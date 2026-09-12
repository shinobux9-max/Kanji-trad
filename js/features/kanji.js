/**
 * js/features/kanji.js
 * Logique métier et contrôleur d'affichage des Kanji
 */

import { state } from '../core/state.js';
import { renderKanjiCard } from '../ui/cards.js';

export function getKanjiByChar(char) {
    return state.data.kanjiMap.get(char) || null;
}

export function filterKanjiByLevel(level) {
    return state.data.kanjiDb.filter(k => k.jlpt === level);
}

/**
 * Affiche la grille de Kanji filtrée dans le conteneur cible
 */
export function renderKanjiGrid(containerId, level = 'N5') {
    const container = document.getElementById(containerId);
    if (!container) return;

    const kanjiList = filterKanjiByLevel(level);
    if (kanjiList.length === 0) {
        container.innerHTML = '<p class="empty-msg">Aucun kanji trouvé pour ce niveau.</p>';
        return;
    }

    container.innerHTML = kanjiList.map(item => renderKanjiCard(item)).join('');
}

/**
 * Recherche dans la base de Kanji
 */
export function searchKanji(query) {
    const q = query.toLowerCase().trim();
    if (!q) return [];

    return state.data.kanjiDb.filter(k => 
        (k.kanji && k.kanji.includes(q)) ||
        (k.meaning && k.meaning.toLowerCase().includes(q)) ||
        (k.onyomi && k.onyomi.includes(q)) ||
        (k.kunyomi && k.kunyomi.includes(q))
    );
}