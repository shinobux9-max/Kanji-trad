/**
 * js/learning/learning-path.js
 * Parcours guidé par unités (curriculum.json) : écran de liste des unités, moteur générique
 * (progression, navigation avant/arrière, concepts en micro-écrans façon texte flottant,
 * exercices mixtes vocab+grammaire), résultat de fin d'unité.
 *
 * state.learningSession (PAS une variable locale au module, contrairement à kanaReviewSession
 * dans features/kana.js) : core/navigation.js::closeAllOverlaysAndSessions() la lit/nettoie
 * déjà (placeholder réservé depuis le portage de navigation.js) — donc CE fichier doit lire/
 * écrire state.learningSession partout, pas une variable locale, sinon le nettoyage de
 * navigation.js ne toucherait pas la vraie session utilisée ici.
 */

import { state } from '../core/state.js';
import { getLevelVocabData, getLevelGrammarData, getLevelConceptsData, kanaToRomajiPrecise } from '../core/data-loader.js';
import { gradeReview } from './srs.js';
import { updateWeaknessTracking } from './weakness.js';
import { mdBold, showFicheCorrectionModal, continueFAB, backFAB, hideBottomNav, buildAnswerFeedbackHtml } from '../ui/common.js';
import { buildMeaningQCM } from '../features/vocabulary.js';
import { buildGrammarCloze, getShortLessonExplanation, showLessonReferencePopup } from '../features/grammar.js';

/**
 * Équivalent EXACT de getLearningResource(type, id, levelId) du monolithe — résout une
 * référence { type, id } du curriculum vers la vraie donnée pédagogique. Le moteur ne connaît
 * JAMAIS directement vocab.json/grammar.json/kanji_jouyou_fr.json — il passe systématiquement
 * par cette fonction.
 */
export async function getLearningResource(type, id, levelId) {
    if (type === 'vocabulary') {
        const vd = await getLevelVocabData(levelId);
        return vd && vd.data ? vd.data.find(w => w.id === id) || null : null;
    }
    if (type === 'grammar') {
        const gd = await getLevelGrammarData(levelId);
        return gd && gd.data ? gd.data.find(l => l.id === id) || null : null;
    }
    if (type === 'kanji') {
        // state.data.kanjiDb/kanjiMap déjà chargés au démarrage (bootstrap init()), synchrones —
        // id est directement le caractère (ex: "学")
        const idx = state.data.kanjiMap.get(id);
        return idx !== undefined ? state.data.kanjiDb[idx] : null;
    }
    if (type === 'concept') {
        const cd = await getLevelConceptsData(levelId);
        return cd && cd.concepts ? cd.concepts.find(c => c.id === id) || null : null;
    }
    console.warn(`getLearningResource: type inconnu "${type}"`);
    return null;
}

/* ══════════════════════════════════════════════════
   SAUVEGARDE / REPRISE DE PROGRESSION
══════════════════════════════════════════════════ */
const CURRICULUM_PROGRESS_KEY = 'kanji_trad_curriculum_progress';

export function loadLearningProgress() {
    try {
        const raw = localStorage.getItem(CURRICULUM_PROGRESS_KEY);
        return raw ? JSON.parse(raw) : { currentLevel: 'n5', currentUnit: null, currentStep: 0, units: {} };
    } catch (e) {
        return { currentLevel: 'n5', currentUnit: null, currentStep: 0, units: {} };
    }
}

export function saveLearningProgress(progress) {
    try {
        localStorage.setItem(CURRICULUM_PROGRESS_KEY, JSON.stringify(progress));
    } catch (e) {
        console.warn('Impossible de sauvegarder la progression du parcours:', e);
    }
}

// Charge le curriculum d'un niveau (data/curriculum/{levelId}.json), pas de cache pour l'instant
// vu le faible volume attendu (quelques unités par niveau).
export async function getLevelCurriculum(levelId) {
    try {
        const res = await fetch(`./data/curriculum/${levelId}.json`, { cache: 'no-store' });
        if (!res.ok) return null;
        return await res.json();
    } catch (e) {
        console.warn('Impossible de charger le curriculum:', e);
        return null;
    }
}

// Détermine la prochaine unité à faire : la première non "completed", dans l'ordre du fichier.
// Retourne null si tout est terminé (tout le niveau est fini).
export function getNextLearningUnit(curriculum, progress) {
    if (!curriculum || !Array.isArray(curriculum.units)) return null;
    const sorted = [...curriculum.units].sort((a, b) => a.order - b.order);
    for (const unit of sorted) {
        const status = progress.units[unit.id]?.status;
        if (status !== 'completed') return unit;
    }
    return null; // niveau entièrement terminé
}

