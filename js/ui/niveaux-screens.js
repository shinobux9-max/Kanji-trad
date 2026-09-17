/**
 * js/ui/niveaux-screens.js
 * Écrans "Niveaux" grammaire/kanji — miroirs de ui/dashboard.js::showNiveauxScreen (vocab).
 *
 * Extrait de ui/cards.js (audit Phase 5, ETAT-ACTUEL.md : "écrans niveaux").
 */

import { state } from '../core/state.js';
import { backFAB, hideBottomNav } from './common.js';
import { getLevelVocabGrammarStats, getLevelKanjiChars } from '../core/data-loader.js';
import { getKanjiMastery } from '../features/kanji.js';
import { buildNiveauxWaveSvg } from './dashboard.js';

/* ══════════════════════════════════════════════════
   ÉCRANS "NIVEAUX" GRAMMAIRE / KANJI (miroirs de ui/dashboard.js::showNiveauxScreen)
══════════════════════════════════════════════════ */

/**
 * ⚠️ ATTENTION : showCategoryDirect (routeur cross-feature showCategoryDirect/
 * loadJLPTCategory, ui/cards.js) — même landmine que dans core/navigation.js et
 * features/kanji.js::displayKanjiListFromHome(). Vrai appel JS non importé.
 */
export async function showGrammarNiveauxScreen(isBack = false) {
    if (!isBack) history.pushState({ view: 'grammar-niveaux' }, '');
    hideBottomNav();
    const mainContent = document.getElementById('main-content');
    document.getElementById('page-title').innerText = 'Grammaire';

    if (!state.jlptMapping) {
        mainContent.innerHTML = '<div style="padding:20px;color:var(--gray)">Chargement des niveaux…</div>';
        return;
    }

    mainContent.innerHTML = `${backFAB()}
        <div class="niveaux-wrap">
            <div class="niveaux-header">
                <div class="niveaux-title-main">Grammaire</div>
                <div class="niveaux-subtitle-main">Choisis ton niveau JLPT.</div>
            </div>
            <div id="niveaux-list">
                <div style="padding:20px;text-align:center;color:var(--gray)"><div class="spinner"></div></div>
            </div>
        </div>`;

    const listEl = document.getElementById('niveaux-list');
    const sortedLevels = Object.entries(state.jlptMapping.levels).sort((a, b) => a[1].order - b[1].order);

    const cardsHtml = await Promise.all(sortedLevels.map(async ([levelId, levelData]) => {
        const vg = await getLevelVocabGrammarStats(levelId);
        const hasData = vg.grammarTotal > 0;
        const pct = hasData ? Math.round((vg.grammarMastered / vg.grammarTotal) * 100) : 0;

        if (!hasData) {
            return `
                <div class="niveaux-card locked">
                    <div class="niveaux-badge" style="background:${levelData.color}22;color:${levelData.color};border:1px solid ${levelData.color}44">${levelData.label}</div>
                    <div class="niveaux-info">
                        <div class="niveaux-card-title">${levelData.label_full}</div>
                        <div class="niveaux-card-sub">${levelData.description}</div>
                    </div>
                    <div class="niveaux-soon">Bientôt</div>
                </div>`;
        }

        return `
            <div class="niveaux-card" style="border-color:${levelData.color}99; box-shadow:0 0 18px ${levelData.color}59; background:${levelData.color}1f;" onclick="showCategoryDirect('${levelId}','grammar')">
                <div class="niveaux-badge" style="background:${levelData.color}22;color:${levelData.color};border:1px solid ${levelData.color}44">${levelData.label}</div>
                <div class="niveaux-info">
                    <div class="niveaux-card-title">${levelData.label_full}</div>
                    <div class="niveaux-card-sub">${vg.grammarMastered} / ${vg.grammarTotal} leçons</div>
                    <div class="niveaux-progress-bar"><div class="niveaux-progress-fill" style="width:${pct}%;background:${levelData.color}"></div></div>
                    ${buildNiveauxWaveSvg(levelData.color)}
                </div>
                <div class="niveaux-pct">${pct}%</div>
            </div>`;
    }));

    listEl.innerHTML = cardsHtml.join('');
}

/**
 * ⚠️ ATTENTION : showCategoryDirect — même landmine que ci-dessus.
 */
export async function showKanjiNiveauxScreen(isBack = false) {
    if (!isBack) history.pushState({ view: 'kanji-niveaux' }, '');
    hideBottomNav();
    const mainContent = document.getElementById('main-content');
    document.getElementById('page-title').innerText = 'Kanji';

    if (!state.jlptMapping) {
        mainContent.innerHTML = '<div style="padding:20px;color:var(--gray)">Chargement des niveaux…</div>';
        return;
    }

    const sortedLevels = Object.entries(state.jlptMapping.levels).sort((a, b) => a[1].order - b[1].order);

    const cardsHtml = (await Promise.all(sortedLevels.map(async ([levelId, levelData]) => {
        const chars = await getLevelKanjiChars(levelId) || [];
        const totalKanji = chars.length;
        const totalMastery = chars.reduce((sum, c) => sum + getKanjiMastery(c), 0);
        const avgMastery = chars.length > 0 ? Math.round(totalMastery / chars.length) : 0;

        return `
            <div class="niveaux-card" style="border-color:${levelData.color}99; box-shadow:0 0 18px ${levelData.color}59; background:${levelData.color}1f;" onclick="showCategoryDirect('${levelId}','kanji')">
                <div class="niveaux-badge" style="background:${levelData.color}22;color:${levelData.color};border:1px solid ${levelData.color}44">${levelData.label}</div>
                <div class="niveaux-info">
                    <div class="niveaux-card-title">${levelData.label_full}</div>
                    <div class="niveaux-card-sub">${totalKanji} kanji · ${avgMastery}% en moyenne</div>
                    <div class="niveaux-progress-bar"><div class="niveaux-progress-fill" style="width:${avgMastery}%;background:${levelData.color}"></div></div>
                    ${buildNiveauxWaveSvg(levelData.color)}
                </div>
                <div class="niveaux-pct">${avgMastery}%</div>
            </div>`;
    }))).join('');

    mainContent.innerHTML = `${backFAB()}
        <div class="niveaux-wrap">
            <div class="niveaux-header">
                <div class="niveaux-title-main">Kanji</div>
                <div class="niveaux-subtitle-main">Choisis ton niveau JLPT.</div>
            </div>
            <div id="niveaux-list">${cardsHtml}</div>
        </div>`;
}
