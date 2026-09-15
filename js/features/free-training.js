/**
 * js/features/free-training.js
 * Entraînement libre : configuration (type/niveau/nombre/mode/ordre/filtres), session isolée
 * du SRS (flip-card, cloze, QCM), résultats, et les petites stats globales qui lui sont propres
 * (TRAINING_STATS_KEY).
 *
 * buildCardDisplay()/getEntryLabel() sont exportées bien qu'utilisées seulement ici pour
 * l'instant : le monolithe les réutilise aussi dans launchMixedReviewSession() (~ligne 6235,
 * système de révision mixte de l'onglet "Apprendre"/bouton "Réviser aujourd'hui" de l'accueil),
 * pas encore porté (emplacement final pas encore tranché — dashboard.js ou un futur fichier
 * dédié). Quand ce chantier viendra, il devra importer ces deux fonctions D'ICI plutôt que de
 * les redéfinir.
 */

import { state } from '../core/state.js';
import { ALL_JLPT_LEVELS } from '../core/constants.js';
import { pushModalState } from '../core/navigation.js';
import { getKanaFlatList } from '../core/data-loader.js';
import { getSrsInfo, getRawItemsForTypeLevel, makeQueueEntry, getEntryTrackingId } from '../learning/srs.js';
import { updateWeaknessTracking } from '../learning/weakness.js';
import { prepareSessionItem, getPrimaryMeaning } from './vocabulary.js';
import { prepareGrammarSessionItem } from './grammar.js';
import { mdBold, showFicheCorrectionModal, continueFAB, backFAB } from '../ui/common.js';

/* ══════════════════════════════════════════════════
   STATS GLOBALES D'ENTRAÎNEMENT LIBRE (compteurs cumulés, distincts du SRS)
══════════════════════════════════════════════════ */
const TRAINING_STATS_KEY = 'kanji_trad_training_stats';

export function getTrainingStats() {
    const stored = localStorage.getItem(TRAINING_STATS_KEY);
    return stored ? JSON.parse(stored) : { totalSessions: 0, totalAnswered: 0, totalCorrect: 0 };
}
export function saveTrainingStats(s) { localStorage.setItem(TRAINING_STATS_KEY, JSON.stringify(s)); }
export function recordTrainingSession(correct, total) {
    const s = getTrainingStats();
    s.totalSessions++;
    s.totalAnswered += total;
    s.totalCorrect += correct;
    saveTrainingStats(s);
}

