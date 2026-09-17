/**
 * js/features/kana.js
 * Données Kana (Hiragana/Katakana), grille d'affichage, fiche détail et animation KanjiVG.
 *
 * ENCORE MANQUANT (passage séparé à venir) : les sessions de révision flashcard kana
 * (startKanaFlashcardReview/renderKanaReviewScreen/...) et le tracé HanziWriter kana
 * (startKanaTraceQuiz/renderKanaTraceQuestion/...) — kanaDataLoader ci-dessous est prête
 * pour ce dernier mais pas encore utilisée.
 *
 * kanaGroups + getKanaFlatList() ont été déplacées vers core/data-loader.js (voir
 * HANDOFF.md, étape 0 de "PROCHAINE ÉTAPE" — exécutée) : learning/srs.js en a besoin pour
 * buildReviewQueue(), et ce fichier a maintenant besoin d'importer learning/srs.js
 * (buildDueQueue/gradeReview/recordSessionCompleted/scheduleRelearning) et
 * features/strokes.js (createStrokeWriter/markMastered) pour la suite du chantier — les
 * garder ici aurait créé un cycle direct avec srs.js. kanaGroups est réimportée ci-dessous
 * pour l'usage propre à ce fichier (rendu grille).
 */

import { state } from '../core/state.js';
import { getItemStatus } from '../core/storage.js';
import { kanaGroups, getKanaFlatList } from '../core/data-loader.js';
import { pushModalState } from '../core/navigation.js';
import { buildDueQueue, gradeReview, scheduleRelearning, recordSessionCompleted } from '../learning/srs.js';
import { createStrokeWriter, markMastered } from './strokes.js';
import { handleListItemClick, toggleCategoryMasteryLive, refreshMasteryUI, backFAB, hideBottomNav } from '../ui/common.js';

/**
 * Équivalent EXACT de kanaDataLoader(char, onLoad, onError) du monolithe. Charge les
 * données de tracé d'un kana pour HanziWriter (fork krmanik/hanzi-writer-data-jp — inclut les
 * données kana, fusionnées depuis ailectra/kana-json — avec repli sur ce dernier).
 */
export function kanaDataLoader(char, onLoad, onError) {
    const primary  = `https://raw.githubusercontent.com/krmanik/hanzi-writer-data-jp/master/data/${char}.json`;
    const fallback = `https://cdn.jsdelivr.net/gh/ailectra/kana-json@v0.0.1/data/${char}.json`;
    fetch(primary)
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(onLoad)
        .catch(() =>
            fetch(fallback)
                .then(r => r.ok ? r.json() : Promise.reject())
                .then(onLoad)
                .catch(() => { if (typeof onError === 'function') onError(); })
        );
}

/* ══════════════════════════════════════════════════
   AFFICHAGE — GRILLE HIRAGANA/KATAKANA
══════════════════════════════════════════════════ */
let currentKanaTabType = 'hira'; // suivi de l'onglet actif, utile pour "Tout sélectionner" et le retour en mode normal

export function loadKanas(script = 'hira', isBack = false) {
    if (!isBack) history.pushState({ view: 'kana-list', script }, '');
    document.getElementById('page-title').innerText = 'Kana';
    renderKanaScreen(script);
}

/**
 * Écran de choix Hiragana/Katakana avant la grille — demandé explicitement : auparavant,
 * Apprendre > Kana tombait directement sur la grille (toujours hiragana par défaut), sans
 * possibilité de choisir. Même famille visuelle que showRevisionKanaPicker (côté Réviser),
 * mais mène à renderKanaScreen() (navigation/consultation) plutôt qu'à une session de
 * révision — 2 cartes seulement (pas de "Les deux", qui n'a pas de sens pour une grille de
 * consultation simple ; les onglets internes de renderKanaScreen permettent déjà de basculer
 * une fois à l'intérieur).
 */
export function showKanaLearningPicker(isBack = false) {
    if (!isBack) history.pushState({ view: 'kana-learning-picker' }, '');
    hideBottomNav();
    document.getElementById('page-title').innerText = 'Kana';
    const main = document.getElementById('main-content');

    main.innerHTML = `${backFAB()}
        <div class="niveaux-wrap">
            <div class="niveaux-header">
                <div class="niveaux-title-main">Kana</div>
                <div class="niveaux-subtitle-main">Choisis le syllabaire à consulter.</div>
            </div>
            <div id="niveaux-list">
                <div class="niveaux-card" style="border-color:#9D6EFF99; box-shadow:0 0 18px #9D6EFF59; background:#9D6EFF1f;" onclick="loadKanas('hira')">
                    <div class="niveaux-badge" style="background:#9D6EFF22;color:#9D6EFF;border:1px solid #9D6EFF44">あ</div>
                    <div class="niveaux-info"><div class="niveaux-card-title">Hiragana</div><div class="niveaux-card-sub">Toucher pour consulter</div></div>
                </div>
                <div class="niveaux-card" style="border-color:#9D6EFF99; box-shadow:0 0 18px #9D6EFF59; background:#9D6EFF1f;" onclick="loadKanas('kata')">
                    <div class="niveaux-badge" style="background:#9D6EFF22;color:#9D6EFF;border:1px solid #9D6EFF44">ア</div>
                    <div class="niveaux-info"><div class="niveaux-card-title">Katakana</div><div class="niveaux-card-sub">Toucher pour consulter</div></div>
                </div>
            </div>
        </div>`;
}

