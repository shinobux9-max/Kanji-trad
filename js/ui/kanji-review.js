/**
 * js/ui/kanji-review.js
 * Sélecteur de mode de révision kanji (flashcard / tracé normal / tracé difficile /
 * entraînement libre) et la session de révision flashcard kanji elle-même, plus le point
 * d'entrée "⚡ Quiz" des dossiers qui réutilise ce même sélecteur.
 *
 * Extrait de ui/cards.js (audit Phase 5, ETAT-ACTUEL.md : "sélecteurs de mode" + "dossiers")
 * — reste dans ui/ (pas features/) pour la même raison que l'ancien cards.js : besoin
 * d'importer à la fois features/kanji.js ET features/strokes.js, impossible depuis l'un ou
 * l'autre (cycle direct sinon, vérifié SANS cycle avant d'écrire).
 */

import { state } from '../core/state.js';
import { backFAB, hideBottomNav } from './common.js';
import { pushModalState } from '../core/navigation.js';
import { getDueKanjiChars, buildReadingChips, loadFolders } from '../features/kanji.js';
import { startStrokeQuiz } from '../features/strokes.js';
import { showFreeTrainingConfig } from '../features/free-training.js';
import { gradeReview, scheduleRelearning, recordSessionCompleted } from '../learning/srs.js';

/* ══════════════════════════════════════════════════
   MODE DE RÉVISION KANJI — flashcard + tracé (normal/hardcore)
══════════════════════════════════════════════════ */
// Liste de kanji actuellement proposée par le sélecteur de mode — par défaut les kanji dus
// (onglet Réviser), mais peut être surchargée pour une source différente (ex: le contenu
// d'un dossier, voir startKanjiQuizForFolder() plus bas). Lue par startKanjiFlashcardReview()/
// startKanjiTraceReview() au moment du choix du mode.
let _kanjiReviewModeChars = null;
// true quand la file vient d'un dossier (startKanjiQuizForFolder) plutôt que d'un niveau JLPT
// (onglet Réviser) — détermine où le bouton retour du sélecteur ET de la session flashcard
// doit renvoyer (navFolders() au lieu de loadJLPTCategory(state.kanjiHomeData...), qui n'a pas
// de sens quand on n'est jamais passé par un niveau JLPT). Bug trouvé en test réel : le retour
// depuis une session lancée par un dossier retombait sur un niveau JLPT sans rapport (ou ne
// faisait rien si state.kanjiHomeData était vide) — voir les entrées *-folder du registre dans
// core/navigation.js.
let _kanjiReviewFromFolder = false;

/**
 * @param {string[]} [chars] - liste explicite de kanji à réviser (ex: contenu d'un dossier).
 *   Omis = comportement d'origine, kanji actuellement dus (onglet Réviser).
 * @param {boolean} [fromFolder] - true si chars vient d'un dossier (voir _kanjiReviewFromFolder).
 */
export function showKanjiReviewModeSelector(chars = null, fromFolder = false) {
    hideBottomNav();
    const container = document.getElementById('category-content');
    const dueChars = chars || getDueKanjiChars();
    _kanjiReviewModeChars = dueChars;
    _kanjiReviewFromFolder = fromFolder;

    if (dueChars.length === 0) {
        alert('Rien à réviser pour le moment ! 🎉');
        return;
    }

    pushModalState(fromFolder ? 'kanji-review-selector-folder' : 'kanji-review-selector');

    container.innerHTML = `
        <div class="review-mode-selector">
            ${backFAB()}
            <div class="review-mode-title">Choisis ton mode de révision</div>
            <div class="review-mode-count">${dueChars.length} kanji à revoir</div>

            <button class="review-mode-btn" onclick="startKanjiFlashcardReview()">
                <span class="review-mode-icon">🗂️</span>
                <div><div class="review-mode-name">Flashcard</div><div class="review-mode-desc">Lecture et sens</div></div>
            </button>
            <button class="review-mode-btn" onclick="startKanjiTraceReview('trace-easy')">
                <span class="review-mode-icon">✍️</span>
                <div><div class="review-mode-name">Tracé normal</div><div class="review-mode-desc">Avec assistance</div></div>
            </button>
            <button class="review-mode-btn" onclick="startKanjiTraceReview('trace-hard')">
                <span class="review-mode-icon">🔥</span>
                <div><div class="review-mode-name">Tracé difficile</div><div class="review-mode-desc">Sans assistance (hardcore)</div></div>
            </button>
            <button class="review-mode-btn" onclick="startKanjiFreeTrainingFromSelector()">
                <span class="review-mode-icon">🏋️</span>
                <div><div class="review-mode-name">Entraînement libre</div><div class="review-mode-desc">Configurable, sans impact sur le SRS</div></div>
            </button>
        </div>`;
}

// Équivalent du onclick="showFreeTrainingConfig(false, {type:'kanji', level: kanjiHomeData
// ?.levelId})" du monolithe — adapté car state.kanjiHomeData est une propriété d'import de
// module, inaccessible depuis un attribut onclick. Même principe que replayKanaTraceQuiz.
export function startKanjiFreeTrainingFromSelector() {
    showFreeTrainingConfig(false, { type: 'kanji', level: state.kanjiHomeData?.levelId });
}

export function startKanjiTraceReview(mode) {
    hideBottomNav();
    const dueChars = _kanjiReviewModeChars || getDueKanjiChars();
    if (dueChars.length === 0) return;
    startStrokeQuiz({ type: 'queue', id: dueChars, mode });
}