/* ══════════════════════════════════════════════════
   ÉCRAN DE CONFIGURATION
══════════════════════════════════════════════════ */
export function showFreeTrainingConfig(isBack = false, preset = null) {
    if (!isBack) history.pushState({ view: 'free-training-config' }, '');
    document.getElementById('page-title').innerText = 'Entraînement libre';
    const presetType = preset?.type || 'all';

    const typeOptions = [
        { id: 'all',     label: 'Tout',         sub: 'Vocabulaire + Grammaire + Kanji + Kana' },
        { id: 'vocab',   label: 'Vocabulaire',  sub: '' },
        { id: 'grammar', label: 'Grammaire',    sub: '' },
        { id: 'kanji',   label: 'Kanji',        sub: '' },
        { id: 'kana',    label: 'Kana',         sub: 'Hiragana / Katakana' }
    ];

    document.getElementById('main-content').innerHTML = `
        <div style="padding:16px 16px 24px">
            <div class="free-training-banner">🏋️ Entraînement libre — sans impact sur tes révisions</div>

            ${presetType === 'all' ? `
            <div class="mode-section-label" style="margin-top:14px">— Contenu</div>
            <div class="ft-radio-group">
                ${typeOptions.map((o) => `
                    <label class="ft-radio-row">
                        <input type="radio" name="ft-type" value="${o.id}" ${o.id === presetType ? 'checked' : ''} onchange="onFreeTrainingTypeChange()">
                        <span class="ft-radio-label">${o.label}</span>
                        ${o.sub ? `<span class="ft-radio-sub">${o.sub}</span>` : ''}
                    </label>
                `).join('')}
            </div>
            ` : `<input type="radio" name="ft-type" value="${presetType}" checked style="display:none">`}

            <div class="mode-section-label" style="margin-top:14px" id="ft-scope-label">— Niveau</div>
            <div id="ft-scope-options" class="ft-radio-group"></div>

            <div class="mode-section-label" style="margin-top:14px">— Nombre de questions</div>
            <div class="ft-radio-group ft-radio-pills">
                ${[10, 20, 50, 0].map(n => `
                    <label class="ft-radio-pill">
                        <input type="radio" name="ft-count" value="${n}" ${n === 10 ? 'checked' : ''}>
                        <span>${n === 0 ? '∞' : n}</span>
                    </label>
                `).join('')}
            </div>

            <div class="mode-section-label" style="margin-top:14px">— Mode</div>
            <div class="ft-radio-group">
                <label class="ft-radio-row">
                    <input type="radio" name="ft-mode" value="normal" checked onchange="onFreeTrainingModeChange()">
                    <span class="ft-radio-label">Entraînement</span>
                    <span class="ft-radio-sub">Corrige à chaque carte</span>
                </label>
                <label class="ft-radio-row">
                    <input type="radio" name="ft-mode" value="blank" onchange="onFreeTrainingModeChange()">
                    <span class="ft-radio-label">Test blanc</span>
                    <span class="ft-radio-sub">Pas de fiche, résultats détaillés à la fin</span>
                </label>
                <label class="ft-radio-row">
                    <input type="radio" name="ft-mode" value="chrono" onchange="onFreeTrainingModeChange()">
                    <span class="ft-radio-label">Chrono</span>
                    <span class="ft-radio-sub">Le plus de cartes possible dans le temps imparti</span>
                </label>
                <label class="ft-radio-row">
                    <input type="radio" name="ft-mode" value="loop" onchange="onFreeTrainingModeChange()">
                    <span class="ft-radio-label">Boucle</span>
                    <span class="ft-radio-sub">Les cartes ratées reviennent dans la session</span>
                </label>
            </div>

            <div id="ft-chrono-duration-wrap" style="display:none">
                <div class="mode-section-label" style="margin-top:14px">— Durée</div>
                <div class="ft-radio-group ft-radio-pills">
                    <label class="ft-radio-pill"><input type="radio" name="ft-chrono-duration" value="60" checked><span>1 min</span></label>
                    <label class="ft-radio-pill"><input type="radio" name="ft-chrono-duration" value="180"><span>3 min</span></label>
                    <label class="ft-radio-pill"><input type="radio" name="ft-chrono-duration" value="300"><span>5 min</span></label>
                </div>
            </div>

            <div class="mode-section-label" style="margin-top:14px">— Filtres</div>
            <div class="ft-radio-group">
                <label class="ft-radio-row"><input type="checkbox" id="ft-filter-never-seen"><span class="ft-radio-label">Uniquement les cartes jamais vues</span></label>
            </div>

            <div class="mode-section-label" style="margin-top:14px">— Ordre</div>
            <div class="ft-radio-group ft-radio-pills">
                <label class="ft-radio-pill"><input type="radio" name="ft-order" value="random" checked><span>Aléatoire</span></label>
                <label class="ft-radio-pill"><input type="radio" name="ft-order" value="sequential"><span>Séquentiel</span></label>
            </div>

            <button class="review-cta-btn" style="width:100%;margin-top:22px" onclick="startFreeTraining()">Commencer →</button>
        </div>`;

    renderFreeTrainingScopeOptions(presetType, preset?.level);
}

export function onFreeTrainingModeChange() {
    const mode = document.querySelector('input[name="ft-mode"]:checked')?.value || 'normal';
    const wrap = document.getElementById('ft-chrono-duration-wrap');
    if (wrap) wrap.style.display = (mode === 'chrono') ? '' : 'none';
}