// Redessine l'écran complet (onglets + bouton Sélectionner + grille) — nécessaire pour que
// le bouton Sélectionner disparaisse/réapparaisse correctement selon bulkSelectMode.
export function renderKanaScreen(type) {
    currentKanaTabType = type;
    const label = type === 'hira' ? 'Hiragana あ' : 'Katakana ア';
    document.getElementById('main-content').innerHTML = `${backFAB('history.back()')}
        <div style="margin-top:56px; padding:12px 16px 0; display:flex; justify-content:space-between; align-items:center;">
            <div style="font-size:1rem; font-weight:bold; color:var(--accent)">${label}</div>
            ${!state.bulkSelectMode ? `<button class="bulk-select-toggle-btn" onclick="enterBulkSelectMode(refreshKanaScreen)">☑ Sélectionner</button>` : ''}
        </div>
        <div id="kana-grid-container" style="padding:12px"></div>`;
    renderKanaGrid(type);
}

// Équivalent du onclick="renderKanaScreen(currentKanaTabType)" du monolithe — bug trouvé et
// corrigé lors de la revérification finale (session app.js) : currentKanaTabType est un
// `let` local à ce module, inaccessible depuis un attribut onclick (contexte global). Lit la
// variable en interne, comme resetKanaReviewSession() plus bas dans ce même fichier.
export function refreshKanaScreen() {
    renderKanaScreen(currentKanaTabType);
}

// switchKanaTab() retirée (session de nettoyage, demande explicite) : les onglets
// Hiragana/Katakana en haut de la grille ont été supprimés — le choix se fait maintenant
// exclusivement via showKanaLearningPicker(), écran dédié avant d'entrer dans la grille.
export function renderKanaGrid(type) {
    const container = document.getElementById('kana-grid-container');
    container.innerHTML = '';
    for (const group of kanaGroups[type]) {
        if (group.title) {
            const h = document.createElement('div');
            h.className = 'kana-section-title';
            if (state.bulkSelectMode) {
                const groupIds = [];
                group.rows.forEach(row => row.forEach(k => { if (k) groupIds.push('kana_' + k.c); }));
                const allMastered = groupIds.length > 0 && groupIds.every(id => getItemStatus(id) === 'mastered');
                h.style.display = 'flex';
                h.style.alignItems = 'center';
                h.style.gap = '8px';
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'bulk-cat-checkbox';
                checkbox.checked = allMastered;
                checkbox.onclick = (e) => { e.stopPropagation(); toggleCategoryMasteryLive(checkbox, groupIds); };
                const span = document.createElement('span');
                span.textContent = group.title;
                h.appendChild(checkbox);
                h.appendChild(span);
            } else {
                h.textContent = group.title;
            }
            container.appendChild(h);
        }
        const grid = document.createElement('div');
        grid.className = 'kana-grid';
        for (const row of group.rows) {
            for (const kana of row) {
                const cell = document.createElement('div');
                if (!kana) {
                    cell.className = 'kana-cell empty';
                } else {
                    const isYoon = [...kana.c].length > 1;
                    const kanaId = 'kana_' + kana.c;
                    const isKanaMastered = getItemStatus(kanaId) === 'mastered';
                    cell.className = 'kana-cell';
                    cell.style.position = 'relative';
                    cell.innerHTML = `${isKanaMastered ? '<span class="mastered-check">✔</span>' : ''}<span class="kana-char${isYoon?' yoon':''}">${kana.c}</span><span class="kana-rom">${kana.r}</span>`;
                    cell.onclick = () => handleListItemClick(cell, kanaId, () => openKanaDetail(kana));
                }
                grid.appendChild(cell);
            }
        }
        container.appendChild(grid);
    }
}

