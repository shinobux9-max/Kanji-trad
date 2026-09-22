/**
 * js/features/grammar.js
 * Liste grammaire par niveau (par unité), fiche détail, révision (flashcard + trou à
 * combler + SRS), et le système de renvoi entre leçons (popup "Aperçu" + comparatif
 * ❌/✅ des quiz vocab ET grammaire).
 *
 * EXCLUSIONS VOLONTAIRES (pas des oublis) : displayGrammarList(levelId, data, examples) et
 * GRAMMAR_TYPE_MAP (monolithe, lignes ~988 et ~3727) — vérifié programmatiquement
 * (grep "displayGrammarList(") : cette fonction n'est appelée NULLE PART ailleurs dans tout
 * le monolithe. Code mort utilisant un schéma de données obsolète (pattern.pattern/
 * pattern.meaning/examples.grammar[exId] par index — ne correspond plus au vrai
 * grammar.json actuel, qui utilise item/title/sections/examples[] objets). Contient même
 * un console.log de debug oublié. showGrammarHome() est la vraie fonction active
 * équivalente à displayVocabList() pour la grammaire.
 */

import { state } from '../core/state.js';
import { ALL_JLPT_LEVELS } from '../core/constants.js';
import { getItemStatus, trackItem, getTrackingData } from '../core/storage.js';
import { getGrammarExtraExamples, getItemRomaji, findLessonByIdSync, findLessonByItemSync } from '../core/data-loader.js';
import { pushModalState } from '../core/navigation.js';
import { buildDueQueue, gradeReview, scheduleRelearning, recordSessionCompleted, shuffleArray } from '../learning/srs.js';
import { stripRubyForSpeech } from './kanji.js';
import { speakText } from './oral.js';
import { mdBold, showFicheCorrectionModal, isBulkSelected, handleListItemClick, toggleCategoryMasteryLive, enterBulkSelectMode, buildSpeakableExampleHtml, continueFAB, backFAB, hideBottomNav, buildAnswerFeedbackHtml } from '../ui/common.js';

/* ══════════════════════════════════════════════════
   RÉVISION GRAMMAIRE (flashcard + trou à combler + SRS)
   Session dans state.grammarReviewSession (core/state.js) — PAS une variable locale au
   module : corrigé lors de l'audit Phase 3 (utilisait une variable locale au module (let),
   jamais lue/nettoyée par core/navigation.js::closeAllOverlaysAndSessions(), qui ne touchait
   que state.grammarReviewSession sans effet réel). { queue: [{lesson,type,clozeInfo}],
   index, results, flipped, answered, selected }
══════════════════════════════════════════════════ */

// Génère un trou à combler grammaire : utilise example.highlight (déjà la forme exacte
// présente dans la phrase).
export function buildGrammarCloze(lesson, pool) {
    const highlightTarget = (h) => Array.isArray(h) ? h[0] : h;

    const levelId = (lesson.id || '').split('_')[0];
    const extraExamples = getGrammarExtraExamples(levelId, lesson.id);
    const allExamples = [...(lesson.examples || []), ...extraExamples];

    const usable = allExamples.filter(ex => ex.japanese && ex.highlight && ex.japanese.includes(highlightTarget(ex.highlight)));
    if (!usable.length) return null;
    const example = usable[Math.floor(Math.random() * usable.length)];

    const correct = highlightTarget(example.highlight);
    const sentence = example.japanese;
    const blankStart = sentence.indexOf(correct);
    if (blankStart === -1) return null;

    const otherHighlights = pool
        .filter(l => l.id !== lesson.id)
        .map(l => {
            const ex = Array.isArray(l.examples) ? l.examples.find(e => e.highlight) : null;
            return ex ? highlightTarget(ex.highlight) : null;
        })
        .filter(h => h && h !== correct);

    const uniqueDistractors = [...new Set(otherHighlights)];
    if (uniqueDistractors.length < 3) return null;

    const distractors = shuffleArray(uniqueDistractors).slice(0, 3);
    const options = shuffleArray([correct, ...distractors]);

    return {
        before: sentence.slice(0, blankStart),
        after: sentence.slice(blankStart + correct.length),
        correct, french: example.french || '', options
    };
}

export function prepareGrammarSessionItem(lesson, pool, forceMode = null) {
    const clozeInfo = buildGrammarCloze(lesson, pool);
    let type;
    if (forceMode === 'flashcard') type = 'flashcard';
    else if (forceMode === 'quiz') type = clozeInfo ? 'cloze' : 'flashcard';
    else type = clozeInfo && Math.random() < 0.5 ? 'cloze' : 'flashcard';
    return { lesson, type, clozeInfo };
}

