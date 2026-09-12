/* ==========================================
   js/app.js — Point d'entrée principal (ESM)
   ========================================== */

// 1. CORE (Fondations & Système)
import { initState, getState, setState } from './core/state.js';
import { initStorage, loadUserData, saveUserData } from './core/storage.js';
import { initNavigation, bottomNavGo, toggleSearch, clearSearch, debouncedDoSearch } from './core/navigation.js';
import { loadAllData } from './core/data-loader.js';

// 2. LEARNING (Algorithmes & Répétition)
import { initSRS, processReviewAnswer } from './learning/srs.js';
import { initWeaknessWidget, loadWeaknessItems } from './learning/weakness.js';
import { initExercises, startQuizMode, launchQuizMode, launchStrokeMode, launchKanaTraceMode } from './learning/exercises.js';
import { initLearningPath } from './learning/learning-path.js';

// 3. FEATURES (Modules Métier spécifiques)
import { initKanjiModule, replayAnimation, launchDetailTrace, toggleDetailMastery, openFolderModal, closeFolderModal, confirmNewFolder } from './features/kanji.js';
import { initVocabularyModule } from './features/vocabulary.js';
import { initGrammarModule } from './features/grammar.js';
import { initKanaModule } from './features/kana.js';
import { initQuizModule, closeQuiz, togglePause, toggleExamples, continueAfterFeedback } from './features/quiz.js';
import { initStrokeModule, closeStrokeQuiz, toggleStrokePause } from './features/stroke.js';
import { initOralModule, startOralTest } from './features/oral.js';
import { initFreeTrainingModule } from './features/free-training.js';

// 4. UI (Composants visuels, modales & popups)
import { initDashboardUI } from './ui/dashboard.js';
import { initCardsUI } from './ui/cards.js';
import { 
    closeQuizModal, 
    closeKanaTraceModal, 
    closeDailyGoalModal, 
    saveDailyGoalFromModal, 
    closeLessonReferencePopup, 
    closeKanaTablePopup, 
    closeFicheCorrectionModal 
} from './ui/modals.js';
import { initCommonUI, exitBulkSelectMode } from './ui/common.js';

// --- Initialisation globale au chargement du DOM ---
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await loadAllData();
        initStorage();
        initState();

        initNavigation();
        initCommonUI();
        initDashboardUI();

        initKanjiModule();
        initVocabularyModule();
        initGrammarModule();
        initKanaModule();

        console.log("🚀 Application initialisée avec succès !");
    } catch (error) {
        console.error("❌ Erreur lors de l'initialisation de l'application :", error);
    }
});