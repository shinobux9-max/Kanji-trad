/**
 * js/learning/exercises.js
 * Parcours de leçon grammaire "Commençons l'apprentissage" : onboarding (5 slides,
 * affichées une seule fois), le parcours de leçon lui-même (texte flottant + exercices +
 * écran de fin), l'écran "Explorer les leçons" (choix libre), et le système de swipe/tap
 * global de navigation (initSwipeNavigation) — PAS le Learning Path (learning/learning-path.js,
 * système séparé et plus récent, voir HANDOFF.md pour la clarification de nommage).
 *
 * ⚠️ DÉCOUVERTE (pas dans le plan initial) : initSwipeNavigation() vit ici plutôt que dans
 * core/navigation.js — elle a besoin de state.lessonSession (ce fichier) ET
 * state.learningSession (learning/learning-path.js), donc d'AUCUN des deux modules
 * exclusivement. Placée ici parce que 2 de ses 3 contextes ('lesson', 'onboarding')
 * appartiennent à ce fichier, contre 1 seul ('learning-path') à learning-path.js — minimise
 * les imports croisés. Vérifié SANS cycle avant d'écrire : ce fichier peut importer à la fois
 * features/grammar.js/vocabulary.js/kana.js/free-training.js ET learning/learning-path.js,
 * donc le swipe est ENTIÈREMENT fonctionnel (pas de branche en landmine, contrairement à ce
 * qui avait été anticipé au départ).
 *
 * MISE À JOUR : les DÉCOUVERTE 2/3 d'origine (système "sélection de révision par catégorie",
 * showGrammarNiveauxScreen/showKanjiNiveauxScreen) ont depuis été construites dans
 * ui/cards.js — plus des landmines. startOnboardingChoice() ne référence d'ailleurs plus ces
 * fonctions : l'écran "Par où commencer ?" propose maintenant "Apprendre les kanas" et
 * "Parcours Guidé" uniquement (fusion Introduction/Parcours guidé demandée, voir
 * ui/cards.js::startIntroductionOrResume()).
 */

import { state } from '../core/state.js';
import { ALL_JLPT_LEVELS } from '../core/constants.js';
import { pushModalState } from '../core/navigation.js';
import { getLevelGrammarData, getItemRomaji, kanaGroups } from '../core/data-loader.js';
import { getSrsInfo, gradeReview, shuffleArray } from '../learning/srs.js';
import { updateWeaknessTracking } from './weakness.js';
import { buildConfusionBoxHtml, buildParticleComparisonHtml, showLessonReferencePopup, getShortLessonExplanation } from '../features/grammar.js';
import { COMMON_PARTICLES } from '../features/vocabulary.js';
import { showRevisionKanaPicker } from '../features/kana.js';
import { showFreeTrainingConfig } from '../features/free-training.js';
import { mdBold, continueFAB, backFAB, hideBottomNav } from '../ui/common.js';
import { completeLearningStep, startLearningStep, advanceConceptSubStep, showLearningPathHome } from './learning-path.js';

/* ══════════════════════════════════════════════════
   SWIPE / TAP — navigation globale par geste, partagée entre ce fichier et learning-path.js
══════════════════════════════════════════════════ */

// Types d'étape du parcours de leçon où le swipe/tap fait avancer — pas sur les exercices
// (réponse via boutons), l'intro (bouton "Commencer") ou la fin (boutons d'action).
const LESSON_SWIPE_STEP_TYPES = new Set(['paragraph', 'structure', 'example', 'confusion']);
// Étapes du Learning Path où le swipe/tap fait simplement avancer.
const LEARNING_PATH_SWIPE_STEP_TYPES = new Set(['introduction', 'vocabulary', 'kanji', 'grammar', 'concept']);

// Points de pagination façon carrousel (remplace la barre de progression pour l'onboarding et
// le parcours de leçon) — le point actif se déplace, montrant qu'il y a un avant et un après.
function buildDotsHtml(total, currentIndex) {
    let dots = '';
    for (let i = 0; i < total; i++) {
        dots += `<span class="lesson-dot ${i === currentIndex ? 'active' : ''}"></span>`;
    }
    return `<div class="lesson-dots">${dots}</div>`;
}

/**
 * Équivalent EXACT de initSwipeNavigation() du monolithe — à appeler une fois depuis app.js
 * au bootstrap (comme initNavigation() dans core/navigation.js).
 */
