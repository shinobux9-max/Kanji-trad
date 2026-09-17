/**
 * js/app.js
 * Point d'entrée de l'application — bootstrap init(), initialisation des sous-systèmes
 * globaux (navigation par historique, swipe/tap, micro de recherche, pull-to-refresh), et
 * résolution du risque transversal onclick : le monolithe original génère énormément de HTML
 * avec des attributs onclick="maFonction(...)" — en ESM, les fonctions importées ne sont PAS
 * globales, donc chaque fonction encore référencée depuis du HTML généré doit être exposée
 * explicitement sur window ici, en une seule passe (voir HANDOFF.md, "Risque transversal").
 *
 * Toutes les fonctions référencées en onclick à travers les fichiers déjà portés sont
 * retrouvées et exposées ci-dessous (extraction programmatique par script, pas manuelle —
 * évite tout risque de faute de frappe sur un si grand nombre de noms).
 */

import { state } from './core/state.js';
import { initNavigation, closeSearchOverlay, bottomNavGo, toggleSearch, closeAllOverlaysAndSessions } from './core/navigation.js';
import { preloadAllGrammarLevels } from './core/data-loader.js';
import { trackItem } from './core/storage.js';

import { initSwipeNavigation } from './learning/exercises.js';
import { getRawItemsForTypeLevel } from './learning/srs.js';
import { initMicSearch } from './ui/modals.js';
import { recordDailyActivity, renderDashboard, setActiveBottomNav, showDashboard } from './ui/dashboard.js';

// ── Toutes les fonctions encore référencées depuis des attributs onclick="..." générés en
// HTML, groupées par fichier d'origine (générées programmatiquement, voir en-tête) ──
import { advanceTrainingQuiz, answerTrainingCard, endTrainingSession, onFreeTrainingModeChange, onFreeTrainingTypeChange, openTrainingCurrentFiche, retrainMistakes, showFreeTrainingConfig, startFreeTraining, submitTrainingQuizAnswer, launchFreeTraining, flipTrainingCard } from './features/free-training.js';
import { advanceGrammarReviewQueue, closeLessonReferencePopup, showGrammarHome, showLessonReferencePopup, startGrammarReview, submitGrammarQuizAnswer, submitGrammarReviewGrade, refreshGrammarHome, startGrammarFreeTrainingFromSelector, showGrammarDetail, renderSectionBody, buildConfusionBoxHtml, flipGrammarReviewCard } from './features/grammar.js';
import { kanaTraceHint, kanaTraceSkip, openKanaDetail, replayKanaTraceQuiz, showKanaRevisionModeSelector, startKanaFlashcardReview, startKanaTraceQuiz, startKanaTraceReview, submitKanaReviewGrade, showRevisionKanaPicker, refreshKanaScreen, closeKanaTraceModal, launchKanaTraceMode, resetKanaReviewSession, flipKanaReviewCard, loadKanas, showKanaLearningPicker, showKanaTraceModal, animateKanaChar } from './features/kana.js';
import { openDetail, openKanjiFromChar, promptCreateEmptyFolder, promptDeleteFolder, promptRenameFolder, toggleFmNewRow, toggleKanjiInFolder, refreshKanjiList, closeFolderModal, confirmNewFolder, openFolderModal, displayKanjiList, closeDetail, getJLPTLevel, navFolders } from './features/kanji.js';
import { speakSentence, speakText, startOralTest } from './features/oral.js';
import { closeStrokeQuiz, sqShowHint, sqSkip, startStrokeQuiz, launchDetailTrace, replayAnimation } from './features/strokes.js';
import { advanceReviewQueue, displayVocabList, openReviewRelatedGrammarFiche, startVocabReview, submitQuizAnswer, submitReviewGrade, openVocabDetailFromState, refreshVocabList, startVocabFreeTrainingFromSelector, showVocabDetail, flipReviewCard, showVocabReferencePopup, closeVocabReferencePopup } from './features/vocabulary.js';
import { advanceLessonStep, continueToNextLesson, exitLessonFlow, showExploreLessonsScreen, showKanaTablePopup, skipLessonOnboarding, startFreeTrainingFromLesson, startOnboardingChoice, startSpecificGrammarLesson, submitLessonExercise, closeKanaTablePopup, startGrammarLessonFlow } from './learning/exercises.js';
import { answerLearningExercise, completeLearningStep, continueLearningExercise, continueLearningPath, showLearningFicheCorrection, showLearningPathHome, startLearningPath, startLearningUnitById } from './learning/learning-path.js';
import { openWeaknessItem, trainWeaknessItems } from './learning/weakness.js';
import { closeFicheCorrectionModal, enterBulkSelectMode, handleListItemClick, showFicheCorrectionModal, toggleCategoryMasteryLive, exitBulkSelectMode, toggleDetailMastery } from './ui/common.js';
import { navDashboard, showDailyGoalModal, showProgressionDetail, startDashboardReview, closeDailyGoalModal, saveDailyGoalFromModal, showNiveauxScreen, navKana } from './ui/dashboard.js';
import { openGrammarFromSearch, openKanjiFromSearchHit, openVocabFromSearch, toggleSearchFilter, resetSearchFilters, clearSearch, debouncedDoSearch, showSearchPanel, hideSearchPanel } from './ui/modals.js';
import { showRevisionLevelPicker, startRevisionFor, showRevisionsScreen, showApprendreScreen, showCategoryDirect, loadJLPTCategory, startIntroductionOrResume } from './ui/cards.js';
import { showKanjiReviewModeSelector, startKanjiFlashcardReview, startKanjiFreeTrainingFromSelector, startKanjiTraceReview, submitKanjiReviewGrade, flipKanjiReviewCard, startKanjiQuizForFolder } from './ui/kanji-review.js';
import { showGrammarNiveauxScreen, showKanjiNiveauxScreen } from './ui/niveaux-screens.js';
import { launchMixedReviewSession, flipMixedReviewCard, openMixedReviewCurrentFiche, submitMixedReviewGrade } from './ui/mixed-review.js';

