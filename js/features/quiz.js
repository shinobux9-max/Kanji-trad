/**
 * js/features/quiz.js
 * Gestion de l'état et du moteur de Quiz
 */

import { state, resetQuizState } from '../core/state.js';
import { gradeReview } from '../learning/srs.js';

export function startQuiz(questions = []) {
    resetQuizState();
    state.quizState.active = true;
    state.quizState.questions = questions;
    return state.quizState;
}

export function submitQuizAnswer(isCorrect, quality = 3) {
    const currentQ = state.quizState.questions[state.quizState.currentIndex];
    
    if (isCorrect) {
        state.quizState.score += 1;
    }

    if (currentQ && currentQ.itemId) {
        gradeReview(currentQ.itemId, isCorrect ? quality : 1);
    }

    state.quizState.currentIndex += 1;
    
    if (state.quizState.currentIndex >= state.quizState.questions.length) {
        state.quizState.active = false;
    }

    return {
        isFinished: !state.quizState.active,
        score: state.quizState.score,
        total: state.quizState.questions.length
    };
}