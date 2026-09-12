/**
 * js/features/free-training.js
 * Moteur d'entraînement libre
 */

import { state } from '../core/state.js';

export function buildFreeTrainingSession(type, count = 10) {
    let dataset = [];
    if (type === 'kanji') dataset = state.data.kanjiDb;
    else if (type === 'vocab') dataset = state.data.vocabDb;
    else if (type === 'grammar') dataset = state.data.grammarDb;

    const shuffled = [...dataset].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}