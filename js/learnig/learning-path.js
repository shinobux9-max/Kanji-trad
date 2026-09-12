/**
 * js/learning/learning-path.js
 * Moteur du parcours d'apprentissage (Learning Path)
 */

import { state } from '../core/state.js';
import { buildMeaningQCM, buildVocabWordCloze, buildGrammarCloze } from './exercises.js';

export function createLearningSession(levelId, items = []) {
    const sessionQuestions = items.map(item => {
        if (item.type === 'grammar') {
            return buildGrammarCloze(item);
        } else if (item.type === 'vocab') {
            return buildVocabWordCloze(item);
        } else {
            return buildMeaningQCM(item);
        }
    }).filter(q => q !== null);

    state.learningSession = {
        levelId,
        questions: sessionQuestions,
        currentIndex: 0,
        score: 0,
        active: true
    };

    return state.learningSession;
}

export function getNextPathQuestion() {
    const session = state.learningSession;
    if (!session || !session.active) return null;

    if (session.currentIndex >= session.questions.length) {
        session.active = false;
        return null;
    }

    return session.questions[session.currentIndex];
}