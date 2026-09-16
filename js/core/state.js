/**
 * js/core/state.js
 * État global mutable de l'application — reproduit les variables globales du monolithe
 * kanji.js réellement partagées entre plusieurs modules (bases de données chargées,
 * contexte de navigation courant). Ne contient AUCUNE logique métier.
 *
 * Convention conservée : state.data.* pour les bases de données (déjà utilisée par les
 * stubs features/kanji.js, features/vocabulary.js, features/grammar.js,
 * ui/dashboard.js, learning/learning-path.js, learning/exercises.js — ne pas la changer
 * sans mettre à jour ces imports).
 *
 * IMPORTANT sur la mutabilité en ESM : un module important { state } ne peut PAS faire
 * `state.currentType = 'kanji'` de l'extérieur si state était une primitive exportée
 * directement — mais state est un objet unique exporté une seule fois, donc muter ses
 * PROPRIÉTÉS (state.currentType = ...) est parfaitement légal depuis n'importe quel module
 * qui l'importe (seule la réassignation du binding `state` lui-même serait interdite, et
 * personne n'en a besoin ici).
 */

export const state = {
    // Bases de données chargées (bootstrap fait dans core/data-loader.js / app.js init())
    data: {
        kanjiDb: [],
        kanjiMap: new Map(),      // char -> index dans kanjiDb (O(1) lookup), voir kanjiMap du monolithe
        vocabDb: [],              // NON UTILISÉ par le vrai monolithe (vocab est chargé PAR NIVEAU via
                                   // core/data-loader.js::getLevelVocabData, pas une base globale unique) —
                                   // conservé pour compatibilité avec les stubs existants, à ne pas alimenter
        grammarDb: [],            // idem : le vrai chargement est par niveau (getLevelGrammarData)
        examplesDb: [],           // NOM/TYPE CORRIGÉS plus bas — voir state.exemplesDb (racine).
                                   // Ce champ state.data.examplesDb reste un vestige de compat
                                   // stub, jamais alimenté par le vrai chargement.
        jlptMapping: {},          // voir aussi state.jlptMapping ci-dessous (racine) : le monolithe a une SEULE
                                   // variable `jlptMapping` au niveau racine, pas dans un sous-objet data. Gardé ici
                                   // pour compat stub existante, mais la vraie source de vérité est state.jlptMapping.
        conceptsDb: []            // le monolithe charge les concepts PAR NIVEAU (getLevelConceptsData, conceptsDataCache
                                   // interne), pas une base globale unique — conservé pour compat, à ne pas alimenter
    },

    /* ══════════════════════════════════════════════════
       CONTEXTE DE NAVIGATION COURANT
       Équivalent direct des variables globales `let` du monolithe (kanji.js, section STATE)
    ══════════════════════════════════════════════════ */
    jlptMapping: null,        // mapping JLPT chargé depuis data/mapping.json (racine, PAS state.data.jlptMapping)
    categories: new Map(),    // catId -> {id, label, color, short, indices[]}
    seriesMap: new Map(),     // seriesId -> {id, catId, label, indices[]}

    writer: null,             // instance HanziWriter courante (fiche détail kanji)
    currentChar: null,        // caractère actuellement affiché en fiche détail (kanji ou kana)
    currentType: null,        // 'kanji' | 'kana' | null (rien avant la première navigation)
    currentCatId: null,       // catégorie affichée (ancienne navigation par grade)
    currentJLPTLevel: null,   // 'n5'...'n1' | null — niveau JLPT actuellement affiché
    currentLevelId: null,     // accès rapide au niveau courant (vocab/grammar/kanji par niveau)

    grammarHomeData: null,    // {levelId, data, examples} pour la page d'accueil grammar
    vocabHomeData: null,      // {levelId, data, examples} pour la page d'accueil vocab
    kanjiHomeData: null,      // {levelId, chars} pour la page d'accueil kanji

    searchOpen: false,

    // Tracé kana (features/kana.js, pas encore porté) — partagé avec le même overlay
    // #stroke-quiz-view que le tracé kanji. closeStrokeQuiz() (features/strokes.js) nettoie
    // ces trois champs systématiquement, même avant que le tracé kana lui-même soit porté.
    kanaTraceState: null,
    kanaTraceWriter: null,
    kanaTraceTimerInterval: null,

    // Sélection en masse (validation rapide de maîtrise) — partagé entre kanji/vocab/grammaire/
    // kana. bulkSelectRerender : () => void, redessine l'écran courant dans son état actuel.
    bulkSelectMode: false,
    bulkSelectRerender: null,

    // Partagés avec animateKanaChar (features/kana.js) : timeouts de
    // l'animation de tracé kana en cours + AbortController du fetch KanjiVG associé.
    // closeDetail() les nettoie systématiquement à la fermeture de la fiche détail.
    kanaAnimTimeouts: [],
    fetchCtrl: null,

    // Base d'exemples "legacy" (bootstrap depuis GitHub, cache localStorage 'exemplesDb_v2'),
    // indexée par caractère kanji : { "食": [...] }. Objet, PAS tableau — utilisée en repli par
    // renderExemples() quand exemplesByLevel[niveau] n'a rien pour ce kanji. Chargement pas
    // encore porté (fait dans init(), bootstrap au démarrage) — reste vide tant que ça n'est
    // pas branché, renderExemples() se rabat alors sur exemplesByLevel via data-loader.js.
    exemplesDb: {},

    /* ══════════════════════════════════════════════════
       SESSIONS PONCTUELLES — placeholders null.
       IMPORTANT : ne PAS inventer de forme ici. La vraie structure de chacune de ces sessions
       est créée entièrement par la fonction de démarrage correspondante dans sa feature
       (startQuiz() -> features/quiz.js, startStrokeQuiz() -> features/stroke.js, etc.), pas
       encore portée. Un ancien stub donnait à quizState/strokeQuizState une forme inventée
       ({active, questions, currentIndex, score} / {active, timerInterval, isPaused}) qui ne
       correspond à RIEN dans le monolithe réel — corrigé ici en simple `null`.
    ══════════════════════════════════════════════════ */
    quizState: null,          // { indices, poolIndices, idx, correct, wrong, answered, revealed,
                               //   title, sourceType, sourceId, elapsedSec, mode } une fois démarré
    strokeQuizState: null,    // forme définie par startStrokeQuiz() (features/stroke.js, à porter)
    learningSession: null,    // { levelId, unit, stepIndex, testResults, coveredNew, recentNew }
                               // une fois démarré (learning/learning-path.js)

    // Ajoutés lors du portage de core/navigation.js::closeAllOverlaysAndSessions() : cette
    // fonction (déjà réellement portée) doit nettoyer TOUTES les sessions ponctuelles de l'app
    // à chaque changement d'écran/retour, y compris celles dont le module propriétaire n'est
    // PAS ENCORE porté — même logique de placeholder anticipé que kanaTraceState ci-dessus.
    // Quand vocabulary.js/grammar.js/free-training.js/ui/dashboard.js seront portés, ILS
    // devront lire/écrire ces champs state.* (pas recréer des variables locales à leur module),
    // sinon closeAllOverlaysAndSessions() nettoierait le mauvais état.
    reviewSession: null,          // révision vocab (features/vocabulary.js, pas encore porté)
    grammarReviewSession: null,   // révision grammaire (features/grammar.js, pas encore porté)
    mixedReviewSession: null,     // révision mixte "Aujourd'hui" (ui/cards.js::launchMixedReviewSession)
    kanjiReviewSession: null,     // révision flashcard kanji (features/kanji.js — la fiche/liste
                                   // sont portées, mais pas encore cette session de révision précise)
    lessonSession: null,          // parcours "Commençons l'apprentissage" (grammaire, pas encore porté)
    trainingSession: null,        // entraînement libre (features/free-training.js, pas encore porté)
    trainingChronoInterval: null, // idem — id de setInterval du chrono d'entraînement libre
    activeSwipeContext: null      // 'lesson' | 'onboarding' | 'learning-path' | null — contexte de
                                   // swipe actif, lu par le listener tactile global (pas encore
                                   // porté) qui décide comment interpréter un swipe/tap selon l'écran
};

/**
 * Remet quizState à null — équivalent d'un simple `quizState = null;` direct dans le
 * monolithe (il n'existe PAS de fonction resetQuizState() dans le monolithe : quizState y est
 * réassigné entièrement par startQuiz()/closeQuiz() à chaque fois). Cette fonction est un
 * wrapper de confort ajouté pour l'ESM, pas un portage direct — à utiliser à la place d'une
 * assignation directe pour rester cohérent si la forme évolue.
 */
export function resetQuizState() {
    state.quizState = null;
}