/* ══════════════════════════════════════════════════
   FICHE DÉTAIL KANA (même #detail-view que kanji, voir features/kanji.js::openDetail)
══════════════════════════════════════════════════ */
export function openKanaDetail(kana) {
    pushModalState('kana-detail');
    hideBottomNav();
    state.currentType = 'kana'; state.currentChar = kana.c;
    // Le kana n'a pas de "mots qui l'utilisent" (contrairement au kanji) — on vide cette
    // section qui pourrait sinon garder le contenu résiduel d'un kanji visité juste avant
    // (même overlay partagé).
    const linkedTitle = document.getElementById('linked-vocab-title');
    const linkedContainer = document.getElementById('linked-vocab-container');
    if (linkedTitle) linkedTitle.style.display = 'none';
    if (linkedContainer) linkedContainer.innerHTML = '';
    const code = kana.c.codePointAt(0);
    const label = (code >= 0x3040 && code <= 0x309F) ? 'Hiragana' : 'Katakana';
    const isYoon = [...kana.c].length > 1, isSokuon = kana.c === 'っ' || kana.c === 'ッ';

    document.getElementById('detail-view').style.display = 'flex';
    document.getElementById('detail-char-title').innerText = kana.c;
    document.getElementById('d-level').innerText  = label;
    const dLevelWord = document.getElementById('d-level-word');
    if (dLevelWord) dLevelWord.style.display = 'none';
    document.getElementById('d-romaji').innerText = kana.r;
    refreshMasteryUI();
    document.getElementById('section-on').style.display  = 'none';
    document.getElementById('section-kun').style.display = 'none';
    document.getElementById('voice-feedback').textContent = '';

    // Masquer les boutons réservés aux kanji (audio, sauvegarde) — le tracé reste possible
    document.getElementById('btn-oral-test').style.display = 'none';
    window.currentKanaForStroke = kana;
    const dqb = document.getElementById('detail-quiz-btn');
    if (dqb) {
        dqb.style.display = '';
        dqb.title = "S'entraîner au tracé guidé";
    }
    const bsk = document.getElementById('btn-save-kanji');
    if (bsk) bsk.style.display = 'none';

    // Masquer la grille stroke guide
    document.getElementById('stroke-guide-grid').innerHTML = '';
    document.getElementById('stroke-guide-title').style.display = 'none';

    let meaning = `Syllabe « ${kana.r} »`;
    if (isYoon)   meaning = `Yoon (拗音) — combiné « ${kana.r} »`;
    if (isSokuon) meaning = 'Sokuon (促音) — double la consonne suivante';

    document.getElementById('d-meaning').innerText = meaning;
    document.getElementById('d-strokes').innerText = '…';
    document.getElementById('kanji-writer-target').innerHTML = '';
    document.getElementById('kanji-writer-target').style.display = 'none';

    // Vider les exemples pour les kana
    const exContainer = document.getElementById('exemples-container');
    if (exContainer) exContainer.innerHTML = '';

    animateKanaChar(kana.c);
}

/* ══════════════════════════════════════════════════
   ANIMATION KANJIVG (kana, y compris yōon en 2 sous-caractères)
══════════════════════════════════════════════════ */
async function fetchPaths(char, signal) {
    const cp  = char.codePointAt(0).toString(16).padStart(5,'0');
    const res = await fetch(`https://cdn.jsdelivr.net/gh/KanjiVG/kanjivg@master/kanji/${cp}.svg`, {signal});
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const doc = new DOMParser().parseFromString(await res.text(), 'image/svg+xml');
    return [...doc.querySelectorAll('path')].map(p => p.getAttribute('d'));
}

function makeGroup(dList, transform, color) {
    const NS = 'http://www.w3.org/2000/svg';
    const g  = document.createElementNS(NS, 'g');
    if (transform) g.setAttribute('transform', transform);
    for (const d of dList) {
        const p = document.createElementNS(NS, 'path');
        p.setAttribute('d', d); p.setAttribute('fill', 'none');
        p.setAttribute('stroke', color); p.setAttribute('stroke-width', '3');
        p.setAttribute('stroke-linecap', 'round'); p.setAttribute('stroke-linejoin', 'round');
        p.setAttribute('vector-effect', 'non-scaling-stroke');
        g.appendChild(p);
    }
    return g;
}

export async function animateKanaChar(char) {
    const chars  = [...char], isYoon = chars.length > 1;
    const svgEl  = document.getElementById('kana-writer-svg');
    const spn    = document.getElementById('writer-spinner');
    const hanz   = document.getElementById('kanji-writer-target');
    if (state.fetchCtrl) state.fetchCtrl.abort();
    state.fetchCtrl = new AbortController();
    const { signal } = state.fetchCtrl;
    state.kanaAnimTimeouts.forEach(clearTimeout); state.kanaAnimTimeouts = [];
    hanz.style.display = 'none'; svgEl.style.display = 'none'; spn.style.display = 'block';
    try {
        const groups = await Promise.all(chars.map(c => fetchPaths(c, signal)));
        if (signal.aborted) return;
        svgEl.innerHTML = ''; svgEl.setAttribute('viewBox', '0 0 109 109');
        const tf = isYoon ? ['scale(0.62)', 'translate(65,65) scale(0.35)'] : [null];
        chars.forEach((_, i) => svgEl.appendChild(makeGroup(groups[i], tf[i], '#2a2a3a')));
        const animPaths = [];
        chars.forEach((_, i) => {
            const g = makeGroup(groups[i], tf[i], '#00c9a7');
            svgEl.appendChild(g); animPaths.push(...g.querySelectorAll('path'));
        });
        spn.style.display = 'none'; svgEl.style.display = 'block';
        animPaths.forEach(p => {
            const len = p.getTotalLength();
            p.style.strokeDasharray = len; p.style.strokeDashoffset = len; p.style.transition = 'none';
        });
        const DUR = 550, PAU = 150; let delay = 100;
        animPaths.forEach(p => {
            const t = setTimeout(() => { p.style.transition = `stroke-dashoffset ${DUR}ms ease`; p.style.strokeDashoffset = '0'; }, delay);
            delay += DUR + PAU; state.kanaAnimTimeouts.push(t);
        });
        document.getElementById('d-strokes').innerText = groups.reduce((s,g) => s + g.length, 0);
    } catch(err) {
        if (err.name === 'AbortError') return;
        spn.style.display = 'none';
        svgEl.innerHTML = `<text x="54" y="80" text-anchor="middle" fill="#dde0eb" font-size="60" font-family="serif">${char}</text>`;
        svgEl.style.display = 'block';
        document.getElementById('d-strokes').innerText = '?';
    }
}

/* ══════════════════════════════════════════════════
   RÉVISION FLASHCARD KANA
══════════════════════════════════════════════════ */

