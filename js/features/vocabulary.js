/**
 * js/features/vocabulary.js
 * Liste vocabulaire par niveau, fiche détail, et système de révision (flashcard + QCM +
 * trou à combler + SRS) — le moteur de révision générique est PARTAGÉ avec la grammaire
 * dans le monolithe (mêmes noms de fonctions génériques comme submitQuizAnswer), mais les
 * DEUX systèmes (vocab et grammaire) ont chacun leur propre reviewSession/grammarReviewSession
 * et leurs propres fonctions dans le monolithe réel (pas un seul moteur partagé au niveau du
 * code, malgré l'apparence) — vocabulary.js ne porte donc QUE la branche vocab ici,
 * features/grammar.js portera sa propre branche séparément (buildGrammarCloze, etc.).
 */

import { state } from '../core/state.js';
import { ALL_JLPT_LEVELS } from '../core/constants.js';
import { getItemStatus, trackItem } from '../core/storage.js';
import { getVocabExtraExamples, getLevelGrammarData, kanaToRomaji } from '../core/data-loader.js';
import { pushModalState } from '../core/navigation.js';
import { buildDueQueue, countDueItems, getSrsConfidencePct, gradeReview, scheduleRelearning, recordSessionCompleted, shuffleArray } from '../learning/srs.js';
import { openDetail, stripRubyForSpeech } from './kanji.js';
import { speakText } from './oral.js';
import { mdBold, stripRtTags, extractReadingFromRawRt, buildCleanToRawIndexMap, showFicheCorrectionModal, isBulkSelected, handleListItemClick, toggleCategoryMasteryLive, enterBulkSelectMode, buildSpeakableExampleHtml } from '../ui/common.js';

const VOCAB_CATEGORY_MAP = {
    'action': '🎬 Action', 'color': '🎨 Couleurs', 'descriptor': '✨ Descripteurs',
    'nature': '🌿 Nature', 'time': '⏰ Temps', 'food': '🍜 Nourriture', 'body': '🏃 Corps',
    'weather': '⛅ Météo', 'direction': '🧭 Directions', 'people': '👥 Personnes',
    'family': '👨‍👩‍👧‍👦 Famille', 'place': '🏠 Lieux', 'object': '📦 Objets', 'state': '💫 État',
    'communication': '💬 Communication', 'movement': '🚶 Mouvement', 'question': '❓ Questions',
    'interrogative': '❓ Interrogatifs', 'number': '🔢 Nombres', 'animal': '🐶 Animaux',
    'abstract': '🧠 Concepts', 'art': '🎭 Arts', 'language': '🗣️ Langues',
    'clothing': '👕 Vêtements', 'phrase': '💭 Expressions', 'grammar': '📚 Grammaire'
};

/* ══════════════════════════════════════════════════
   RÉVISION VOCABULAIRE (flashcard + QCM + trou à combler + SRS)
══════════════════════════════════════════════════ */
let reviewSession = null; // { queue: [{word, type, clozeInfo, qcmInfo}], index, results, flipped, answered, selected }

export const COMMON_PARTICLES = ['は', 'が', 'を', 'に', 'で', 'と', 'へ', 'も', 'から', 'まで', 'の'];

export function getPrimaryMeaning(word) {
    const m = word.meanings;
    if (m && typeof m === 'object' && !Array.isArray(m)) return m.primary || 'Sens';
    if (Array.isArray(m)) return m[0] || 'Sens';
    return m || 'Sens';
}