export function renderFreeTrainingScopeOptions(type, presetLevel = null) {
    const label = document.getElementById('ft-scope-label');
    const container = document.getElementById('ft-scope-options');
    if (!container || !label) return;

    if (type === 'kana') {
        label.textContent = '— Script';
        container.innerHTML = `
            <label class="ft-radio-row"><input type="radio" name="ft-scope" value="both" checked><span class="ft-radio-label">Les deux</span></label>
            <label class="ft-radio-row"><input type="radio" name="ft-scope" value="hira"><span class="ft-radio-label">Hiragana</span></label>
            <label class="ft-radio-row"><input type="radio" name="ft-scope" value="kata"><span class="ft-radio-label">Katakana</span></label>
        `;
    } else {
        label.textContent = '— Niveau';
        const levels = state.jlptMapping
            ? Object.entries(state.jlptMapping.levels).sort((a, b) => a[1].order - b[1].order)
            : ALL_JLPT_LEVELS.map(id => [id, { label: id.toUpperCase(), color: '#00E5FF' }]);
        const preset = presetLevel && levels.some(([id]) => id === presetLevel) ? presetLevel : 'all';
        container.innerHTML = `
            <label class="ft-radio-row"><input type="radio" name="ft-scope" value="all" ${preset === 'all' ? 'checked' : ''}><span class="ft-radio-label">Tous les niveaux</span></label>
            ${levels.map(([id, d]) => `<label class="ft-radio-row"><input type="radio" name="ft-scope" value="${id}" ${preset === id ? 'checked' : ''}><span class="ft-radio-label" style="color:${d.color || 'var(--text)'}">${d.label}</span></label>`).join('')}
        `;
    }
}

export function onFreeTrainingTypeChange() {
    const type = document.querySelector('input[name="ft-type"]:checked')?.value || 'all';
    renderFreeTrainingScopeOptions(type);
}

// Pool complet (pas de filtre due/fresh, contrairement à buildReviewQueue) pour un ensemble de
// types/niveaux/scripts donné. Réutilise les mêmes fonctions de lecture de données que
// buildReviewQueue pour rester cohérent avec le reste de l'app.
async function buildTrainingPool({ types, levels, kanaScripts }) {
    const pool = [];
    for (const type of types.filter(t => t !== 'kana')) {
        for (const level of levels) {
            const items = await getRawItemsForTypeLevel(type, level);
            items.forEach(it => {
                const entry = makeQueueEntry(type, level, it, false);
                // Variété d'exercices (cloze/QCM/flashcard), comme en révision normale.
                if (type === 'vocab') {
                    const prepared = prepareSessionItem(it, items);
                    entry.exercise = { type: prepared.type, clozeInfo: prepared.clozeInfo, qcmInfo: prepared.qcmInfo };
                } else if (type === 'grammar') {
                    const prepared = prepareGrammarSessionItem(it, items);
                    entry.exercise = { type: prepared.type, clozeInfo: prepared.clozeInfo };
                }
                pool.push(entry);
            });
        }
    }
    if (types.includes('kana')) {
        for (const script of kanaScripts) {
            const items = getKanaFlatList(script);
            items.forEach(it => pool.push(makeQueueEntry('kana', script, it, false)));
        }
    }
    return pool;
}