// Équivalent EXACT de getDueKanaChars(script) du monolithe.
export function getDueKanaChars(script) {
    const list = getKanaFlatList(script);
    const due = buildDueQueue(list.map(k => ({ id: k.id })));
    return due.map(item => list.find(k => k.id === item.id)).filter(Boolean);
}

export async function showRevisionKanaPicker(isBack = false) {
    if (!isBack) history.pushState({ view: 'revision-kana-picker' }, '');
    hideBottomNav();
    document.getElementById('page-title').innerText = 'Réviser';
    const main = document.getElementById('main-content');

    main.innerHTML = `${backFAB()}
        <div class="niveaux-wrap">
            <div class="niveaux-header">
                <div class="niveaux-title-main">Kana</div>
                <div class="niveaux-subtitle-main">Choisis le syllabaire à réviser.</div>
            </div>
            <div id="niveaux-list">
                <div class="niveaux-card" style="border-color:#9D6EFF99; box-shadow:0 0 18px #9D6EFF59; background:#9D6EFF1f;" onclick="showKanaRevisionModeSelector('hira')">
                    <div class="niveaux-badge" style="background:#9D6EFF22;color:#9D6EFF;border:1px solid #9D6EFF44">あ</div>
                    <div class="niveaux-info"><div class="niveaux-card-title">Hiragana</div><div class="niveaux-card-sub">Toucher pour réviser</div></div>
                </div>
                <div class="niveaux-card" style="border-color:#9D6EFF99; box-shadow:0 0 18px #9D6EFF59; background:#9D6EFF1f;" onclick="showKanaRevisionModeSelector('kata')">
                    <div class="niveaux-badge" style="background:#9D6EFF22;color:#9D6EFF;border:1px solid #9D6EFF44">ア</div>
                    <div class="niveaux-info"><div class="niveaux-card-title">Katakana</div><div class="niveaux-card-sub">Toucher pour réviser</div></div>
                </div>
                <div class="niveaux-card" style="border-color:#9D6EFF99; box-shadow:0 0 18px #9D6EFF59; background:#9D6EFF1f;" onclick="showKanaRevisionModeSelector('both')">
                    <div class="niveaux-badge" style="background:#9D6EFF22;color:#9D6EFF;border:1px solid #9D6EFF44">両</div>
                    <div class="niveaux-info"><div class="niveaux-card-title">Les deux</div><div class="niveaux-card-sub">Hiragana + Katakana</div></div>
                </div>
            </div>
        </div>`;
}

export function showKanaRevisionModeSelector(script) {
    hideBottomNav();
    const dueKana = getDueKanaChars(script);
    if (dueKana.length === 0) {
        alert('Rien à réviser pour le moment ! 🎉');
        return;
    }

    pushModalState('kana-mode-selector');
    document.getElementById('main-content').innerHTML = `<div id="category-content" style="padding:16px"></div>`;
    document.getElementById('category-content').innerHTML = `
        <div class="review-mode-selector">
            ${backFAB()}
            <div class="review-mode-title">Choisis ton mode de révision</div>
            <div class="review-mode-count">${dueKana.length} kana à revoir</div>

            <button class="review-mode-btn" onclick="startKanaFlashcardReview('${script}')">
                <span class="review-mode-icon">🗂️</span>
                <div><div class="review-mode-name">Flashcard</div><div class="review-mode-desc">Lecture romaji</div></div>
            </button>
            <button class="review-mode-btn" onclick="startKanaTraceReview('${script}','trace-easy')">
                <span class="review-mode-icon">✍️</span>
                <div><div class="review-mode-name">Tracé normal</div><div class="review-mode-desc">Ordre des traits avec aide visuelle</div></div>
            </button>
            <button class="review-mode-btn" onclick="startKanaTraceReview('${script}','trace-hard')">
                <span class="review-mode-icon">🔥</span>
                <div><div class="review-mode-name">Tracé difficile</div><div class="review-mode-desc">Sans ombre — de mémoire pure</div></div>
            </button>
        </div>`;
}

// kanaReviewSession reste une variable locale au module (comme currentKanaTabType plus haut) :
// contrairement à kanaTraceState/kanaTraceWriter/kanaTraceTimerInterval, RIEN dans
// features/strokes.js ne la lit ni ne la nettoie. Seule resetKanaReviewSession() (exportée
// d'ici) la remet à null — appelée par core/navigation.js::closeAllOverlaysAndSessions() via
// window.* (cycle : kana.js importe déjà pushModalState depuis navigation.js).
let kanaReviewSession = null;

export function startKanaFlashcardReview(script) {
    hideBottomNav();
    const dueKana = getDueKanaChars(script);
    if (dueKana.length === 0) return;

    pushModalState('kana-review-flashcard');
    kanaReviewSession = {
        queue: dueKana,
        index: 0,
        results: { again: 0, hard: 0, good: 0, easy: 0 },
        flipped: false
    };
    document.getElementById('main-content').innerHTML = `<div id="category-content" style="padding:16px"></div>`;
    renderKanaReviewScreen();
}