// Génère un exercice "trou à combler" à partir du MOT lui-même dans sa phrase d'exemple.
// Pioche au hasard parmi l'exemple canonique (word.example) et les exemples supplémentaires
// éventuels d'exemples.json.
function buildVocabWordCloze(word, pool) {
    const levelId = (word.level || '').toLowerCase();
    const extras = getVocabExtraExamples(levelId, word.id);
    const allExamples = [word.example, ...extras].filter(e => e && e.japanese);
    if (!allExamples.length) return null;
    const ex = allExamples[Math.floor(Math.random() * allExamples.length)];

    const highlightIsArray = Array.isArray(ex.highlight);
    const target = (highlightIsArray ? ex.highlight[0] : ex.highlight) || word.word;
    const targetRomajiExact = highlightIsArray ? ex.highlight[1] : null;
    if (!target) return null;

    const rawJp = ex.japanese;
    const cleanJp = stripRtTags(rawJp);
    const cleanIdx = cleanJp.indexOf(target);
    if (cleanIdx === -1) return null;

    const map = buildCleanToRawIndexMap(rawJp);
    const rawStart = map[cleanIdx];
    const lastCleanIdx = cleanIdx + target.length - 1;
    const rawEnd = (lastCleanIdx + 1 < map.length) ? map[lastCleanIdx + 1] : rawJp.length;

    const rawBefore = rawJp.slice(0, rawStart);
    const rawTarget = rawJp.slice(rawStart, rawEnd);
    const rawAfter = rawJp.slice(rawEnd);

    const targetReading = extractReadingFromRawRt(rawTarget);
    const targetRomaji = targetRomajiExact || (targetReading ? kanaToRomaji(targetReading) : (word.romaji || ''));

    const distractorPool = pool.filter(w => w.id !== word.id && w.word && w.word !== target);
    if (distractorPool.length < 2) return null;
    const distractorWords = shuffleArray(distractorPool).slice(0, 3);
    const options = shuffleArray([
        { word: target, romaji: targetRomaji, reading: targetReading },
        ...distractorWords.map(w => ({ word: w.word, romaji: w.romaji || '', reading: w.reading || '' }))
    ]);

    const tokens = [autoWrapRubyLocal(rawBefore), target, autoWrapRubyLocal(rawAfter)];

    const sentenceRomaji = ex.romaji || '';
    let sentenceRomajiMasked = null;
    if (targetRomajiExact && sentenceRomaji) {
        const rIdx = sentenceRomaji.toLowerCase().indexOf(targetRomajiExact.toLowerCase());
        if (rIdx !== -1) {
            sentenceRomajiMasked = sentenceRomaji.slice(0, rIdx) + '＿＿＿' + sentenceRomaji.slice(rIdx + targetRomajiExact.length);
        }
    }

    return {
        tokens, blankIndex: 1, correct: target, options, french: ex.french || '',
        sentenceRomaji, sentenceRomajiMasked, targetReading
    };
}

// autoWrapRuby n'est pas exportée par ui/common.js (utilitaire interne à mdBold) — équivalent
// local minimal, identique au monolithe, pour ne pas exporter inutilement une fonction interne
// depuis un autre module juste pour cet unique usage.
function autoWrapRubyLocal(str) {
    if (!str || !str.includes('<rt>')) return str || '';
    return str.replace(/([\u4e00-\u9faf]+)(<rt>.*?<\/rt>)/g, '<ruby>$1$2</ruby>');
}

function buildClozeParticle(word) {
    const particles = word.particles || [];
    const jp = (word.example && word.example.japanese) || '';
    const tokens = jp.split(/\s+/).filter(Boolean);
    const validParticle = particles.find(p => tokens.includes(p));
    if (!validParticle) return null;

    const blankIndex = tokens.indexOf(validParticle);
    const distractorPool = COMMON_PARTICLES.filter(p => p !== validParticle);
    const distractors = shuffleArray(distractorPool).slice(0, 3);
    const options = shuffleArray([validParticle, ...distractors]).map(p => ({ word: p, romaji: '' }));

    return { tokens, blankIndex, correct: validParticle, options };
}

// Génère un QCM sur le sens du mot, avec 3 distracteurs pris ailleurs dans le pool
export function buildMeaningQCM(word, pool) {
    const primary = getPrimaryMeaning(word);
    const others = pool.filter(w => w.id !== word.id && getPrimaryMeaning(w) && getPrimaryMeaning(w) !== primary);
    if (others.length < 3) return null;

    const distractors = shuffleArray(others).slice(0, 3).map(getPrimaryMeaning);
    const options = shuffleArray([primary, ...distractors]);
    return { correct: primary, options };
}

