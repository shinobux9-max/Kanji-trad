/**
 * js/ui/cards.js
 * Rendu des cartes et fiches de détail (Kanji, Vocabulaire, Grammaire)
 */

import { escapeHtml } from './common.js';
import { getItemTracking } from '../core/storage.js';

/**
 * Génère le HTML d'une carte Kanji pour les grilles
 */
export function renderKanjiCard(item) {
    const tracking = getItemTracking(item.id || item.kanji) || {};
    const statusClass = tracking.status ? `status-${tracking.status}` : '';

    return `
        <div class="kanji-card ${statusClass}" data-id="${item.id || item.kanji}" onclick="showKanjiDetail('${item.kanji}')">
            <div class="kanji-main">${escapeHtml(item.kanji)}</div>
            <div class="kanji-meaning">${escapeHtml(item.meaning || '')}</div>
            <div class="kanji-readings">
                <span class="onyomi">${escapeHtml(item.onyomi || '')}</span>
                <span class="kunyomi">${escapeHtml(item.kunyomi || '')}</span>
            </div>
        </div>
    `;
}

/**
 * Génère le HTML d'une carte Vocabulaire
 */
export function renderVocabCard(item) {
    const tracking = getItemTracking(item.id) || {};
    const statusClass = tracking.status ? `status-${tracking.status}` : '';

    return `
        <div class="vocab-card ${statusClass}" data-id="${item.id}" onclick="showVocabDetail('${item.id}')">
            <div class="vocab-header">
                <span class="vocab-word">${escapeHtml(item.word || item.kanji)}</span>
                <span class="vocab-reading">${escapeHtml(item.reading || '')}</span>
            </div>
            <div class="vocab-meaning">${escapeHtml(item.meaning || '')}</div>
        </div>
    `;
}

/**
 * Génère le HTML d'une carte Grammaire
 */
export function renderGrammarCard(item) {
    const tracking = getItemTracking(item.id) || {};
    const statusClass = tracking.status ? `status-${tracking.status}` : '';

    return `
        <div class="grammar-card ${statusClass}" data-id="${item.id}" onclick="showGrammarDetail('${item.id}')">
            <div class="grammar-title">${escapeHtml(item.title || item.pattern)}</div>
            <div class="grammar-meaning">${escapeHtml(item.meaning || '')}</div>
        </div>
    `;
}