/**
 * js/core/navigation.js
 * Système réel de navigation par history.pushState du monolithe : MODAL_EXIT_REGISTRY,
 * SCREEN_REGISTRY, closeAllOverlaysAndSessions(), window.onpopstate, pushModalState(),
 * toggleSearch()/closeSearchOverlay(), bottomNavGo().
 *
 * REMPLACE l'ancien stub (navigateTo/initNavigation) : ce dernier était un modèle
 * générique show/hide de sections par id qui ne correspondait à RIEN dans le vrai
 * monolithe (qui utilise history.pushState({view:'modal'|'...', ...}) partout) — retiré
 * plutôt que conservé à côté (cf. data-loader.js pour la même décision sur son ancien stub).
 *
 * ⚠️ CHANTIER MASSIVEMENT CROSS-CUTTING : ce fichier est, par nature, le point de
 * convergence de TOUTES les features de l'app (chaque écran/session doit pouvoir être fermé
 * proprement au retour). Toutes les fonctions référencées dans les deux registres et dans
 * closeAllOverlaysAndSessions() sont aujourd'hui bel et bien portées (ui/dashboard.js,
 * ui/cards.js, features/*, learning/*) — mais chacune importe, directement ou
 * transitivement, pushModalState() depuis CE fichier : un import réel en retour créerait donc
 * un cycle direct (vérifié fonction par fonction via un script DFS lors de l'audit Phase 4,
 * aucune exception trouvée). Seul ui/common.js est importable ici sans risque (n'importe
 * jamais navigation.js). Chaque référence non importable est donc un vrai appel JS non
 * importé (landmine), marquée explicitement ⚠️ ATTENTION avec sa raison précise plutôt que
 * contournée par un import fantôme ou une valeur par défaut.
 *
 * ⚠️ DÉCOUVERTE EN COURS DE CHANTIER : toggleSearch() dépend d'un sous-système de recherche
 * unifiée bien plus large que la simple navigation (searchFilters, renderSearchFilterPills,
 * toggleSearchFilter, resetSearchFilters, showSearchPanel/hideSearchPanel, SEARCH_TYPE_STYLE,
 * et la logique d'exécution de recherche elle-même — jamais lue jusqu'ici). Pas anticipé dans
 * le plan initial du HANDOFF, qui listait juste "toggleSearch" comme faisant partie de ce
 * fichier. toggleSearch()/closeSearchOverlay() SONT portées ci-dessous (elles appartiennent
 * réellement au système de navigation : ouverture/fermeture via l'historique), mais leurs
 * dépendances (filtres, panneau, résultats) restent des landmines — la "recherche unifiée"
 * devient son propre chantier séparé — désormais fait, voir ui/modals.js. Reste néanmoins
 * des landmines ICI (ce fichier ne peut toujours pas importer ui/modals.js, cycle sinon) —
 * voir les commentaires ⚠️ ATTENTION précis sur resetSearchFilters/showSearchPanel/
 * hideSearchPanel plus bas.
 */

import { state } from './state.js';
import { updateBulkActionBar } from '../ui/common.js';

/**
 * ⚠️ IMPORTANT — pourquoi AUCUNE fonction de kanji.js/strokes.js/kana.js n'est
 * importée ici, alors que closeDetail, closeStrokeQuiz, displayKanjiList,
 * showRevisionKanaPicker existent bel et bien comme exports réels dans ces fichiers
 * (vérifié avant d'écrire ce fichier) :
 * kanji.js, strokes.js (via kanji.js) ET kana.js importent TOUS déjà
 * pushModalState() depuis CE fichier. Si navigation.js importait quoi que ce soit en retour
 * depuis l'un d'eux, ce serait un cycle direct (confirmé programmatiquement : la première
 * tentative d'écriture de ce fichier important closeDetail/loadCategory/loadSeriesPage/
 * displayKanjiList depuis kanji.js créait exactement `kanji.js -> navigation.js ->
 * kanji.js`). Seul ui/common.js est importable en toute sécurité ici (il n'importe QUE
 * state.js/storage.js, jamais navigation.js). Toutes les autres références restent donc des
 * landmines volontaires, marquées ⚠️ ATTENTION ci-dessous — pas des oublis.
 */


/**
 * Équivalent EXACT de pushModalState(name) du monolithe. Pousse UNE entrée d'historique pour
 * un modal/overlay/session — la vraie fermeture doit toujours passer par history.back(),
 * jamais appeler une fonction de fermeture directement (sinon l'entrée reste orpheline dans
 * l'historique).
 */