/* ══════════════════════════════════════════════════
   ÉCRAN DE LISTE DES UNITÉS
══════════════════════════════════════════════════ */

// Statut d'affichage d'une unité : "completed" / "in_progress" / "available" (pas encore
// commencée mais accessible, juste après la dernière terminée) / "locked" (pas encore
// atteinte). Les unités terminées ou en cours restent TOUJOURS consultables librement.
export function getLearningUnitDisplayStatus(unit, curriculum, progress) {
    const p = progress.units[unit.id];
    if (p && p.status === 'completed') return 'completed';
    if (p && p.status === 'in_progress') return 'in_progress';
    const next = getNextLearningUnit(curriculum, progress);
    if (next && next.id === unit.id) return 'available';
    return 'locked';
}

export async function showLearningPathHome(levelId, isBack = false) {
    if (!isBack) history.pushState({ view: 'learning-path-home', levelId }, '');
    hideBottomNav();
    // Bug trouvé en test réel : sans ce nettoyage, state.activeSwipeContext restait sur
    // 'learning-path' et state.learningSession pointait toujours sur l'ancienne unité — un
    // simple tap sur une carte d'unité (un <div>, pas un <button>, donc pas exclu du
    // détecteur de swipe) était intercepté par la logique de swipe de l'ANCIENNE session
    // AVANT même d'atteindre le vrai onclick="startLearningUnitById(...)" de la carte.
    state.activeSwipeContext = null;
    state.learningSession = null;
    document.getElementById('page-title').innerText = 'Parcours guidé';
    const main = document.getElementById('main-content');
    const curriculum = await getLevelCurriculum(levelId);
    const progress = loadLearningProgress();

    if (!curriculum || !Array.isArray(curriculum.units) || !curriculum.units.length) {
        main.innerHTML = `<div class="dash-card" style="margin:16px;">Aucune unité disponible pour ce niveau pour l'instant.</div>`;
        return;
    }

    const sorted = [...curriculum.units].sort((a, b) => a.order - b.order);
    const statusMeta = {
        completed:   { icon: '✓', color: '#4ADE80', label: 'Terminée' },
        in_progress: { icon: '▶', color: 'var(--accent)', label: 'En cours' },
        available:   { icon: '○', color: 'var(--gray)', label: 'À commencer' },
        locked:      { icon: '🔒', color: 'var(--gray)', label: 'Verrouillée' },
    };

    const cardsHtml = sorted.map(unit => {
        const status = getLearningUnitDisplayStatus(unit, curriculum, progress);
        const meta = statusMeta[status];
        const locked = status === 'locked';
        return `<div class="dash-card" style="${locked ? 'opacity:0.5;' : 'cursor:pointer;'}margin-bottom:10px;"
                ${locked ? '' : `onclick="startLearningUnitById('${levelId}', '${unit.id}')"`}>
            <div style="display:flex;align-items:center;gap:10px;">
                <span style="color:${meta.color};font-size:1.2rem;">${meta.icon}</span>
                <div style="flex:1;">
                    <div style="font-weight:bold;">${unit.title}</div>
                    <div style="color:var(--gray);font-size:0.85rem;">${meta.label}${status==='completed' && progress.units[unit.id]?.score != null ? ' · ' + progress.units[unit.id].score + ' %' : ''}</div>
                </div>
            </div>
        </div>`;
    }).join('');

    main.innerHTML = `
        <div style="padding:16px;">
            <div class="apprendre-title-main" style="margin-bottom:4px;">Niveau ${levelId.toUpperCase()}</div>
            <div class="apprendre-subtitle-main" style="margin-bottom:16px;">Choisis une unité à commencer ou à revoir.</div>
            ${cardsHtml}
        </div>`;
}

// Démarre/reprend une unité précise depuis l'écran de liste (par son id, pas forcément
// "la prochaine" comme le fait startLearningPath).
export async function startLearningUnitById(levelId, unitId) {
    const curriculum = await getLevelCurriculum(levelId);
    if (!curriculum) return;
    const unit = curriculum.units.find(u => u.id === unitId);
    if (!unit) return;
    await loadLearningUnit(levelId, unit);
}

// Point d'entrée principal : reprend une session en cours, ou démarre/reprend la prochaine
// unité recommandée.
export async function startLearningPath(levelId = 'n5') {
    const progress = loadLearningProgress();
    const curriculum = await getLevelCurriculum(levelId);
    if (!curriculum) {
        console.error(`Curriculum introuvable pour ${levelId}`);
        return;
    }

    let unit;
    if (progress.currentUnit && progress.currentLevel === levelId) {
        unit = curriculum.units.find(u => u.id === progress.currentUnit);
    }
    if (!unit) {
        unit = getNextLearningUnit(curriculum, progress);
    }
    if (!unit) {
        // Niveau entièrement terminé — pas encore de vrai écran dédié, comportement minimal.
        alert('Bravo, tu as terminé toutes les unités disponibles pour ce niveau !');
        return;
    }

    await loadLearningUnit(levelId, unit, progress);
}

