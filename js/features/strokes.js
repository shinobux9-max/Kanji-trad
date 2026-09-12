/**
 * js/features/stroke.js
 * Gestion du tracé de kanji (HanziWriter) et du Stroke Quiz
 */

import { state } from '../core/state.js';

/**
 * Initialise l'instance HanziWriter dans un conteneur HTML
 */
export function initKanjiWriter(containerId, character, options = {}) {
    if (!window.HanziWriter) {
        console.error("HanziWriter n'est pas chargé dans la page.");
        return null;
    }

    const defaultOptions = {
        width: 200,
        height: 200,
        padding: 5,
        showOutline: true,
        strokeAnimationSpeed: 1,
        delayBetweenStrokes: 100,
        ...options
    };

    state.writer = HanziWriter.create(containerId, character, defaultOptions);
    return state.writer;
}

/**
 * Lance le test de tracé pour le kanji courant
 */
export function startStrokeQuiz(character, onComplete) {
    if (!state.writer) return;

    state.strokeQuizState.active = true;
    state.strokeQuizState.isPaused = false;

    state.writer.quiz({
        onComplete: (summary) => {
            state.strokeQuizState.active = false;
            if (typeof onComplete === 'function') {
                onComplete(summary);
            }
        }
    });
}