/**
 * js/ui/dashboard.js
 * Rendu complet et rafraîchissement du Tableau de Bord (Dashboard)
 */

import { getTrackingData } from '../core/storage.js';
import { state } from '../core/state.js';

/**
 * Calcule et met à jour l'ensemble des métriques de la page d'accueil
 */
export function updateDashboardStats() {
    const tracking = getTrackingData();
    const trackingItems = Object.values(tracking);
    const now = new Date();

    // 1. Compteurs globaux par statut
    let learned = 0;
    let reviewing = 0;
    let dueToday = 0;

    trackingItems.forEach(item => {
        if (item.status === 'learned') learned++;
        if (item.status === 'reviewing') reviewing++;

        // Vérification des révisions dues (SRS)
        if (item.nextReview && new Date(item.nextReview) <= now) {
            dueToday++;
        }
    });

    // 2. Mise à jour des éléments du DOM
    const elLearned = document.getElementById('stat-learned-count');
    const elReviewing = document.getElementById('stat-reviewing-count');
    const elDue = document.getElementById('stat-due-count');
    const elTotalData = document.getElementById('stat-total-data');

    if (elLearned) elLearned.textContent = learned;
    if (elReviewing) elReviewing.textContent = reviewing;
    if (elDue) elDue.textContent = dueToday;

    if (elTotalData) {
        const totalItems = state.data.kanjiDb.length + state.data.vocabDb.length + state.data.grammarDb.length;
        elTotalData.textContent = totalItems;
    }
}

/**
 * Initialise les événements et raccourcis du dashboard
 */
export function initDashboardUI() {
    updateDashboardStats();

    const startReviewBtn = document.getElementById('btn-start-dashboard-review');
    if (startReviewBtn) {
        startReviewBtn.addEventListener('click', () => {
            // Déclenchera la file de révision SRS
            if (typeof window.startSrsReviewSession === 'function') {
                window.startSrsReviewSession();
            }
        });
    }
}