export async function startFreeTraining() {
    const type = document.querySelector('input[name="ft-type"]:checked')?.value || 'all';
    const scope = document.querySelector('input[name="ft-scope"]:checked')?.value || 'all';
    const countRaw = document.querySelector('input[name="ft-count"]:checked')?.value ?? '10';
    const mode = document.querySelector('input[name="ft-mode"]:checked')?.value || 'normal';
    const chronoDuration = parseInt(document.querySelector('input[name="ft-chrono-duration"]:checked')?.value || '60', 10);
    const order = document.querySelector('input[name="ft-order"]:checked')?.value || 'random';
    const neverSeenOnly = document.getElementById('ft-filter-never-seen')?.checked || false;

    let targetCount = countRaw === '0' ? null : parseInt(countRaw, 10);
    if (mode === 'chrono') targetCount = null;

    let types, levels, kanaScripts;
    if (type === 'kana') {
        types = ['kana']; levels = [];
        kanaScripts = scope === 'both' ? ['hira', 'kata'] : [scope];
    } else if (type === 'all') {
        types = ['vocab', 'grammar', 'kanji', 'kana'];
        levels = scope === 'all' ? ALL_JLPT_LEVELS : [scope];
        kanaScripts = ['hira', 'kata'];
    } else {
        types = [type];
        levels = scope === 'all' ? ALL_JLPT_LEVELS : [scope];
        kanaScripts = [];
    }

    let pool = await buildTrainingPool({ types, levels, kanaScripts });
    if (neverSeenOnly) {
        pool = pool.filter(entry => !getSrsInfo(getEntryTrackingId(entry)));
    }
    if (pool.length === 0) {
        alert('Aucun contenu disponible pour cette sélection.');
        return;
    }

    launchFreeTraining(pool, targetCount, {
        type, scope, countRaw, mode, order, neverSeenOnly,
        chronoDuration: mode === 'chrono' ? chronoDuration : null
    });
}

/* ══════════════════════════════════════════════════
   SESSION D'ENTRAÎNEMENT
   ─────────────────────────────────────────────────
   trainingSession/trainingChronoInterval vivent dans state.* (pas des variables locales) :
   core/navigation.js::closeAllOverlaysAndSessions() les lit et les nettoie déjà (placeholders
   réservés depuis le portage de navigation.js) — même raison que kanaTraceState pour kana.js.
══════════════════════════════════════════════════ */
export function launchFreeTraining(pool, targetCount, config) {
    pushModalState('free-training-session');
    if (state.trainingChronoInterval) { clearInterval(state.trainingChronoInterval); state.trainingChronoInterval = null; }

    const mode = (config && config.mode) || 'normal';
    const order = (config && config.order) || 'random';

    state.trainingSession = {
        pool, config, targetCount, mode, order,
        queue: [], index: 0, seqCursor: 0,
        correct: 0, wrong: 0, mistakes: [],
        flipped: false, quizAnswered: false, quizSelected: null,
        chronoRemaining: (config && config.chronoDuration) || null
    };
    document.getElementById('main-content').innerHTML = `<div id="category-content" style="padding:16px"></div>`;

    if (mode === 'chrono' && state.trainingSession.chronoRemaining) {
        state.trainingChronoInterval = setInterval(() => {
            if (!state.trainingSession) { clearInterval(state.trainingChronoInterval); state.trainingChronoInterval = null; return; }
            state.trainingSession.chronoRemaining--;
            if (state.trainingSession.chronoRemaining <= 0) {
                clearInterval(state.trainingChronoInterval);
                state.trainingChronoInterval = null;
                endTrainingSession();
            } else {
                renderTrainingScreen();
            }
        }, 1000);
    }

    renderTrainingScreen();
}

// Tire (ou retrouve) la carte courante. Mode fini : s'arrête à targetCount. Mode infini
// (targetCount=null) : tire indéfiniment jusqu'à fermeture ou fin du chrono. Ordre aléatoire :
// anti-répétition simple (jamais 2x la même carte d'affilée). Ordre séquentiel : parcourt le
// pool dans son ordre naturel, en boucle.
function trainingEnsureNextItem() {
    const s = state.trainingSession;
    if (!s) return null;
    if (s.index < s.queue.length) return s.queue[s.index];
    if (s.targetCount && s.queue.length >= s.targetCount) return null;
    if (!s.pool.length) return null;

    let candidate;
    if (s.order === 'sequential') {
        candidate = s.pool[s.seqCursor % s.pool.length];
        s.seqCursor++;
    } else {
        let attempts = 0;
        do {
            candidate = s.pool[Math.floor(Math.random() * s.pool.length)];
            attempts++;
        } while (s.pool.length > 1 && s.queue.length > 0 &&
                 getEntryTrackingId(candidate) === getEntryTrackingId(s.queue[s.queue.length - 1]) &&
                 attempts < 10);
    }

    s.queue.push(candidate);
    return candidate;
}

