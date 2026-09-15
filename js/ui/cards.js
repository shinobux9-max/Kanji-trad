/**
 * js/ui/cards.js
 * Système de sélection de révision par catégorie — onglet "Réviser" (choix catégorie ->
 * niveau -> mode), écrans "Niveaux" pour grammaire/kanji (miroirs de
 * ui/dashboard.js::showNiveauxScreen), et la session de révision flashcard kanji elle-même
 * (parallèle à celles déjà dans vocabulary.js/grammar.js).
 *
 * ⚠️ CHANTIER DÉCOUVERT EN COURS DE ROUTE, PAS DANS LE PLAN INITIAL (voir HANDOFF.md) —
 * jamais lu ni porté avant cette session, malgré plusieurs landmines documentées le
 * référençant depuis navigation.js, ui/modals.js et features/kanji.js.
 *
 * Placement dans ui/cards.js (stub vide jusqu'ici) : ce système a besoin d'importer à la
 * fois features/kanji.js ET features/strokes.js — impossible depuis kanji.js lui-même
 * (strokes.js importe déjà kanji.js, cycle direct sinon) ni depuis strokes.js (même
 * raison inversée). Vérifié SANS cycle avant d'écrire.
 */

import { state } from '../core/state.js';
import { pushModalState } from '../core/navigation.js';
import { getLevelVocabData, getLevelGrammarData, getLevelKanjiChars, getLevelVocabGrammarStats } from '../core/data-loader.js';
import { getSavedLessonProgress, findActiveLearningLevel, startGrammarLessonFlow } from '../learning/exercises.js';
import { showLearningPathHome } from '../learning/learning-path.js';
import { renderWeaknessWidget } from '../learning/weakness.js';
import { gradeReview, scheduleRelearning, recordSessionCompleted } from '../learning/srs.js';
import { getDueKanjiChars, buildReadingChips, getKanjiMastery } from '../features/kanji.js';
import { startStrokeQuiz } from '../features/strokes.js';
import { showVocabReviewModeSelector } from '../features/vocabulary.js';
import { showGrammarReviewModeSelector } from '../features/grammar.js';
import { showRevisionKanaPicker } from '../features/kana.js';
import { showFreeTrainingConfig } from '../features/free-training.js';
import { buildNiveauxWaveSvg, navKana } from './dashboard.js';

/* ══════════════════════════════════════════════════
   ONGLET "RÉVISER" — choix catégorie -> choix niveau/script -> lance direct la révision
══════════════════════════════════════════════════ */
export async function showRevisionsScreen(isBack = false) {
    if (!isBack) history.pushState({ view: 'revisions' }, '');
    document.getElementById('page-title').innerText = 'Réviser';
    const main = document.getElementById('main-content');

    main.innerHTML = `
        <div class="apprendre-wrap">
            <div class="apprendre-header">
                <div class="apprendre-title-main">Réviser</div>
                <div class="apprendre-subtitle-main">Choisis une catégorie à réviser.</div>
            </div>
            <div class="dash-card free-training-card" onclick="showFreeTrainingConfig()">
                <div class="free-training-icon">復</div>
                <div class="free-training-info">
                    <div class="free-training-title">Entraînement libre <span class="free-training-badge">LIBRE</span></div>
                    <div class="free-training-sub">Feuillette tes mots vus · sans effet sur tes révisions</div>
                </div>
                <span class="free-training-chevron">→</span>
            </div>
            <div class="apprendre-grid">
                <div class="apprendre-card" style="border-color:#4ADE8099; box-shadow:0 0 18px #4ADE8059;" onclick="showRevisionLevelPicker('grammar')">
                    <div class="apprendre-card-icon" style="background:rgba(74,222,128,0.15);color:#4ADE80;">文</div>
                    <div class="apprendre-card-title">Grammaire</div>
                    <div class="apprendre-card-sub">Choisir un niveau</div>
                </div>
                <div class="apprendre-card" style="border-color:#FBBF2499; box-shadow:0 0 18px #FBBF2459;" onclick="showRevisionLevelPicker('vocab')">
                    <div class="apprendre-card-icon" style="background:rgba(251,191,36,0.15);color:#FBBF24;">語</div>
                    <div class="apprendre-card-title">Vocabulaire</div>
                    <div class="apprendre-card-sub">Choisir un niveau</div>
                </div>
                <div class="apprendre-card" style="border-color:#00E5FF99; box-shadow:0 0 18px #00E5FF59;" onclick="showRevisionLevelPicker('kanji')">
                    <div class="apprendre-card-icon" style="background:rgba(0,229,255,0.15);color:var(--accent);">字</div>
                    <div class="apprendre-card-title">Kanji</div>
                    <div class="apprendre-card-sub">Choisir un niveau</div>
                </div>
                <div class="apprendre-card" style="border-color:#9D6EFF99; box-shadow:0 0 18px #9D6EFF59; background:#9D6EFF1f;" onclick="showRevisionKanaPicker()">
                    <div class="apprendre-card-icon" style="background:rgba(157,139,255,0.15);color:#9D6EFF;">あ</div>
                    <div class="apprendre-card-title">Kana</div>
                    <div class="apprendre-card-sub">Hiragana / Katakana</div>
                </div>
            </div>
        </div>`;
}

