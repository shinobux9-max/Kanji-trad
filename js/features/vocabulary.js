/**
 * js/features/vocabulary.js
 * Logique métier et contrôleur d'affichage du Vocabulaire
 */

import { state } from '../core/state.js';
import { renderVocabCard } from '../ui/cards.js';

export function filterVocabByLevel(level) {
    return state.data.vocabDb.filter(v => v.jlpt === level);
}

/**
 * Affiche la grille/liste de vocabulaire filtrée dans le conteneur cible
 */
export function renderVocabGrid(containerId, level = 'N5') {
    const container = document.getElementById(containerId);
    if (!container) return;

    const vocabList = filterVocabByLevel(level);
    if (vocabList.length === 0) {
        container.innerHTML = '<p class="empty-msg">Aucun vocabulaire trouvé pour ce niveau.</p>';
        return;
    }

    container.innerHTML = vocabList.map(item => renderVocabCard(item)).join('');
}

/**
 * Recherche dans la base de vocabulaire
 */
export function searchVocab(query) {
    const q = query.toLowerCase().trim();
    if (!q) return [];

    return state.data.vocabDb.filter(v => 
        (v.word && v.word.includes(q)) || 
        (v.reading && v.reading.includes(q)) || 
        (v.meaning && v.meaning.toLowerCase().includes(q))
    );
}