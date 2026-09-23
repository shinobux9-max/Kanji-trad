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

    // Tracé kana (features/kana.js, porté et fonctionnel : startKanaTraceQuiz/
    // launchKanaTraceMode) — partagé avec le même overlay #stroke-quiz-view que le tracé
    // kanji. closeStrokeQuiz() (features/strokes.js) nettoie ces trois champs systématiquement.
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
    ══════════════════════════════════════════════════ */
    strokeQuizState: null,    // forme définie par startStrokeQuiz() (features/strokes.js)
    learningSession: null,    // { levelId, unit, stepIndex, testResults, coveredNew, recentNew }
                               // une fois démarré (learning/learning-path.js)

    // Nettoyées à chaque changement d'écran/retour par
    // core/navigation.js::closeAllOverlaysAndSessions().
    reviewSession: null,          // révision vocab (features/vocabulary.js)
    grammarReviewSession: null,   // révision grammaire (features/grammar.js)
    mixedReviewSession: null,     // révision mixte "Aujourd'hui" (ui/cards.js::launchMixedReviewSession)
    kanjiReviewSession: null,     // révision flashcard kanji (features/kanji.js)
    lessonSession: null,          // parcours "Commençons l'apprentissage" (learning/exercises.js)
    trainingSession: null,        // entraînement libre (features/free-training.js)
    trainingChronoInterval: null, // idem — id de setInterval du chrono d'entraînement libre
    activeSwipeContext: null      // 'lesson' | 'onboarding' | 'learning-path' | null — contexte de
                                   // swipe actif, lu par le listener tactile global
                                   // (learning/exercises.js::initSwipeNavigation)
};
