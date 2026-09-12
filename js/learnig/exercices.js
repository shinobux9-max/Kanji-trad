/**
 * js/learning/exercises.js
 * Générateurs d'exercices (Cloze / QCM)
 */

import { state } from '../core/state.js';

/**
 * Génère une question QCM sur le sens d'un mot ou d'un kanji
 */
export function buildMeaningQCM(item, choicesCount = 4) {
    const allItems = state.data.vocabDb.length > 0 ? state.data.vocabDb : state.data.kanjiDb;
    const distractors = allItems
        .filter(i => i.id !== item.id && i.meaning)
        .sort(() => 0.5 - Math.random())
        .slice(0, choicesCount - 1)
        .map(i => i.meaning);

    const choices = [item.meaning, ...distractors].sort(() => 0.5 - Math.random());

    return {
        type: 'meaning_qcm',
        itemId: item.id,
        question: item.kanji || item.word || item.character,
        correctAnswer: item.meaning,
        choices
    };
}

/**
 * Génère un exercice de phrase à trou pour le vocabulaire
 */
export function buildVocabWordCloze(vocabItem) {
    if (!vocabItem.examples || vocabItem.examples.length === 0) {
        return buildMeaningQCM(vocabItem);
    }

    const example = vocabItem.examples[0];
    const targetWord = vocabItem.word || vocabItem.kanji;
    const maskedSentence = example.japanese.replace(targetWord, '______');

    return {
        type: 'vocab_cloze',
        itemId: vocabItem.id,
        question: maskedSentence,
        reading: example.reading,
        translation: example.meaning,
        correctAnswer: targetWord
    };
}

/**
 * Génère un exercice de grammaire
 */
export function buildGrammarCloze(grammarItem) {
    const example = grammarItem.examples && grammarItem.examples[0] ? grammarItem.examples[0] : null;
    if (!example) return null;

    return {
        type: 'grammar_cloze',
        itemId: grammarItem.id,
        title: grammarItem.title,
        question: example.japanese.replace(grammarItem.pattern, '______'),
        translation: example.meaning,
        correctAnswer: grammarItem.pattern
    };
}