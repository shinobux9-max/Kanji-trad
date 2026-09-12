/**
 * js/core/navigation.js
 * Gestion de la navigation entre écrans et intégration d'history.pushState
 */

import { state } from './state.js';

export function navigateTo(screenId, options = {}) {
    const { pushHistory = true, title = '' } = options;

    // Masquer tous les écrans
    const screens = document.querySelectorAll('.screen, .page-section');
    screens.forEach(s => s.classList.add('hidden'));

    // Afficher l'écran ciblé
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.remove('hidden');
        window.scrollTo(0, 0);
    } else {
        console.warn(`Écran introuvable: ${screenId}`);
    }

    // Gestion de l'historique du navigateur
    if (pushHistory) {
        history.pushState({ screenId }, title, `#${screenId}`);
    }
}

export function initNavigation() {
    window.addEventListener('popstate', (event) => {
        if (event.state && event.state.screenId) {
            navigateTo(event.state.screenId, { pushHistory: false });
        }
    });
}