/* ══════════════════════════════════════════════════
   EXPOSITION SUR window — UNE SEULE PASSE, ici et nulle part ailleurs (voir HANDOFF.md)
══════════════════════════════════════════════════ */
const EXPOSED_FUNCTIONS = {
    trackItem, getRawItemsForTypeLevel,
    closeSearchOverlay, bottomNavGo, toggleSearch, setActiveBottomNav, closeAllOverlaysAndSessions, renderDashboard,
    // free-training.js
    advanceTrainingQuiz, answerTrainingCard, endTrainingSession, onFreeTrainingModeChange,
    onFreeTrainingTypeChange, openTrainingCurrentFiche, retrainMistakes, showFreeTrainingConfig,
    startFreeTraining, submitTrainingQuizAnswer, launchFreeTraining, flipTrainingCard,
    // grammar.js
    advanceGrammarReviewQueue, closeLessonReferencePopup, showGrammarHome, showLessonReferencePopup,
    startGrammarReview, submitGrammarQuizAnswer, submitGrammarReviewGrade, refreshGrammarHome,
    startGrammarFreeTrainingFromSelector, showGrammarDetail, renderSectionBody, buildConfusionBoxHtml, flipGrammarReviewCard,
    // kana.js
    kanaTraceHint, kanaTraceSkip, openKanaDetail, replayKanaTraceQuiz, showKanaRevisionModeSelector,
    startKanaFlashcardReview, startKanaTraceQuiz, startKanaTraceReview, submitKanaReviewGrade,
    showRevisionKanaPicker, refreshKanaScreen, closeKanaTraceModal, launchKanaTraceMode, resetKanaReviewSession, flipKanaReviewCard, loadKanas, showKanaLearningPicker, showKanaTraceModal, animateKanaChar,
    // kanji.js
    openDetail, openKanjiFromChar, promptCreateEmptyFolder,
    promptDeleteFolder, promptRenameFolder, toggleFmNewRow, toggleKanjiInFolder, refreshKanjiList,
    closeFolderModal, confirmNewFolder, openFolderModal, displayKanjiList, closeDetail, getJLPTLevel, navFolders,
    // oral.js
    speakSentence, speakText, startOralTest,
    // strokes.js
    closeStrokeQuiz, sqShowHint, sqSkip, startStrokeQuiz, launchDetailTrace, replayAnimation,
    // vocabulary.js
    advanceReviewQueue, displayVocabList, openReviewRelatedGrammarFiche, startVocabReview,
    submitQuizAnswer, submitReviewGrade, openVocabDetailFromState, refreshVocabList,
    startVocabFreeTrainingFromSelector, showVocabDetail, flipReviewCard, showVocabReferencePopup, closeVocabReferencePopup,
    // exercises.js
    advanceLessonStep, continueToNextLesson, exitLessonFlow, showExploreLessonsScreen,
    showKanaTablePopup, skipLessonOnboarding, startFreeTrainingFromLesson, startOnboardingChoice,
    startSpecificGrammarLesson, submitLessonExercise, closeKanaTablePopup, startGrammarLessonFlow,
    // learning-path.js
    answerLearningExercise, completeLearningStep, continueLearningExercise, continueLearningPath,
    showLearningFicheCorrection, showLearningPathHome, startLearningPath, startLearningUnitById,
    // weakness.js
    openWeaknessItem, trainWeaknessItems,
    // ui/common.js
    closeFicheCorrectionModal, enterBulkSelectMode, handleListItemClick, showFicheCorrectionModal,
    toggleCategoryMasteryLive, exitBulkSelectMode, toggleDetailMastery,
    // ui/dashboard.js
    navDashboard, showDailyGoalModal, showProgressionDetail, startDashboardReview, showDashboard,
    closeDailyGoalModal, saveDailyGoalFromModal, showNiveauxScreen, navKana,
    // ui/modals.js
    openGrammarFromSearch, openKanjiFromSearchHit, openVocabFromSearch, toggleSearchFilter,
    resetSearchFilters, clearSearch, debouncedDoSearch, showSearchPanel, hideSearchPanel,
    // ui/cards.js
    showRevisionLevelPicker, startRevisionFor, showRevisionsScreen, showApprendreScreen,
    showCategoryDirect, loadJLPTCategory, startIntroductionOrResume,
    // ui/kanji-review.js
    showKanjiReviewModeSelector, startKanjiFlashcardReview, startKanjiFreeTrainingFromSelector,
    startKanjiTraceReview, submitKanjiReviewGrade, flipKanjiReviewCard, startKanjiQuizForFolder,
    // ui/niveaux-screens.js
    showGrammarNiveauxScreen, showKanjiNiveauxScreen,
    // ui/mixed-review.js
    launchMixedReviewSession, flipMixedReviewCard, openMixedReviewCurrentFiche, submitMixedReviewGrade,
};
Object.entries(EXPOSED_FUNCTIONS).forEach(([name, fn]) => { window[name] = fn; });

