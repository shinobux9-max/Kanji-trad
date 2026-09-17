/**
 * js/ui/cards.js
 * Écrans d'accueil des onglets "Réviser"/"Apprendre" (choix catégorie -> niveau -> mode) et
 * routeur cross-feature showCategoryDirect/loadJLPTCategory.
 *
 * Depuis l'audit Phase 5 (ETAT-ACTUEL.md), les 3 autres responsabilités historiquement
 * regroupées ici ont été extraites dans leurs propres fichiers :
 *   - ui/kanji-review.js  : sélecteurs de mode + session flashcard kanji + dossiers
 *   - ui/niveaux-screens.js : écrans "Niveaux" grammaire/kanji
 *   - ui/mixed-review.js  : révision mixte (Vocab+Grammaire+Kanji+Kana)
 *
 * ⚠️ CHANTIER DÉCOUVERT EN COURS DE ROUTE, PAS DANS LE PLAN INITIAL (voir HANDOFF.md) —
 * jamais lu ni porté avant cette session, malgré plusieurs landmines documentées le
 * référençant depuis navigation.js, ui/modals.js et features/kanji.js.
 */

import { state } from '../core/state.js';
import { backFAB, showBottomNav, hideBottomNav } from './common.js';
import { getLevelVocabData, getLevelGrammarData, getLevelKanjiChars, getLevelVocabGrammarStats, flattenIfNested } from '../core/data-loader.js';
import { getSavedLessonProgress, findActiveLearningLevel, hasSeenLessonOnboarding, startGrammarLessonFlowActual, showLessonOnboarding, showOnboardingChoiceScreen } from '../learning/exercises.js';
import { loadLearningProgress, startLearningPath } from '../learning/learning-path.js';
import { renderWeaknessWidget } from '../learning/weakness.js';
import { displayKanjiList } from '../features/kanji.js';
import { showVocabReviewModeSelector, displayVocabList } from '../features/vocabulary.js';
import { showGrammarReviewModeSelector, showGrammarHome } from '../features/grammar.js';
import { showKanjiReviewModeSelector } from './kanji-review.js';
import { buildNiveauxWaveSvg } from './dashboard.js';

