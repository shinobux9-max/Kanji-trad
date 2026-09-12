/**
 * js/core/state.js
 * Gestion de l'état global de l'application
 */

export const state = {
    // Bases de données chargées
    data: {
        kanjiDb: [],
        kanjiMap: new Map(),
        vocabDb: [],
        grammarDb: [],
        examplesDb: [],
        jlptMapping: {},
        conceptsDb: []
    },

    // État de navigation / affichage courant
    currentType: 'kanji',      // 'kanji', 'vocab', 'grammar', 'kana'
    currentChar: null,
    currentLevelId: null,
    currentJLPTLevel: 'N5',
    searchOpen: false,

    // Session de Quiz / Révision / Stroke
    quizState: {
        active: false,
        questions: [],
        currentIndex: 0,
        score: 0,
        type: null
    },

    learningSession: null,

    // HanziWriter / Tracé
    writer: null,
    strokeQuizState: {
        active: false,
        timerInterval: null,
        isPaused: false
    }
};

/**
 * Rinitialise l'état d'un quiz
 */
export function resetQuizState() {
    state.quizState = {
        active: false,
        questions: [],
        currentIndex: 0,
        score: 0,
        type: null
    };
}