/**
 * Rendu générique carte recto/verso pour vocab/grammaire/kanji/kana — utilisée ici ET (une
 * fois porté) par le futur système de révision mixte. Voir en-tête de fichier.
 */
export function buildCardDisplay(entry) {
    let front = '', back = '', typeLabel = '', frontSize = 36;

    if (entry.type === 'vocab') {
        const w = entry.item;
        typeLabel = '📚 Vocabulaire';
        front = w.word || '';
        back = `<div class="review-romaji">${w.reading || ''} · ${w.romaji || ''}</div><div class="review-meaning">${mdBold(getPrimaryMeaning(w))}</div>`;
    } else if (entry.type === 'grammar') {
        const l = entry.item;
        typeLabel = '📝 Grammaire';
        front = l.item || l.pattern || '';
        frontSize = 28;
        back = `<div class="review-reading">${l.title || ''}</div><div class="review-romaji">${l.pattern || ''}</div>`;
    } else if (entry.type === 'kanji') {
        const char = entry.item.char;
        const kanjiData = state.data.kanjiDb.find(k => k.char === char);
        typeLabel = '🔤 Kanji';
        front = char;
        frontSize = 56;
        const meanings = (kanjiData?.meanings || []).filter(m => !m.toLowerCase().includes('radical'));
        const on = kanjiData?.on || [];
        const kun = kanjiData?.kun || [];
        back = `${on.length ? `<div class="review-romaji">On : ${on.slice(0, 3).join('、')}</div>` : ''}${kun.length ? `<div class="review-romaji">Kun : ${kun.slice(0, 3).join('、')}</div>` : ''}<div class="review-meaning">${meanings.slice(0, 3).join(' / ') || '–'}</div>`;
    } else if (entry.type === 'kana') {
        const k = entry.item;
        typeLabel = (entry.level === 'kata') ? 'ア Katakana' : 'あ Hiragana';
        front = k.char || '';
        frontSize = 56;
        back = `<div class="review-meaning">${k.romaji || ''}</div>`;
    }

    return { front, back, typeLabel, frontSize };
}

// Libellé court et lisible d'une entrée générique { type, item } — utilisé par le widget "À
// renforcer" (via updateWeaknessTracking ici) et le mode Test blanc pour afficher quelque
// chose de compréhensible sans avoir à tout re-résoudre.
export function getEntryLabel(entry) {
    if (entry.type === 'vocab')   return entry.item.word || entry.item.id;
    if (entry.type === 'grammar') return entry.item.item || entry.item.pattern || entry.item.id;
    if (entry.type === 'kanji')   return entry.item.char;
    if (entry.type === 'kana')    return entry.item.char || entry.item.c;
    return '';
}

// Équivalent du onclick="showFicheCorrectionModal(trainingSession.queue[trainingSession.index])"
// du monolithe — adapté car state.trainingSession est une propriété d'import de module,
// inaccessible depuis un attribut onclick. Même principe que replayKanaTraceQuiz (kana.js).
export function openTrainingCurrentFiche() {
    if (!state.trainingSession) return;
    const entry = state.trainingSession.queue[state.trainingSession.index];
    if (entry) showFicheCorrectionModal(entry);
}

