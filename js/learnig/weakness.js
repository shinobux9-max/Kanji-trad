/**
 * js/learning/weakness.js
 * Système autonome de suivi des points faibles
 */

import { getWeaknessData, saveWeaknessData } from '../core/storage.js';

export function updateWeaknessTracking(itemId, isCorrect, detail = {}) {
    const weaknesses = getWeaknessData();
    const item = weaknesses[itemId] || { errors: 0, successes: 0, history: [] };

    if (isCorrect) {
        item.successes += 1;
    } else {
        item.errors += 1;
    }

    item.history.push({
        date: new Date().toISOString(),
        isCorrect,
        ...detail
    });

    // Garder seulement les 20 derniers essais
    if (item.history.length > 20) {
        item.history.shift();
    }

    weaknesses[itemId] = item;
    saveWeaknessData(weaknesses);
    return item;
}

export function computeWeaknessPriority(itemId) {
    const weaknesses = getWeaknessData();
    const item = weaknesses[itemId];
    if (!item || item.errors === 0) return 0;

    // Calcul simple : plus il y a d'erreurs récentes, plus le score est élevé
    const ratio = item.errors / (item.errors + item.successes || 1);
    return Math.round(ratio * 100);
}