/* ══════════════════════════════════════════════════
   PROGRESSION DANS UNE UNITÉ
══════════════════════════════════════════════════ */

// Calcule ce qui a été couvert (vu) dans l'unité jusqu'à une étape donnée incluse — utilisé
// pour le TEST FINAL uniquement (cumulatif, tout ce qui a été vu depuis le début de l'unité).
export function computeCoveredUpTo(unit, stepIndex) {
    const covered = { vocabulary: [], kanji: [], grammar: [] };
    for (let i = 0; i <= stepIndex && i < unit.steps.length; i++) {
        const s = unit.steps[i];
        if ((s.type === 'vocabulary' || s.type === 'kanji' || s.type === 'grammar') && Array.isArray(s.items)) {
            covered[s.type].push(...s.items);
        }
    }
    return covered;
}

// Comme computeCoveredUpTo, mais réinitialisé à chaque mixed_practice/test rencontré — ne
// garde que ce qui a été introduit DEPUIS la dernière pratique. Sert à ce qu'une pratique
// intermédiaire ne teste que le groupe qui vient d'être introduit, pas tout depuis le début.
export function computeRecentUpTo(unit, stepIndex) {
    let recent = { vocabulary: [], kanji: [], grammar: [] };
    for (let i = 0; i <= stepIndex && i < unit.steps.length; i++) {
        const s = unit.steps[i];
        if (s.type === 'mixed_practice' || s.type === 'test') {
            if (i < stepIndex) recent = { vocabulary: [], kanji: [], grammar: [] };
            continue;
        }
        if ((s.type === 'vocabulary' || s.type === 'kanji' || s.type === 'grammar') && Array.isArray(s.items)) {
            recent[s.type].push(...s.items);
        }
    }
    return recent;
}

// Charge une unité précise et initialise/reprend la session en mémoire (state.learningSession).
export async function loadLearningUnit(levelId, unit, progress = null) {
    hideBottomNav();
    progress = progress || loadLearningProgress();
    const savedStep = (progress.currentUnit === unit.id) ? (progress.currentStep || 0) : 0;

    state.learningSession = {
        levelId, unit, stepIndex: savedStep, testResults: [],
        coveredNew: computeCoveredUpTo(unit, savedStep),
        recentNew: computeRecentUpTo(unit, savedStep)
    };

    progress.currentLevel = levelId;
    progress.currentUnit = unit.id;
    progress.currentStep = savedStep;
    if (!progress.units[unit.id]) {
        progress.units[unit.id] = { status: 'in_progress', currentStep: savedStep };
    }
    saveLearningProgress(progress);

    state.activeSwipeContext = 'learning-path';
    renderLearningStep();
}

// Avance à l'étape suivante (ou termine l'unité si on est déjà à la dernière étape).
export async function completeLearningStep() {
    if (!state.learningSession) return;
    const nextIndex = state.learningSession.stepIndex + 1;
    if (nextIndex >= state.learningSession.unit.steps.length) {
        await completeLearningUnit();
        return;
    }
    state.learningSession.stepIndex = nextIndex;
    state.learningSession.coveredNew = computeCoveredUpTo(state.learningSession.unit, nextIndex);
    state.learningSession.recentNew = computeRecentUpTo(state.learningSession.unit, nextIndex);
    const progress = loadLearningProgress();
    progress.currentStep = nextIndex;
    if (progress.units[state.learningSession.unit.id]) {
        progress.units[state.learningSession.unit.id].currentStep = nextIndex;
    }
    saveLearningProgress(progress);
    renderLearningStep();
}

// Revient à l'étape précédente (navigation arrière dans l'unité).
export function startLearningStep(index) {
    if (!state.learningSession) return;
    if (index < 0 || index >= state.learningSession.unit.steps.length) return;
    state.learningSession.stepIndex = index;
    state.learningSession.coveredNew = computeCoveredUpTo(state.learningSession.unit, index);
    state.learningSession.recentNew = computeRecentUpTo(state.learningSession.unit, index);
    renderLearningStep();
}