export function pushModalState(name) {
    history.pushState({ view: 'modal', modal: name }, '');
}

/* ══════════════════════════════════════════════════
   RECHERCHE — coordination ouverture/fermeture via l'historique uniquement.
   Le panneau de résultats/filtres lui-même (resetSearchFilters, showSearchPanel,
   renderSearchFilterPills, ...) est porté dans ui/modals.js — restent des landmines
   ci-dessous, volontairement, pour la seule raison du cycle d'import (voir plus bas).
══════════════════════════════════════════════════ */
let searchJustOpened = false; // local au module : jamais lu ailleurs (contrairement à state.searchOpen)

export function toggleSearch() {
    if (state.searchOpen) {
        // Déjà ouvert : on passe par history.back() pour garder l'historique cohérent
        // (fermeture réellement effectuée par MODAL_EXIT_REGISTRY['search'] au popstate)
        history.back();
        return;
    }
    state.searchOpen = true;
    // ⚠️ ATTENTION : resetSearchFilters() existe maintenant réellement dans ui/modals.js
    // (chantier "recherche unifiée" fait), mais reste un vrai appel JS non importé : ce
    // fichier ne peut pas importer ui/modals.js (qui importe kanji.js/kana.js -> navigation.js,
    // cycle direct sinon). Résolution probable via window.* exposé par app.js.
    resetSearchFilters();
    // Empêche le clic qui VIENT D'OUVRIR la recherche d'être aussi interprété
    // comme un "clic à l'extérieur" par le listener global (même événement, même bulle)
    searchJustOpened = true;
    setTimeout(() => { searchJustOpened = false; }, 0);
    pushModalState('search');
    document.getElementById('search-bar').classList.add('open');
    const main = document.getElementById('main-content');
    if (main) main.classList.add('search-open');
    setTimeout(() => document.getElementById('search-input').focus(), 220);
    // ⚠️ ATTENTION : showSearchPanel() — existe réellement dans ui/modals.js, même raison
    // de cycle que ci-dessus (voir plus haut).
    showSearchPanel();
}

// Ferme réellement l'écran de recherche (appelée uniquement par le registre de retour,
// jamais directement par un clic — pour que bouton retour matériel et clic donnent le même résultat)
export function closeSearchOverlay() {
    state.searchOpen = false;
    const bar = document.getElementById('search-bar');
    if (bar) bar.classList.remove('open');
    const main = document.getElementById('main-content');
    if (main) main.classList.remove('search-open');
    // ⚠️ ATTENTION : hideSearchPanel() — existe réellement dans ui/modals.js, même raison
    // de cycle.
    hideSearchPanel();
    const input = document.getElementById('search-input');
    if (input) input.value = '';
    const clearBtn = document.getElementById('search-clear');
    if (clearBtn) clearBtn.classList.remove('show');
}