export function initSwipeNavigation() {
    const el = document.getElementById('main-content');
    if (!el) return;
    // Éléments interactifs qui gèrent déjà leur propre tap — un tap dessus ne doit jamais
    // aussi déclencher l'avancée du swipe.
    const INTERACTIVE_SELECTOR = '.eye-badge, .review-option-btn, .vocab-example-box, .back-btn, button, .dash-goal-row';
    let startX = 0, startY = 0, startTime = 0, startTarget = null;

    // Logique de décision partagée tactile/souris — équivalent EXACT du monolithe (qui
    // n'écoutait que touchstart/touchend, jamais la souris : sur PC, impossible de faire
    // avancer les slides — bug trouvé en test réel, jamais présent sur mobile donc jamais
    // remarqué avant). Extraite en fonction commune pour ne pas dupliquer la logique de
    // décision (tap vs swipe vs rien) entre les deux jeux d'événements.
    function handleGestureEnd(endX, endY) {
        if (!state.activeSwipeContext) return;
        if (startTarget && startTarget.closest && startTarget.closest(INTERACTIVE_SELECTOR)) return;

        if (state.activeSwipeContext === 'lesson') {
            const step = state.lessonSession && state.lessonSession.steps[state.lessonSession.index];
            if (!step || !LESSON_SWIPE_STEP_TYPES.has(step.type)) return;
        }
        if (state.activeSwipeContext === 'learning-path') {
            const step = state.learningSession && state.learningSession.unit.steps[state.learningSession.stepIndex];
            if (!step || !LEARNING_PATH_SWIPE_STEP_TYPES.has(step.type)) return;
        }

        const dx = endX - startX;
        const dy = endY - startY;
        const dt = Date.now() - startTime;
        const isSwipe = Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5;
        const isTap = Math.abs(dx) < 15 && Math.abs(dy) < 15 && dt < 400;

        let direction = 0;
        if (isSwipe) direction = dx < 0 ? 1 : -1;
        else if (isTap) direction = 1;
        if (direction === 0) return;

        if (state.activeSwipeContext === 'lesson') advanceLessonStep(direction);
        else if (state.activeSwipeContext === 'onboarding') advanceOnboarding(direction);
        if (state.activeSwipeContext === 'learning-path') {
            const lpStep = state.learningSession && state.learningSession.unit.steps[state.learningSession.stepIndex];
            if (lpStep && lpStep.type === 'concept') advanceConceptSubStep(direction);
            else if (direction === 1) completeLearningStep();
            else startLearningStep(state.learningSession.stepIndex - 1);
        }
    }

    el.addEventListener('touchstart', e => {
        if (!state.activeSwipeContext) return;
        const t = e.changedTouches[0];
        startX = t.clientX; startY = t.clientY; startTime = Date.now();
        startTarget = e.target;
    }, { passive: true });

    el.addEventListener('touchend', e => {
        const t = e.changedTouches[0];
        handleGestureEnd(t.clientX, t.clientY);
    }, { passive: true });

    // Souris (PC/navigateur desktop) — même logique que le tactile ci-dessus, jamais
    // présente dans le monolithe original (touch uniquement).
    let mouseDown = false;
    el.addEventListener('mousedown', e => {
        if (!state.activeSwipeContext) return;
        mouseDown = true;
        startX = e.clientX; startY = e.clientY; startTime = Date.now();
        startTarget = e.target;
    });

    el.addEventListener('mouseup', e => {
        if (!mouseDown) return;
        mouseDown = false;
        handleGestureEnd(e.clientX, e.clientY);
    });
}

/* ══════════════════════════════════════════════════
   ONBOARDING "COMMENÇONS L'APPRENTISSAGE" — 5 slides d'introduction, affichées une seule fois
   avant la toute première leçon. Système léger et séparé de lessonSession (pas d'exercices,
   pas de SRS) pour ne pas fragiliser la logique de leçon réelle.
══════════════════════════════════════════════════ */
const LESSON_ONBOARDING_KEY = 'kanji_trad_lesson_onboarding_seen';
export function hasSeenLessonOnboarding() {
    try { return localStorage.getItem(LESSON_ONBOARDING_KEY) === '1'; } catch (e) { return true; }
}
function markLessonOnboardingSeen() {
    try { localStorage.setItem(LESSON_ONBOARDING_KEY, '1'); } catch (e) {}
}

// Slides d'introduction chargées depuis data/onboarding.json (pas en dur ici) — mises en
// cache après le premier chargement.
let LESSON_ONBOARDING_SLIDES = [];
let onboardingSlidesLoaded = false;

async function getOnboardingSlides() {
    if (onboardingSlidesLoaded) return LESSON_ONBOARDING_SLIDES;
    try {
        const res = await fetch('./data/onboarding.json', { cache: 'no-store' });
        LESSON_ONBOARDING_SLIDES = res.ok ? await res.json() : [];
    } catch (e) {
        LESSON_ONBOARDING_SLIDES = [];
    }
    onboardingSlidesLoaded = true;
    return LESSON_ONBOARDING_SLIDES;
}

let onboardingIndex = 0;

export async function showLessonOnboarding() {
    pushModalState('lesson-onboarding');
    hideBottomNav();
    onboardingIndex = 0;
    document.getElementById('main-content').innerHTML = `<div id="category-content" style="padding:16px"></div>`;
    await getOnboardingSlides();
    if (!LESSON_ONBOARDING_SLIDES.length) {
        // JSON introuvable ou vide : ne bloque jamais l'utilisateur, enchaîne direct sur la leçon
        markLessonOnboardingSeen();
        history.back();
        startGrammarLessonFlowActual();
        return;
    }
    state.activeSwipeContext = 'onboarding';
    renderOnboardingSlide();
}