export function prepareSessionItem(word, pool, forceMode = null) {
    const clozeInfo = buildVocabWordCloze(word, pool) || buildClozeParticle(word);
    const qcmInfo = buildMeaningQCM(word, pool);

    let type = 'flashcard';
    if (forceMode === 'flashcard') {
        type = 'flashcard';
    } else if (forceMode === 'quiz') {
        type = clozeInfo ? 'cloze' : (qcmInfo ? 'qcm' : 'flashcard');
    } else {
        const r = Math.random();
        if (clozeInfo && r < 0.35) type = 'cloze';
        else if (qcmInfo && r < 0.7) type = 'qcm';
    }

    return { word, type, clozeInfo, qcmInfo };
}

/**
 * ⚠️ ATTENTION : showFreeTrainingConfig existe réellement dans features/free-training.js, mais y importer créerait un cycle (confirmé).
 * Vrai appel JS non importé (dans le bouton "Entraînement libre").
 */
export function showVocabReviewModeSelector() {
    const container = document.getElementById('category-content');
    const data = state.vocabHomeData?.data || [];
    const dueWords = buildDueQueue(data);

    if (dueWords.length === 0) {
        alert('Rien à réviser pour le moment ! 🎉');
        return;
    }

    pushModalState('vocab-review-selector');

    container.innerHTML = `
        <div class="review-mode-selector">
            <button class="back-btn" onclick="history.back()">←</button>
            <div class="review-mode-title">Choisis ton mode de révision</div>
            <div class="review-mode-count">${dueWords.length} mot${dueWords.length > 1 ? 's' : ''} à revoir</div>

            <button class="review-mode-btn" onclick="startVocabReview()">
                <span class="review-mode-icon">🎲</span>
                <div><div class="review-mode-name">Mixte</div><div class="review-mode-desc">Flashcard, trous et QCM mélangés</div></div>
            </button>
            <button class="review-mode-btn" onclick="startVocabReview('flashcard')">
                <span class="review-mode-icon">🗂️</span>
                <div><div class="review-mode-name">Flashcard</div><div class="review-mode-desc">Lecture et sens, auto-évalué</div></div>
            </button>
            <button class="review-mode-btn" onclick="startVocabReview('quiz')">
                <span class="review-mode-icon">✍️</span>
                <div><div class="review-mode-name">Quiz actif</div><div class="review-mode-desc">Trous et QCM uniquement</div></div>
            </button>
            <button class="review-mode-btn" onclick="startVocabFreeTrainingFromSelector()">
                <span class="review-mode-icon">🏋️</span>
                <div><div class="review-mode-name">Entraînement libre</div><div class="review-mode-desc">Configurable, sans impact sur le SRS</div></div>
            </button>
        </div>`;
}

// Équivalent du onclick="showFreeTrainingConfig(false, {type:'vocab', level: vocabHomeData
// ?.levelId})" du monolithe — adapté car state.vocabHomeData est une propriété d'import de
// module, inaccessible depuis un attribut onclick. Bug trouvé et corrigé lors de la
// revérification finale (session app.js) : l'onclick original référençait vocabHomeData en
// bare (sans state.), copié tel quel du monolithe où c'était une vraie globale — ne
// fonctionnait pas en ESM. ⚠️ ATTENTION : showFreeTrainingConfig (features/free-training.js)
// reste un vrai appel JS non importé (cycle confirmé, voir HANDOFF.md).
export function startVocabFreeTrainingFromSelector() {
    showFreeTrainingConfig(false, { type: 'vocab', level: state.vocabHomeData?.levelId });
}

// Équivalent des onclick="displayVocabList('${levelId}', vocabHomeData.data, vocabHomeData
// .examples, true)" du monolithe (bouton "Sélectionner" et bouton retour de la fiche détail)
// — bug trouvé et corrigé : vocabHomeData/currentLevelId référencés en bare dans plusieurs
// onclick, copiés tels quels du monolithe où c'étaient de vraies globales. Relit
// systématiquement depuis state.* au moment du clic (pas de paramètres figés à l'écriture du
// HTML), donc reste correct même après un changement de niveau entre-temps.
export function refreshVocabList(isBack = true) {
    if (!state.vocabHomeData) return;
    displayVocabList(state.currentLevelId, state.vocabHomeData.data, state.vocabHomeData.examples, isBack);
}

// Équivalent des onclick="showVocabDetail('${word.id}', vocabHomeData.data)" du monolithe
// (carte de la liste, bouton favori, bouton maîtrisé) — même correction que ci-dessus.
export function openVocabDetailFromState(wordId) {
    if (!state.vocabHomeData) return;
    showVocabDetail(wordId, state.vocabHomeData.data);
}

