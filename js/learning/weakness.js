/**
 * js/learning/weakness.js
 * Système autonome de suivi des points faibles
 */

import { getWeaknessData, saveWeaknessData } from '../core/storage.js';
import { state } from '../core/state.js';
import { ALL_JLPT_LEVELS, ALL_KANA_SCRIPTS } from '../core/constants.js';
import { getKanaFlatList } from '../core/data-loader.js';
import { showFicheCorrectionModal } from '../ui/common.js';

/**
 * Équivalent EXACT de updateWeaknessTracking(itemId, quality, meta) du monolithe.
 * quality : 0 = Encore (échec), 1/2/3 = Difficile/Bien/Facile (réussite).
 * - Échec (quality === 0) : incrémente consecutiveFails ET totalFails, note la date du jour
 *   et le type/label (repris de meta si fourni, sinon conservés depuis l'entrée existante).
 * - Réussite (quality >= 1) ET une entrée existait déjà : SUPPRIME l'entrée — la notion est
 *   considérée consolidée après un premier succès qui suit un échec, elle sort du widget
 *   "À renforcer". (Si aucune entrée n'existait, une réussite ne crée rien : rien à faire.)
 */
export function updateWeaknessTracking(itemId, quality, meta = null) {
    const data = getWeaknessData();
    if (quality === 0) {
        const existing = data[itemId] || { consecutiveFails: 0, totalFails: 0 };
        data[itemId] = {
            consecutiveFails: existing.consecutiveFails + 1,
            totalFails: (existing.totalFails || 0) + 1,
            lastFailDate: new Date().toISOString(),
            type: (meta && meta.type) || existing.type || 'vocab',
            label: (meta && meta.label) || existing.label || itemId
        };
    } else if (data[itemId]) {
        delete data[itemId];
    }
    saveWeaknessData(data);
    return data[itemId] || null;
}

/**
 * Équivalent EXACT de computeWeaknessPriority(rec) du monolithe.
 * IMPORTANT : contrairement à l'ancienne signature de ce stub, prend directement
 * l'ENREGISTREMENT (rec = data[itemId]), pas un itemId — c'est ce que consomment
 * prioritizeQueue() (learning/srs.js) et le tri du widget "À renforcer", qui itèrent déjà
 * sur Object.entries(getWeaknessData()).
 * Trois signaux combinés : échecs consécutifs (poids fort), échecs totaux (poids faible),
 * récence en décroissance linéaire sur 14 jours (un échec d'hier prime sur un échec ancien).
 */
export function computeWeaknessPriority(rec) {
    const daysSince = (Date.now() - new Date(rec.lastFailDate).getTime()) / 86400000;
    const recencyFactor = Math.max(0, 1 - daysSince / 14);
    return (rec.consecutiveFails || 0) * 5 + (rec.totalFails || 0) * 1 + recencyFactor * 8;
}

/**
 * Équivalent EXACT de resolveWeaknessEntry(itemId, rec) du monolithe. Reconstruit une entrée
 * { type, level, item } complète à partir d'un id + son enregistrement de faiblesse (qui ne
 * connaît que le type, pas le niveau) — recherche parmi les niveaux/scripts disponibles.
 * ⚠️ ATTENTION : getRawItemsForTypeLevel existe réellement dans learning/srs.js, mais srs.js
 * importe déjà learning/weakness.js (pour updateWeaknessTracking) — un import en retour ici
 * créerait un cycle direct (confirmé par le script de détection avant d'écrire ce fichier).
 * Reste un vrai appel JS non importé pour les branches vocab/grammar (la branche kana utilise
 * getKanaFlatList, importée sans risque depuis core/data-loader.js).
 */
export async function resolveWeaknessEntry(itemId, rec) {
    const type = rec.type;
    if (type === 'kana') {
        for (const script of ALL_KANA_SCRIPTS) {
            const found = getKanaFlatList(script).find(it => it.id === itemId);
            if (found) return { type: 'kana', level: script, item: found };
        }
        return null;
    }
    if (type === 'kanji') {
        const kanjiData = state.data.kanjiDb.find(k => k.char === itemId);
        return kanjiData ? { type: 'kanji', level: null, item: { char: itemId } } : null;
    }
    // ⚠️ ATTENTION : getRawItemsForTypeLevel (learning/srs.js) — cycle si importée ici (voir
    // ci-dessus). Vrai appel JS non importé.
    for (const level of ALL_JLPT_LEVELS) {
        const items = await getRawItemsForTypeLevel(type, level);
        const found = items.find(it => it.id === itemId);
        if (found) return { type, level, item: found };
    }
    return null;
}

/**
 * Équivalent EXACT de openWeaknessItem(itemId) du monolithe — ouvre la fiche complète d'une
 * notion faible (appelée depuis le widget "À renforcer" de l'accueil).
 */
export async function openWeaknessItem(itemId) {
    const rec = getWeaknessData()[itemId];
    if (!rec) return;
    const entry = await resolveWeaknessEntry(itemId, rec);
    if (!entry) { alert('Cette fiche est introuvable (contenu peut-être modifié depuis).'); return; }
    showFicheCorrectionModal(entry);
}

/**
 * Équivalent EXACT de trainWeaknessItems() du monolithe — lance une session d'Entraînement
 * libre (isolée du SRS) sur les 5 notions actuellement les plus faibles, dans le même ordre
 * de priorité que celui affiché par le widget.
 * ⚠️ ATTENTION : launchFreeTraining existe réellement dans features/free-training.js, mais y importer créerait un cycle (confirmé). Vrai
 * appel JS non importé.
 */
export async function trainWeaknessItems() {
    const data = getWeaknessData();
    const ids = Object.entries(data)
        .sort((a, b) => computeWeaknessPriority(b[1]) - computeWeaknessPriority(a[1]))
        .slice(0, 5)
        .map(([id]) => id);
    if (ids.length === 0) return;

    const pool = [];
    for (const id of ids) {
        const entry = await resolveWeaknessEntry(id, data[id]);
        if (entry) pool.push(entry);
    }
    if (pool.length === 0) { alert('Aucune fiche disponible pour ces notions.'); return; }
    launchFreeTraining(pool, pool.length, { type: 'weakness', scope: 'weakness', countRaw: String(pool.length) });
}

/**
 * Équivalent EXACT de renderWeaknessWidget(elementId) du monolithe — résout la landmine
 * ui/dashboard.js::showDashboard() (voir HANDOFF.md).
 */
export async function renderWeaknessWidget(elementId = 'dashboard-weakness-widget') {
    const el = document.getElementById(elementId);
    if (!el) return;

    const data = getWeaknessData();
    const total = Object.keys(data).length;

    if (total === 0) {
        el.style.display = 'none'; // pas de carte vide qui ne sert à rien
        return;
    }
    el.style.display = '';

    el.innerHTML = `
        <button class="weakness-compact-row" onclick="trainWeaknessItems()">
            <span class="weakness-compact-icon">🧠</span>
            <span class="weakness-compact-label">Notion${total > 1 ? 's' : ''} à renforcer</span>
            <span class="weakness-count">${total}</span>
        </button>
    `;
}