/* ══════════════════════════════════════════════════
   ONGLET "RÉVISER" — choix catégorie -> choix niveau/script -> lance direct la révision
══════════════════════════════════════════════════ */
export async function showRevisionsScreen(isBack = false) {
    if (!isBack) history.pushState({ view: 'revisions' }, '');
    showBottomNav();
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
                <div class="apprendre-card" style="border-color:#FBBF2499; box-shadow:0 0 18px #FBBF2459;" onclick="navFolders()">
                    <div class="apprendre-card-icon" style="background:rgba(251,191,36,0.15);color:#FBBF24;">📁</div>
                    <div class="apprendre-card-title">Mes dossiers</div>
                    <div class="apprendre-card-sub">Favoris et kanji enregistrés</div>
                </div>
            </div>
        </div>`;
}

export async function showRevisionLevelPicker(category, isBack = false) {
    if (!isBack) history.pushState({ view: 'revision-level-picker', category }, '');
    hideBottomNav();
    document.getElementById('page-title').innerText = 'Réviser';
    const main = document.getElementById('main-content');

    if (!state.jlptMapping) {
        main.innerHTML = '<div style="padding:20px;color:var(--gray)">Chargement des niveaux…</div>';
        return;
    }

    const labels = { grammar: 'Grammaire', vocab: 'Vocabulaire', kanji: 'Kanji' };

    main.innerHTML = `${backFAB()}
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

/**
 * Équivalent EXACT de showApprendreScreen(isBack) du monolithe — écran d'accueil de l'onglet
 * "Apprendre". N'existait dans AUCUN fichier porté jusqu'ici (vrai trou, pas juste une
 * landmine) : découvert en testant réellement l'app (clic sur l'onglet Apprendre ->
 * ReferenceError). Toutes ses dépendances existaient déjà, juste jamais assemblées dans
 * cette fonction précise.
 */
export async function showApprendreScreen(isBack = false) {
    if (!isBack) history.pushState({ view: 'apprendre' }, '');
    showBottomNav();
    document.getElementById('page-title').innerText = 'Apprendre';
    const main = document.getElementById('main-content');
    const savedLessonProgress = getSavedLessonProgress();
    const learningProgress = loadLearningProgress();
    // Fusion "Introduction"/"Parcours guidé" en une seule carte (demande explicite) : "Reprendre"
    // s'active dès qu'une session est active dans L'UN OU L'AUTRE des deux systèmes.
    const hasLearningPathProgress = !!learningProgress.currentUnit;
    const hasAnyProgress = !!savedLessonProgress || hasLearningPathProgress;
    const activeLevel = savedLessonProgress ? savedLessonProgress.level
        : (hasLearningPathProgress ? learningProgress.currentLevel : await findActiveLearningLevel());
    const activeLevelLabel = activeLevel ? activeLevel.toUpperCase() : '';

    main.innerHTML = `
        <div class="apprendre-wrap">
            <div class="apprendre-header">
                <div class="apprendre-title-main">Apprendre</div>
                <div class="apprendre-subtitle-main">Suis le fil, ou choisis toi-même ci-dessous.</div>
            </div>

            <div class="dash-card free-training-card" onclick="startIntroductionOrResume()">
                <div class="free-training-icon" style="background:rgba(74,222,128,0.15);color:#4ADE80">${hasAnyProgress ? '▶' : '📚'}</div>
                <div class="free-training-info">
                    <div class="free-training-title">${hasAnyProgress ? 'Reprendre' : 'Introduction'}</div>
                    <div class="free-training-sub">${hasAnyProgress ? `Reprends là où tu t'es arrêté · ${activeLevelLabel}` : `Découvre le parcours guidé et les bases · ${activeLevelLabel}`}</div>
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

            <div class="dash-card" style="display:flex;align-items:center;gap:12px;cursor:pointer;" onclick="navFolders()">
                <div style="flex-shrink:0;width:40px;height:40px;border-radius:10px;background:rgba(139,148,158,0.15);color:var(--gray);display:flex;align-items:center;justify-content:center;font-size:1.25rem;">📁</div>
                <div style="flex:1;">
                    <div style="font-size:0.875rem;color:#fff;font-weight:bold;">Mes dossiers</div>
                    <div style="font-size:0.6875rem;color:var(--gray);margin-top:2px;">Favoris et kanji enregistrés</div>
                </div>
                <span style="color:var(--gray);font-size:1.125rem;">→</span>
            </div>
        </div>`;
    renderWeaknessWidget('apprendre-weakness-widget');
}

/* ══════════════════════════════════════════════════
   ROUTEUR CROSS-FEATURE — showCategoryDirect / loadJLPTCategory
   ─────────────────────────────────────────────────
   Écran générique "kanji|vocab|grammaire d'un niveau JLPT donné", distribue vers
   displayKanjiList/displayVocabList/showGrammarHome selon la catégorie. Dernière landmine
   connue résolue (référencée depuis core/navigation.js, ui/niveaux-screens.js — pour les
   écrans "Niveaux" — et features/kanji.js::displayKanjiListFromHome()).
══════════════════════════════════════════════════ */
export async function showCategoryDirect(levelId, category, isBack = false) {
    if (!state.jlptMapping || !state.jlptMapping.levels[levelId]) return;
    hideBottomNav();

    if (!isBack) history.pushState({ view: 'category-direct', levelId, category }, '');

    state.currentJLPTLevel = levelId;
    const levelData = state.jlptMapping.levels[levelId];
    const mainContent = document.getElementById('main-content');

    const catLabels = { kanji: 'Kanji', vocab: 'Vocabulaire', grammar: 'Grammaire' };
    const catLabel = catLabels[category] || category;

    // Sous-titre : stats réelles si disponibles, sinon la description du niveau
    let subtitle = levelData.description;
    if (category === 'vocab' || category === 'grammar') {
        const vg = await getLevelVocabGrammarStats(levelId);
        if (category === 'vocab' && vg.vocabTotal > 0) subtitle = `${vg.vocabTotal} mots · ${vg.vocabMastered} maîtrisés`;
        if (category === 'grammar' && vg.grammarTotal > 0) subtitle = `${vg.grammarTotal} leçons · ${vg.grammarMastered} maîtrisées`;
    } else if (category === 'kanji') {
        const chars = await getLevelKanjiChars(levelId);
        subtitle = `${chars ? chars.length : 0} kanji`;
    }

    mainContent.innerHTML = `${backFAB('history.back()')}
        <div class="cat-header" style="padding-top:56px">
            <div class="cat-header-info">
                <div class="cat-header-title">${catLabel} ${levelData.label}</div>
                <div class="cat-header-sub">${subtitle}</div>
            </div>
        </div>
        <div id="category-content" style="padding:16px">
            <div style="text-align:center;color:var(--gray);margin-top:40px">
                <div class="spinner" style="margin-bottom:16px"></div>
                Chargement…
            </div>
        </div>`;

    loadJLPTCategory(levelId, category, true);
}

export async function loadJLPTCategory(levelId, category, isBack = false) {
    const container = document.getElementById('category-content');
    if (!container) return;

    try {
        container.innerHTML = '<div style="text-align:center;color:var(--gray)"><div class="spinner" style="margin-bottom:16px"></div>Chargement…</div>';

        const url = `./data/${levelId}/${category}.json`;
        const res = await fetch(url, { cache: 'no-store' });

        if (!res.ok) {
            throw new Error(`Fichier non trouvé : ${url}`);
        }

        const data = flattenIfNested(await res.json());

        let examples = null;
        if (category === 'vocab' || category === 'grammar') {
            try {
                const exRes = await fetch(`./data/${levelId}/exemples.json`, { cache: 'no-store' });
                if (exRes.ok) {
                    examples = await exRes.json();
                }
            } catch (e) {
                console.warn(`Exemples non trouvés pour ${levelId}:`, e);
            }
        }

        if (category === 'kanji') {
            displayKanjiList(levelId, data, isBack);
        } else if (category === 'vocab') {
            displayVocabList(levelId, data, examples, isBack);
        } else if (category === 'grammar') {
            showGrammarHome(levelId, data, examples, isBack);
        }

    } catch (e) {
        container.innerHTML = `<div style="color:#e55;font-size:0.8125rem;padding:20px;text-align:center">Erreur : ${e.message}</div>`;
        console.error('loadJLPTCategory error:', e);
    }
}

/**
 * Orchestre le clic sur la carte fusionnée "Introduction"/"Reprendre" de l'écran Apprendre.
 * Fusion demandée explicitement : un seul point d'entrée pour le parcours de leçon ET le
 * Learning Path, au lieu de deux cartes séparées.
 */
export function startIntroductionOrResume() {
    if (!hasSeenLessonOnboarding()) {
        // Jamais vu l'intro : passe TOUJOURS par l'onboarding, peu importe une éventuelle
        // progression déjà entamée par ailleurs (cas rare, mais l'intro reste prioritaire).
        showLessonOnboarding();
        return;
    }

    const hasLessonProgress = !!getSavedLessonProgress();
    const learningProgress = loadLearningProgress();
    const hasLearningPathProgress = !!learningProgress.currentUnit;

    if (hasLessonProgress && hasLearningPathProgress) {
        // Les deux ont une session active : on garde la possibilité de choisir laquelle
        // reprendre plutôt que de trancher arbitrairement pour l'une des deux.
        // Bug trouvé en test réel, corrigé : showOnboardingChoiceScreen() s'attend à ce que
        // #category-content existe déjà (vrai quand on vient de finir les slides d'intro,
        // FAUX quand on y arrive directement depuis l'écran Apprendre) — sans ce conteneur,
        // la fonction se terminait silencieusement (if (!container) return;), sans erreur ni
        // affichage. On le crée nous-mêmes avant l'appel, comme le fait tout le reste de l'app.
        document.getElementById('main-content').innerHTML = `<div id="category-content" style="padding:16px"></div>`;
        showOnboardingChoiceScreen();
    } else if (hasLessonProgress) {
        startGrammarLessonFlowActual();
    } else if (hasLearningPathProgress) {
        startLearningPath(learningProgress.currentLevel);
    } else {
        // Intro déjà vue, aucune session active nulle part : repropose le choix de départ.
        document.getElementById('main-content').innerHTML = `<div id="category-content" style="padding:16px"></div>`;
        showOnboardingChoiceScreen();
    }
}