function renderOnboardingSlide() {
    const container = document.getElementById('category-content');
    if (!container) return;
    const slide = LESSON_ONBOARDING_SLIDES[onboardingIndex];
    const total = LESSON_ONBOARDING_SLIDES.length;

    container.innerHTML = `${backFAB('skipLessonOnboarding()', '✕')}
        <div class="review-page lesson-slide-anim">
            <div style="text-align:center;padding:24px 0 16px">
                <div style="font-size:3rem;margin-bottom:14px">${slide.emoji}</div>
                <div style="font-size:1.375rem;font-weight:bold;color:#fff">${slide.title}</div>
            </div>
            <div class="fiche-title-card" style="text-align:left;padding:20px">
                ${slide.body.map(p => `<div class="section-paragraph">${makeKanaWordsClickable(mdBold(p))}</div>`).join('')}
            </div>
            <div class="lesson-tap-hint">${onboardingIndex > 0 ? '👈 Glisse ou touche pour naviguer 👉' : '👉 Glisse ou touche l\'écran pour naviguer.'}</div>
            <div class="lesson-bottom-pagination">
                ${buildDotsHtml(total, onboardingIndex)}
                <div class="review-progress-text">${onboardingIndex + 1}/${total}</div>
            </div>
        </div>
    `;
}

export function advanceOnboarding(direction = 1) {
    onboardingIndex = Math.max(0, onboardingIndex + direction);
    if (onboardingIndex >= LESSON_ONBOARDING_SLIDES.length) {
        finishLessonOnboarding();
    } else {
        renderOnboardingSlide();
    }
}

// Table de référence hiragana/katakana en popup — réutilise kanaGroups déjà chargé en mémoire.
function buildKanaTablePopupContent(script) {
    const groups = (kanaGroups[script] || []).filter(g => !g.title);
    return groups.map(group => `
        <div class="kana-popup-rows">
            ${group.rows.map(row => `
                <div class="kana-popup-row">
                    ${row.map(k => k
                        ? `<div class="kana-popup-cell"><span class="kana-popup-char">${k.c}</span><span class="kana-popup-romaji">${k.r}</span></div>`
                        : `<div class="kana-popup-cell empty"></div>`
                    ).join('')}
                </div>
            `).join('')}
        </div>
    `).join('');
}

export function showKanaTablePopup(script) {
    const modal = document.getElementById('kana-table-popup-modal');
    if (!modal) return;
    document.getElementById('kana-table-popup-title').textContent = script === 'hira' ? 'Hiragana' : 'Katakana';
    document.getElementById('kana-table-popup-content').innerHTML = buildKanaTablePopupContent(script);
    modal.classList.add('open');
    modal.style.display = 'flex';
}

export function closeKanaTablePopup() {
    const modal = document.getElementById('kana-table-popup-modal');
    if (!modal) return;
    modal.classList.remove('open');
    modal.style.display = 'none';
}

function wrapKanaMentions(html, wordPattern, script) {
    const re = new RegExp(`<span class="md-bold">(${wordPattern})<\\/span>|\\b(${wordPattern})\\b`, 'gi');
    return html.replace(re, (match, boldWord, plainWord) => {
        const word = boldWord || plainWord;
        return `<span class="eye-badge" onclick="showKanaTablePopup('${script}')">👁️ ${word}</span>`;
    });
}

function makeKanaWordsClickable(html) {
    html = wrapKanaMentions(html, 'Hiraganas?', 'hira');
    html = wrapKanaMentions(html, 'Katakanas?', 'kata');
    return html;
}

export function skipLessonOnboarding() {
    markLessonOnboardingSeen();
    state.activeSwipeContext = null;
    history.back();
}

// Fin de l'introduction : marque comme vue, puis affiche l'écran de choix.
function finishLessonOnboarding() {
    markLessonOnboardingSeen();
    showOnboardingChoiceScreen();
}