/* ══════════════════════════════════════════════════
   REGISTRES DE SORTIE — MODAL_EXIT_REGISTRY / SCREEN_REGISTRY
   ─────────────────────────────────────────────────
   Toutes les entrées ci-dessous sont des landmines (vrais appels JS non importés, PAS des
   chaînes onclick) : soit la fonction appelée appartient à un module réellement pas encore
   porté, soit elle existe déjà mais créerait un cycle via pushModalState si importée ici
   (voir en-tête de fichier). Chaque cas est commenté ⚠️ ATTENTION individuellement pour
   préciser lequel des deux s'applique. Seules les entrées 'search' (closeSearchOverlay) et
   les mises à jour state.* sont du vrai code fonctionnel.
══════════════════════════════════════════════════ */
export const MODAL_EXIT_REGISTRY = {
    // 'kanji-detail'/'kana-detail' : la fiche kanji/kana utilise un OVERLAY partagé
    // (#detail-view) posé PAR-DESSUS l'écran courant (liste, grille...), jamais un
    // remplacement de main-content — donc "fermer" cette fiche ne doit JAMAIS re-rendre quoi
    // que ce soit d'autre que fermer l'overlay lui-même (l'écran dessous est déjà correct,
    // inchangé). Bug trouvé en test réel : sans ces 2 entrées, aucune des deux ne
    // correspondait à rien dans les registres, donc handlePopState() tombait sur le cas par
    // défaut (showDashboard) — fermer une fiche renvoyait à l'accueil au lieu de fermer
    // simplement l'overlay.
    'kanji-detail': () => closeDetail(),
    'kana-detail': () => closeDetail(),
    // ⚠️ ATTENTION : showRevisionLevelPicker (ui/cards.js) — cards.js importe ui/kanji-review.js,
    // qui importe déjà pushModalState() d'ici : import réel en retour = cycle transitif.
    'vocab-review': () => { state.reviewSession = null; showRevisionLevelPicker('vocab', true); },
    'vocab-review-selector': () => showRevisionLevelPicker('vocab', true),
    // ⚠️ ATTENTION : showRevisionLevelPicker (ui/cards.js), même raison que ci-dessus.
    'grammar-review': () => { state.grammarReviewSession = null; showRevisionLevelPicker('grammar', true); },
    'grammar-review-selector': () => showRevisionLevelPicker('grammar', true),
    // ⚠️ ATTENTION : showApprendreScreen (ui/cards.js), même raison de cycle transitif.
    'grammar-lesson-flow': () => { state.lessonSession = null; showApprendreScreen(true); },
    'lesson-onboarding': () => showApprendreScreen(true),
    // ⚠️ ATTENTION : loadJLPTCategory (routeur cross-feature, ui/cards.js), même raison de cycle.
    'kanji-review-selector': () => { if (state.kanjiHomeData) loadJLPTCategory(state.kanjiHomeData.levelId, 'kanji', true); },
    'kanji-review-flashcard': () => { state.kanjiReviewSession = null; if (state.kanjiHomeData) loadJLPTCategory(state.kanjiHomeData.levelId, 'kanji', true); },
    // ⚠️ ATTENTION : showApprendreScreen (idem ci-dessus)
    'apprendre-discovery': () => { state.mixedReviewSession = null; showApprendreScreen(true); },
    // ⚠️ ATTENTION : showDashboard/renderDashboard (ui/dashboard.js) — dashboard.js importe
    // features/kanji.js, qui importe déjà pushModalState() d'ici : cycle transitif.
    'mixed-review-dashboard': () => { state.mixedReviewSession = null; showDashboard(true); renderDashboard(); },
    'search': () => closeSearchOverlay(),
    // ⚠️ ATTENTION : showRevisionKanaPicker existe dans features/kana.js, mais kana.js importe
    // pushModalState depuis CE fichier — un import réel ici créerait un cycle (voir en-tête).
    'kana-mode-selector': () => showRevisionKanaPicker(true),
    'kana-review-flashcard': () => { resetKanaReviewSession(); showRevisionKanaPicker(true); },
    'kana-trace-review': () => showRevisionKanaPicker(true),
    // ⚠️ ATTENTION : showFreeTrainingConfig existe réellement dans features/free-training.js, mais y importer créerait un cycle (confirmé)
    'free-training-session': () => {
        if (state.trainingChronoInterval) { clearInterval(state.trainingChronoInterval); state.trainingChronoInterval = null; }
        state.trainingSession = null;
        showFreeTrainingConfig(true);
    },
};

