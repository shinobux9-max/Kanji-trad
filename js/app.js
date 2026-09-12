/**
 * js/app.js
 * Point d'entrée principal et chef d'orchestre de l'application
 */

import { loadKanjiData, loadVocabData, loadGrammarData } from './core/data-loader.js';
import { initNavigation, navigateTo } from './core/navigation.js';
import { initModalListeners } from './ui/modals.js';
import { updateDashboardStats, initDashboardUI } from './ui/dashboard.js';
import { renderKanjiGrid } from './features/kanji.js';
import { renderVocabGrid } from './features/vocabulary.js';
import { renderGrammarGrid } from './features/grammar.js';
import { state } from './core/state.js';

/**
 * Initialisation au chargement de l'application
 */
async function initApp() {
    console.log("Initialisation de l'architecture modulaire Kanji-trad...");

    try {
        // 1. Activer la navigation et le système de modales
        initNavigation();
        initModalListeners();

        // 2. Charger toutes les bases de données JSON en parallèle
        await Promise.all([
            loadKanjiData(),
            loadVocabData(),
            loadGrammarData()
        ]);

        console.log("Toutes les données ont été chargées avec succès.");

        // 3. Initialiser les vues et le dashboard
        initDashboardUI();

        // 4. Pré-afficher le contenu initial (niveau N5 par exemple)
        renderKanjiGrid('kanji-grid', state.currentJLPTLevel);
        renderVocabGrid('vocab-list', state.currentJLPTLevel);
        renderGrammarGrid('grammar-list', state.currentJLPTLevel);

        // 5. Afficher le Dashboard au démarrage
        navigateTo('dashboard-screen', { pushHistory: false });

    } catch (error) {
        console.error("Erreur lors de l'initialisation de l'application :", error);
    }
}

// Lancement au DOMContentLoaded
document.addEventListener('DOMContentLoaded', initApp);