/**
 * ⚠️ ATTENTION : showFreeTrainingConfig existe réellement dans features/free-training.js, mais y importer créerait un cycle (confirmé).
 * Vrai appel JS non importé (bouton "Entraînement libre").
 */
export function showGrammarReviewModeSelector() {
    hideBottomNav();
    const container = document.getElementById('category-content');
    const data = state.grammarHomeData?.data || [];
    const dueLessons = buildDueQueue(data);

    if (dueLessons.length === 0) {
        alert('Rien à réviser pour le moment ! 🎉');
        return;
    }

    pushModalState('grammar-review-selector');

    container.innerHTML = `
        <div class="review-mode-selector">
            ${backFAB()}
            <div class="review-mode-title">Choisis ton mode de révision</div>
            <div class="review-mode-count">${dueLessons.length} leçon${dueLessons.length > 1 ? 's' : ''} à revoir</div>

            <button class="review-mode-btn" onclick="startGrammarReview()">
                <span class="review-mode-icon">🎲</span>
                <div><div class="review-mode-name">Mixte</div><div class="review-mode-desc">Flashcard et trous mélangés</div></div>
            </button>
            <button class="review-mode-btn" onclick="startGrammarReview('flashcard')">
                <span class="review-mode-icon">🗂️</span>
                <div><div class="review-mode-name">Flashcard</div><div class="review-mode-desc">Cours et exemples, auto-évalué</div></div>
            </button>
            <button class="review-mode-btn" onclick="startGrammarReview('quiz')">
                <span class="review-mode-icon">✍️</span>
                <div><div class="review-mode-name">Quiz actif</div><div class="review-mode-desc">Trous uniquement</div></div>
            </button>
            <button class="review-mode-btn" onclick="startGrammarFreeTrainingFromSelector()">
                <span class="review-mode-icon">🏋️</span>
                <div><div class="review-mode-name">Entraînement libre</div><div class="review-mode-desc">Configurable, sans impact sur le SRS</div></div>
            </button>
        </div>`;
}

// Corrections des mêmes bugs onclick "bare global" que dans vocabulary.js (voir son
// HANDOFF.md) — trouvés et corrigés lors de la revérification finale.
export function startGrammarFreeTrainingFromSelector() {
    showFreeTrainingConfig(false, { type: 'grammar', level: state.grammarHomeData?.levelId });
}

export function refreshGrammarHome(isBack = true) {
    if (!state.grammarHomeData) return;
    showGrammarHome(state.grammarHomeData.levelId, state.grammarHomeData.data, state.grammarHomeData.examples, isBack);
}

export function startGrammarReview(forceMode = null) {
    hideBottomNav();
    const data = state.grammarHomeData?.data || [];
    const dueLessons = buildDueQueue(data);

    if (dueLessons.length === 0) {
        alert('Rien à réviser pour le moment ! 🎉');
        return;
    }

    const queue = dueLessons.map(l => prepareGrammarSessionItem(l, data, forceMode));

    pushModalState('grammar-review');

    state.grammarReviewSession = {
        queue, index: 0,
        results: { again: 0, hard: 0, good: 0, easy: 0 },
        flipped: false, answered: false, selected: null
    };
    document.getElementById('main-content').innerHTML = `<div id="category-content" style="padding:16px"></div>`;
    renderGrammarReviewScreen();
}

export function renderGrammarReviewScreen() {
    const container = document.getElementById('category-content');
    const session = state.grammarReviewSession;

    if (!session || session.index >= session.queue.length) {
        renderGrammarReviewSummary();
        return;
    }

    const entry = session.queue[session.index];
    const progress = session.index + 1;
    const total = session.queue.length;

    const bodyHtml = entry.type === 'cloze'
        ? renderGrammarClozeExercise(entry, session)
        : renderGrammarFlashcardExercise(entry, session);

    container.innerHTML = `${backFAB('history.back()', '✕')}<div class="review-page">
        <div class="review-header">
            <div class="review-progress-bar"><div class="review-progress-fill" style="width:${(session.index / total) * 100}%"></div></div>
            <div class="review-progress-text">${progress} / ${total}</div>
        </div>
        ${bodyHtml}
    </div>`;
}