export async function showRevisionLevelPicker(category, isBack = false) {
    if (!isBack) history.pushState({ view: 'revision-level-picker', category }, '');
    document.getElementById('page-title').innerText = 'Réviser';
    const main = document.getElementById('main-content');

    if (!state.jlptMapping) {
        main.innerHTML = '<div style="padding:20px;color:var(--gray)">Chargement des niveaux…</div>';
        return;
    }

    const labels = { grammar: 'Grammaire', vocab: 'Vocabulaire', kanji: 'Kanji' };

    main.innerHTML = `
        <div class="niveaux-wrap">
            <div class="niveaux-header">
                <div class="niveaux-title-main">${labels[category]}</div>
                <div class="niveaux-subtitle-main">Choisis le niveau à réviser.</div>
            </div>
            <div id="niveaux-list">
                <div style="padding:20px;text-align:center;color:var(--gray)"><div class="spinner"></div></div>
            </div>
        </div>`;

    const listEl = document.getElementById('niveaux-list');
    const sortedLevels = Object.entries(state.jlptMapping.levels).sort((a, b) => a[1].order - b[1].order);

    const cardsHtml = await Promise.all(sortedLevels.map(async ([levelId, levelData]) => {
        let hasData = false;

        if (category === 'kanji') {
            hasData = true; // kanjiDb toujours en mémoire, tous les niveaux dispo
        } else {
            const vg = await getLevelVocabGrammarStats(levelId);
            hasData = category === 'vocab' ? vg.vocabTotal > 0 : vg.grammarTotal > 0;
        }

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
            <div class="niveaux-card" style="border-color:${levelData.color}99; box-shadow:0 0 18px ${levelData.color}59; background:${levelData.color}1f;" onclick="startRevisionFor('${category}','${levelId}')">
                <div class="niveaux-badge" style="background:${levelData.color}22;color:${levelData.color};border:1px solid ${levelData.color}44">${levelData.label}</div>
                <div class="niveaux-info">
                    <div class="niveaux-card-title">${levelData.label_full}</div>
                    <div class="niveaux-card-sub">Toucher pour réviser</div>
                    ${buildNiveauxWaveSvg(levelData.color)}
                </div>
            </div>`;
    }));

    listEl.innerHTML = cardsHtml.join('');
}

export async function startRevisionFor(category, levelId) {
    if (category === 'vocab') {
        const vd = await getLevelVocabData(levelId);
        if (!vd || !vd.data) { alert("Aucune donnée disponible pour ce niveau."); return; }
        state.vocabHomeData = { levelId, data: vd.data, examples: vd.examples };
        state.currentLevelId = levelId;
        document.getElementById('main-content').innerHTML = `<div id="category-content" style="padding:16px"></div>`;
        showVocabReviewModeSelector();
    } else if (category === 'grammar') {
        const gd = await getLevelGrammarData(levelId);
        if (!gd || !gd.data) { alert("Aucune donnée disponible pour ce niveau."); return; }
        state.grammarHomeData = { levelId, data: gd.data, examples: null };
        document.getElementById('main-content').innerHTML = `<div id="category-content" style="padding:16px"></div>`;
        showGrammarReviewModeSelector();
    } else if (category === 'kanji') {
        const chars = await getLevelKanjiChars(levelId);
        state.kanjiHomeData = { levelId, chars: chars || [] };
        document.getElementById('main-content').innerHTML = `<div id="category-content" style="padding:16px"></div>`;
        showKanjiReviewModeSelector();
    }
}

/* ══════════════════════════════════════════════════
   MODE DE RÉVISION KANJI — flashcard + tracé (normal/hardcore)
══════════════════════════════════════════════════ */
export function showKanjiReviewModeSelector() {
    const container = document.getElementById('category-content');
    const dueChars = getDueKanjiChars();

    if (dueChars.length === 0) {
        alert('Rien à réviser pour le moment ! 🎉');
        return;
    }

    pushModalState('kanji-review-selector');

    container.innerHTML = `
        <div class="review-mode-selector">
            <button class="back-btn" onclick="history.back()">←</button>
            <div class="review-mode-title">Choisis ton mode de révision</div>
            <div class="review-mode-count">${dueChars.length} kanji à revoir</div>

            <button class="review-mode-btn" onclick="startKanjiFlashcardReview()">
                <span class="review-mode-icon">🗂️</span>
                <div><div class="review-mode-name">Flashcard</div><div class="review-mode-desc">Lecture et sens</div></div>
            </button>
            <button class="review-mode-btn" onclick="startKanjiTraceReview('trace-easy')">
                <span class="review-mode-icon">✍️</span>
                <div><div class="review-mode-name">Tracé normal</div><div class="review-mode-desc">Avec assistance</div></div>
            </button>
            <button class="review-mode-btn" onclick="startKanjiTraceReview('trace-hard')">
                <span class="review-mode-icon">🔥</span>
                <div><div class="review-mode-name">Tracé difficile</div><div class="review-mode-desc">Sans assistance (hardcore)</div></div>
            </button>
            <button class="review-mode-btn" onclick="startKanjiFreeTrainingFromSelector()">
                <span class="review-mode-icon">🏋️</span>
                <div><div class="review-mode-name">Entraînement libre</div><div class="review-mode-desc">Configurable, sans impact sur le SRS</div></div>
            </button>
        </div>`;
}

// Équivalent du onclick="showFreeTrainingConfig(false, {type:'kanji', level: kanjiHomeData
// ?.levelId})" du monolithe — adapté car state.kanjiHomeData est une propriété d'import de
// module, inaccessible depuis un attribut onclick. Même principe que replayKanaTraceQuiz.
export function startKanjiFreeTrainingFromSelector() {
    showFreeTrainingConfig(false, { type: 'kanji', level: state.kanjiHomeData?.levelId });
}

export function startKanjiTraceReview(mode) {
    const dueChars = getDueKanjiChars();
    if (dueChars.length === 0) return;
    startStrokeQuiz({ type: 'queue', id: dueChars, mode });
}

export function startKanjiFlashcardReview() {
    const dueChars = getDueKanjiChars();
    if (dueChars.length === 0) return;

    pushModalState('kanji-review-flashcard');

    state.kanjiReviewSession = {
        queue: dueChars,
        index: 0,
        results: { again: 0, hard: 0, good: 0, easy: 0 },
        flipped: false
    };
    document.getElementById('main-content').innerHTML = `<div id="category-content" style="padding:16px"></div>`;
    renderKanjiReviewScreen();
}

export function renderKanjiReviewScreen() {
    const container = document.getElementById('category-content');
    const session = state.kanjiReviewSession;

    if (!session || session.index >= session.queue.length) {
        renderKanjiReviewSummary();
        return;
    }

    const char = session.queue[session.index];
    const kanjiData = state.data.kanjiDb.find(k => k.char === char);
    const progress = session.index + 1;
    const total = session.queue.length;
    const flipped = session.flipped;

    const meanings = (kanjiData?.meanings || []).filter(m => !m.toLowerCase().includes('radical'));
    const onReadings = kanjiData?.on || [];
    const kunReadings = kanjiData?.kun || [];

    container.innerHTML = `<div class="review-page">
        <div class="review-header">
            <button class="back-btn" onclick="history.back()">✕</button>
            <div class="review-progress-bar"><div class="review-progress-fill" style="width:${(session.index / total) * 100}%"></div></div>
            <div class="review-progress-text">${progress} / ${total}</div>
        </div>

        <div class="review-card ${flipped ? 'flipped' : ''}" onclick="${flipped ? '' : 'flipKanjiReviewCard()'}">
            <div class="review-card-front">
                <div class="review-word" style="font-size:3.5rem;">${char}</div>
            </div>
            ${flipped ? `
                <div class="review-card-back">
                    ${(onReadings.length || kunReadings.length) ? `<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-bottom:12px">${buildReadingChips(kanjiData, { maxOn: 3, maxKun: 3 })}</div>` : ''}
                    <div class="review-meaning">${meanings.slice(0, 3).join(' / ') || '–'}</div>
                </div>
            ` : `<div class="review-tap-hint">Touche la carte pour révéler</div>`}
        </div>

        ${flipped ? `
            <div class="review-grade-buttons">
                <button class="grade-btn grade-again" onclick="submitKanjiReviewGrade(0)">Encore</button>
                <button class="grade-btn grade-hard" onclick="submitKanjiReviewGrade(1)">Difficile</button>
                <button class="grade-btn grade-good" onclick="submitKanjiReviewGrade(2)">Bien</button>
                <button class="grade-btn grade-easy" onclick="submitKanjiReviewGrade(3)">Facile</button>
            </div>
        ` : ''}
    </div>`;
}

export function flipKanjiReviewCard() {
    if (!state.kanjiReviewSession) return;
    state.kanjiReviewSession.flipped = true;
    renderKanjiReviewScreen();
}

export function submitKanjiReviewGrade(quality) {
    if (!state.kanjiReviewSession) return;
    const char = state.kanjiReviewSession.queue[state.kanjiReviewSession.index];
    gradeReview(char, quality, { type: 'kanji', label: char });
    if (quality === 0) scheduleRelearning(state.kanjiReviewSession, char);

    const labels = ['again', 'hard', 'good', 'easy'];
    state.kanjiReviewSession.results[labels[quality]]++;

    state.kanjiReviewSession.index++;
    state.kanjiReviewSession.flipped = false;
    renderKanjiReviewScreen();
}

export function renderKanjiReviewSummary() {
    recordSessionCompleted();
    const container = document.getElementById('category-content');
    const r = state.kanjiReviewSession.results;
    const total = state.kanjiReviewSession.queue.length;

    container.innerHTML = `<div class="review-summary">
        <div class="review-summary-title">Session terminée ! 🎉</div>
        <div class="review-summary-count">${total} kanji révisé${total > 1 ? 's' : ''}</div>
        <div class="review-summary-stats">
            <div class="review-stat"><span class="review-stat-dot again"></span>Encore : ${r.again}</div>
            <div class="review-stat"><span class="review-stat-dot hard"></span>Difficile : ${r.hard}</div>
            <div class="review-stat"><span class="review-stat-dot good"></span>Bien : ${r.good}</div>
            <div class="review-stat"><span class="review-stat-dot easy"></span>Facile : ${r.easy}</div>
        </div>
        <button class="revise-btn" style="margin-top:20px;" onclick="history.back()">Retour aux kanji</button>
    </div>`;
    state.kanjiReviewSession = null;
}

/* ══════════════════════════════════════════════════
   ÉCRANS "NIVEAUX" GRAMMAIRE / KANJI (miroirs de ui/dashboard.js::showNiveauxScreen)
══════════════════════════════════════════════════ */

/**
 * ⚠️ ATTENTION : showCategoryDirect (routeur cross-feature showCategoryDirect/
 * loadJLPTCategory, hors périmètre de tout fichier actuel — même landmine que dans
 * core/navigation.js et features/kanji.js::displayKanjiListFromHome()). Vrai appel JS non
 * importé.
 */
export async function showGrammarNiveauxScreen(isBack = false) {
    if (!isBack) history.pushState({ view: 'grammar-niveaux' }, '');
    const mainContent = document.getElementById('main-content');
    document.getElementById('page-title').innerText = 'Grammaire';

    if (!state.jlptMapping) {
        mainContent.innerHTML = '<div style="padding:20px;color:var(--gray)">Chargement des niveaux…</div>';
        return;
    }

    mainContent.innerHTML = `
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

    mainContent.innerHTML = `
        <div class="niveaux-wrap">
            <div class="niveaux-header">
                <div class="niveaux-title-main">Kanji</div>
                <div class="niveaux-subtitle-main">Choisis ton niveau JLPT.</div>
            </div>
            <div id="niveaux-list">${cardsHtml}</div>
        </div>`;
}

/**
 * Équivalent EXACT de showApprendreScreen(isBack) du monolithe — écran d'accueil de l'onglet
 * "Apprendre". N'existait dans AUCUN fichier porté jusqu'ici (vrai trou, pas juste une
 * landmine) : découvert en testant réellement l'app (clic sur l'onglet Apprendre ->
 * ReferenceError). Toutes ses dépendances existaient déjà, juste jamais assemblées dans
 * cette fonction précise.
 */
export async function showApprendreScreen(isBack = false) {
    if (!isBack) history.pushState({ view: 'apprendre' }, '');
    document.getElementById('page-title').innerText = 'Apprendre';
    const main = document.getElementById('main-content');
    const savedLessonProgress = getSavedLessonProgress();
    const activeLevel = savedLessonProgress ? savedLessonProgress.level : await findActiveLearningLevel();
    const activeLevelLabel = activeLevel ? activeLevel.toUpperCase() : '';

    main.innerHTML = `
        <div class="apprendre-wrap">
            <div class="apprendre-header">
                <div class="apprendre-title-main">Apprendre</div>
                <div class="apprendre-subtitle-main">Suis le fil, ou choisis toi-même ci-dessous.</div>
            </div>

            <div class="dash-card free-training-card" onclick="startGrammarLessonFlow()">
                <div class="free-training-icon" style="background:rgba(74,222,128,0.15);color:#4ADE80">${savedLessonProgress ? '▶' : '📚'}</div>
                <div class="free-training-info">
                    <div class="free-training-title">${savedLessonProgress ? 'Reprendre' : "Introduction"}</div>
                    <div class="free-training-sub">${savedLessonProgress ? `Reprends là où tu t'es arrêté · ${activeLevelLabel} Grammaire` : `Une nouvelle notion vous attend · ${activeLevelLabel} Grammaire`}</div>
                </div>
                <span class="free-training-chevron">→</span>
            </div>

            <div class="dash-card free-training-card" onclick="showLearningPathHome('n5')">
                <div class="free-training-icon" style="background:rgba(0,229,255,0.15);color:var(--accent)">🗺️</div>
                <div class="free-training-info">
                    <div class="free-training-title">Parcours guidé</div>
                    <div class="free-training-sub">Vocabulaire, kanji et grammaire ensemble, unité par unité</div>
                </div>
                <span class="free-training-chevron">→</span>
            </div>

            <div class="dash-card weakness-widget" id="apprendre-weakness-widget" style="display:none;"></div>

            <div class="apprendre-section-header">
                <span>Fiches</span>
            </div>

            <div class="apprendre-grid">
                <div class="apprendre-card" style="border-color:#4ADE8099; box-shadow:0 0 18px #4ADE8059;" onclick="showGrammarNiveauxScreen()">
                    <div class="apprendre-card-icon" style="background:rgba(74,222,128,0.15);color:#4ADE80;">文</div>
                    <div class="apprendre-card-title">Grammaire</div>
                    <div class="apprendre-card-sub">Une règle = une fiche</div>
                </div>
                <div class="apprendre-card" style="border-color:#FBBF2499; box-shadow:0 0 18px #FBBF2459;" onclick="showNiveauxScreen()">
                    <div class="apprendre-card-icon" style="background:rgba(251,191,36,0.15);color:#FBBF24;">語</div>
                    <div class="apprendre-card-title">Vocabulaire</div>
                    <div class="apprendre-card-sub">Mots par niveau JLPT</div>
                </div>
                <div class="apprendre-card" style="border-color:#00E5FF99; box-shadow:0 0 18px #00E5FF59;" onclick="showKanjiNiveauxScreen()">
                    <div class="apprendre-card-icon" style="background:rgba(0,229,255,0.15);color:var(--accent);">字</div>
                    <div class="apprendre-card-title">Kanji</div>
                    <div class="apprendre-card-sub">Caractères et tracé</div>
                </div>
                <div class="apprendre-card" style="border-color:#9D6EFF99; box-shadow:0 0 18px #9D6EFF59; background:#9D6EFF1f;" onclick="navKana()">
                    <div class="apprendre-card-icon" style="background:rgba(157,139,255,0.15);color:#9D6EFF;">あ</div>
                    <div class="apprendre-card-title">Kana</div>
                    <div class="apprendre-card-sub">Hiragana & Katakana</div>
                </div>
            </div>
        </div>`;
    renderWeaknessWidget('apprendre-weakness-widget');
}
