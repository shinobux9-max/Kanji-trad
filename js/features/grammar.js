/**
 * js/features/grammar.js
 * Logique métier et contrôleur d'affichage de la Grammaire
 */

import { state } from '../core/state.js';
import { renderGrammarCard } from '../ui/cards.js';

export function filterGrammarByLevel(level) {
    return state.data.grammarDb.filter(g => g.jlpt === level);
}

/**
 * Affiche la grille/liste de grammaire filtrée dans le conteneur cible
 */
export function renderGrammarGrid(containerId, level = 'N5') {
    const container = document.getElementById(containerId);
    if (!container) return;

    const grammarList = filterGrammarByLevel(level);
    if (grammarList.length === 0) {
        container.innerHTML = '<p class="empty-msg">Aucun point de grammaire trouvé pour ce niveau.</p>';
        return;
    }

    container.innerHTML = grammarList.map(item => renderGrammarCard(item)).join('');
}

/**
 * Recherche dans la base de grammaire
 */
export function searchGrammar(query) {
    const q = query.toLowerCase().trim();
    if (!q) return [];

    return state.data.grammarDb.filter(g => 
        (g.title && g.title.toLowerCase().includes(q)) || 
        (g.pattern && g.pattern.includes(q)) || 
        (g.meaning && g.meaning.toLowerCase().includes(q))
    );
}