export function startVocabReview(forceMode = null) {
    const data = state.vocabHomeData?.data || [];
    const dueWords = buildDueQueue(data);

    if (dueWords.length === 0) {
        alert('Rien à réviser pour le moment ! 🎉');
        return;
    }

    const queue = dueWords.map(w => prepareSessionItem(w, data, forceMode));

    pushModalState('vocab-review');

    reviewSession = {
        queue, index: 0,
        results: { again: 0, hard: 0, good: 0, easy: 0 },
        flipped: false, answered: false, selected: null
    };
    document.getElementById('main-content').innerHTML = `<div id="category-content" style="padding:16px"></div>`;
    renderReviewScreen();
}

export function renderReviewScreen() {
    const container = document.getElementById('category-content');
    const session = reviewSession;

    if (!session || session.index >= session.queue.length) {
        renderReviewSummary();
        return;
    }

    const entry = session.queue[session.index];
    const { type } = entry;
    const progress = session.index + 1;
    const total = session.queue.length;

    let bodyHtml = '';
    if (type === 'cloze') {
        bodyHtml = renderClozeExercise(entry, session);
    } else if (type === 'qcm') {
        bodyHtml = renderQcmExercise(entry, session);
    } else {
        bodyHtml = renderFlashcardExercise(entry, session);
    }

    container.innerHTML = `<div class="review-page">
        <div class="review-header">
            <button class="back-btn" onclick="history.back()">✕</button>
            <div class="review-progress-bar"><div class="review-progress-fill" style="width:${(session.index / total) * 100}%"></div></div>
            <div class="review-progress-text">${progress} / ${total}</div>
        </div>
        ${bodyHtml}
    </div>`;
}

// ── FLASHCARD (rappel libre, auto-évalué par l'utilisateur) ──
function renderFlashcardExercise(entry, session) {
    const { word } = entry;
    const primaryMeaning = getPrimaryMeaning(word);
    const flipped = session.flipped;

    return `
        <div class="review-card ${flipped ? 'flipped' : ''}" onclick="${flipped ? '' : 'flipReviewCard()'}">
            <div class="review-card-front">
                <div class="review-word">${word.word || ''}</div>
                ${flipped ? `<div class="review-reading">${word.reading || ''}</div>` : ''}
            </div>
            ${flipped ? `
                <div class="review-card-back">
                    <div class="review-romaji">${word.romaji || ''}</div>
                    <div class="review-meaning">${mdBold(primaryMeaning)}</div>
                    ${word.example && word.example.japanese ? `
                        <div class="review-example">
                            <div class="example-jp">${mdBold(word.example.japanese)}</div>
                            <div class="example-fr">${mdBold(word.example.french || '')}</div>
                        </div>
                    ` : ''}
                </div>
            ` : `<div class="review-tap-hint">Touche la carte pour révéler</div>`}
        </div>
        ${flipped ? `
            <div class="review-grade-buttons">
                <button class="grade-btn grade-again" onclick="submitReviewGrade(0)">Encore</button>
                <button class="grade-btn grade-hard" onclick="submitReviewGrade(1)">Difficile</button>
                <button class="grade-btn grade-good" onclick="submitReviewGrade(2)">Bien</button>
                <button class="grade-btn grade-easy" onclick="submitReviewGrade(3)">Facile</button>
            </div>
        ` : ''}
    `;
}