/* ══════════════════════════════════════════════════
   PULL-TO-REFRESH — tirer vers le bas en haut de l'écran pour actualiser
   ─────────────────────────────────────────────────
   Équivalent EXACT de l'IIFE initPullToRefresh() du monolithe. Entièrement autonome (aucune
   dépendance vers un autre module), gardée locale à ce fichier plutôt qu'exportée ailleurs —
   contrairement au monolithe qui l'auto-exécutait en IIFE au chargement du script, exposée
   ici comme fonction appelée explicitement par init() (même traitement que
   initNavigation()/initSwipeNavigation()/initMicSearch(), pas d'effet de bord au chargement
   du module).
══════════════════════════════════════════════════ */
function initPullToRefresh() {
    const container = document.getElementById('main-content');
    if (!container) return;

    const PULL_THRESHOLD = 80;
    let startY = 0;
    let pulling = false;
    let indicator = null;

    function ensureIndicator() {
        if (indicator) return indicator;
        indicator = document.createElement('div');
        indicator.id = 'ptr-indicator';
        indicator.innerText = '↓';
        document.body.appendChild(indicator);
        return indicator;
    }

    container.addEventListener('touchstart', (e) => {
        pulling = container.scrollTop <= 0;
        if (pulling) startY = e.touches[0].clientY;
    }, { passive: true });

    container.addEventListener('touchmove', (e) => {
        if (!pulling) return;
        const deltaY = e.touches[0].clientY - startY;
        if (deltaY > 0 && container.scrollTop <= 0) {
            const ind = ensureIndicator();
            const pull = Math.min(deltaY, PULL_THRESHOLD * 1.5);
            ind.style.opacity = Math.min(pull / PULL_THRESHOLD, 1);
            ind.style.transform = `translateX(-50%) translateY(${pull}px) rotate(${pull * 3}deg)`;
            ind.classList.toggle('ready', pull >= PULL_THRESHOLD);
            ind.dataset.pull = pull;
        }
    }, { passive: true });

    container.addEventListener('touchend', () => {
        if (!pulling) return;
        pulling = false;
        if (indicator) {
            const pull = parseFloat(indicator.dataset.pull || 0);
            if (pull >= PULL_THRESHOLD) {
                indicator.classList.add('loading');
                indicator.innerText = '↻';
                setTimeout(() => location.reload(), 300);
            } else {
                indicator.style.opacity = 0;
                indicator.style.transform = 'translateX(-50%) translateY(0)';
            }
        }
    }, { passive: true });
}