// Fin d'unité : note le SRS pour chaque ressource testée pendant le test final (jamais pendant
// les étapes de découverte), marque l'unité "completed". SEUL moment où gradeReview() est
// appelé depuis le Learning Path.
export async function completeLearningUnit() {
    if (!state.learningSession) return;
    const { unit, testResults } = state.learningSession;

    testResults.forEach(r => {
        const quality = r.correct ? 2 : 0; // Bien si juste, Encore si faux — convention SRS habituelle
        gradeReview(r.sourceId, quality, { type: r.sourceType, label: r.sourceLabel });
    });

    const scorePct = testResults.length
        ? Math.round(100 * testResults.filter(r => r.correct).length / testResults.length)
        : null;

    const progress = loadLearningProgress();
    progress.units[unit.id] = { status: 'completed', score: scorePct };
    // Bug trouvé en test réel : progress.currentUnit n'était jamais réinitialisé ici — donc
    // startLearningPath() (bouton "Continuer") retrouvait toujours CETTE unité (déjà
    // terminée) au lieu de passer à la suivante via getNextLearningUnit(). Corrigé.
    progress.currentUnit = null;
    progress.currentStep = 0;
    saveLearningProgress(progress);

    renderLearningUnitResult(scorePct, testResults);
}

/* ══════════════════════════════════════════════════
   RENDU — bouton retour flottant + micro-écrans de concept
══════════════════════════════════════════════════ */

// Bouton retour flottant (FAB), présent sur tout le parcours sauf l'écran de liste des unités
// lui-même. Corrigé (audit Phase 3) : appelait showLearningPathHome(levelId) directement, en
// violation de la règle stricte de navigation (poussait un NOUVEL état à chaque clic au lieu
// d'y revenir) — remplacé par le vrai backFAB() partagé (ui/common.js) sur history.back(),
// qui retombe correctement sur l'unique état 'learning-path-home' poussé par
// showLearningPathHome() (aucun écran de ce fichier ne pousse son propre état intermédiaire).
function learningPathFAB() {
    return backFAB('history.back()');
}

// Aplatit concept.sections en une liste de micro-écrans : un titre au tout début, puis un
// écran par paragraphe et un par exemple — jamais un gros bloc de texte d'un coup.
function flattenConceptSections(concept) {
    const typeLabels = { introduction: '📘 Introduction', rappel: '🟨 Rappel', point_attention: '⚠️ Point de vigilance' };
    const steps = [{ kind: 'title', label: typeLabels[concept.type] || '📘 Introduction', title: concept.title }];
    for (const section of (concept.sections || [])) {
        if (Array.isArray(section.paragraphs)) {
            for (const p of section.paragraphs) {
                steps.push({ kind: 'paragraph', label: section.label, text: p });
            }
        }
        if (Array.isArray(section.examples)) {
            for (const ex of section.examples) {
                steps.push({ kind: 'example', label: section.label, example: ex });
            }
        }
    }
    return steps;
}