export function renderKanaReviewScreen() {
    const container = document.getElementById('category-content');
    const session = kanaReviewSession;

    if (!session || session.index >= session.queue.length) {
        renderKanaReviewSummary();
        return;
    }

    const kana = session.queue[session.index];
    const progress = session.index + 1;
    const total = session.queue.length;
    const flipped = session.flipped;

    container.innerHTML = `${backFAB('history.back()', '✕')}<div class="review-page">
        <div class="review-header">
            <div class="review-progress-bar"><div class="review-progress-fill" style="width:${(session.index / total) * 100}%"></div></div>
            <div class="review-progress-text">${progress} / ${total}</div>
        </div>
        <div class="review-card ${flipped ? 'flipped' : ''}" onclick="${flipped ? '' : 'flipKanaReviewCard()'}">
            <div class="review-card-front">
                <div class="review-word" style="font-size:56px;">${kana.char}</div>
            </div>
            ${flipped ? `<div class="review-card-back"><div class="review-meaning">${kana.romaji}</div></div>` : `<div class="review-tap-hint">Touche la carte pour révéler</div>`}
        </div>
        ${flipped ? `
            <div class="review-grade-buttons">
                <button class="grade-btn grade-again" onclick="submitKanaReviewGrade(0)">Encore</button>
                <button class="grade-btn grade-hard" onclick="submitKanaReviewGrade(1)">Difficile</button>
                <button class="grade-btn grade-good" onclick="submitKanaReviewGrade(2)">Bien</button>
                <button class="grade-btn grade-easy" onclick="submitKanaReviewGrade(3)">Facile</button>
            </div>
        ` : ''}
    </div>`;
}

export function flipKanaReviewCard() {
    if (!kanaReviewSession) return;
    kanaReviewSession.flipped = true;
    renderKanaReviewScreen();
}

export function submitKanaReviewGrade(quality) {
    if (!kanaReviewSession) return;
    const kana = kanaReviewSession.queue[kanaReviewSession.index];
    gradeReview(kana.id, quality, { type: 'kana', label: kana.char });
    if (quality === 0) scheduleRelearning(kanaReviewSession, kana);

    const labels = ['again', 'hard', 'good', 'easy'];
    kanaReviewSession.results[labels[quality]]++;

    kanaReviewSession.index++;
    kanaReviewSession.flipped = false;
    renderKanaReviewScreen();
}

export function renderKanaReviewSummary() {
    recordSessionCompleted();
    const container = document.getElementById('category-content');
    const r = kanaReviewSession.results;
    const total = kanaReviewSession.queue.length;

    container.innerHTML = `<div class="review-summary">
        <div class="review-summary-title">Session terminée ! 🎉</div>
        <div class="review-summary-count">${total} kana révisé${total > 1 ? 's' : ''}</div>
        <div class="review-summary-stats">
            <div class="review-stat"><span class="review-stat-dot again"></span>Encore : ${r.again}</div>
            <div class="review-stat"><span class="review-stat-dot hard"></span>Difficile : ${r.hard}</div>
            <div class="review-stat"><span class="review-stat-dot good"></span>Bien : ${r.good}</div>
            <div class="review-stat"><span class="review-stat-dot easy"></span>Facile : ${r.easy}</div>
        </div>
        <button class="revise-btn" style="margin-top:20px;" onclick="history.back()">Retour</button>
    </div>`;
    kanaReviewSession = null;
}

// Ajoutée pour core/navigation.js::MODAL_EXIT_REGISTRY['kana-review-flashcard'] (voir
// HANDOFF.md) : dans le monolithe, la sortie du modal fait directement
// `kanaReviewSession = null;` sur la variable globale — impossible depuis un autre module en
// ESM puisque kanaReviewSession est un `let` local à ce fichier (volontairement, voir plus
// haut). Cette fonction expose le même effet sans sortir la variable de son module.
export function resetKanaReviewSession() {
    kanaReviewSession = null;
}

/* ══════════════════════════════════════════════════
   TRACÉ KANA (HanziWriter)
   ─────────────────────────────────────────────────
   kanaTraceState/kanaTraceWriter/kanaTraceTimerInterval vivent dans state.* (pas des
   variables locales à ce module) : features/strokes.js::closeStrokeQuiz() les lit déjà et
   les nettoie, partageant le même overlay #stroke-quiz-view que le tracé kanji (voir
   HANDOFF.md). kanaTracePaused/_kanaTraceSource restent locales : jamais lues ailleurs.
══════════════════════════════════════════════════ */
let kanaTracePaused = false;
let _kanaTraceSource = null;

export function showKanaTraceModal(kana) {
    _kanaTraceSource = { queue: [kana], sourceType: 'single' };
    const m = document.getElementById('kana-trace-modal');
    if (!m) return;
    m.classList.add('open');
    m.style.display = 'flex';
}

export function closeKanaTraceModal() {
    const m = document.getElementById('kana-trace-modal');
    if (!m) return;
    m.classList.remove('open');
    m.style.display = 'none';
}

export function launchKanaTraceMode(mode) {
    const source = _kanaTraceSource;
    closeKanaTraceModal();
    if (!source || !source.queue || !source.queue.length) return;
    startKanaTraceQuiz(source.queue, mode, source.sourceType);
}

// Entrée depuis l'onglet Révisions → Kana → mode "Tracé normal"/"Tracé difficile"
export function startKanaTraceReview(script, mode) {
    hideBottomNav();
    const dueKana = getDueKanaChars(script);
    if (dueKana.length === 0) { alert('Rien à réviser pour le moment ! 🎉'); return; }
    pushModalState('kana-trace-review');
    const queue = dueKana.map(k => ({ c: k.char, r: k.romaji, id: k.id }));
    startKanaTraceQuiz(queue, mode, 'queue');
}