export function renderTrainingScreen() {
    const container = document.getElementById('category-content');
    const s = state.trainingSession;
    if (!s) return;
    if (!container) {
        // L'utilisateur a quitté via la bottom-nav (toujours cliquable, pas de cleanup
        // automatique) : le conteneur de session n'existe plus, on arrête le minuteur.
        if (state.trainingChronoInterval) { clearInterval(state.trainingChronoInterval); state.trainingChronoInterval = null; }
        state.trainingSession = null;
        return;
    }

    const entry = trainingEnsureNextItem();
    if (!entry) { renderTrainingResults(); return; }

    const { front, back, typeLabel, frontSize } = buildCardDisplay(entry);

    let progressText, progressFill;
    if (s.mode === 'chrono') {
        const total = (s.config && s.config.chronoDuration) || 60;
        const elapsed = total - s.chronoRemaining;
        const m = Math.floor(s.chronoRemaining / 60), sec = s.chronoRemaining % 60;
        progressText = `⏱ ${m}:${String(sec).padStart(2, '0')}`;
        progressFill = `<div class="review-progress-fill" style="width:${(elapsed / total) * 100}%"></div>`;
    } else {
        progressText = s.targetCount ? `${s.index + 1} / ${s.targetCount}` : `${s.index + 1}`;
        progressFill = s.targetCount ? `<div class="review-progress-fill" style="width:${(s.index / s.targetCount) * 100}%"></div>` : '';
    }

    const modeBanner = {
        normal: '🏋️ Sans impact sur tes révisions',
        blank:  '📝 Mode Test — résultats détaillés à la fin',
        chrono: '⏱ Mode Chrono — sans impact sur tes révisions',
        loop:   '🔁 Mode Boucle — les cartes ratées reviennent'
    }[s.mode] || '🏋️ Sans impact sur tes révisions';

    // En Test blanc, pas de fiche accessible pendant la question : conditions d'examen.
    const ficheBtn = (s.mode !== 'blank')
        ? `<button class="fiche-correction-btn" onclick="openTrainingCurrentFiche()">📖 Voir la fiche</button>`
        : '';

    const headerHtml = `${backFAB('endTrainingSession()', '✕')}
        <div class="review-header">
            <div class="review-progress-bar">${progressFill}</div>
            <div class="review-progress-text">${progressText}</div>
        </div>
        <div class="free-training-banner small">${modeBanner}</div>`;

    // Variété d'exercices : cloze/QCM utilisent leur propre écran interactif, le reste
    // (kanji, kana, flashcard) garde le flip-card classique ci-dessous.
    const exercise = entry.exercise;
    if (exercise && (exercise.type === 'cloze' || exercise.type === 'qcm')) {
        renderTrainingQuizExercise(container, headerHtml, entry, exercise);
        return;
    }

    container.innerHTML = `<div class="review-page">
        ${headerHtml}
        <div class="review-type-tag">${typeLabel}</div>
        <div class="review-card ${s.flipped ? 'flipped' : ''}" onclick="${s.flipped ? '' : 'flipTrainingCard()'}">
            <div class="review-card-front">
                <div class="review-word" style="font-size:${frontSize}px;">${front}</div>
            </div>
            ${s.flipped ? `<div class="review-card-back">${back}${ficheBtn}</div>` : `<div class="review-tap-hint">Touche la carte pour révéler</div>`}
        </div>
        ${s.flipped ? `
            <div class="review-grade-buttons ft-grade-buttons">
                <button class="grade-btn grade-again" onclick="answerTrainingCard(false)">✘ Incorrect</button>
                <button class="grade-btn grade-easy" onclick="answerTrainingCard(true)">✔ Correct</button>
            </div>
        ` : ''}
    </div>`;
}