export const SCREEN_REGISTRY = {
    // ⚠️ ATTENTION : showDashboard/renderDashboard (ui/dashboard.js) — même raison de cycle
    // transitif que dans MODAL_EXIT_REGISTRY ci-dessus.
    'dashboard': () => { showDashboard(true); renderDashboard(); },
    // ⚠️ ATTENTION : showFreeTrainingConfig (features/free-training.js) — cycle confirmé.
    'free-training-config': () => showFreeTrainingConfig(true),
    // 'category'/'series' retirées (session de nettoyage) : loadCategory/loadSeriesPage
    // (ancienne navigation par grade Primaire/Collège) n'existent plus nulle part —
    // écrans jamais atteignables depuis l'interface actuelle, supprimés à la demande de
    // l'utilisateur. Le moteur de quiz par modal (showQuizModeModal/launchQuizMode)
    // qu'ils utilisaient a lui aussi été retiré depuis (features/quiz.js supprimé —
    // décision explicite, "les autres systèmes suffisent").
    // ⚠️ ATTENTION : les 6 suivantes sont toutes portées (ui/dashboard.js, ui/cards.js,
    // learning/exercises.js, ui/niveaux-screens.js) mais cyclent toutes via pushModalState().
    'niveaux': () => showNiveauxScreen(true),
    'apprendre': () => showApprendreScreen(true),
    'explore-lessons': () => showExploreLessonsScreen(true),
    'grammar-niveaux': () => showGrammarNiveauxScreen(true),
    'kanji-niveaux': () => showKanjiNiveauxScreen(true),
    'progression': () => showProgressionDetail(true),
    // ⚠️ ATTENTION : showCategoryDirect, routeur cross-feature (ui/cards.js, voir plus haut)
    'category-direct': (s) => showCategoryDirect(s.levelId, s.category, true),
    // ⚠️ ATTENTION : displayKanjiList existe dans features/kanji.js, même raison que ci-dessus.
    'kanji-list': () => { if (state.kanjiHomeData) displayKanjiList(state.kanjiHomeData.levelId, { chars: state.kanjiHomeData.chars }, true); },
    // ⚠️ ATTENTION : navFolders existe dans features/kanji.js, même raison de cycle que
    // loadCategory/loadSeriesPage juste au-dessus.
    'folders': () => navFolders(true),
    // ⚠️ ATTENTION : displayVocabList (features/vocabulary.js) — cycle confirmé.
    'vocab-list': () => { if (state.vocabHomeData) displayVocabList(state.vocabHomeData.levelId, state.vocabHomeData.data, state.vocabHomeData.examples, true); },
    'vocab-detail': (s) => { if (state.vocabHomeData) showVocabDetail(s.wordId, state.vocabHomeData.data, true); },
    // ⚠️ ATTENTION : showGrammarHome (features/grammar.js) — cycle confirmé.
    'grammar-home': () => { if (state.grammarHomeData) showGrammarHome(state.grammarHomeData.levelId, state.grammarHomeData.data, state.grammarHomeData.examples, true); },
    'grammar-detail': (s) => showGrammarDetail(s.lessonId, true),
    // ⚠️ ATTENTION : showRevisionsScreen/showRevisionLevelPicker (ui/cards.js) — cycle confirmé.
    'revisions': () => showRevisionsScreen(true),
    'revision-level-picker': (s) => showRevisionLevelPicker(s.category, true),
    // ⚠️ ATTENTION : showRevisionKanaPicker, même raison (cycle via pushModalState).
    'revision-kana-picker': () => showRevisionKanaPicker(true),
    // ⚠️ ATTENTION : showKanaLearningPicker, même raison (cycle via pushModalState).
    'kana-learning-picker': () => showKanaLearningPicker(true),
    // ⚠️ ATTENTION : loadKanas, même raison (cycle via pushModalState). Bug trouvé en test
    // réel : loadKanas() ne poussait JAMAIS son propre état avant — la "Liste" n'existait
    // donc pas dans l'historique, et le retour la sautait dans les deux sens (Liste<Apprendre
    // au lieu de Liste<Choix<Apprendre, et Fiche<Choix au lieu de Fiche<Liste<Choix).
    'kana-list': (s) => loadKanas(s.script, true),
    // ⚠️ ATTENTION : showLearningPathHome (learning/learning-path.js), même raison de cycle
    // (learning-path.js importe features/grammar.js, qui importe déjà pushModalState d'ici).
    // Entrée manquante trouvée en audit Phase 3 : showLearningPathHome() poussait bien
    // { view: 'learning-path-home' } mais sans entrée correspondante ici, un history.back()
    // qui y retombait tombait dans le cas par défaut (showDashboard) au lieu de rafraîchir la
    // liste des unités — masqué jusqu'ici car learningPathFAB() appelait la fonction
    // directement au lieu de history.back() (corrigé dans le même audit).
    'learning-path-home': (s) => showLearningPathHome(s.levelId, true),
};

/**
 * Équivalent EXACT de closeAllOverlaysAndSessions() du monolithe. Sécurité partagée : ferme
 * systématiquement tous les overlays plein écran (fiche, quiz, tracé) ET annule toute session
 * de révision "légère" en cours, quelle que soit la façon dont l'utilisateur quitte l'écran —
 * bouton retour matériel (via onpopstate) OU bottom-nav (reste cliquable en permanence, même
 * par-dessus une session active, puisqu'elle est en position fixe et ne passe jamais par
 * l'historique). Toutes les sessions nettoyées ici vivent dans state.* (voir core/state.js,
 * section ajoutée lors de ce portage). En revanche closeDetail()/closeStrokeQuiz()
 * restent des landmines (existent réellement dans kanji.js/strokes.js, mais cycle via
 * pushModalState si importées ici — voir en-tête de fichier), résolues via window.*
 * (exposées par app.js).
 */
