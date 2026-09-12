/**
 * js/core/data-loader.js
 * Chargement centralisé des données JSON (Kanji, Vocab, Grammar, Examples)
 */

import { state } from './state.js';

const cachePromises = {};

/**
 * Charge un fichier JSON avec mise en cache de la promesse
 */
export async function loadJsonData(url) {
    if (cachePromises[url]) {
        return cachePromises[url];
    }

    cachePromises[url] = fetch(url)
        .then(res => {
            if (!res.ok) throw new Error(`Impossible de charger ${url}: ${res.status}`);
            return res.json();
        })
        .catch(err => {
            console.error(`Erreur de chargement (${url}):`, err);
            delete cachePromises[url];
            throw err;
        });

    return cachePromises[url];
}

/**
 * Charge la base complète de Kanji et initialise kanjiMap
 */
export async function loadKanjiData(dataPath = 'data/kanji.json') {
    const data = await loadJsonData(dataPath);
    state.data.kanjiDb = data;
    
    // Remplissage optimisé de la Map
    state.data.kanjiMap.clear();
    data.forEach(item => {
        if (item.kanji) {
            state.data.kanjiMap.set(item.kanji, item);
        }
    });

    return data;
}

/**
 * Charge le vocabulaire
 */
export async function loadVocabData(dataPath = 'data/vocab.json') {
    const data = await loadJsonData(dataPath);
    state.data.vocabDb = data;
    return data;
}

/**
 * Charge la grammaire
 */
export async function loadGrammarData(dataPath = 'data/grammar.json') {
    const data = await loadJsonData(dataPath);
    state.data.grammarDb = data;
    return data;
}