// Rendu de l'exercice cloze (particule à trous) ou QCM (sens du mot, vocab) en entraînement
// libre — auto-noté au clic, comme en révision normale.
function renderTrainingQuizExercise(container, headerHtml, entry, exercise) {
    const s = state.trainingSession;
    const answered = s.quizAnswered;
    const selected = s.quizSelected;
    let bodyHtml = '';

    if (exercise.type === 'cloze') {
        const word = entry.item;
        const clozeInfo = exercise.clozeInfo;
        const sentenceHtml = clozeInfo.tokens.map((tok, i) => {
            if (i !== clozeInfo.blankIndex) return `<span>${tok}</span>`;
            if (!answered) return `<span class="cloze-blank">＿＿</span>`;
            const cls = selected === clozeInfo.correct ? 'cloze-blank-filled correct' : 'cloze-blank-filled incorrect';
            return `<span class="${cls}">${selected}</span>`;
        }).join(' ');
        bodyHtml = `
            <div class="review-card review-cloze-card">
                <div class="review-quiz-instruction">Complète la phrase avec la bonne particule</div>
                <div class="cloze-sentence">${sentenceHtml}</div>
                <div class="review-romaji">${word.romaji || ''}</div>
                <div class="review-example-fr-only">${mdBold((word.example && word.example.french) || '')}</div>
            </div>
            <div class="review-options review-options-particles">
                ${clozeInfo.options.map(opt => {
                    let cls = 'review-option-btn';
                    if (answered) { if (opt === clozeInfo.correct) cls += ' correct'; else if (opt === selected) cls += ' incorrect'; }
                    return `<button class="${cls}" ${answered ? 'disabled' : ''} onclick="submitTrainingQuizAnswer('${opt}')">${opt}</button>`;
                }).join('')}
            </div>
            ${(answered && selected !== clozeInfo.correct && word.nuance) ? `<div class="vocab-nuance-box" style="margin-top:14px;text-align:left">💡 ${mdBold(word.nuance)}</div>` : ''}
        `;
    } else { // qcm (vocab uniquement)
        const word = entry.item;
        const qcmInfo = exercise.qcmInfo;
        bodyHtml = `
            <div class="review-card review-qcm-card">
                <div class="review-word">${word.word || ''}</div>
                <div class="review-reading">${word.reading || ''}</div>
                <div class="review-quiz-instruction">Quel est le sens de ce mot ?</div>
            </div>
            <div class="review-options">
                ${qcmInfo.options.map(opt => {
                    let cls = 'review-option-btn';
                    if (answered) { if (opt === qcmInfo.correct) cls += ' correct'; else if (opt === selected) cls += ' incorrect'; }
                    return `<button class="${cls}" ${answered ? 'disabled' : ''} onclick="submitTrainingQuizAnswer('${opt.replace(/'/g, "\\'")}')">${mdBold(opt)}</button>`;
                }).join('')}
            </div>
        `;
    }

    container.innerHTML = `<div class="review-page">
        ${headerHtml}
        ${bodyHtml}
        ${answered ? continueFAB('advanceTrainingQuiz()') : ''}
    </div>`;
}

export function submitTrainingQuizAnswer(selected) {
    const s = state.trainingSession;
    if (!s || s.quizAnswered) return;
    const entry = s.queue[s.index];
    const exercise = entry.exercise;
    if (!exercise) return;
    const correct = exercise.type === 'cloze' ? exercise.clozeInfo.correct : exercise.qcmInfo.correct;
    const isCorrect = selected === correct;

    s.quizAnswered = true;
    s.quizSelected = selected;

    if (isCorrect) {
        s.correct++;
    } else {
        s.wrong++;
        s.mistakes.push(entry);
        if (s.mode === 'loop') s.pool.push(entry);
    }
    if (s.config && s.config.type === 'weakness') {
        updateWeaknessTracking(getEntryTrackingId(entry), isCorrect ? 2 : 0, { type: entry.type, label: getEntryLabel(entry) });
    }
    renderTrainingScreen();
}

export function advanceTrainingQuiz() {
    const s = state.trainingSession;
    if (!s) return;
    s.index++;
    s.quizAnswered = false;
    s.quizSelected = null;
    renderTrainingScreen();
}

export function flipTrainingCard() {
    if (!state.trainingSession) return;
    state.trainingSession.flipped = true;
    renderTrainingScreen();
}

// answerTrainingCard() n'appelle JAMAIS gradeReview() — c'est tout le principe de
// l'isolation vis-à-vis du SRS. Mode Boucle : une carte ratée est remise dans le pool, donc
// repiochable plus tard dans la MÊME session (l'anti-répétition immédiate de
// trainingEnsureNextItem empêche qu'elle revienne littéralement à la question suivante).
// Exception ciblée : si la session vient du widget "À renforcer" (config.type === 'weakness'),
// la réponse met à jour le tracker de faiblesse (updateWeaknessTracking) — sinon s'entraîner
// dessus ne ferait jamais disparaître un item du widget, même à 100% de réussite.
export function answerTrainingCard(isCorrect) {
    const s = state.trainingSession;
    if (!s) return;
    const entry = s.queue[s.index];
    if (isCorrect) {
        s.correct++;
    } else {
        s.wrong++;
        s.mistakes.push(entry);
        if (s.mode === 'loop') s.pool.push(entry);
    }
    if (s.config && s.config.type === 'weakness') {
        updateWeaknessTracking(getEntryTrackingId(entry), isCorrect ? 2 : 0, { type: entry.type, label: getEntryLabel(entry) });
    }
    s.index++;
    s.flipped = false;
    s.quizAnswered = false;
    s.quizSelected = null;
    renderTrainingScreen();
}

// Fermer manuellement (utile en mode infini/chrono, sans fin naturelle par compte de cartes)
// — affiche les résultats avec ce qui a été répondu jusqu'ici.
export function endTrainingSession() {
    if (!state.trainingSession) return;
    renderTrainingResults();
}

export function renderTrainingResults() {
    const s = state.trainingSession;
    if (!s) return;
    if (state.trainingChronoInterval) { clearInterval(state.trainingChronoInterval); state.trainingChronoInterval = null; }

    const container = document.getElementById('category-content');
    if (!container) { state.trainingSession = null; return; }
    const total = s.correct + s.wrong;
    const pct = total > 0 ? Math.round((s.correct / total) * 100) : 0;

    recordTrainingSession(s.correct, total);

    // Test blanc : détail carte par carte, seulement révélé maintenant.
    const detailHtml = (s.mode === 'blank' && s.queue.length > 0) ? `
        <div class="ft-results-detail">
            ${s.queue.slice(0, s.index).map(entry => {
                const isWrong = s.mistakes.includes(entry);
                return `<div class="ft-result-row ${isWrong ? 'wrong' : 'ok'}">
                    <span>${isWrong ? '✘' : '✔'}</span>
                    <span>${getEntryLabel(entry)}</span>
                </div>`;
            }).join('')}
        </div>
    ` : '';

    container.innerHTML = `<div class="review-summary">
        <div class="review-summary-title">Entraînement terminé ! 🏋️</div>
        <div class="review-summary-count">${total} carte${total > 1 ? 's' : ''} pratiquée${total > 1 ? 's' : ''}</div>
        <div class="review-summary-stats">
            <div class="review-stat"><span class="review-stat-dot easy"></span>Correct : ${s.correct}</div>
            <div class="review-stat"><span class="review-stat-dot again"></span>Incorrect : ${s.wrong}</div>
            <div class="review-stat">${pct}% de réussite</div>
        </div>
        ${detailHtml}
        <div class="quiz-btn-row" style="margin-top:20px">
            <button class="quiz-action-btn secondary" onclick="history.back()">Fermer</button>
            ${s.mistakes.length > 0 ? `<button class="quiz-action-btn primary" onclick="retrainMistakes()">Refaire mes erreurs (${s.mistakes.length})</button>` : ''}
        </div>
    </div>`;
}

export function retrainMistakes() {
    const s = state.trainingSession;
    if (!s || !s.mistakes.length) return;
    launchFreeTraining([...s.mistakes], s.mistakes.length, s.config);
}