export function closeAllOverlaysAndSessions() {
    // ⚠️ ATTENTION : les 2 suivantes existent réellement (kanji.js/strokes.js) mais
    // cycleraient via pushModalState si importées ici (voir en-tête de fichier).
    // closeQuiz() (features/quiz.js) retirée : le système modal lecture/sens a été
    // supprimé (décision explicite, "les autres systèmes suffisent") — plus d'overlay à
    // fermer ici. Bug trouvé en nettoyant : cet appel tournait à CHAQUE navigation.
    closeDetail();
    closeStrokeQuiz();
    if (state.searchOpen) closeSearchOverlay();

    if (state.bulkSelectMode) {
        state.bulkSelectMode     = false;
        state.bulkSelectRerender = null;
        updateBulkActionBar();
    }

    state.activeSwipeContext = null;
    state.lessonSession      = null;
    state.learningSession    = null;

    state.reviewSession        = null;
    state.grammarReviewSession = null;
    // ⚠️ ATTENTION : resetKanaReviewSession existe dans features/kana.js, même raison de cycle.
    resetKanaReviewSession();
    state.mixedReviewSession   = null;
    state.kanjiReviewSession   = null;
    if (state.trainingChronoInterval) { clearInterval(state.trainingChronoInterval); state.trainingChronoInterval = null; }
    state.trainingSession = null;
}

/**
 * Équivalent EXACT de window.onpopstate du monolithe.
 * ⚠️ ATTENTION : showDashboard/renderDashboard (ui/dashboard.js) restent des appels JS non
 * importés ici — même raison de cycle transitif que partout ailleurs dans ce fichier (voir
 * en-tête). Cette fonction doit être appelée par app.js (pas auto-exécutée ici, contrairement
 * au monolithe qui l'assigne directement à window.onpopstate au chargement du script) — voir
 * initNavigation() ci-dessous, à appeler explicitement depuis app.js une fois le bootstrap
 * terminé (app.js::init(), qui alimente state.data.kanjiDb).
 */
export function handlePopState(event) {
    // Garde-fou normal (pas un TODO) : ignore tout popstate survenant avant la fin du
    // bootstrap (state.data.kanjiDb pas encore alimenté par app.js::init()) — évite de
    // naviguer sur un état applicatif incomplet. Comportement fidèle au monolithe.
    if (state.data.kanjiDb.length === 0) return;

    closeAllOverlaysAndSessions();

    if (event.state && event.state.view === 'modal' && MODAL_EXIT_REGISTRY[event.state.modal]) {
        MODAL_EXIT_REGISTRY[event.state.modal]();
    } else if (event.state && SCREEN_REGISTRY[event.state.view]) {
        SCREEN_REGISTRY[event.state.view](event.state);
    } else {
        // ⚠️ ATTENTION : showDashboard/renderDashboard (ui/dashboard.js) — cycle transitif.
        showDashboard(true);
        renderDashboard();
    }
}

// À appeler explicitement depuis app.js après le bootstrap (voir handlePopState ci-dessus) —
// contrairement au monolithe qui fait `window.onpopstate = function(event) {...}` directement
// au chargement du script (pas d'équivalent "appel explicite" nécessaire en non-module).
export function initNavigation() {
    window.onpopstate = handlePopState;
}

/**
 * Équivalent EXACT de bottomNavGo(target) du monolithe.
 * ⚠️ ATTENTION : setActiveBottomNav/navDashboard (ui/dashboard.js) et showApprendreScreen/
 * showRevisionsScreen (ui/cards.js) sont tous portés, mais cyclent tous via pushModalState()
 * — même raison que partout ailleurs dans ce fichier (voir en-tête).
 */
export function bottomNavGo(target) {
    setActiveBottomNav(target);
    // Changer d'onglet ne doit jamais laisser une session/overlay actif en arrière-plan sur
    // le nouvel écran — la bottom-nav reste cliquable même par-dessus une session en cours.
    closeAllOverlaysAndSessions();
    if (target === 'accueil') {
        navDashboard();
    } else if (target === 'recherche') {
        toggleSearch();
    } else if (target === 'apprendre') {
        showApprendreScreen();
    } else if (target === 'revisions') {
        showRevisionsScreen();
    }
}