// ── QCM (reconnaissance du sens) ──
function renderQcmExercise(entry, session) {
    const { word, qcmInfo } = entry;
    const answered = session.answered;
    const selected = session.selected;

    return `
        <div class="review-card review-qcm-card">
            <div class="review-word">${word.word || ''}</div>
            <div class="review-reading">${word.reading || ''}</div>
            <div class="review-quiz-instruction">Quel est le sens de ce mot ?</div>
        </div>
        <div class="review-options">
            ${qcmInfo.options.map(opt => {
                let cls = 'review-option-btn';
                if (answered) {
                    if (opt === qcmInfo.correct) cls += ' correct';
                    else if (opt === selected) cls += ' incorrect';
                }
                return `<button class="${cls}" ${answered ? 'disabled' : ''} onclick="submitQuizAnswer('${opt.replace(/'/g, "\\'")}')">${mdBold(opt)}</button>`;
            }).join('')}
        </div>
        ${answered ? `<button class="review-continue-btn" onclick="advanceReviewQueue()">Continuer →</button>` : ''}
    `;
}

// ── CLOZE (trou à combler) ──
function renderClozeExercise(entry, session) {
    const { word, clozeInfo } = entry;
    const answered = session.answered;
    const selected = session.selected;

    const sentenceHtml = clozeInfo.tokens.map((tok, i) => {
        if (i === clozeInfo.blankIndex) {
            if (!answered) return `<span class="cloze-blank">＿＿</span>`;
            const isCorrect = selected === clozeInfo.correct;
            const cls = isCorrect ? 'cloze-blank-filled correct' : 'cloze-blank-filled incorrect';
            const reading = isCorrect ? clozeInfo.targetReading : '';
            return `<span class="${cls}">${reading ? `<ruby>${selected}<rt>${reading}</rt></ruby>` : selected}</span>`;
        }
        return `<span>${tok}</span>`;
    }).join(' ');

    return `
        <div class="review-card review-cloze-card">
            <div class="review-quiz-instruction">Complète la phrase avec le bon élément</div>
            <div class="cloze-sentence">${sentenceHtml}</div>
            ${answered
                ? `<div class="review-romaji">${clozeInfo.sentenceRomaji || (word.example && word.example.romaji) || ''}</div>`
                : (clozeInfo.sentenceRomajiMasked ? `<div class="review-romaji">${clozeInfo.sentenceRomajiMasked}</div>` : '')}
            <div class="review-example-fr-only">${mdBold((word.example && word.example.french) || '')}</div>
        </div>
        <div class="review-options">
            ${clozeInfo.options.map(opt => {
                let cls = 'review-option-btn';
                if (answered) {
                    if (opt.word === clozeInfo.correct) cls += ' correct';
                    else if (opt.word === selected) cls += ' incorrect';
                }
                return `<button class="${cls}" ${answered ? 'disabled' : ''} onclick="submitQuizAnswer('${opt.word.replace(/'/g, "\\'")}')">
                    <span class="cloze-option-word">${opt.reading ? `<ruby>${opt.word}<rt>${opt.reading}</rt></ruby>` : opt.word}</span>
                    ${opt.romaji ? `<span class="cloze-option-romaji">${opt.romaji}</span>` : ''}
                </button>`;
            }).join('')}
        </div>
        ${(answered && selected !== clozeInfo.correct) ? (
            entry.relatedGrammarEntry
                ? `<button class="fiche-correction-btn" style="margin-top:14px" onclick="openReviewRelatedGrammarFiche()">📖 Voir la leçon : ${clozeInfo.correct}</button>`
                : (entry.relatedGrammarEntry === null && word.nuance)
                    ? `<div class="vocab-nuance-box" style="margin-top:14px;text-align:left">💡 ${mdBold(word.nuance)}</div>`
                    : ''
        ) : ''}
        ${answered ? `<button class="review-continue-btn" onclick="advanceReviewQueue()">Continuer →</button>` : ''}
    `;
}

export function flipReviewCard() {
    if (!reviewSession) return;
    reviewSession.flipped = true;
    renderReviewScreen();
}

// Cherche une leçon de grammaire dont "item" correspond exactement à la particule/notion
// donnée — utilisé pour lier le quiz à trous du vocabulaire à la vraie fiche grammaire.
async function findGrammarLessonForItem(itemText) {
    if (!itemText) return null;
    for (const level of ALL_JLPT_LEVELS) {
        const gd = await getLevelGrammarData(level);
        if (gd && gd.data) {
            const found = gd.data.find(l => l.item === itemText);
            if (found) return { type: 'grammar', level, item: found };
        }
    }
    return null;
}

export async function submitQuizAnswer(selected) {
    if (!reviewSession || reviewSession.answered) return;
    const session = reviewSession;
    const entry = session.queue[session.index];
    const correct = entry.type === 'cloze' ? entry.clozeInfo.correct : entry.qcmInfo.correct;
    const isCorrect = selected === correct;

    session.answered = true;
    session.selected = selected;

    const quality = isCorrect ? 2 : 0; // Bien si juste, Encore si faux
    gradeReview(entry.word.id, quality, { type: 'vocab', label: entry.word.word });
    if (!isCorrect) scheduleRelearning(session, entry);
    const labels = ['again', 'hard', 'good', 'easy'];
    session.results[labels[quality]]++;

    renderReviewScreen(); // affichage immédiat (couleurs correct/incorrect), sans attendre la recherche ci-dessous

    if (entry.type === 'cloze' && !isCorrect && entry.relatedGrammarEntry === undefined) {
        const found = await findGrammarLessonForItem(entry.clozeInfo.correct);
        entry.relatedGrammarEntry = found || null;
        if (reviewSession === session && session.queue[session.index] === entry) {
            renderReviewScreen();
        }
    }
}

// Équivalent du onclick="showFicheCorrectionModal(reviewSession.queue[reviewSession.index]
// .relatedGrammarEntry)" du monolithe — adapté car reviewSession est un `let` local à ce
// module, inaccessible depuis un attribut onclick (contexte global). Même principe que
// replayKanaTraceQuiz (features/kana.js) / openKanjiFromSearchHit (ui/modals.js).
export function openReviewRelatedGrammarFiche() {
    if (!reviewSession) return;
    const entry = reviewSession.queue[reviewSession.index];
    if (entry && entry.relatedGrammarEntry) showFicheCorrectionModal(entry.relatedGrammarEntry);
}

export function advanceReviewQueue() {
    if (!reviewSession) return;
    reviewSession.index++;
    reviewSession.flipped = false;
    reviewSession.answered = false;
    reviewSession.selected = null;
    renderReviewScreen();
}

export function submitReviewGrade(quality) {
    if (!reviewSession) return;
    const entry = reviewSession.queue[reviewSession.index];
    gradeReview(entry.word.id, quality, { type: 'vocab', label: entry.word.word });
    if (quality === 0) scheduleRelearning(reviewSession, entry);

    const labels = ['again', 'hard', 'good', 'easy'];
    reviewSession.results[labels[quality]]++;

    advanceReviewQueue();
}

export function renderReviewSummary() {
    recordSessionCompleted();
    const container = document.getElementById('category-content');
    const r = reviewSession.results;
    const total = reviewSession.queue.length;

    container.innerHTML = `<div class="review-summary">
        <div class="review-summary-title">Session terminée ! 🎉</div>
        <div class="review-summary-count">${total} carte${total > 1 ? 's' : ''} révisée${total > 1 ? 's' : ''}</div>
        <div class="review-summary-stats">
            <div class="review-stat"><span class="review-stat-dot again"></span>Encore : ${r.again}</div>
            <div class="review-stat"><span class="review-stat-dot hard"></span>Difficile : ${r.hard}</div>
            <div class="review-stat"><span class="review-stat-dot good"></span>Bien : ${r.good}</div>
            <div class="review-stat"><span class="review-stat-dot easy"></span>Facile : ${r.easy}</div>
        </div>
        <button class="revise-btn" style="margin-top:20px;" onclick="history.back()">Retour au vocabulaire</button>
    </div>`;
    reviewSession = null;
}

/* ══════════════════════════════════════════════════
   LISTE VOCABULAIRE PAR NIVEAU
══════════════════════════════════════════════════ */
export function displayVocabList(levelId, data, examples = null, isBack = false) {
    const container = document.getElementById('category-content');
    if (!Array.isArray(data)) {
        container.innerHTML = '<div style="color:var(--gray)">Structure invalide</div>';
        return;
    }

    if (!isBack) history.pushState({ view: 'vocab-list' }, '');

    state.vocabHomeData = { levelId, data, examples };
    state.currentLevelId = levelId;

    const grouped = {};
    data.forEach(word => {
        const cat = word.category || 'other';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(word);
    });

    const sortedCats = Object.keys(grouped).sort();
    const dueCount = countDueItems(data);

    let html = `<div class="vocab-container">`;

    html += `<div style="display:flex;gap:8px">
        ${!state.bulkSelectMode ? `<button class="bulk-select-toggle-btn" style="flex:1" onclick="enterBulkSelectMode(refreshVocabList)">☑ Sélectionner</button>` : ''}
    </div>`;

    html += sortedCats.map(cat => {
        const label = VOCAB_CATEGORY_MAP[cat] || `📌 ${cat}`;
        const words = grouped[cat];
        const catId = `vocab-cat-${cat}`;

        return `
            <div class="vocab-category-box">
                <div class="vocab-category-header" onclick="const content = document.getElementById('${catId}'); content.classList.toggle('open'); this.querySelector('.vocab-cat-arrow').classList.toggle('open')">
                    <div class="vocab-category-title">
                        ${state.bulkSelectMode ? `<input type="checkbox" class="bulk-cat-checkbox" onclick='event.stopPropagation(); toggleCategoryMasteryLive(this, ${JSON.stringify(words.map(w => w.id))})' ${words.every(w => getItemStatus(w.id) === 'mastered') ? 'checked' : ''}>` : ''}
                        <span class="vocab-cat-arrow">▶</span>
                        <span>${label}</span>
                    </div>
                    <div class="vocab-cat-counter">${words.length}</div>
                </div>

                <div class="vocab-category-content" id="${catId}">
                    ${words.map(word => {
                        const meaningText = (() => {
                            const m = word.meanings;
                            if (Array.isArray(m)) return m.join(' • ');
                            if (m && typeof m === 'object') return m.primary || '';
                            return m || '';
                        })();
                        const confidence = getSrsConfidencePct(word.id);
                        const isMastered = getItemStatus(word.id) === 'mastered';
                        return `
                        <div class="vocab-pill-card ${isBulkSelected(word.id) ? 'bulk-selected' : ''}" onclick="handleListItemClick(this, '${word.id}', () => openVocabDetailFromState('${word.id}'))" style="position:relative;">
                            ${isMastered ? '<span class="mastered-check">✔</span>' : ''}
                            <div class="vocab-pill-badge" style="--pct:${confidence === null ? 0 : confidence}">
                                <span>${confidence === null ? '–' : confidence}</span>
                            </div>
                            <div class="vocab-pill-left">
                                <div class="vocab-pill-word">${word.word || ''}</div>
                                <div class="vocab-pill-reading">${word.reading || ''}</div>
                            </div>
                            <div class="vocab-pill-right">
                                <div class="vocab-pill-meaning">${meaningText}</div>
                                <div class="vocab-pill-romaji">${word.romaji || ''}</div>
                            </div>
                        </div>`;
                    }).join('')}
                </div>
            </div>
        `;
    }).join('');

    html += `</div>`;

    container.innerHTML = html;
}

/* ══════════════════════════════════════════════════
   FICHE DÉTAIL D'UN MOT
══════════════════════════════════════════════════ */
export function showVocabDetail(wordId, allWords = [], isBack = false) {
    document.getElementById('main-content').innerHTML = `<div id="category-content" style="padding:16px"></div>`;
    const container = document.getElementById('category-content');

    if (!allWords || allWords.length === 0) {
        allWords = state.vocabHomeData?.data || [];
    }

    const word = allWords.find(w => w.id === wordId);

    if (!word) {
        container.innerHTML = '<div style="color:var(--gray)">Mot non trouvé</div>';
        return;
    }

    if (!isBack) history.pushState({ view: 'vocab-detail', wordId }, '');

    const status = getItemStatus(word.id);
    const level = word.level || 'N5';
    const currentIndex = allWords.findIndex(w => w.id === wordId);
    const totalWords = allWords.length;

    const normalizeMeanings = () => {
        const m = word.meanings;
        if (Array.isArray(m)) return { primary: m[0] || 'Sens', secondary: m.slice(1) };
        if (m && typeof m === 'object') return { primary: m.primary || 'Sens', secondary: Array.isArray(m.secondary) ? m.secondary : [] };
        if (typeof m === 'string') return { primary: m, secondary: [] };
        return { primary: 'Sens', secondary: [] };
    };
    const { primary: primaryMeaning, secondary: secondaryMeanings } = normalizeMeanings();

    const classifyType = (typeRaw) => {
        if (!typeRaw) return null;
        const t = typeRaw.toLowerCase();
        if (t.includes('verb')) return { color: '#6EA8FF' };
        if (t.includes('nom') || t.includes('noun')) return { color: '#4ADE80' };
        if (t.includes('adj')) return { color: '#FBBF24' };
        if (t.includes('adv')) return { color: '#38BDF8' };
        if (t.includes('partic')) return { color: '#9D6EFF' };
        if (t.includes('interj') || t.includes('express')) return { color: '#FB7185' };
        return { color: '#A7B0C0' };
    };

    const buildTypeBadge = () => {
        if (!word.type) return '';
        const info = classifyType(word.type) || { color: '#A7B0C0' };
        const groupLabel = word.group ? ` · ${word.group}` : '';
        return `<span class="vocab-type-badge" style="background: ${info.color}22; color: ${info.color}; border: 1px solid ${info.color}66; box-shadow: 0 0 8px ${info.color}33;">${word.type}${groupLabel}</span>`;
    };

    let html = `<div class="vocab-detail-page">`;

    html += `<div class="vocab-detail-header">
        <button class="back-btn" onclick="refreshVocabList(false)">←</button>
        <div class="vocab-progress">${currentIndex + 1} / ${totalWords}</div>
    </div>`;

    html += `<div class="vocab-detail-top">
        <span class="vocab-level-badge">${level}</span>
        <button class="vocab-favorite-btn ${status === 'favorited' ? 'active' : ''}" onclick="trackItem('${word.id}', '${status === 'favorited' ? 'null' : 'favorited'}'); openVocabDetailFromState('${word.id}')">
            ${status === 'favorited' ? '❤' : '🤍'}
        </button>
    </div>`;

    html += `<div class="vocab-detail-main-box">
        <div class="vocab-reading">${word.reading || ''}</div>
        <div class="vocab-word">${word.word || ''}</div>
        <div class="vocab-romaji">${word.romaji || ''}</div>
        ${buildTypeBadge()}
        <button class="vocab-speak-btn" onclick="speakText('${(word.word || '').replace(/'/g, "\\'")}')" title="Écouter">🔊</button>
    </div>`;

    html += `<div class="vocab-section-title">Signification</div>`;
    html += `<div class="vocab-meanings">`;
    html += `<div class="vocab-meaning-primary">${mdBold(primaryMeaning)}</div>`;
    secondaryMeanings.forEach(m => {
        html += `<div class="vocab-meaning-secondary">${mdBold(m)}</div>`;
    });
    html += `</div>`;

    if (word.nuance) {
        html += `<div class="vocab-nuance-box">💡 ${mdBold(word.nuance)}</div>`;
    }

    if (word.example && word.example.japanese) {
        html += `<div class="vocab-section-title">Exemple en contexte</div>`;
        html += buildSpeakableExampleHtml(
            mdBold(word.example.japanese || ''),
            mdBold(word.example.romaji || ''),
            mdBold(word.example.french || ''),
            stripRubyForSpeech(word.example.japanese || '').replace(/'/g, "\\'")
        );
    }

    if (Array.isArray(word.kanji_list) && word.kanji_list.length) {
        const chips = word.kanji_list
            .map(char => {
                const k = state.data.kanjiDb.find(kd => kd.char === char);
                if (!k) return '';
                const meaning = (k.meanings || []).find(m => !m.toLowerCase().includes('radical')) || k.meanings?.[0] || '';
                return `<div class="vocab-kanji-chip" onclick="openDetail({char:'${char}'})">
                    <span class="vocab-kanji-chip-char">${char}</span>
                    <span class="vocab-kanji-chip-meaning">${meaning}</span>
                </div>`;
            })
            .join('');
        if (chips) {
            html += `<div class="vocab-section-title">Kanji de ce mot</div>`;
            html += `<div class="vocab-kanji-chips">${chips}</div>`;
        }
    }

    html += `<div class="vocab-detail-actions">
        <button class="vocab-master-btn ${status === 'mastered' ? 'active' : ''}" onclick="trackItem('${word.id}', '${status === 'mastered' ? 'null' : 'mastered'}'); openVocabDetailFromState('${word.id}')">
            ${status === 'mastered' ? '✓ Maîtrisé' : '✓ Marquer comme maîtrisé'}
        </button>
    </div>`;

    html += `</div>`;

    container.innerHTML = html;
}