function renderGrammarFlashcardExercise(entry, session) {
    const lesson = entry.lesson;
    const itemText = lesson.item || lesson.pattern || 'Formule';
    const titleText = lesson.title || lesson.meaning || 'Sans titre';
    const flipped = session.flipped;
    const firstExample = Array.isArray(lesson.examples) && lesson.examples.length > 0 ? lesson.examples[0] : null;

    return `
        <div class="review-card ${flipped ? 'flipped' : ''}" onclick="${flipped ? '' : 'flipGrammarReviewCard()'}">
            <div class="review-card-front">
                <div class="review-word" style="font-size:2rem;">${itemText}</div>
                ${flipped ? `<div class="review-reading">${titleText}</div>` : ''}
            </div>
            ${flipped ? `
                <div class="review-card-back">
                    <div class="review-romaji">${lesson.pattern || ''}</div>
                    ${firstExample ? `
                        <div class="review-example">
                            <div class="example-jp">${mdBold(firstExample.japanese || '')}</div>
                            <div class="example-fr">${mdBold(firstExample.french || '')}</div>
                        </div>
                    ` : ''}
                </div>
            ` : `<div class="review-tap-hint">Touche la carte pour révéler</div>`}
        </div>
        ${flipped ? `
            <div class="review-grade-buttons">
                <button class="grade-btn grade-again" onclick="submitGrammarReviewGrade(0)">Encore</button>
                <button class="grade-btn grade-hard" onclick="submitGrammarReviewGrade(1)">Difficile</button>
                <button class="grade-btn grade-good" onclick="submitGrammarReviewGrade(2)">Bien</button>
                <button class="grade-btn grade-easy" onclick="submitGrammarReviewGrade(3)">Facile</button>
            </div>
        ` : ''}
    `;
}

