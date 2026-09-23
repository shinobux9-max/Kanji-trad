/**
 * js/ui/mixed-review.js
 * Révision mixte (Vocab + Grammaire + Kanji-flashcard + Kana mélangés) — partagée entre
 * l'onglet "Apprendre" et le bouton "Réviser aujourd'hui" de l'accueil, seule la file en
 * entrée et le nom d'état modal (destination du bouton retour) diffèrent.
 *
 * Extrait de ui/cards.js (audit Phase 5, ETAT-ACTUEL.md : "session mixte"). Réutilise
 * buildCardDisplay()/getEntryLabel() (features/free-training.js) et getEntryTrackingId()
 * (learning/srs.js), déjà portées — aucune duplication.
 */

import { state } from '../core/state.js';
import { backFAB, showFicheCorrectionModal } from './common.js';
import { pushModalState } from '../core/navigation.js';
import { gradeReview, scheduleRelearning, recordSessionCompleted, getEntryTrackingId } from '../learning/srs.js';
import { buildCardDisplay, getEntryLabel } from '../features/free-training.js';
import { addDailyNewCardsUsed } from './dashboard.js';

export function launchMixedReviewSession(queue, exitState = 'apprendre-discovery', trackDailyQuota = false) {
    if (queue.length === 0) {
        alert("Rien à réviser aujourd'hui, tous types confondus ! 🎉");
        return;
    }

    pushModalState(exitState);

    state.mixedReviewSession = {
        queue,
        index: 0,
        results: { again: 0, hard: 0, good: 0, easy: 0 },
        flipped: false,
        // true uniquement pour "Réviser aujourd'hui" (accueil) — crédite le quota journalier
        // carte par carte au fur et à mesure de la notation, pas d'un coup au lancement
        // (sinon quitter en cours de session faisait croire à tort que tout avait déjà été vu).
        trackDailyQuota
    };

    document.getElementById('main-content').innerHTML = `<div id="category-content" style="padding:16px"></div>`;
    renderMixedReviewScreen();
}

export function renderMixedReviewScreen() {
    const container = document.getElementById('category-content');
    const session = state.mixedReviewSession;

    if (!session || session.index >= session.queue.length) {
        renderMixedReviewSummary();
        return;
    }

    const entry = session.queue[session.index];
    const progress = session.index + 1;
    const total = session.queue.length;
    const flipped = session.flipped;

    const { front, back, typeLabel, frontSize } = buildCardDisplay(entry);

    container.innerHTML = `${backFAB('history.back()', '✕')}<div class="review-page">
        <div class="review-header">
            <div class="review-progress-bar"><div class="review-progress-fill" style="width:${(session.index / total) * 100}%"></div></div>
            <div class="review-progress-text">${progress} / ${total}</div>
        </div>
        <div class="review-type-tag">${typeLabel}</div>
        <div class="review-card ${flipped ? 'flipped' : ''}" onclick="${flipped ? '' : 'flipMixedReviewCard()'}">
            <div class="review-card-front">
                <div class="review-word" style="font-size:${frontSize}px;">${front}</div>
            </div>
            ${flipped ? `<div class="review-card-back">${back}<button class="fiche-correction-btn" onclick="openMixedReviewCurrentFiche()">📖 Voir la fiche</button></div>` : `<div class="review-tap-hint">Touche la carte pour révéler</div>`}
        </div>
        ${flipped ? `
            <div class="review-grade-buttons">
                <button class="grade-btn grade-again" onclick="submitMixedReviewGrade(0)">Encore</button>
                <button class="grade-btn grade-hard" onclick="submitMixedReviewGrade(1)">Difficile</button>
                <button class="grade-btn grade-good" onclick="submitMixedReviewGrade(2)">Bien</button>
                <button class="grade-btn grade-easy" onclick="submitMixedReviewGrade(3)">Facile</button>
            </div>
        ` : ''}
    </div>`;
}

export function flipMixedReviewCard() {
    if (!state.mixedReviewSession) return;
    state.mixedReviewSession.flipped = true;
    renderMixedReviewScreen();
}

// Équivalent du onclick="showFicheCorrectionModal(mixedReviewSession.queue[mixedReviewSession
// .index])" du monolithe — adapté car state.mixedReviewSession est une propriété d'import de
// module, inaccessible depuis un attribut onclick. Même principe que openTrainingCurrentFiche
// (features/free-training.js) / replayKanaTraceQuiz (features/kana.js).
export function openMixedReviewCurrentFiche() {
    if (!state.mixedReviewSession) return;
    const entry = state.mixedReviewSession.queue[state.mixedReviewSession.index];
    if (entry) showFicheCorrectionModal(entry);
}

export function submitMixedReviewGrade(quality) {
    if (!state.mixedReviewSession) return;
    const entry = state.mixedReviewSession.queue[state.mixedReviewSession.index];
    const id = getEntryTrackingId(entry);
    gradeReview(id, quality, { type: entry.type, label: getEntryLabel(entry) });
    if (quality === 0) scheduleRelearning(state.mixedReviewSession, entry);
    if (state.mixedReviewSession.trackDailyQuota && entry.isNew && !entry._dailyCredited) {
        addDailyNewCardsUsed(1);
        entry._dailyCredited = true;
    }

    const labels = ['again', 'hard', 'good', 'easy'];
    state.mixedReviewSession.results[labels[quality]]++;

    state.mixedReviewSession.index++;
    state.mixedReviewSession.flipped = false;
    renderMixedReviewScreen();
}

export function renderMixedReviewSummary() {
    recordSessionCompleted();
    const container = document.getElementById('category-content');
    const r = state.mixedReviewSession.results;
    const total = state.mixedReviewSession.queue.length;

    container.innerHTML = `<div class="review-summary">
        <div class="review-summary-title">Session terminée ! 🎉</div>
        <div class="review-summary-count">${total} carte${total > 1 ? 's' : ''} révisée${total > 1 ? 's' : ''}</div>
        <div class="review-summary-stats">
            <div class="review-stat"><span class="review-stat-dot again"></span>Encore : ${r.again}</div>
            <div class="review-stat"><span class="review-stat-dot hard"></span>Difficile : ${r.hard}</div>
            <div class="review-stat"><span class="review-stat-dot good"></span>Bien : ${r.good}</div>
            <div class="review-stat"><span class="review-stat-dot easy"></span>Facile : ${r.easy}</div>
        </div>
        <button class="revise-btn" style="margin-top:20px;" onclick="history.back()">Retour</button>
    </div>`;
    state.mixedReviewSession = null;
}