// Affiche un micro-écran de concept, façon texte flottant, avec pagination en bas.
function renderConceptMicroStep(concept, microSteps, subIndex) {
    const container = document.getElementById('main-content');
    if (!container) return;
    const micro = microSteps[subIndex];

    let bodyHtml = '';
    if (micro.kind === 'title') {
        bodyHtml = `
            <div class="lesson-tap-advance">
                <div class="section-sub-title" style="text-align:center;margin-bottom:6px">${micro.label}</div>
                <div class="lesson-floating-text-wrap"><div class="lesson-floating-text" style="font-size:1.5rem;font-weight:bold;">${micro.title}</div></div>
            </div>`;
    } else if (micro.kind === 'paragraph') {
        bodyHtml = `
            <div class="lesson-tap-advance">
                ${micro.label ? `<div class="section-sub-title" style="text-align:center;margin-bottom:6px">${micro.label}</div>` : ''}
                <div class="lesson-floating-text-wrap"><div class="lesson-floating-text">${mdBold(micro.text || '')}</div></div>
            </div>`;
    } else if (micro.kind === 'example') {
        const ex = micro.example;
        bodyHtml = `
            <div class="lesson-tap-advance">
                <div class="section-sub-title" style="text-align:center;margin-bottom:6px">${micro.label || 'Exemple'}</div>
                <div class="lesson-floating-text-wrap">
                    <div class="lesson-floating-text">
                        <div style="font-size:1.0625em;margin-bottom:10px">${mdBold(ex.japanese || '')}</div>
                        ${ex.romaji ? `<div style="font-size:0.7em;color:var(--accent-muted, var(--accent));margin-bottom:8px;font-style:italic;">${mdBold(ex.romaji)}</div>` : ''}
                        <div style="font-size:0.75em;color:var(--gray)">${mdBold(ex.french || '')}</div>
                        ${ex.note ? `<div style="font-size:0.7em;color:var(--gray);margin-top:6px;opacity:0.8;">${mdBold(ex.note)}</div>` : ''}
                    </div>
                </div>
            </div>`;
    }

    const isLast = subIndex === microSteps.length - 1;
    const dotsHtml = microSteps.map((s, i) =>
        `<span style="width:7px;height:7px;border-radius:50%;background:${i === subIndex ? 'var(--accent)' : 'var(--border)'};display:inline-block;margin:0 3px;"></span>`
    ).join('');

    container.innerHTML = learningPathFAB() + `
        <div style="padding:56px 16px 6px;min-height:calc(100vh - 220px);display:flex;flex-direction:column;justify-content:center;">
            ${bodyHtml}
        </div>
        <div class="lesson-bottom-pagination">
            <div class="lesson-dots">${dotsHtml}</div>
            ${isLast ? `<button class="review-cta-btn" onclick="completeLearningStep()">Continuer →</button>` : `<div class="lesson-tap-hint">👉 Glisse ou touche l'écran pour naviguer.</div>`}
        </div>`;
}

// Avance/recule dans les micro-écrans d'un concept. En bout de liste, passe à l'étape
// suivante/précédente du curriculum comme d'habitude.
export function advanceConceptSubStep(direction) {
    const step = state.learningSession.unit.steps[state.learningSession.stepIndex];
    getLearningResource('concept', step.conceptId, state.learningSession.levelId).then(concept => {
        const microSteps = flattenConceptSections(concept);
        const next = state.learningSession.conceptSubIndex + direction;
        if (next < 0) {
            startLearningStep(state.learningSession.stepIndex - 1);
        } else if (next >= microSteps.length) {
            completeLearningStep();
        } else {
            state.learningSession.conceptSubIndex = next;
            renderConceptMicroStep(concept, microSteps, next);
        }
    });
}

/**
 * Affiche l'étape courante de la session en cours. Dispatch selon step.type — ne connaît
 * jamais N5 spécifiquement, seulement les types d'étapes génériques du curriculum.
 */
export async function renderLearningStep() {
    if (!state.learningSession) return;
    const { unit, stepIndex } = state.learningSession;
    const step = unit.steps[stepIndex];
    const container = document.getElementById('main-content');
    if (!container) return;

    // Étape marquée "skipRender" (ex: grammaire déjà couverte en détail par le concept
    // précédent) : compte pour le suivi de couverture, mais ne s'affiche jamais à l'écran.
    if (step.skipRender) {
        completeLearningStep();
        return;
    }

    const progressDots = unit.steps.map((s, i) =>
        `<span style="width:8px;height:8px;border-radius:50%;background:${i === stepIndex ? 'var(--accent)' : 'var(--border)'};display:inline-block;margin:0 3px;"></span>`
    ).join('');
    const header = learningPathFAB();
    const bottomDots = `<div style="display:flex;align-items:center;justify-content:center;padding:16px;">${progressDots}</div>`;

    if (step.type === 'introduction') {
        container.innerHTML = header + `
            <div class="dash-card" style="margin:56px 16px 16px;">
                <h2 style="margin-top:0;">${unit.title}</h2>
                <p style="color:var(--gray);">${unit.description || ''}</p>
                <ul>${(unit.objectives || []).map(o => `<li>${o}</li>`).join('')}</ul>
                <button class="review-cta-btn" onclick="completeLearningStep()">Commencer →</button>
            </div>` + bottomDots;
        return;
    }

    if (step.type === 'vocabulary' || step.type === 'kanji' || step.type === 'grammar') {
        const items = await Promise.all(
            step.items.map(id => getLearningResource(step.type, id, state.learningSession.levelId))
        );
        container.innerHTML = header + `
            <div style="padding:56px 16px 0;">
                ${items.map(item => renderLearningResourceCard(step.type, item)).join('')}
                <button class="review-cta-btn" onclick="completeLearningStep()">Suivant →</button>
            </div>` + bottomDots;
        return;
    }

    if (step.type === 'concept') {
        const concept = await getLearningResource('concept', step.conceptId, state.learningSession.levelId);
        if (!concept) {
            console.warn(`Concept introuvable: ${step.conceptId}`);
            completeLearningStep();
            return;
        }

        const microSteps = flattenConceptSections(concept);

        if (state.learningSession.conceptStepId !== step.id) {
            state.learningSession.conceptStepId = step.id;
            state.learningSession.conceptSubIndex = 0;
        }
        const subIndex = Math.min(state.learningSession.conceptSubIndex, microSteps.length - 1);
        renderConceptMicroStep(concept, microSteps, subIndex);
        return;
    }

    if (step.type === 'mixed_practice' || step.type === 'test') {
        await renderLearningExerciseStep(step);
        return;
    }

    // Type inconnu : on passe simplement à l'étape suivante plutôt que de bloquer l'utilisateur
    console.warn(`renderLearningStep: type d'étape inconnu "${step.type}"`);
    completeLearningStep();
}