// Écran de choix affiché juste après l'onboarding : plutôt que d'enchaîner automatiquement sur
// la grammaire, laisse l'utilisateur décider par où commencer.
export function showOnboardingChoiceScreen() {
    state.activeSwipeContext = null;
    const container = document.getElementById('category-content');
    if (!container) return;
    container.innerHTML = `
        <div class="review-page">
            <div style="text-align:center;padding:20px 0 24px">
                <div style="font-size:3rem;margin-bottom:10px">🚀</div>
                <div style="font-size:1.5rem;font-weight:bold;color:#fff;margin-bottom:6px">Par où commencer ?</div>
                <div style="font-size:0.9375rem;color:var(--gray)">Choisis ta première étape</div>
            </div>
            <div class="onboarding-choice-card recommended" onclick="startOnboardingChoice('kana')">
                <div class="onboarding-choice-icon">あ</div>
                <div class="onboarding-choice-info">
                    <div class="onboarding-choice-title">Apprendre les kanas <span class="onboarding-recommended-tag">Recommandé</span></div>
                    <div class="onboarding-choice-sub">La base indispensable pour bien démarrer en japonais.</div>
                </div>
            </div>
            <div class="onboarding-choice-card" onclick="startOnboardingChoice('learning-path')">
                <div class="onboarding-choice-icon">🗺️</div>
                <div class="onboarding-choice-info">
                    <div class="onboarding-choice-title">Parcours Guidé</div>
                    <div class="onboarding-choice-sub">Vocabulaire, kanji et grammaire ensemble, unité par unité — le romaji est toujours affiché.</div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Démarre l'option choisie sur l'écran "Par où commencer ?".
 */
export function startOnboardingChoice(choice) {
    if (choice === 'kana') showRevisionKanaPicker();
    else if (choice === 'learning-path') showLearningPathHome('n5');
}

/* ══════════════════════════════════════════════════
   PARCOURS DE LEÇON — état, construction des étapes, rendu, exercices
══════════════════════════════════════════════════ */
const LESSON_PROGRESS_KEY = 'kanji_trad_lesson_progress';

function saveLessonProgress() {
    const s = state.lessonSession;
    if (!s) return;
    try {
        localStorage.setItem(LESSON_PROGRESS_KEY, JSON.stringify({
            lessonId: s.lesson.id, level: s.level || 'n5', index: s.index, exCorrectCount: s.exCorrectCount
        }));
    } catch (e) { /* stockage plein ou indisponible : tant pis, pas bloquant */ }
}
function clearLessonProgress() {
    try { localStorage.removeItem(LESSON_PROGRESS_KEY); } catch (e) {}
}
export function getSavedLessonProgress() {
    try {
        const raw = localStorage.getItem(LESSON_PROGRESS_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
}

// Prochaine leçon jamais commencée (aucune info SRS), dans l'ordre lesson_number croissant.
function findNextLessonToLearn(lessons) {
    const sorted = [...lessons].sort((a, b) => (a.lesson_number || 0) - (b.lesson_number || 0));
    return sorted.find(l => !getSrsInfo(l.id)) || null;
}

// Détermine quel niveau JLPT propose actuellement une leçon jamais commencée (N5 d'abord).
// afterLevel : cherche STRICTEMENT après un niveau donné (utilisé quand le niveau courant
// est épuisé).
export async function findActiveLearningLevel(afterLevel = null) {
    let searching = !afterLevel;
    for (const levelId of ALL_JLPT_LEVELS) {
        if (!searching) {
            if (levelId === afterLevel) searching = true;
            continue;
        }
        const data = await getLevelGrammarData(levelId);
        if (data && data.data && data.data.length && findNextLessonToLearn(data.data)) {
            return levelId;
        }
    }
    return null;
}

// Construit les 3 exercices de fin : jusqu'à 2 cloze sur des exemples différents de LA leçon
// (distracteurs = particules courantes), puis 1 exercice de confusion documentée si elle existe.
function buildLessonExercises(lesson) {
    const exercises = [];
    const highlightTarget = (h) => Array.isArray(h) ? h[0] : h;
    const usableExamples = (lesson.examples || []).filter(ex => ex.highlight && ex.japanese && ex.japanese.includes(highlightTarget(ex.highlight)));

    usableExamples.slice(0, 2).forEach(ex => {
        const correct = highlightTarget(ex.highlight);
        const distractorPool = COMMON_PARTICLES.filter(p => p !== correct);
        const options = shuffleArray([correct, ...shuffleArray(distractorPool).slice(0, 2)]);
        exercises.push({ type: 'cloze', sentence: ex.japanese, correct, options, french: ex.french });
    });

    if (Array.isArray(lesson.confusions) && lesson.confusions.length && lesson.confusions[0].wrong_example) {
        const c = lesson.confusions[0];
        const correctFirst = Math.random() < 0.5;
        exercises.push({
            type: 'confusion-check',
            optionA: correctFirst ? c.wrong_example.correct_japanese : c.wrong_example.japanese,
            optionB: correctFirst ? c.wrong_example.japanese : c.wrong_example.correct_japanese,
            correctOption: correctFirst ? 'A' : 'B',
            french: c.wrong_example.french, explanation: c.explanation
        });
    }

    return exercises.slice(0, 3);
}

function buildLessonSteps(lesson) {
    const steps = [{ type: 'intro' }];
    (lesson.sections || []).forEach(sec => {
        const paragraphs = [];
        if (sec.text) paragraphs.push(sec.text);
        if (Array.isArray(sec.paragraphs)) paragraphs.push(...sec.paragraphs);
        paragraphs.forEach((p, i) => steps.push({ type: 'paragraph', text: p, label: sec.label, first: i === 0 }));

        if (sec.sub_title || (Array.isArray(sec.list) && sec.list.length)) {
            steps.push({ type: 'structure', sub_title: sec.sub_title, list: sec.list });
        }
        if (Array.isArray(sec.blocks)) {
            sec.blocks.forEach(b => steps.push({ type: 'structure', sub_title: b.sub_title, list: b.list, paragraphs: b.paragraphs }));
        }
    });
    (lesson.examples || []).forEach(ex => steps.push({ type: 'example', example: ex }));
    if (Array.isArray(lesson.confusions) && lesson.confusions.length) {
        steps.push({ type: 'confusion', confusion: lesson.confusions[0] });
    }
    buildLessonExercises(lesson).forEach(ex => steps.push({ type: 'exercise', exercise: ex }));
    steps.push({ type: 'end' });
    return steps;
}

// Point d'entrée public : montre l'introduction 5 slides une seule fois, puis enchaîne
// directement sur la vraie leçon. Les appels suivants sautent l'introduction.
export async function startGrammarLessonFlow() {
    if (!hasSeenLessonOnboarding()) {
        await showLessonOnboarding();
        return;
    }
    await startGrammarLessonFlowActual();
}

export async function startGrammarLessonFlowActual() {
    hideBottomNav();
    // Reprend une leçon interrompue si elle existe encore, sur SON niveau sauvegardé — sinon
    // détermine dynamiquement quel niveau propose actuellement du contenu neuf (N5 d'abord).
    const saved = getSavedLessonProgress();
    let level, lesson, resumeIndex = 0, resumeScore = 0;

    if (saved && saved.lessonId) {
        const savedData = await getLevelGrammarData(saved.level);
        const savedLesson = savedData && savedData.data ? savedData.data.find(l => l.id === saved.lessonId) : null;
        if (savedLesson) {
            level = saved.level; lesson = savedLesson;
            resumeIndex = saved.index; resumeScore = saved.exCorrectCount || 0;
        }
    }

    if (!lesson) {
        level = await findActiveLearningLevel();
        if (!level) {
            alert("Tu as déjà commencé toutes les leçons de grammaire disponibles ! 🎉 Direction Réviser pour les consolider.");
            return;
        }
        const data = await getLevelGrammarData(level);
        lesson = findNextLessonToLearn(data.data);
    }

    pushModalState('grammar-lesson-flow');
    const steps = buildLessonSteps(lesson);
    state.lessonSession = {
        lesson, level, steps,
        index: Math.min(resumeIndex, steps.length - 1),
        exAnswered: false, exSelected: null, exCorrectCount: resumeScore
    };
    document.getElementById('main-content').innerHTML = `<div id="category-content" style="padding:16px"></div>`;
    renderLessonStep();
}

export function renderLessonStep() {
    const container = document.getElementById('category-content');
    if (!container || !state.lessonSession) return;
    state.activeSwipeContext = 'lesson';
    const s = state.lessonSession;
    const step = s.steps[s.index];
    if (step.type === 'end') clearLessonProgress(); else saveLessonProgress();

    const header = backFAB('exitLessonFlow()', '✕');
    const footer = `
        <div class="lesson-bottom-pagination">
            ${buildDotsHtml(s.steps.length, s.index)}
            <div class="review-progress-text">${s.index + 1}/${s.steps.length}</div>
        </div>`;

    let body = '';
    if (step.type === 'intro') body = renderLessonIntro();
    else if (step.type === 'paragraph') body = renderLessonParagraph(step);
    else if (step.type === 'structure') body = renderLessonStructure(step);
    else if (step.type === 'example') body = renderLessonExample(step);
    else if (step.type === 'confusion') body = renderLessonConfusion(step);
    else if (step.type === 'exercise') body = renderLessonExercise(step);
    else if (step.type === 'end') body = renderLessonEnd();

    // innerHTML recrée un nœud DOM neuf à chaque appel : l'animation CSS se rejoue
    // automatiquement à chaque étape sans artifice supplémentaire.
    container.innerHTML = `<div class="review-page lesson-slide-anim">${step.type === 'end' ? '' : header}${body}${step.type === 'end' ? '' : footer}</div>`;
}

function renderLessonIntro() {
    const l = state.lessonSession.lesson;
    return `
        <div class="fiche-title-card">
            <div style="font-size:0.6875rem;color:var(--accent-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">${l.unit_title || ''}</div>
            <div class="fiche-title-main">${l.title || ''}</div>
            <div style="font-size:2rem;color:var(--accent);margin:14px 0 4px;font-family:'Noto Sans JP',sans-serif">${l.item || ''}</div>
            ${getItemRomaji(l.item, l.item_romaji) ? `<div style="font-size:0.8125rem;color:var(--gray);margin-bottom:6px">${getItemRomaji(l.item, l.item_romaji)}</div>` : ''}
            <div class="fiche-title-reading">${l.badge || ''}</div>
            ${l.pattern ? `<div style="margin-top:14px;padding:10px;background:rgba(0,0,0,0.3);border-radius:8px;font-family:monospace;color:var(--gray);font-size:0.8125rem">${l.pattern}</div>` : ''}
        </div>
        <div style="text-align:center;color:var(--gray);font-size:0.75rem;margin:16px 0">⏱ 3-5 min · Nouvelle notion</div>
        <button class="review-continue-btn" onclick="advanceLessonStep()">Commencer →</button>
    `;
}

function renderLessonParagraph(step) {
    return `
        <div class="lesson-tap-advance">
            ${step.label ? `<div class="section-sub-title" style="text-align:center;margin-bottom:6px">${step.label}</div>` : ''}
            <div class="lesson-floating-text-wrap"><div class="lesson-floating-text">${mdBold(step.text || '')}</div></div>
            <div class="lesson-tap-hint">👉 Glisse ou touche l'écran pour naviguer.</div>
        </div>
    `;
}

function renderLessonStructure(step) {
    return `
        <div class="lesson-tap-advance">
            <div class="fiche-title-card" style="text-align:left;padding:18px">
                ${step.sub_title ? `<div class="section-sub-title">${mdBold(step.sub_title)}</div>` : ''}
                ${Array.isArray(step.paragraphs) ? step.paragraphs.map(p => `<div class="section-paragraph">${mdBold(p)}</div>`).join('') : ''}
                ${Array.isArray(step.list) && step.list.length ? `<ul class="section-list">${step.list.map(item => `<li>${mdBold(item)}</li>`).join('')}</ul>` : ''}
            </div>
            <div class="lesson-tap-hint">👉 Glisse ou touche l'écran pour naviguer.</div>
        </div>
    `;
}

function renderLessonExample(step) {
    const ex = step.example;
    return `
        <div class="lesson-tap-advance">
            <div class="section-sub-title" style="text-align:center;margin-bottom:6px">Exemple</div>
            <div class="lesson-floating-text-wrap">
                <div class="lesson-floating-text">
                    <div style="font-size:1.0625em;margin-bottom:10px">${mdBold(ex.japanese || '')}</div>
                    ${ex.romaji ? `<div style="font-size:0.7em;color:var(--accent-muted);margin-bottom:8px">${ex.romaji}</div>` : ''}
                    <div style="font-size:0.75em;color:var(--gray)">${mdBold(ex.french || '')}</div>
                </div>
            </div>
            <div class="lesson-tap-hint">👉 Glisse ou touche l'écran pour naviguer.</div>
        </div>
    `;
}

function renderLessonConfusion(step) {
    return `
        <div class="lesson-tap-advance">
            <div class="section-sub-title" style="text-align:center;margin-bottom:10px">⚠️ Dernière règle d'or avant de t'entraîner</div>
            ${buildConfusionBoxHtml(step.confusion)}
            <div class="lesson-tap-hint">👉 Glisse ou touche l'écran pour naviguer.</div>
        </div>
    `;
}

function renderLessonExercise(step) {
    const s = state.lessonSession;
    const ex = step.exercise;
    const answered = s.exAnswered;
    const selected = s.exSelected;
    let bodyHtml;

    if (ex.type === 'cloze') {
        const displayedSentence = answered
            ? ex.sentence.replace(ex.correct, `<span class="cloze-blank-filled ${selected === ex.correct ? 'correct' : 'incorrect'}">${selected}</span>`)
            : ex.sentence.replace(ex.correct, '<span class="cloze-blank">＿＿</span>');
        bodyHtml = `
            <div class="review-card review-cloze-card">
                <div class="review-quiz-instruction">Complète la phrase</div>
                <div class="cloze-sentence">${displayedSentence}</div>
                <div class="review-example-fr-only">${mdBold(ex.french || '')}</div>
            </div>
            <div class="review-options review-options-particles">
                ${ex.options.map(opt => {
                    let cls = 'review-option-btn';
                    if (answered) { if (opt === ex.correct) cls += ' correct'; else if (opt === selected) cls += ' incorrect'; }
                    return `<button class="${cls}" ${answered ? 'disabled' : ''} onclick="submitLessonExercise('${opt}')">${opt}</button>`;
                }).join('')}
            </div>
            ${answered && selected !== ex.correct ? buildParticleComparisonHtml(selected, state.lessonSession.lesson) : ''}
        `;
    } else { // confusion-check : position de la bonne réponse aléatoire (correctOption)
        bodyHtml = `
            <div class="review-card"><div class="review-quiz-instruction">Laquelle de ces phrases est correcte ?</div></div>
            <div class="review-options" style="display:flex;flex-direction:column;gap:10px">
                <button class="review-option-btn ${answered ? (ex.correctOption === 'A' ? 'correct' : (selected === 'A' ? 'incorrect' : '')) : ''}" ${answered ? 'disabled' : ''} onclick="submitLessonExercise('A')" style="text-align:left">${ex.optionA}</button>
                <button class="review-option-btn ${answered ? (ex.correctOption === 'B' ? 'correct' : (selected === 'B' ? 'incorrect' : '')) : ''}" ${answered ? 'disabled' : ''} onclick="submitLessonExercise('B')" style="text-align:left">${ex.optionB}</button>
            </div>
            ${answered ? `<div class="vocab-nuance-box" style="margin-top:14px">💡 ${mdBold(ex.explanation || '')}</div>` : ''}
        `;
    }

    return `
        <div class="section-sub-title" style="text-align:center;margin-bottom:10px">Entraîne-toi</div>
        ${bodyHtml}
        ${answered ? continueFAB('advanceLessonStep()') : ''}
    `;
}

function renderLessonEnd() {
    const s = state.lessonSession;
    const l = s.lesson;
    const totalEx = s.steps.filter(st => st.type === 'exercise').length;
    const score = s.exCorrectCount;
    const passed = s.lessonPassed;

    const preview = s.nextLessonPreview;
    const nextLesson = preview ? preview.lesson : null;
    const levelChanged = preview && preview.level !== s.level;

    return `
        <div style="text-align:center;padding:20px 0">
            <div style="font-size:3rem;margin-bottom:10px">${passed ? '🎉' : '💪'}</div>
            <div style="font-size:1.5rem;font-weight:bold;color:#fff;margin-bottom:6px">${passed ? 'Leçon terminée !' : 'Presque !'}</div>
            <div style="font-size:1.0625rem;color:var(--gray);margin-bottom:20px">${l.title}</div>
            <div style="display:inline-block;background:rgba(74,222,128,0.1);border:1px solid rgba(74,222,128,0.3);border-radius:12px;padding:12px 22px;color:#4ADE80;font-size:1.0625rem;margin-bottom:20px">${score} / ${totalEx} bonnes réponses</div>
            ${passed
                ? `<div style="font-size:0.9375rem;color:var(--gray);margin-bottom:24px;line-height:1.5">📅 Première révision programmée pour demain, dans "Réviser"</div>`
                : `<div style="font-size:0.9375rem;color:var(--gray);margin-bottom:24px;line-height:1.5">🧠 Cette notion a été ajoutée à "À renforcer" — pas de souci, tu la reverras</div>`}
        </div>
        ${nextLesson ? `
            <div class="fiche-title-card" style="margin-bottom:14px">
                <div style="font-size:0.6875rem;color:var(--accent-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">${levelChanged ? `🎊 Niveau suivant débloqué — ${preview.level.toUpperCase()}` : 'Prochaine leçon'}</div>
                <div style="font-size:1.375rem;color:var(--accent);font-weight:bold;font-family:'Noto Sans JP',sans-serif">${nextLesson.item || ''}</div>
                <div style="font-size:0.9375rem;color:#fff;margin-top:4px">${nextLesson.title || ''}</div>
            </div>
            <button class="review-continue-btn" onclick="continueToNextLesson()">Continuer →</button>
            <button class="bulk-select-toggle-btn" style="width:100%;max-width:340px;margin:10px auto 0;display:block;padding-top:14px;padding-bottom:14px;font-size:0.875rem" onclick="exitLessonFlow()">Retour à Apprendre</button>
        ` : `
            <button class="review-continue-btn" onclick="exitLessonFlow()">Retour à Apprendre</button>
        `}
        <button class="bulk-select-toggle-btn" style="width:100%;max-width:340px;margin:10px auto 0;display:block;padding-top:14px;padding-bottom:14px;font-size:0.875rem" onclick="startFreeTrainingFromLesson()">🏋️ Pratiquer en Entraînement libre</button>
    `;
}

/* ══════════════════════════════════════════════════
   ÉCRAN "EXPLORER LES LEÇONS" — choix libre, sans verrouillage
══════════════════════════════════════════════════ */
export async function showExploreLessonsScreen(isBack = false, initialLevel = null) {
    if (!isBack) history.pushState({ view: 'explore-lessons' }, '');
    hideBottomNav();
    document.getElementById('page-title').innerText = 'Explorer les leçons';
    const main = document.getElementById('main-content');
    const level = initialLevel || await findActiveLearningLevel() || 'n5';
    main.innerHTML = `${backFAB()}
        <div style="padding:56px 16px 16px">
            <div class="apprendre-title-main" style="margin-top:10px">Explorer les leçons</div>
            <div id="explore-level-tabs" class="ft-radio-group ft-radio-pills" style="margin:14px 0"></div>
            <div id="explore-lessons-list"><div style="color:var(--gray);font-size:0.75rem;text-align:center;padding:20px">Chargement…</div></div>
        </div>
    `;
    await renderExploreLevelTabs(level);
    const data = await getLevelGrammarData(level);
    renderExploreLessonsList(data && data.data ? data.data : [], level);
}

// N'affiche que les niveaux ayant réellement du contenu grammaire.
async function renderExploreLevelTabs(activeLevel) {
    const el = document.getElementById('explore-level-tabs');
    if (!el) return;
    const available = [];
    for (const lv of ALL_JLPT_LEVELS) {
        const data = await getLevelGrammarData(lv);
        if (data && data.data && data.data.length) available.push(lv);
    }
    el.innerHTML = available.map(lv => `
        <label class="ft-radio-pill">
            <input type="radio" name="explore-level" ${lv === activeLevel ? 'checked' : ''} onclick="showExploreLessonsScreen(true, '${lv}')">
            <span>${lv.toUpperCase()}</span>
        </label>
    `).join('');
}

function renderExploreLessonsList(lessons, level) {
    const el = document.getElementById('explore-lessons-list');
    if (!el) return;
    if (!lessons.length) {
        el.innerHTML = `<div style="color:var(--gray);font-size:0.75rem;text-align:center;padding:20px">Aucune leçon disponible.</div>`;
        return;
    }
    const saved = getSavedLessonProgress();
    const sorted = [...lessons].sort((a, b) => (a.lesson_number || 0) - (b.lesson_number || 0));
    el.innerHTML = sorted.map(l => {
        const isInProgress = !!(saved && saved.lessonId === l.id);
        const isDone = !isInProgress && !!getSrsInfo(l.id);
        const icon = isInProgress ? '🔵' : (isDone ? '✔' : '⚪');
        const statusText = isInProgress ? 'En cours' : (isDone ? 'Terminée' : 'À découvrir');
        const statusColor = isInProgress ? 'var(--accent)' : (isDone ? '#4ADE80' : 'var(--gray)');
        const safeId = l.id.replace(/'/g, "\\'");
        return `
            <div class="explore-lesson-row" onclick="startSpecificGrammarLesson('${safeId}', '${level}')">
                <span class="explore-lesson-icon" style="color:${statusColor}">${icon}</span>
                <div class="explore-lesson-info">
                    <div class="explore-lesson-item">${l.item || ''}</div>
                    <div class="explore-lesson-title">${l.title || ''}</div>
                </div>
                <span class="explore-lesson-status" style="color:${statusColor}">${statusText}</span>
            </div>
        `;
    }).join('');
}

// Démarre (ou reprend, si c'est la leçon en cours) une leçon précise choisie depuis
// l'exploration libre — contrairement à startGrammarLessonFlow(), ignore l'ordre linéaire imposé.
export async function startSpecificGrammarLesson(lessonId, level) {
    hideBottomNav();
    const data = await getLevelGrammarData(level);
    if (!data || !data.data) return;
    const lesson = data.data.find(l => l.id === lessonId);
    if (!lesson) return;

    const saved = getSavedLessonProgress();
    const resume = saved && saved.lessonId === lessonId;

    pushModalState('grammar-lesson-flow');
    const steps = buildLessonSteps(lesson);
    state.lessonSession = {
        lesson, level, steps,
        index: resume ? Math.min(saved.index, steps.length - 1) : 0,
        exAnswered: false, exSelected: null,
        exCorrectCount: resume ? (saved.exCorrectCount || 0) : 0
    };
    document.getElementById('main-content').innerHTML = `<div id="category-content" style="padding:16px"></div>`;
    renderLessonStep();
}

// Enchaîne directement sur la leçon suivante, sans repasser par l'écran Apprendre.
export function continueToNextLesson() {
    const s = state.lessonSession;
    const preview = s?.nextLessonPreview;
    if (!preview) { exitLessonFlow(); return; }
    state.lessonSession = {
        lesson: preview.lesson, level: preview.level,
        steps: buildLessonSteps(preview.lesson),
        index: 0, exAnswered: false, exSelected: null, exCorrectCount: 0
    };
    document.getElementById('main-content').innerHTML = `<div id="category-content" style="padding:16px"></div>`;
    renderLessonStep();
}

export function submitLessonExercise(selected) {
    const s = state.lessonSession;
    if (!s || s.exAnswered) return;
    const step = s.steps[s.index];
    const ex = step.exercise;
    const isCorrect = ex.type === 'cloze' ? selected === ex.correct : selected === ex.correctOption;
    s.exAnswered = true;
    s.exSelected = selected;
    if (isCorrect) s.exCorrectCount++;
    renderLessonStep();
}

// Applique la transition SRS une seule fois, au moment précis où on atteint l'écran de fin —
// jamais pendant le rendu (qui peut être rappelé plusieurs fois pour la même étape).
// Note d'adaptation : le monolithe lit grammarDataCache[s.level] directement (cache privé de
// core/data-loader.js, inaccessible ici) — remplacé par un await getLevelGrammarData(s.level),
// strictement équivalent puisque cette fonction est déjà async et que le niveau est déjà en
// cache à ce stade (résolution immédiate, pas de vrai nouveau fetch réseau).
async function applyLessonCompletion() {
    const s = state.lessonSession;
    const l = s.lesson;
    const totalEx = s.steps.filter(st => st.type === 'exercise').length;
    const score = s.exCorrectCount;
    const passed = totalEx === 0 || score >= Math.ceil(totalEx / 2);
    if (passed) {
        const quality = score === totalEx ? 2 : 1; // Bien si sans faute, Difficile sinon (mais validé)
        gradeReview(l.id, quality, { type: 'grammar', label: l.item || l.pattern });
    } else {
        updateWeaknessTracking(l.id, 0, { type: 'grammar', label: l.item || l.pattern });
    }
    s.lessonPassed = passed;

    // Précalcule l'aperçu de la prochaine leçon (y compris bascule automatique de niveau).
    const levelData = await getLevelGrammarData(s.level);
    let nextLesson = levelData && levelData.data ? findNextLessonToLearn(levelData.data) : null;
    let nextLevel = s.level;
    if (!nextLesson) {
        const nextLevelId = await findActiveLearningLevel(s.level);
        if (nextLevelId) {
            nextLevel = nextLevelId;
            const data = await getLevelGrammarData(nextLevelId);
            nextLesson = data && data.data ? findNextLessonToLearn(data.data) : null;
        }
    }
    s.nextLessonPreview = nextLesson ? { level: nextLevel, lesson: nextLesson } : null;
}

export async function advanceLessonStep(direction = 1) {
    const s = state.lessonSession;
    if (!s) return;
    s.index = Math.max(0, s.index + direction);
    s.exAnswered = false;
    s.exSelected = null;
    const nextStep = s.steps[s.index];
    if (direction > 0 && nextStep && nextStep.type === 'end' && !s.srsApplied) {
        s.srsApplied = true;
        await applyLessonCompletion();
    }
    renderLessonStep();
}

export function exitLessonFlow() {
    state.activeSwipeContext = null;
    history.back();
}

export function startFreeTrainingFromLesson() {
    showFreeTrainingConfig(false, { type: 'grammar', level: 'n5' });
}