function renderGrammarClozeExercise(entry, session) {
    const { clozeInfo, lesson } = entry;
    const answered = session.answered;
    const selected = session.selected;

    const blankHtml = !answered
        ? `<span class="cloze-blank">＿＿＿</span>`
        : `<span class="cloze-blank-filled ${selected === clozeInfo.correct ? 'correct' : 'incorrect'}">${selected}</span>`;

    const isWrong = answered && selected !== clozeInfo.correct;
    let confusion = null;
    if (isWrong && Array.isArray(lesson.confusions) && lesson.confusions.length) {
        confusion = lesson.confusions.find(c => c.with === selected) || lesson.confusions[0];
    }

    return `
        <div class="review-card review-cloze-card">
            <div class="review-quiz-instruction">Complète la phrase avec le bon élément grammatical</div>
            <div class="cloze-sentence">${clozeInfo.before}${blankHtml}${clozeInfo.after}</div>
            <div class="review-example-fr-only">${mdBold(clozeInfo.french)}</div>
        </div>
        <div class="review-options">
            ${clozeInfo.options.map(opt => {
                let cls = 'review-option-btn';
                if (answered) {
                    if (opt === clozeInfo.correct) cls += ' correct';
                    else if (opt === selected) cls += ' incorrect';
                }
                return `<button class="${cls}" ${answered ? 'disabled' : ''} onclick="submitGrammarQuizAnswer('${opt.replace(/'/g, "\\'")}')">${opt}</button>`;
            }).join('')}
        </div>
        ${isWrong ? buildParticleComparisonHtml(selected, lesson) : ''}
        ${confusion ? buildConfusionBoxHtml(confusion) : ''}
        ${answered ? continueFAB('advanceGrammarReviewQueue()') : ''}
    `;
}

/**
 * Contenu de l'encadré "pourquoi c'est faux" — repose sur confusions[] de grammar.json
 * ({ with, explanation, wrong_example? }). Le champ optionnel "voir" (id d'une autre leçon)
 * génère un badge cliquable vers la vraie fiche de la leçon visée.
 */
export function buildConfusionBoxHtml(confusion) {
    const voirLesson = confusion.voir ? findLessonByIdSync(confusion.voir) : null;
    if (confusion.voir && !voirLesson) {
        console.warn(`⚠️ "voir": "${confusion.voir}" introuvable — vérifie que cette leçon existe bien dans le grammar.json de son niveau.`);
    }
    return `
        <div class="confusion-box">
            <div class="confusion-box-title">💡 Point de vigilance : ${confusion.with}</div>
            ${voirLesson ? `
                <div class="eye-badge" onclick="event.stopPropagation();showLessonReferencePopup('${voirLesson.id}')">
                    👁️ Aperçu : Leçon ${voirLesson.lesson_number || '?'} · ${voirLesson.item || voirLesson.title}${getItemRomaji(voirLesson.item, voirLesson.item_romaji) ? ` · ${getItemRomaji(voirLesson.item, voirLesson.item_romaji)}` : ''}
                </div>
            ` : ''}
            <div class="confusion-box-text">${mdBold(confusion.explanation || '')}</div>
            ${confusion.wrong_example ? `
                <div class="confusion-example-row wrong"><span>✘</span><span>${mdBold(confusion.wrong_example.japanese || '')}</span></div>
                ${confusion.wrong_example.romaji ? `<div class="confusion-example-romaji">${confusion.wrong_example.romaji}</div>` : ''}
                <div class="confusion-example-row ok"><span>✔</span><span>${mdBold(confusion.wrong_example.correct_japanese || '')}</span></div>
                ${confusion.wrong_example.correct_romaji ? `<div class="confusion-example-romaji">${confusion.wrong_example.correct_romaji}</div>` : ''}
                ${confusion.wrong_example.french ? `<div class="confusion-example-fr">${mdBold(confusion.wrong_example.french)}</div>` : ''}
            ` : ''}
        </div>
    `;
}

export function flipGrammarReviewCard() {
    if (!state.grammarReviewSession) return;
    state.grammarReviewSession.flipped = true;
    renderGrammarReviewScreen();
}

export function submitGrammarQuizAnswer(selected) {
    if (!state.grammarReviewSession || state.grammarReviewSession.answered) return;
    const session = state.grammarReviewSession;
    const entry = session.queue[session.index];
    const isCorrect = selected === entry.clozeInfo.correct;

    session.answered = true;
    session.selected = selected;

    const quality = isCorrect ? 2 : 0;
    gradeReview(entry.lesson.id, quality, { type: 'grammar', label: entry.lesson.item || entry.lesson.pattern });
    if (!isCorrect) scheduleRelearning(session, entry);
    const labels = ['again', 'hard', 'good', 'easy'];
    session.results[labels[quality]]++;

    renderGrammarReviewScreen();
}

export function advanceGrammarReviewQueue() {
    if (!state.grammarReviewSession) return;
    state.grammarReviewSession.index++;
    state.grammarReviewSession.flipped = false;
    state.grammarReviewSession.answered = false;
    state.grammarReviewSession.selected = null;
    renderGrammarReviewScreen();
}

export function submitGrammarReviewGrade(quality) {
    if (!state.grammarReviewSession) return;
    const entry = state.grammarReviewSession.queue[state.grammarReviewSession.index];
    gradeReview(entry.lesson.id, quality, { type: 'grammar', label: entry.lesson.item || entry.lesson.pattern });
    if (quality === 0) scheduleRelearning(state.grammarReviewSession, entry);

    const labels = ['again', 'hard', 'good', 'easy'];
    state.grammarReviewSession.results[labels[quality]]++;

    advanceGrammarReviewQueue();
}

export function renderGrammarReviewSummary() {
    recordSessionCompleted();
    const container = document.getElementById('category-content');
    const r = state.grammarReviewSession.results;
    const total = state.grammarReviewSession.queue.length;

    container.innerHTML = `<div class="review-summary">
        <div class="review-summary-title">Session terminée ! 🎉</div>
        <div class="review-summary-count">${total} leçon${total > 1 ? 's' : ''} révisée${total > 1 ? 's' : ''}</div>
        <div class="review-summary-stats">
            <div class="review-stat"><span class="review-stat-dot again"></span>Encore : ${r.again}</div>
            <div class="review-stat"><span class="review-stat-dot hard"></span>Difficile : ${r.hard}</div>
            <div class="review-stat"><span class="review-stat-dot good"></span>Bien : ${r.good}</div>
            <div class="review-stat"><span class="review-stat-dot easy"></span>Facile : ${r.easy}</div>
        </div>
        <button class="revise-btn" style="margin-top:20px;" onclick="history.back()">Retour à la grammaire</button>
    </div>`;
    state.grammarReviewSession = null;
}

/* ══════════════════════════════════════════════════
   RENVOI ENTRE LEÇONS — popup "Aperçu" + comparatif ❌/✅
   (utilisé par la révision vocab ET grammaire)
══════════════════════════════════════════════════ */

// Résumé court (1re phrase de l'EXPLICATION) — évite de dupliquer 2 paragraphes entiers.
export function getShortLessonExplanation(lesson) {
    if (!lesson) return '';
    const explication = (lesson.sections || []).find(s => (s.label || '').toUpperCase() === 'EXPLICATION');
    const text = explication && Array.isArray(explication.paragraphs) ? explication.paragraphs[0] : '';
    if (!text) return '';
    return text.split(/(?<=[.!?])\s/)[0];
}

/**
 * Comparaison ❌ mauvaise réponse / ✅ bonne réponse — chaque particule est cliquable et ouvre
 * la même popup "Aperçu" que le système de renvoi entre leçons. Exportée : utilisée aussi par
 * features/vocabulary.js (quiz à trous vocab lié à une leçon grammaire).
 */
export function buildParticleComparisonHtml(selected, correctLesson) {
    const wrongLesson = findLessonByItemSync(selected);
    const wrongExplanation = getShortLessonExplanation(wrongLesson);
    const correctExplanation = getShortLessonExplanation(correctLesson);
    if (!wrongExplanation && !correctExplanation) return '';

    return buildAnswerFeedbackHtml({
        wrongText: selected,
        wrongOnClick: wrongLesson ? `showLessonReferencePopup('${wrongLesson.id}')` : null,
        wrongExplanation,
        correctText: correctLesson?.item || '',
        correctOnClick: correctLesson ? `showLessonReferencePopup('${correctLesson.id}')` : null,
        correctExplanation
    });
}

/**
 * ⚠️ ATTENTION : le bouton "Voir la fiche complète →" appelle closeLessonReferencePopup()
 * puis showGrammarDetail() — showGrammarDetail est définie plus bas DANS ce même fichier
 * (appel interne normal), mais reste un onclick (landmine générique window.*, pas de cycle).
 */
export function showLessonReferencePopup(lessonId) {
    const modal = document.getElementById('lesson-reference-popup-modal');
    const content = document.getElementById('lesson-reference-popup-content');
    if (!modal || !content) return;

    const lesson = findLessonByIdSync(lessonId);
    if (!lesson) {
        content.innerHTML = `<div style="color:var(--gray);text-align:center;padding:20px">Leçon introuvable.</div>`;
    } else {
        const explication = (lesson.sections || []).find(s => (s.label || '').toUpperCase() === 'EXPLICATION') || (lesson.sections || [])[0];
        content.innerHTML = `
            <div class="fiche-title-card" style="margin-bottom:14px">
                <div style="font-size:0.6875rem;color:var(--accent-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">Leçon ${lesson.lesson_number || '?'}</div>
                <div style="font-size:1.375rem;color:var(--accent);font-weight:bold;font-family:'Noto Sans JP',sans-serif">${lesson.item || ''}</div>
                ${getItemRomaji(lesson.item, lesson.item_romaji) ? `<div style="font-size:0.75rem;color:var(--gray);margin-top:2px">${getItemRomaji(lesson.item, lesson.item_romaji)}</div>` : ''}
                <div style="font-size:0.9375rem;color:#fff;margin-top:6px">${lesson.title || ''}</div>
            </div>
            ${explication ? `<div class="fiche-title-card" style="text-align:left;padding:18px">${renderSectionBody(explication)}</div>` : `<div style="color:var(--gray);text-align:center">Pas d'explication disponible.</div>`}
            <button class="review-continue-btn" style="margin-top:16px" onclick="closeLessonReferencePopup();showGrammarDetail('${lesson.id}')">Voir la fiche complète →</button>
        `;
    }

    modal.classList.add('open');
    modal.style.display = 'flex';
}

export function closeLessonReferencePopup() {
    const modal = document.getElementById('lesson-reference-popup-modal');
    if (!modal) return;
    modal.classList.remove('open');
    modal.style.display = 'none';
}

/* ══════════════════════════════════════════════════
   RENDU D'UNE SECTION DE LEÇON — partagé fiche détail + popup "Aperçu"
══════════════════════════════════════════════════ */
export function renderSectionBody(section, { includeBlocks = true } = {}) {
    let body = '';

    if (section.text) {
        body += `<div class="section-paragraph">${mdBold(section.text)}</div>`;
    }

    if (Array.isArray(section.paragraphs)) {
        body += section.paragraphs.map(p => `<div class="section-paragraph">${mdBold(p)}</div>`).join('');
    }

    if (section.sub_title) {
        body += `<div class="section-sub-title">${mdBold(section.sub_title)}</div>`;
    }

    if (Array.isArray(section.list)) {
        body += `<ul class="section-list">${section.list.map(item => `<li>${mdBold(item)}</li>`).join('')}</ul>`;
    }

    if (includeBlocks && Array.isArray(section.blocks)) {
        body += section.blocks.map(block => {
            let blockHtml = '';
            if (block.sub_title) {
                blockHtml += `<div class="section-sub-title">${mdBold(block.sub_title)}</div>`;
            }
            if (Array.isArray(block.paragraphs)) {
                blockHtml += block.paragraphs.map(p => `<div class="section-paragraph">${mdBold(p)}</div>`).join('');
            }
            if (Array.isArray(block.list)) {
                blockHtml += `<ul class="section-list">${block.list.map(item => `<li>${mdBold(item)}</li>`).join('')}</ul>`;
            }
            return blockHtml;
        }).join('');
    }

    return body;
}

/**
 * Rend chaque block d'une section (ex: "Structure de base") comme sa propre boîte
 * .detail-section, séparée du corps principal de la section (voir renderSectionBody
 * appelée avec includeBlocks:false dans showGrammarDetail).
 */
export function renderSectionBlocks(section) {
    if (!Array.isArray(section.blocks)) return '';

    return section.blocks.map(block => {
        let blockHtml = '';
        if (Array.isArray(block.paragraphs)) {
            blockHtml += block.paragraphs.map(p => `<div class="section-paragraph">${mdBold(p)}</div>`).join('');
        }
        if (Array.isArray(block.list)) {
            blockHtml += `<ul class="section-list">${block.list.map(item => `<li>${mdBold(item)}</li>`).join('')}</ul>`;
        }
        return `
            <div class="detail-section grammar-block-box">
                <div class="section-label">${block.sub_title || 'Détail'}</div>
                <div class="section-content-box">${blockHtml}</div>
            </div>`;
    }).join('');
}

/* ══════════════════════════════════════════════════
   LISTE GRAMMAIRE PAR NIVEAU (par unité)
══════════════════════════════════════════════════ */
function getFamilyColor(badgeText) {
    const text = (badgeText || '').toLowerCase();

    if (text.match(/copule|existence|démonstratif|déterminant|lieu|spatial/i)) {
        return { color: '#4ADE80', emoji: '🟢', family: 'Structure' };
    }
    if (text.match(/verbe|désir|volonté|requête|obligation|capacité|passe-temps|expérience|action|proposition|invitation/i)) {
        return { color: '#6EA8FF', emoji: '🔵', family: 'Verbes & Actions' };
    }
    if (text.match(/passé|progressif|chronologie|séquence|conditionnel|temporel|temps/i)) {
        return { color: '#9D6EFF', emoji: '🟣', family: 'Temps' };
    }
    if (text.match(/cause|opposition|concession|simultanéité|citation|logique|raison/i)) {
        return { color: '#FBBF24', emoji: '🟠', family: 'Logique' };
    }
    if (text.match(/permission|interdiction|changement|don|réception|service|facilité|excès|absence|aide|conseil/i)) {
        return { color: '#FB7185', emoji: '🟡', family: 'Modalités' };
    }
    if (text.match(/interrogatif|indéfini|négatif|question/i)) {
        return { color: '#4ADE80', emoji: '🟢', family: 'Structure' };
    }
    return { color: '#A7B0C0', emoji: '⚪', family: 'Autre' };
}

/**
 * ⚠️ ATTENTION : les event listeners `.unit-box-header` ajoutés en fin de fonction
 * dupliquent en partie le onclick inline de displayVocabList (toggle arrow/content) — fidèle
 * au monolithe, qui fait bien les deux (pas une redondance introduite par le portage).
 */
export function showGrammarHome(levelId, data, examples = null, isBack = false) {
    const container = document.getElementById('category-content');
    if (!Array.isArray(data)) {
        container.innerHTML = '<div style="color:var(--gray)">Structure invalide</div>';
        return;
    }

    if (!isBack) history.pushState({ view: 'grammar-home' }, '');

    state.grammarHomeData = { levelId, data, examples };

    const groupedByUnit = {};
    data.forEach(lesson => {
        const unitKey = lesson.unit || 'unknown';
        const unitTitle = lesson.unit_title || `Unité ${unitKey}`;

        if (!groupedByUnit[unitKey]) {
            groupedByUnit[unitKey] = { title: unitTitle, lessons: [] };
        }
        groupedByUnit[unitKey].lessons.push(lesson);
    });

    const sortedUnits = Object.keys(groupedByUnit).sort((a, b) => Number(a) - Number(b));

    let html = `<div class="grammar-container">`;

    html += !state.bulkSelectMode ? `<div style="display:flex;gap:8px">
        <button class="bulk-select-toggle-btn" onclick="enterBulkSelectMode(refreshGrammarHome)">☑ Sélectionner</button>
    </div>` : '';

    html += sortedUnits.map((unitKey, unitIdx) => {
        const unit = groupedByUnit[unitKey];
        const tracking = getTrackingData();
        const unitMastered = unit.lessons.filter(l => tracking[l.id]?.status === 'mastered').length;
        const unitId = `unit-${unitKey}`;
        const lessonNumber = String(unitIdx + 1).padStart(1, '0');

        return `
            <div class="unit-box-wrapper">
                <div class="unit-box-header">
                    <div class="Ocean"><div class="wave"></div></div>
                    <svg xmlns="http://www.w3.org/2000/svg"><rect class="border" pathLength="100"></rect></svg>
                    <div class="unit-box-title">
                        ${state.bulkSelectMode ? `<input type="checkbox" class="bulk-cat-checkbox" onclick='event.stopPropagation(); toggleCategoryMasteryLive(this, ${JSON.stringify(unit.lessons.map(l => l.id))})' ${unit.lessons.every(l => getItemStatus(l.id) === 'mastered') ? 'checked' : ''}>` : ''}
                        <span class="unit-box-arrow">▶</span>
                        <span>${lessonNumber} - ${unit.title.toUpperCase()}</span>
                    </div>
                    <div class="unit-box-counter">${unitMastered}/${unit.lessons.length}</div>
                    <div class="glass-reflect-bottom"></div>
                </div>

                <div class="unit-box-content" id="${unitId}">
                    ${unit.lessons.map((lesson) => {
                        const status = getItemStatus(lesson.id);
                        const badgeText = lesson.badge || 'Leçon';
                        const itemText = lesson.item || lesson.pattern || 'Formule';
                        const titleText = lesson.title || lesson.meaning || 'Sans titre';
                        const badgeStyle = getFamilyColor(badgeText);

                        return `
                            <div class="lesson-card-in-box ${isBulkSelected(lesson.id) ? 'bulk-selected' : ''}" onclick="handleListItemClick(this, '${lesson.id}', () => showGrammarDetail('${lesson.id}'))">
                                <div class="card-header-in-box">
                                    <span class="lesson-badge-in-box" style="background: ${badgeStyle.color}22; color: ${badgeStyle.color}; border: 1px solid ${badgeStyle.color}66; box-shadow: 0 0 8px ${badgeStyle.color}33;">
                                        ${badgeStyle.emoji} ${badgeText}
                                    </span>
                                    ${status === 'favorited' ? '<span class="status-icon-in-box favorited">❤</span>' : ''}
                                </div>
                                ${status === 'mastered' ? '<span class="mastered-check">✔</span>' : ''}
                                <div class="card-item-in-box">${itemText}</div>
                                <div class="card-title-in-box">${titleText}</div>
                                ${(() => {
                                    const firstSection = lesson.sections && lesson.sections[0];
                                    if (!firstSection) return '';
                                    const raw = firstSection.text || (Array.isArray(firstSection.paragraphs) ? firstSection.paragraphs[0] : '') || '';
                                    const plain = raw.replace(/<[^>]*>/g, '');
                                    if (!plain) return '';
                                    return `<div class="card-description-in-box">${plain.substring(0, 50)}...</div>`;
                                })()}
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }).join('');

    html += `</div>`;

    container.innerHTML = html;

    document.querySelectorAll('.unit-box-header').forEach(header => {
        header.addEventListener('click', function() {
            const wrapper = this.closest('.unit-box-wrapper');
            const isOpen = wrapper.classList.contains('active');

            // Accordéon strict (maquette "menu grammaire.html") : ferme toutes les autres
            // unités avant d'ouvrir celle cliquée — une seule ouverte à la fois.
            document.querySelectorAll('.unit-box-wrapper.active').forEach(el => {
                el.classList.remove('active');
                el.querySelector('.unit-box-arrow')?.classList.remove('open');
                el.querySelector('.unit-box-content')?.classList.remove('open');
            });

            if (!isOpen) {
                wrapper.classList.add('active');
                this.querySelector('.unit-box-arrow').classList.add('open');
                this.nextElementSibling.classList.add('open');
            }
        });
    });
}

/* ══════════════════════════════════════════════════
   FICHE DÉTAIL D'UNE LEÇON
══════════════════════════════════════════════════ */

/**
 * ⚠️ ATTENTION : startSpecificGrammarLesson existe réellement dans learning/exercises.js
 * (portée), mais l'importer ici créerait un cycle confirmé : exercises.js importe déjà
 * features/grammar.js (pour buildConfusionBoxHtml/buildParticleComparisonHtml/etc.). Vrai
 * appel JS non importé (bouton "Revoir le cours animé").
 */
export function showGrammarDetail(lessonId, isBack = false) {
    hideBottomNav();
    const { levelId, data } = state.grammarHomeData || {};
    document.getElementById('main-content').innerHTML = `<div id="category-content" style="padding:16px"></div>`;
    const container = document.getElementById('category-content');
    const lesson = data.find(l => l.id === lessonId);

    if (!lesson) {
        container.innerHTML = '<div style="color:var(--gray)">Leçon non trouvée</div>';
        return;
    }

    if (!isBack) history.pushState({ view: 'grammar-detail', lessonId }, '');

    const status = getItemStatus(lesson.id);
    const itemText = lesson.item || lesson.pattern || 'Formule';
    const titleText = lesson.title || lesson.meaning || 'Sans titre';
    const patternText = lesson.pattern || itemText;
    const lessonNum = lesson.lesson_number ? String(lesson.lesson_number).padStart(2, '0') : '01';
    const unitText = lesson.unit_title || `Unité ${lesson.unit}`;
    const levelLabel = lesson.level || (levelId ? levelId.toUpperCase() : 'N5');

    const highlightText = (text, highlight) => {
        const target = Array.isArray(highlight) ? highlight[0] : highlight;
        if (!text || !target) return text || '';
        return text.replace(
            new RegExp(`(${target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'g'),
            '<span class="highlight-grammar">$1</span>'
        );
    };

    const resolvedExamples = Array.isArray(lesson.examples) ? lesson.examples : [];

    let html = backFAB('history.back()') + `<div class="detail-page">
        <div class="stars-bg"><div class="stars"></div><div class="stars2"></div><div class="stars3"></div></div>
        <div class="detail-header-top">
            <div class="header-info">
                <div class="lesson-title">Leçon ${lessonNum}</div>
                <div class="lesson-subtitle">${levelLabel} • ${unitText}</div>
            </div>
        </div>

        <div class="grammar-point-box">
            <div class="grammar-point-content">
                <div class="section-label">POINT DE GRAMMAIRE</div>
                <div class="item-display">${itemText}</div>
                ${getItemRomaji(itemText, lesson.item_romaji) ? `<div class="item-romaji">${getItemRomaji(itemText, lesson.item_romaji)}</div>` : ''}
                <div class="item-description">${titleText}</div>
                <div class="pattern-box">${highlightText(patternText, itemText)}</div>
            </div>
            <div class="glass-reflect-bottom"></div>
        </div>

        <div class="action-buttons">
            <button class="link-btn" onclick="startSpecificGrammarLesson('${lesson.id}', '${levelId}')">Revoir le cours animé &nbsp;&nbsp;▶︎</button>
            <button class="revise-btn ${status === 'mastered' ? 'active' : ''}" onclick="trackItem('${lesson.id}', '${status === 'mastered' ? 'null' : 'mastered'}'); showGrammarDetail('${lesson.id}')">
                ${status === 'mastered' ? '✓ Maîtrisé' : '✓ Marquer comme maîtrisé'}
            </button>
        </div>

        ${lesson.sections && Array.isArray(lesson.sections) ? lesson.sections.map(section => {
            const hasBlocks = Array.isArray(section.blocks) && section.blocks.length > 0;
            const wrapperClass = hasBlocks ? 'detail-section grammar-usage-box' : 'detail-section';
            return `
                <div class="${wrapperClass}">
                    <div class="section-label">${section.label || 'Section'}</div>
                    <div class="section-content-box">
                        ${renderSectionBody(section, { includeBlocks: false })}
                    </div>
                </div>
                ${hasBlocks ? renderSectionBlocks(section) : ''}
            `;
        }).join('') : ''}

        ${resolvedExamples.length > 0 ? `
            <div class="examples-section-label">EXEMPLES</div>
            <div class="examples-container">
                ${resolvedExamples.map(example => buildSpeakableExampleHtml(
                    highlightText(example.japanese || '', example.highlight || ''),
                    example.romaji || '',
                    example.french || '',
                    stripRubyForSpeech(example.japanese || '').replace(/'/g, "\\'")
                )).join('')}
            </div>
        ` : ''}

        ${Array.isArray(lesson.confusions) && lesson.confusions.length ? `
            <div class="examples-section-label">POINTS DE VIGILANCE</div>
            ${lesson.confusions.map(c => buildConfusionBoxHtml(c)).join('')}
        ` : ''}

        <div class="favorite-btn-section">
            <button class="favorite-btn ${status === 'favorited' ? 'active' : ''}" onclick="trackItem('${lesson.id}', '${status === 'favorited' ? 'null' : 'favorited'}'); showGrammarDetail('${lesson.id}')">
                ${status === 'favorited' ? '❤ Favorisé' : '🤍 Ajouter aux favoris'}
            </button>
        </div>
    </div>`;

    container.innerHTML = html;
}