export function startKanaTraceQuiz(kanaOrQueue, mode = 'trace-easy', sourceType = 'single') {
    const queue = Array.isArray(kanaOrQueue) ? kanaOrQueue : [kanaOrQueue];
    if (!queue.length) return;

    if (state.kanaTraceTimerInterval) clearInterval(state.kanaTraceTimerInterval);
    kanaTracePaused = false;

    state.kanaTraceState = {
        queue, idx: 0, mode, sourceType,
        correct: 0, wrong: 0,
        elapsedSec: 0
    };

    document.getElementById('sq-correct').textContent   = '0';
    document.getElementById('sq-wrong').textContent     = '0';
    document.getElementById('sq-timer').textContent     = '0:00';
    document.getElementById('sq-score-sub').textContent = '';
    document.getElementById('sq-prog-bar').style.width  = '0%';
    document.getElementById('stroke-quiz-view').style.display = 'flex';

    state.kanaTraceTimerInterval = setInterval(() => {
        if (!kanaTracePaused && state.kanaTraceState) {
            state.kanaTraceState.elapsedSec++;
            const m = Math.floor(state.kanaTraceState.elapsedSec / 60);
            const s = state.kanaTraceState.elapsedSec % 60;
            document.getElementById('sq-timer').textContent = `${m}:${String(s).padStart(2,'0')}`;
        }
    }, 1000);

    renderKanaTraceQuestion();
}