/* ══════════════════════════════════════════════════
   BOOTSTRAP — équivalent EXACT de init() du monolithe
══════════════════════════════════════════════════ */
async function init() {
    const mainContent = document.getElementById('main-content');

    mainContent.innerHTML = `
        <div style="height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px">
            <div class="spinner"></div>
            <div style="font-size:0.8125rem;color:var(--gray)">Chargement de la base de données…</div>
        </div>`;

    try {
        // Chargement en parallèle : mapping JLPT + Kanjis (fichier local, pas de dépendance
        // réseau vers raw.githubusercontent.com qui pouvait faire planter tout init()).
        const [mappingRes, kanjiRes] = await Promise.all([
            fetch('./data/mapping.json', { cache: 'no-store' }),
            fetch('./data/kanji_jouyou_fr.json', { cache: 'no-store' })
        ]);

        if (!kanjiRes.ok) throw new Error(`Erreur réseau kanji : ${kanjiRes.status}`);

        if (mappingRes.ok) {
            state.jlptMapping = await mappingRes.json();
            console.log('✅ Mapping JLPT chargé');
        } else {
            console.warn('⚠️ data/mapping.json non trouvé, fallback à structure par défaut');
            state.jlptMapping = null;
        }

        // Enregistre l'ouverture de l'app du jour (pour le streak) — idempotent si déjà fait aujourd'hui.
        recordDailyActivity();

        // Précharge la grammaire en arrière-plan pour que le système de renvoi "voir" entre
        // leçons fonctionne dès la première navigation, sans attendre un fetch à la volée.
        preloadAllGrammarLevels();

        // Active les systèmes de navigation globaux.
        initNavigation();
        initSwipeNavigation();
        initMicSearch();
        initPullToRefresh();

        let text = await kanjiRes.text();
        text = text.trim();
        // Nettoyage sommaire au cas où le JSON GitHub soit mal formé.
        if (!text.startsWith('{')) text = '{' + text;
        if (!text.endsWith('}')) text = text.replace(/,\s*$/, '') + '}';
        const data = JSON.parse(text);

        // Transformation en tableau d'objets — state.data.kanjiDb/kanjiMap (pas des globales
        // bare, contrairement au monolithe).
        state.data.kanjiDb = [];
        state.data.kanjiMap.clear();
        Object.entries(data).forEach(([char, v], i) => {
            state.data.kanjiDb.push({
                char,
                grade: v.classe ?? null,
                meanings: v.sens || [],
                on: v.lectures_on || [],
                kun: v.lectures_kun || [],
                wk_on: v.wk_lectures_on || [],
                wk_kun: v.wk_lectures_kun || [],
                strokes: v.traits || 0,
                romaji: v.romaji || '–'
            });
            state.data.kanjiMap.set(char, i);
        });

        // Chargement des exemples (legacy, kanji uniquement) : localStorage en priorité,
        // GitHub en fallback/rafraîchissement arrière-plan.
        const CACHE_KEY = 'exemplesDb_v2';
        try {
            const cached = localStorage.getItem(CACHE_KEY);
            if (cached) {
                state.exemplesDb = JSON.parse(cached);
                console.log(`✅ Exemples depuis cache (${Object.keys(state.exemplesDb).length} kanji)`);
            }

            fetch('https://raw.githubusercontent.com/shinobux9-max/Kanji-trad/refs/heads/main/exemples.json', { cache: 'no-store' })
                .then(r => r.ok ? r.json() : Promise.reject(r.status))
                .then(data => {
                    state.exemplesDb = data;
                    try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch (_) {}
                    console.log(`✅ Exemples mis à jour depuis GitHub (${Object.keys(data).length} kanji)`);
                })
                .catch(e => console.warn('Refresh exemples GitHub échoué :', e));
        } catch (e) {
            console.warn('Exemples non disponibles :', e.message);
            state.exemplesDb = {};
        }

        // Affichage du dashboard : d'abord le HTML (showDashboard), puis les barres de
        // progression (renderDashboard).
        document.getElementById('page-title').innerText = '漢字 Study';
        showDashboard();
        renderDashboard();
        setActiveBottomNav('accueil');

        console.log(`✅ ${state.data.kanjiDb.length} kanji chargés`);

    } catch (e) {
        console.error('Erreur BDD:', e);
        mainContent.innerHTML = `
            <div style="padding:40px 20px;text-align:center;color:var(--gray)">
                <div style="font-size:2.5rem;margin-bottom:12px">⚠️</div>
                <div style="margin-bottom:16px">Impossible de charger la base de données.<br>${e.message}</div>
                <button onclick="init()" style="padding:10px 24px;background:var(--accent);border:none;color:#000;border-radius:8px;font-weight:bold;cursor:pointer;font-size:0.875rem">Réessayer</button>
            </div>`;
    }
}
window.init = init; // référencée par le bouton "Réessayer" ci-dessus (onclick="init()")

// Lancement au démarrage.
init();