// Petite carte d'affichage générique pour une ressource (vocab/kanji/grammaire).
function renderLearningResourceCard(type, item) {
    if (!item) return `<div class="dash-card">Ressource introuvable.</div>`;
    if (type === 'vocabulary') {
        return `<div class="dash-card" style="overflow-wrap:break-word;">
            <div style="font-size:1.4rem;line-height:1.6;">${item.word_furigana || item.word}</div>
            <div style="color:var(--accent);font-style:italic;">${item.romaji}</div>
            <div style="margin-top:6px;">${item.meanings?.primary || ''}</div>
        </div>`;
    }
    if (type === 'kanji') {
        const readingTag = (r, cls) => {
            const romaji = kanaToRomajiPrecise(r.replace(/\./g, ''));
            return `<span class="tag ${cls}" style="font-size:0.8rem;padding:4px 10px;margin-right:4px;margin-bottom:4px;display:inline-block;">${r} <span style="opacity:0.75;">(${romaji})</span></span>`;
        };
        const onTags = (item.on || []).map(r => readingTag(r, 'tag-on')).join('');
        const kunTags = (item.kun || []).map(r => readingTag(r, 'tag-kun')).join('');

        return `<div class="dash-card" style="overflow-wrap:break-word;">
            <div style="font-size:2rem;">${item.char}</div>
            ${item.on && item.on.length ? `<div style="margin-top:8px;color:var(--gray);font-size:0.85rem;">Lecture on : ${onTags}</div>` : ''}
            ${item.kun && item.kun.length ? `<div style="margin-top:6px;color:var(--gray);font-size:0.85rem;">Lecture kun : ${kunTags}</div>` : ''}
            <div style="margin-top:6px;">${(item.meanings || []).join(', ')}</div>
        </div>`;
    }
    if (type === 'grammar') {
        return `<div class="dash-card" style="overflow-wrap:break-word;">
            <div style="font-size:1.4rem;color:var(--accent);line-height:1.6;">${item.item}</div>
            <div style="color:var(--accent);font-style:italic;opacity:0.8;">${item.item_romaji || ''}</div>
            <div style="color:var(--gray);margin-top:2px;">${item.pattern || ''}</div>
            <div style="margin-top:6px;">${item.title || ''}</div>
        </div>`;
    }
    return '';
}

/* ══════════════════════════════════════════════════
   EXERCICES MIXTES (mixed_practice / test)
   Réutilise EXCLUSIVEMENT les générateurs existants (buildMeaningQCM, buildGrammarCloze) —
   aucun second moteur de quiz créé pour le Learning Path.
══════════════════════════════════════════════════ */

const PARTICLE_THEMATIC_GROUPS = [
    ['は', 'が', 'を'],                     // particules de base : thème / sujet / objet
    ['に', 'で', 'へ', 'から', 'まで'],       // localisation : cible, lieu, direction, origine, limite
    ['と', 'も', 'の'],                     // relation, association, possession
    ['か', 'ね', 'よ'],                     // nuances de conversation
];
function findParticleGroup(particleItem) {
    return PARTICLE_THEMATIC_GROUPS.find(group => group.includes(particleItem)) || null;
}

// Cherche la romaji d'une option de cloze grammaire en la retrouvant dans les highlight des
// exemples du pool (highlight = [texte, romaji]). Ne devine jamais.
function findRomajiForGrammarOption(optionText, pool) {
    for (const lesson of pool) {
        for (const ex of (lesson.examples || [])) {
            if (Array.isArray(ex.highlight) && ex.highlight[0] === optionText) return ex.highlight[1] || null;
        }
    }
    return null;
}

// Retrouve la leçon d'origine d'une option de cloze grammaire (même principe que la romaji).
function findLessonForGrammarOption(optionText, pool) {
    for (const lesson of pool) {
        for (const ex of (lesson.examples || [])) {
            if (Array.isArray(ex.highlight) && ex.highlight[0] === optionText) return lesson;
        }
    }
    return null;
}

// buildLearningGrammarComparisonHtml() retirée (session d'harmonisation des feedbacks de
// quiz, demandée explicitement) : quasi-doublon de buildParticleComparisonHtml
// (features/grammar.js) — remplacée par un appel direct à la fonction partagée
// buildAnswerFeedbackHtml() (ui/common.js), utilisée maintenant par TOUS les types
// d'exercices à choix de l'app plutôt que d'avoir une présentation par système.