export function renderKanaTraceQuestion() {
    if (!state.kanaTraceState) return;
    const qs = state.kanaTraceState;
    if (qs.idx >= qs.queue.length) { renderKanaTraceResults(); return; }

    if (qs._nextTimer) { clearTimeout(qs._nextTimer); qs._nextTimer = null; }
    if (state.kanaTraceWriter) { try { state.kanaTraceWriter.cancelQuiz(); } catch(_) {} state.kanaTraceWriter = null; }

    const kana       = qs.queue[qs.idx];
    const isHardcore = (qs.mode === 'trace-hard');
    const chars      = [...kana.c];
    const isMulti    = chars.length > 1; // yōon : 2 code points à tracer l'un après l'autre

    const scriptLabel = (kana.c.codePointAt(0) >= 0x30A0) ? 'Katakana' : 'Hiragana';

    document.getElementById('sq-prog-bar').style.width = (qs.idx / qs.queue.length * 100).toFixed(1) + '%';
    document.getElementById('sq-counter').textContent  = `${qs.idx + 1} / ${qs.queue.length}`;

    const canvasHtml = isMulti
        ? `<div class="sq-canvas-wrap multi" id="sq-canvas-wrap" style="touch-action:none;">
               <div class="sq-writer-target main pending"  id="sq-writer-target-0"></div>
               <div class="sq-writer-target small pending" id="sq-writer-target-1"></div>
           </div>`
        : `<div class="sq-canvas-wrap" id="sq-canvas-wrap" style="touch-action:none;">
               <div id="sq-writer-target"></div>
               <div class="sq-grid-overlay"></div>
           </div>`;

    document.getElementById('stroke-quiz-body').innerHTML = `
        <div class="sq-kanji-header">
            <div class="sq-meaning" style="font-size:1.375rem;font-weight:bold">${kana.r}</div>
            <div style="font-size:0.75rem;color:var(--gray);margin-top:4px">${scriptLabel}${isMulti ? ' · Yōon (2 traits séquentiels)' : ''}</div>
        </div>
        ${canvasHtml}
        <div id="sq-feedback" style="height:22px;margin-top:10px;font-weight:bold;text-align:center;font-size:0.8125rem;color:var(--gray)"></div>
        <div class="sq-actions">
            <button class="sq-btn hint" onclick="kanaTraceHint()">💡 Indice</button>
            <button class="sq-btn skip" onclick="kanaTraceSkip()">Passer →</button>
        </div>`;

    // Même délai d'une frame que pour le tracé kanji : laisser le DOM se stabiliser
    // avant d'initialiser HanziWriter (évite le bug "élément invisible")
    requestAnimationFrame(() => {
        if (!state.kanaTraceState || state.kanaTraceState.idx !== qs.idx) return;

        const sqBody = document.getElementById('stroke-quiz-body');
        if (sqBody) sqBody.classList.add('tracing');

        let subIdx        = 0;
        let itemMistakes  = 0;
        let subStrokesDone = 0;
        let lastStrokeTimer = null;
        let _subCompleted   = false;
        let _itemCompleted  = false;

        const lockScroll = (targetId) => {
            requestAnimationFrame(() => {
                const target = document.getElementById(targetId);
                if (!target) return;
                target.style.touchAction = 'none';
                target.querySelectorAll('*').forEach(el => { el.style.touchAction = 'none'; });
                target.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
            });
        };

        const finishItem = (totalMistakes) => {
            if (_itemCompleted) return;
            _itemCompleted = true;
            if (lastStrokeTimer) { clearTimeout(lastStrokeTimer); lastStrokeTimer = null; }
            if (!state.kanaTraceState) return;

            const sqBody2 = document.getElementById('stroke-quiz-body');
            if (sqBody2) sqBody2.classList.remove('tracing');

            const isClean = totalMistakes === 0;
            if (isClean) { qs.correct++; markMastered(kana.c); }
            else           qs.wrong++;
            document.getElementById('sq-correct').textContent = qs.correct;
            document.getElementById('sq-wrong').textContent   = qs.wrong;

            // File de révision : nourrit le planning SRS comme la flashcard kana
            if (kana.id) {
                const quality = totalMistakes === 0 ? 3 : totalMistakes <= 2 ? 2 : totalMistakes <= 4 ? 1 : 0;
                gradeReview(kana.id, quality, { type: 'kana', label: kana.c });
            }

            const fb = document.getElementById('sq-feedback');
            if (fb) {
                fb.style.color = isClean ? 'var(--accent)' : '#e55';
                fb.textContent = isClean ? '✔ Parfait !' : `Terminé — ${totalMistakes} erreur${totalMistakes > 1 ? 's' : ''}`;
            }

            qs._nextTimer = setTimeout(() => {
                qs._nextTimer = null;
                if (!state.kanaTraceState) return;
                state.kanaTraceState.idx++;
                renderKanaTraceQuestion();
            }, 1100);
        };

        const startSub = () => {
            if (subIdx >= chars.length) { finishItem(itemMistakes); return; }
            _subCompleted   = false;
            subStrokesDone  = 0;

            const targetId = isMulti ? `sq-writer-target-${subIdx}` : 'sq-writer-target';
            if (isMulti) {
                const prevTarget = subIdx > 0 ? document.getElementById(`sq-writer-target-${subIdx - 1}`) : null;
                if (prevTarget) { prevTarget.classList.remove('pending'); prevTarget.classList.add('sub-done'); }
                const curTarget = document.getElementById(targetId);
                if (curTarget) curTarget.classList.remove('pending');
            }

            // Le premier sous-caractère (ou l'unique, hors yōon) garde la taille pleine ;
            // le second (petit modificateur yōon) est rendu plus petit, comme dans animateKanaChar
            const dims = isMulti
                ? (subIdx === 0 ? { width: 190, height: 190, padding: 16 } : { width: 108, height: 108, padding: 8 })
                : {};

            state.kanaTraceWriter = createStrokeWriter(targetId, chars[subIdx], isHardcore, {
                dataLoader:  kanaDataLoader,
                onDataError: kanaTraceSkip,
                ...dims
            });
            if (!state.kanaTraceWriter) { kanaTraceSkip(); return; }
            lockScroll(targetId);

            const advanceSub = () => {
                if (_subCompleted) return;
                _subCompleted = true;
                if (lastStrokeTimer) { clearTimeout(lastStrokeTimer); lastStrokeTimer = null; }
                subIdx++;
                startSub();
            };

            const subCallbacks = {
                onMistake() {
                    itemMistakes++;
                    const wrap = document.getElementById('sq-canvas-wrap');
                    if (wrap) { wrap.classList.add('flash-err'); setTimeout(() => wrap.classList.remove('flash-err'), 350); }
                    const fb = document.getElementById('sq-feedback');
                    if (fb) { fb.style.color = '#e55'; fb.textContent = isHardcore ? 'Mauvais tracé !' : 'Mauvais tracé, regarde l\'aide…'; }
                },
                onCorrectStroke(strokeData) {
                    subStrokesDone++;
                    const wrap = document.getElementById('sq-canvas-wrap');
                    if (wrap) { wrap.classList.add('flash-ok'); setTimeout(() => wrap.classList.remove('flash-ok'), 350); }
                    const fb = document.getElementById('sq-feedback');
                    if (fb) { fb.style.color = 'var(--accent)'; fb.textContent = 'Bien !';
                        setTimeout(() => { if (fb && fb.textContent === 'Bien !') fb.textContent = ''; }, 800); }

                    // strokesRemaining fourni par HanziWriter : pas besoin de connaître le
                    // nombre total de traits à l'avance (contrairement au kanji qui le lit
                    // dans kanjiDb — les kana n'ont pas cette donnée statique).
                    if (strokeData && strokeData.strokesRemaining === 0) {
                        lastStrokeTimer = setTimeout(advanceSub, (isMulti && subIdx < chars.length - 1) ? 350 : 700);
                    }
                },
                onComplete() { advanceSub(); }
            };
            qs._quizCallbacks  = subCallbacks;
            qs._isHardcore     = isHardcore;
            qs._strokesDoneRef = () => subStrokesDone;

            state.kanaTraceWriter.quiz(subCallbacks);
        };

        startSub();
    });
}

export function kanaTraceHint() {
    if (!state.kanaTraceWriter || !state.kanaTraceState || !state.kanaTraceState._quizCallbacks) return;
    const qs = state.kanaTraceState;
    const strokesDone = qs._strokesDoneRef ? qs._strokesDoneRef() : 0;

    const fb = document.getElementById('sq-feedback');
    if (fb) { fb.style.color = '#f5a623'; fb.textContent = `💡 Indice — trait ${strokesDone + 1}`; }

    try { state.kanaTraceWriter.cancelQuiz(); } catch(_) {}

    state.kanaTraceWriter.animateStroke(strokesDone, {
        onComplete: () => {
            if (!state.kanaTraceState || !state.kanaTraceWriter) return;
            setTimeout(() => {
                if (!state.kanaTraceState || !state.kanaTraceWriter) return;
                if (fb) fb.textContent = '';
                state.kanaTraceWriter.quiz({
                    quizStartStrokeNum:  strokesDone + 1,
                    showHintAfterMisses: qs._isHardcore ? false : 1,
                    ...qs._quizCallbacks
                });
            }, 400);
        }
    });
}