export function startKanjiFlashcardReview() {
    hideBottomNav();
    const dueChars = _kanjiReviewModeChars || getDueKanjiChars();
    if (dueChars.length === 0) return;

    pushModalState(_kanjiReviewFromFolder ? 'kanji-review-flashcard-folder' : 'kanji-review-flashcard');

    state.kanjiReviewSession = {
        queue: dueChars,
        index: 0,
        results: { again: 0, hard: 0, good: 0, easy: 0 },
        flipped: false
    };
    document.getElementById('main-content').innerHTML = `<div id="category-content" style="padding:16px"></div>`;
    renderKanjiReviewScreen();
}

export function renderKanjiReviewScreen() {
    const container = document.getElementById('category-content');
    const session = state.kanjiReviewSession;

    if (!session || session.index >= session.queue.length) {
        renderKanjiReviewSummary();
        return;
    }

    const char = session.queue[session.index];
    const kanjiData = state.data.kanjiDb.find(k => k.char === char);
    const progress = session.index + 1;
    const total = session.queue.length;
    const flipped = session.flipped;

    const meanings = (kanjiData?.meanings || []).filter(m => !m.toLowerCase().includes('radical'));
    const onReadings = kanjiData?.on || [];
    const kunReadings = kanjiData?.kun || [];

    container.innerHTML = `${backFAB('history.back()', '✕')}<div class="review-page">
        <div class="review-header">
            <div class="review-progress-bar"><div class="review-progress-fill" style="width:${(session.index / total) * 100}%"></div></div>
            <div class="review-progress-text">${progress} / ${total}</div>
        </div>

        <div class="review-card ${flipped ? 'flipped' : ''}" onclick="${flipped ? '' : 'flipKanjiReviewCard()'}">
            <div class="review-card-front">
                <div class="review-word" style="font-size:3.5rem;">${char}</div>
            </div>
            ${flipped ? `
                <div class="review-card-back">
                    ${(onReadings.length || kunReadings.length) ? `<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-bottom:12px">${buildReadingChips(kanjiData, { maxOn: 3, maxKun: 3 })}</div>` : ''}
                    <div class="review-meaning">${meanings.slice(0, 3).join(' / ') || '–'}</div>
                </div>
            ` : `<div class="review-tap-hint">Touche la carte pour révéler</div>`}
        </div>

        ${flipped ? `
            <div class="review-grade-buttons">
                <button class="grade-btn grade-again" onclick="submitKanjiReviewGrade(0)">Encore</button>
                <button class="grade-btn grade-hard" onclick="submitKanjiReviewGrade(1)">Difficile</button>
                <button class="grade-btn grade-good" onclick="submitKanjiReviewGrade(2)">Bien</button>
                <button class="grade-btn grade-easy" onclick="submitKanjiReviewGrade(3)">Facile</button>
            </div>
        ` : ''}
    </div>`;
}

export function flipKanjiReviewCard() {
    if (!state.kanjiReviewSession) return;
    state.kanjiReviewSession.flipped = true;
    renderKanjiReviewScreen();
}

export function submitKanjiReviewGrade(quality) {
    if (!state.kanjiReviewSession) return;
    const char = state.kanjiReviewSession.queue[state.kanjiReviewSession.index];
    gradeReview(char, quality, { type: 'kanji', label: char });
    if (quality === 0) scheduleRelearning(state.kanjiReviewSession, char);

    const labels = ['again', 'hard', 'good', 'easy'];
    state.kanjiReviewSession.results[labels[quality]]++;

    state.kanjiReviewSession.index++;
    state.kanjiReviewSession.flipped = false;
    renderKanjiReviewScreen();
}

export function renderKanjiReviewSummary() {
    recordSessionCompleted();
    const container = document.getElementById('category-content');
    const r = state.kanjiReviewSession.results;
    const total = state.kanjiReviewSession.queue.length;

    container.innerHTML = `<div class="review-summary">
        <div class="review-summary-title">Session terminée ! 🎉</div>
        <div class="review-summary-count">${total} kanji révisé${total > 1 ? 's' : ''}</div>
        <div class="review-summary-stats">
            <div class="review-stat"><span class="review-stat-dot again"></span>Encore : ${r.again}</div>
            <div class="review-stat"><span class="review-stat-dot hard"></span>Difficile : ${r.hard}</div>
            <div class="review-stat"><span class="review-stat-dot good"></span>Bien : ${r.good}</div>
            <div class="review-stat"><span class="review-stat-dot easy"></span>Facile : ${r.easy}</div>
        </div>
        <button class="revise-btn" style="margin-top:20px;" onclick="history.back()">Retour aux kanji</button>
    </div>`;
    state.kanjiReviewSession = null;
}

/**
 * Remplace l'ancien "⚡ Quiz" des dossiers (features/quiz.js::startFolderQuiz, système modal
 * lecture/sens retiré) — propose maintenant exactement les mêmes modes que Réviser > Kanji
 * (Flashcard, Tracé normal, Tracé difficile, Entraînement libre), appliqués au contenu du
 * dossier plutôt qu'aux kanji dus. Demandé explicitement.
 */
export function startKanjiQuizForFolder(folderName) {
    const folders = loadFolders();
    const chars = folders[folderName];
    if (!chars || chars.length === 0) {
        alert('Ce dossier est vide.');
        return;
    }
    // Bug trouvé en test réel : showKanjiReviewModeSelector() écrit directement dans
    // #category-content, que cette fonction ne créait jamais (contrairement à startRevisionFor
    // dans ui/cards.js, le seul autre appelant) — TypeError silencieuse au clic sur "⚡ Quiz".
    document.getElementById('main-content').innerHTML = `<div id="category-content" style="padding:16px"></div>`;
    showKanjiReviewModeSelector(chars, true);
}