async function buildLearningExerciseQueue(step) {
    const { unit, levelId } = state.learningSession;
    const vd = await getLevelVocabData(levelId);
    const gd = await getLevelGrammarData(levelId);
    const vocabPool = vd && vd.data ? vd.data : [];
    const grammarPool = gd && gd.data ? gd.data : [];

    // "review" toujours disponible (déjà appris avant cette unité). Pratique intermédiaire :
    // seulement le groupe introduit juste avant (recentNew). Test final : cumulatif (coveredNew).
    const newSource = step.type === 'test' ? state.learningSession.coveredNew : state.learningSession.recentNew;
    const allVocabIds = [...(newSource.vocabulary || []), ...(unit.content.review.vocabulary || [])];
    const allGrammarIds = [...(newSource.grammar || []), ...(unit.content.review.grammar || [])];

    const questionCount = step.questionCount || (allVocabIds.length + allGrammarIds.length);
    const queue = [];

    for (const id of allVocabIds) {
        const word = vocabPool.find(w => w.id === id);
        if (!word) continue;
        const qcm = buildMeaningQCM(word, vocabPool);
        if (qcm) {
            queue.push({
                sourceType: 'vocab', sourceId: id, sourceLabel: word.word, sourceWord: word,
                // "Que signifie X ?" : jamais de traduction française en aide (ce serait la réponse).
                promptMain: `Que signifie ${word.word_furigana || word.word} ?`,
                promptSub: word.romaji, feedback: word.nuance || '',
                options: qcm.options.map(o => ({ label: o, correct: o === qcm.correct })),
            });
        }
    }
    for (const id of allGrammarIds) {
        const lesson = grammarPool.find(l => l.id === id);
        if (!lesson) continue;

        let clozePool = grammarPool;
        const group = findParticleGroup(lesson.item);
        if (group) {
            const thematicPool = grammarPool.filter(l => group.includes(l.item));
            if (thematicPool.length >= 4) clozePool = thematicPool;
        }

        const cloze = buildGrammarCloze(lesson, clozePool);
        if (cloze) {
            queue.push({
                sourceType: 'grammar', sourceId: id, sourceLabel: lesson.item || lesson.pattern, sourceLesson: lesson,
                promptMain: `${cloze.before}<strong>＿＿＿</strong>${cloze.after}`,
                promptSub: cloze.french || '', feedback: '',
                options: cloze.options.map(o => ({
                    label: o, correct: o === cloze.correct,
                    romaji: findRomajiForGrammarOption(o, clozePool),
                    lesson: o === cloze.correct ? lesson : findLessonForGrammarOption(o, clozePool),
                })),
            });
        }
    }

    for (let i = queue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [queue[i], queue[j]] = [queue[j], queue[i]];
    }
    return queue.slice(0, questionCount);
}

async function renderLearningExerciseStep(step) {
    if (!state.learningSession.exerciseQueue || state.learningSession.exerciseStepId !== step.id) {
        state.learningSession.exerciseQueue = await buildLearningExerciseQueue(step);
        state.learningSession.exerciseIndex = 0;
        state.learningSession.exerciseStepId = step.id;
    }
    const queue = state.learningSession.exerciseQueue;
    const idx = state.learningSession.exerciseIndex;
    const container = document.getElementById('main-content');

    if (idx >= queue.length) {
        state.learningSession.exerciseQueue = null;
        completeLearningStep();
        return;
    }

    const q = queue[idx];
    const header = learningPathFAB();
    const questionCounter = `<div style="padding:56px 16px 14px;color:var(--gray);text-align:center;">Question ${idx + 1} / ${queue.length}</div>`;

    const optionsHtml = q.options.map((opt, i) => {
        let cls = 'review-option-btn';
        if (q.answered) {
            if (opt.correct) cls += ' correct';
            else if (i === q.selectedIndex) cls += ' incorrect';
        }
        const romajiHtml = opt.romaji ? `<div style="font-size:0.8rem;opacity:0.75;margin-top:2px;">${opt.romaji}</div>` : '';
        return `<button class="${cls}" ${q.answered ? 'disabled' : ''} onclick="answerLearningExercise(${i})">
            <div>${opt.label}</div>${romajiHtml}
        </button>`;
    }).join('');

    let feedbackHtml = '';
    if (q.answered) {
        const isCorrect = q.options[q.selectedIndex]?.correct;
        const correctOpt = q.options.find(o => o.correct);
        const selectedOpt = q.options[q.selectedIndex];

        if (isCorrect) {
            feedbackHtml = `<div class="dash-card" style="margin-top:14px;">✅ Bonne réponse !</div>`;
        } else if (q.sourceType === 'grammar') {
            feedbackHtml = buildAnswerFeedbackHtml({
                wrongText: selectedOpt.label,
                wrongOnClick: selectedOpt.lesson ? `showLessonReferencePopup('${selectedOpt.lesson.id}')` : null,
                wrongExplanation: getShortLessonExplanation(selectedOpt.lesson),
                correctText: correctOpt.label,
                correctOnClick: correctOpt.lesson ? `showLessonReferencePopup('${correctOpt.lesson.id}')` : null,
                correctExplanation: getShortLessonExplanation(correctOpt.lesson)
            });
        } else {
            // Bug trouvé lors de l'harmonisation des feedbacks de quiz : q.feedback (nuance
            // du mot, voir plus haut "feedback: word.nuance || ''") était construit mais
            // JAMAIS affiché ici — silencieusement perdu. Corrigé au passage.
            feedbackHtml = buildAnswerFeedbackHtml({
                wrongText: selectedOpt.label,
                correctText: correctOpt.label,
                correctOnClick: q.sourceWord ? 'showLearningFicheCorrection()' : null,
                nuance: q.feedback || ''
            });
        }
        feedbackHtml += continueFAB('continueLearningExercise()');
    }

    container.innerHTML = header + questionCounter + `
        <div style="padding:0 16px 160px;">
            <div class="review-card" style="margin-bottom:16px;">
                <div style="font-size:1.3rem;line-height:1.7;">${q.promptMain}</div>
                ${q.promptSub ? `<div style="color:var(--accent);font-style:italic;font-size:0.9rem;">${q.promptSub}</div>` : ''}
            </div>
            <div class="review-options">${optionsHtml}</div>
            ${feedbackHtml}
        </div>`;
}