// Passe l'item courant (kana entier, y compris ses 2 traits en yōon) et avance dans la file
export function kanaTraceSkip() {
    if (!state.kanaTraceState) return;
    const qs = state.kanaTraceState;
    if (qs._nextTimer) { clearTimeout(qs._nextTimer); qs._nextTimer = null; }
    if (state.kanaTraceWriter) { try { state.kanaTraceWriter.cancelQuiz(); } catch(_) {} state.kanaTraceWriter = null; }
    const sqBody = document.getElementById('stroke-quiz-body');
    if (sqBody) sqBody.classList.remove('tracing');

    qs.wrong++;
    document.getElementById('sq-wrong').textContent = qs.wrong;

    const kana = qs.queue[qs.idx];
    if (kana && kana.id) gradeReview(kana.id, 0, { type: 'kana', label: kana.c });

    qs.idx++;
    renderKanaTraceQuestion();
}

export function renderKanaTraceResults() {
    if (state.kanaTraceTimerInterval) { clearInterval(state.kanaTraceTimerInterval); state.kanaTraceTimerInterval = null; }
    if (!state.kanaTraceState) return;
    document.getElementById('sq-prog-bar').style.width = '100%';

    const qs = state.kanaTraceState;
    const { correct, wrong, queue, sourceType, elapsedSec } = qs;
    const total = queue.length;
    const pct   = Math.round(correct / total * 100);
    const emoji = pct >= 80 ? '🎉' : pct >= 60 ? '👍' : pct >= 40 ? '💪' : '😅';
    const msg   = pct >= 80 ? 'Excellent !' : pct >= 60 ? 'Bien joué !' : pct >= 40 ? 'Continuez !' : 'À réviser…';
    const m = Math.floor(elapsedSec / 60), s = elapsedSec % 60;

    if (sourceType === 'queue') recordSessionCompleted();

    const singleRow = (total === 1)
        ? `<div class="quiz-breakdown-row"><span>Kana</span><strong>${queue[0].c} (${queue[0].r})</strong></div>`
        : '';

    // ⚠️ ATTENTION : closeStrokeQuiz() (features/strokes.js) référencée dans l'onclick
    // "Fermer" ci-dessous est un VRAI appel JS non importé (pas juste du HTML inerte) —
    // landmine volontaire pour éviter un cycle kana.js -> strokes.js -> kanji.js -> ...
    // (strokes.js importe déjà des choses de kanji.js) ; résolue plus tard via
    // window.closeStrokeQuiz exposé par app.js (voir HANDOFF.md, risque transversal onclick).
    // Le bouton "Rejouer" appelle replayKanaTraceQuiz(sourceType) (définie ci-dessous, PAS
    // le kanaTraceState brut du monolithe) : dans le monolithe l'onclick référence la
    // variable globale kanaTraceState directement, mais ici c'est state.kanaTraceState
    // (propriété d'un import de module, pas une globale) — inaccessible depuis un attribut
    // onclick qui s'exécute dans le contexte global. Comportement identique, juste la
    // référence adaptée à l'architecture ESM.
    document.getElementById('stroke-quiz-body').innerHTML = `
        <div class="quiz-results" style="padding-top:40px">
            <div class="quiz-results-emoji">${emoji}</div>
            <div class="quiz-score-big">${pct}%</div>
            <div class="quiz-score-label">${msg}</div>
            <div class="quiz-breakdown">
                ${singleRow}
                <div class="quiz-breakdown-row"><span>✔ Sans erreur</span><strong style="color:var(--accent)">${correct}</strong></div>
                <div class="quiz-breakdown-row"><span>✘ Avec erreurs</span><strong style="color:#e55">${wrong}</strong></div>
                <div class="quiz-breakdown-row"><span>Total</span><strong>${total}</strong></div>
                <div class="quiz-breakdown-row"><span>Temps</span><strong>${m}:${String(s).padStart(2,'0')}</strong></div>
            </div>
            <div class="quiz-btn-row">
                <button class="quiz-action-btn secondary" onclick="closeStrokeQuiz()">Fermer</button>
                <button class="quiz-action-btn primary" onclick="replayKanaTraceQuiz('${sourceType}')">Rejouer ↺</button>
            </div>
        </div>`;
}

// Équivalent du onclick="startKanaTraceQuiz(kanaTraceState.queue, kanaTraceState.mode, ...)"
// du monolithe — adapté car kanaTraceState est ici state.kanaTraceState (propriété d'import,
// pas une globale accessible depuis un attribut onclick). Toujours valide à cet instant :
// renderKanaTraceResults() ne vide jamais state.kanaTraceState avant d'afficher ce bouton.
export function replayKanaTraceQuiz(sourceType) {
    if (!state.kanaTraceState) return;
    startKanaTraceQuiz(state.kanaTraceState.queue, state.kanaTraceState.mode, sourceType);
}