// Traite la réponse à une question d'exercice (practice ou test).
export function answerLearningExercise(selectedIndex) {
    const queue = state.learningSession.exerciseQueue;
    const idx = state.learningSession.exerciseIndex;
    const q = queue[idx];
    if (q.answered) return; // déjà répondu, ignore un second clic éventuel
    const isCorrect = q.options[selectedIndex].correct;

    // Le test final alimente le SRS en fin d'unité ; les étapes de découverte/pratique
    // n'enregistrent rien dans le SRS (voir completeLearningUnit).
    const currentStep = state.learningSession.unit.steps[state.learningSession.stepIndex];
    if (currentStep.type === 'test') {
        state.learningSession.testResults.push({ sourceType: q.sourceType, sourceId: q.sourceId, sourceLabel: q.sourceLabel, correct: isCorrect });
    } else if (!isCorrect) {
        updateWeaknessTracking(q.sourceId, 0, { type: q.sourceType, label: q.sourceLabel });
    }

    // On affiche le retour AVANT d'avancer — l'avancée réelle se fait au clic sur "Continuer".
    q.answered = true;
    q.selectedIndex = selectedIndex;
    renderLearningExerciseStep(currentStep);
}

// Appelé par le bouton "Continuer" une fois le retour affiché : passe à la question suivante.
export function continueLearningExercise() {
    state.learningSession.exerciseIndex++;
    const currentStep = state.learningSession.unit.steps[state.learningSession.stepIndex];
    renderLearningExerciseStep(currentStep);
}

// Ouvre la fiche complète du mot de la question courante — relit l'état en mémoire plutôt que
// de faire transiter l'objet mot via l'attribut onclick.
export function showLearningFicheCorrection() {
    const q = state.learningSession?.exerciseQueue?.[state.learningSession.exerciseIndex];
    if (!q || !q.sourceWord) return;
    showFicheCorrectionModal({ type: 'vocab', item: q.sourceWord });
}

/* ══════════════════════════════════════════════════
   ÉCRAN DE FIN D'UNITÉ
══════════════════════════════════════════════════ */
export function renderLearningUnitResult(scorePct, testResults) {
    const container = document.getElementById('main-content');
    if (!container) return;
    // Écran de fin d'unité : navigation uniquement par boutons (Continuer/Retour), jamais par
    // swipe — désactivé ici pour qu'un tap parasite ne déclenche pas la logique de swipe
    // (state.learningSession est volontairement CONSERVÉ : continueLearningPath() en a
    // encore besoin pour lire .levelId).
    state.activeSwipeContext = null;
    const correctCount = testResults.filter(r => r.correct).length;
    container.innerHTML = learningPathFAB() + `
        <div style="padding:64px 16px 24px;text-align:center;">
            <h2>Unité terminée !</h2>
            <div style="font-size:2.4rem;color:var(--accent);margin:16px 0;">${scorePct !== null ? scorePct + ' %' : '—'}</div>
            <p style="color:var(--gray);">${correctCount} / ${testResults.length} bonnes réponses</p>
            <button class="review-cta-btn" onclick="continueLearningPath()">Continuer →</button>
        </div>`;
}

// Équivalent du onclick="startLearningPath(learningSession.levelId)" du monolithe — adapté car
// state.learningSession est une propriété d'import de module, inaccessible depuis un attribut
// onclick. Même principe que replayKanaTraceQuiz (kana.js) / openTrainingCurrentFiche
// (free-training.js).
export function continueLearningPath() {
    if (!state.learningSession) return;
    startLearningPath(state.learningSession.levelId);
}
