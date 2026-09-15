/**
 * js/ui/dashboard.js
 * Écran d'accueil (série, objectif du jour, progression par niveau), écran "Niveaux",
 * détail de progression, et le sous-système "objectif quotidien + quota configurable"
 * dont dépend la carte de révision de l'accueil.
 *
 * Périmètre volontairement délimité (cf. HANDOFF.md, méthode point 6) : ce fichier NE
 * contient PAS le détail du sous-système de faiblesse lui-même (resolveWeaknessEntry,
 * openWeaknessItem, trainWeaknessItems — vivent dans learning/weakness.js, importé ici
 * seulement pour renderWeaknessWidget) ni les statistiques d'entraînement libre
 * (TRAINING_STATS_KEY et consorts — features/free-training.js), bien que ces blocs soient
 * physiquement entremêlés avec le code ci-dessous dans le monolithe (même région du
 * fichier).
 *
 * ⚠️ IMPORTANT POUR LA SUITE — vérifié programmatiquement avant d'écrire ce fichier :
 * ce fichier importe features/kanji.js (pour getKanjiMastery), qui importe lui-même
 * core/navigation.js (pour pushModalState). Conséquence : si core/navigation.js importait
 * un jour QUOI QUE CE SOIT depuis ui/dashboard.js en retour (ce qui semblerait pourtant
 * naturel pour résoudre ses landmines 'dashboard'/'niveaux'/'progression' du
 * SCREEN_REGISTRY), ce serait un cycle — `dashboard.js -> kanji.js -> navigation.js ->
 * dashboard.js`, confirmé par le script de détection avant d'écrire ce fichier. Ces
 * landmines de navigation.js resteront donc structurellement irrésolvables par import
 * direct, quelle que soit la façon dont ui/dashboard.js évolue — seule solution probable :
 * résolution via window.* exposé par app.js, comme les onclick (voir HANDOFF.md).
 */

import { state } from '../core/state.js';
import { getLevelKanjiChars, getLevelVocabGrammarStats } from '../core/data-loader.js';
import { getKanjiMastery } from '../features/kanji.js';
import { buildReviewQueue, getStats } from '../learning/srs.js';
import { renderWeaknessWidget } from '../learning/weakness.js';
import { showKanaLearningPicker } from '../features/kana.js';
import { backFAB, showBottomNav, hideBottomNav } from './common.js';

/* ══════════════════════════════════════════════════
   SÉRIE (STREAK) — jours d'activité consécutifs
══════════════════════════════════════════════════ */
const STREAK_KEY = 'kanji_trad_streak';

export function getStreakData() {
    const stored = localStorage.getItem(STREAK_KEY);
    return stored ? JSON.parse(stored) : { currentStreak: 0, bestStreak: 0, lastActiveDate: null, activityDates: [] };
}

export function saveStreakData(data) {
    localStorage.setItem(STREAK_KEY, JSON.stringify(data));
}

export function todayStr() {
    return new Date().toISOString().slice(0, 10);
}

export function daysBetween(dateStrA, dateStrB) {
    const a = new Date(dateStrA + 'T00:00:00');
    const b = new Date(dateStrB + 'T00:00:00');
    return Math.round((b - a) / 86400000);
}

// À appeler une fois par ouverture d'app : enregistre le jour comme actif et met à jour la série
export function recordDailyActivity() {
    const streak = getStreakData();
    const today = todayStr();

    if (streak.lastActiveDate === today) return streak; // déjà comptabilisé aujourd'hui

    if (streak.lastActiveDate) {
        const gap = daysBetween(streak.lastActiveDate, today);
        if (gap === 1) streak.currentStreak += 1;
        else if (gap > 1) streak.currentStreak = 1;
    } else {
        streak.currentStreak = 1;
    }

    streak.bestStreak = Math.max(streak.bestStreak, streak.currentStreak);
    streak.lastActiveDate = today;

    if (!streak.activityDates.includes(today)) {
        streak.activityDates.push(today);
        streak.activityDates = streak.activityDates.filter(d => daysBetween(d, today) <= 90);
    }

    saveStreakData(streak);
    return streak;
}

export function buildMonthCalendar(streak) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    let startOffset = firstDay.getDay() - 1; // 0=lundi...6=dimanche
    if (startOffset < 0) startOffset = 6;

    const dayLabels = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
    const headerHtml = dayLabels.map(d => `<div class="cal-day-label">${d}</div>`).join('');

    let cellsHtml = '';
    for (let i = 0; i < startOffset; i++) {
        cellsHtml += `<div class="cal-cell empty"></div>`;
    }
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isActive = streak.activityDates.includes(dateStr);
        const isToday = dateStr === todayStr();
        const cls = `cal-cell${isActive ? ' active' : ''}${isToday ? ' today' : ''}`;
        cellsHtml += `<div class="${cls}">${isActive ? '❀' : day}</div>`;
    }

    return `<div class="cal-grid">${headerHtml}${cellsHtml}</div>`;
}

export function buildWeekStreakHtml(streak) {
    const dayLabels = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
    const now = new Date();
    const dow = now.getDay(); // 0=dimanche...6=samedi
    const mondayOffset = (dow === 0) ? 6 : dow - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - mondayOffset);

    const cells = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        cells.push({
            label: dayLabels[i],
            active: streak.activityDates.includes(dateStr),
            today: dateStr === todayStr()
        });
    }

    const dots = cells.map(c => `<div class="streak-week-dot${c.active ? ' active' : ''}${c.today ? ' today' : ''}">❀</div>`).join('');
    const labels = cells.map(c => `<span${c.today ? ' class="today"' : ''}>${c.label}</span>`).join('');

    return `<div class="streak-week-row">${dots}</div><div class="streak-week-labels">${labels}</div>`;
}

/* ══════════════════════════════════════════════════
   OBJECTIF QUOTIDIEN (niveaux JLPT + scripts kana inclus dans "Aujourd'hui")
══════════════════════════════════════════════════ */
const DAILY_GOAL_KEY      = 'kanji_trad_daily_goal';
const DAILY_GOAL_KANA_KEY = 'kanji_trad_daily_goal_kana';
const KANA_SCRIPT_LABELS  = { hira: 'Hiragana', kata: 'Katakana' };

// ALL_JLPT_LEVELS/ALL_KANA_SCRIPTS : équivalent au monolithe (déclarées ligne ~8694, mais
// DÉJÀ extraites vers core/constants.js par une session antérieure car réutilisées ailleurs
// — pas une redéclaration, une seule source de vérité dans le monolithe original, promue.
import { ALL_JLPT_LEVELS, ALL_KANA_SCRIPTS } from '../core/constants.js';

export function getDailyGoalLevels() {
    try {
        const stored = localStorage.getItem(DAILY_GOAL_KEY);
        if (!stored) return [...ALL_JLPT_LEVELS];
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) ? parsed : [...ALL_JLPT_LEVELS];
    } catch (e) {
        return [...ALL_JLPT_LEVELS];
    }
}

export function saveDailyGoalLevels(levels) {
    localStorage.setItem(DAILY_GOAL_KEY, JSON.stringify(levels));
}

// Contrairement aux niveaux JLPT, un tableau vide est une valeur légitime ici
// (l'utilisateur ne veut aucun kana dans "Aujourd'hui") — pas de fallback sur "tout"
// si une valeur a déjà été explicitement sauvegardée, même vide.
export function getDailyGoalKanaScripts() {
    try {
        const stored = localStorage.getItem(DAILY_GOAL_KANA_KEY);
        if (stored === null) return [...ALL_KANA_SCRIPTS];
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) ? parsed : [...ALL_KANA_SCRIPTS];
    } catch (e) {
        return [...ALL_KANA_SCRIPTS];
    }
}

export function saveDailyGoalKanaScripts(scripts) {
    localStorage.setItem(DAILY_GOAL_KANA_KEY, JSON.stringify(scripts));
}

export function renderDailyGoalModalContent() {
    const levelsContainer = document.getElementById('daily-goal-levels-list');
    const kanaContainer = document.getElementById('daily-goal-kana-list');
    if (!levelsContainer) return;

    const currentLevels = getDailyGoalLevels();
    const levels = state.jlptMapping
        ? Object.entries(state.jlptMapping.levels).sort((a, b) => a[1].order - b[1].order)
        : ALL_JLPT_LEVELS.map(id => [id, { label: id.toUpperCase(), label_full: '', color: '#00E5FF' }]);

    levelsContainer.innerHTML = levels.map(([levelId, levelData]) => `
        <label class="daily-goal-row">
            <input type="checkbox" class="daily-goal-checkbox" value="${levelId}"
                ${currentLevels.includes(levelId) ? 'checked' : ''}
                style="accent-color:${levelData.color || 'var(--accent)'}">
            <span class="daily-goal-row-label" style="color:${levelData.color || 'var(--text)'}">${levelData.label || levelId.toUpperCase()}</span>
            <span class="daily-goal-row-sub">${levelData.label_full || ''}</span>
        </label>
    `).join('');

    if (kanaContainer) {
        const currentKana = getDailyGoalKanaScripts();
        kanaContainer.innerHTML = ALL_KANA_SCRIPTS.map(script => `
            <label class="daily-goal-row">
                <input type="checkbox" class="daily-goal-kana-checkbox" value="${script}"
                    ${currentKana.includes(script) ? 'checked' : ''}
                    style="accent-color:#9D6EFF">
                <span class="daily-goal-row-label" style="color:#9D6EFF">${KANA_SCRIPT_LABELS[script]}</span>
            </label>
        `).join('');
    }
}

export function showDailyGoalModal() {
    renderDailyGoalModalContent();
    renderQuotaLevelOptions();
    const m = document.getElementById('daily-goal-modal');
    if (!m) return;
    m.classList.add('open');
    m.style.display = 'flex';
}

export function closeDailyGoalModal() {
    const m = document.getElementById('daily-goal-modal');
    if (!m) return;
    m.classList.remove('open');
    m.style.display = 'none';
}

export function saveDailyGoalFromModal() {
    const checkedLevels = [...document.querySelectorAll('.daily-goal-checkbox:checked')].map(el => el.value);
    const checkedKana = [...document.querySelectorAll('.daily-goal-kana-checkbox:checked')].map(el => el.value);
    if (checkedLevels.length === 0 && checkedKana.length === 0) {
        alert('Choisis au moins un niveau ou un script de kana.');
        return;
    }
    const quotaLevel = document.querySelector('input[name="quota-level"]:checked')?.value || 'normal';

    saveDailyGoalLevels(checkedLevels);
    saveDailyGoalKanaScripts(checkedKana);
    saveQuotaLevel(quotaLevel);
    closeDailyGoalModal();
    const goalSubEl = document.getElementById('dashboard-goal-sub');
    if (goalSubEl) goalSubEl.textContent = 'Règle ton niveau de carte';
    renderDashboardReviewCta(); // recalcule le compte de révisions du jour avec le nouvel objectif
}

/* ══════════════════════════════════════════════════
   QUOTA CONFIGURABLE + QUOTA JOURNALIER
   ─────────────────────────────────────────────────
   Deux mécanismes distincts qui se combinent uniquement sur l'accueil ("Aujourd'hui") :
   - Le NIVEAU choisi (Léger/Normal/Intense) fixe la base — pour Accueil ET Apprendre.
   - Le quota JOURNALIER ne s'applique qu'à l'Accueil : au-delà de la base choisie, plus
     aucune nouvelle carte n'est proposée par ce bouton avant le lendemain.
══════════════════════════════════════════════════ */
const QUOTA_LEVEL_KEY = 'kanji_trad_quota_level';
const QUOTA_LEVELS = {
    relax:   { accueil: 3,  apprendre: 6,  label: '🐢 Léger'   },
    normal:  { accueil: 20, apprendre: 10, label: '📘 Normal'  },
    intense: { accueil: 30, apprendre: 20, label: '🚀 Intense' }
};

export function getQuotaLevel() {
    const stored = localStorage.getItem(QUOTA_LEVEL_KEY);
    return (stored && QUOTA_LEVELS[stored]) ? stored : 'normal';
}
export function saveQuotaLevel(level) {
    if (QUOTA_LEVELS[level]) localStorage.setItem(QUOTA_LEVEL_KEY, level);
}

const DAILY_NEW_USAGE_KEY = 'kanji_trad_daily_new_usage';

// Nombre de nouvelles cartes déjà proposées AUJOURD'HUI via le bouton Accueil (remis à zéro
// silencieusement dès que la date change, pas besoin de job de nettoyage).
export function getDailyNewCardsUsedToday() {
    const stored = localStorage.getItem(DAILY_NEW_USAGE_KEY);
    if (!stored) return 0;
    try {
        const parsed = JSON.parse(stored);
        return parsed.date === todayStr() ? (parsed.count || 0) : 0;
    } catch (e) {
        return 0;
    }
}
export function addDailyNewCardsUsed(n) {
    if (n <= 0) return;
    const current = getDailyNewCardsUsedToday();
    localStorage.setItem(DAILY_NEW_USAGE_KEY, JSON.stringify({ date: todayStr(), count: current + n }));
}

// Quota effectif restant pour l'accueil aujourd'hui = base choisie moins ce qui a déjà été
// consommé depuis minuit, jamais négatif.
export function getAccueilEffectiveNewLimit() {
    const base = QUOTA_LEVELS[getQuotaLevel()].accueil;
    const used = getDailyNewCardsUsedToday();
    return Math.max(0, base - used);
}

export function renderQuotaLevelOptions() {
    const container = document.getElementById('quota-level-options');
    if (!container) return;
    const current = getQuotaLevel();
    container.innerHTML = Object.entries(QUOTA_LEVELS).map(([id, def]) => `
        <label class="ft-radio-pill">
            <input type="radio" name="quota-level" value="${id}" ${id === current ? 'checked' : ''}>
            <span>${def.label}</span>
        </label>
    `).join('');
}

/* ══════════════════════════════════════════════════
   CARTE DE RÉVISION DE L'ACCUEIL
══════════════════════════════════════════════════ */
export async function getDashboardDueCount() {
    const queue = await buildReviewQueue({ types: ['vocab', 'grammar', 'kanji'], levels: getDailyGoalLevels(), newLimit: getAccueilEffectiveNewLimit(), excludeMastered: true, includeKana: true, kanaScripts: getDailyGoalKanaScripts() });
    const newTotal = queue.filter(e => e.isNew).length;
    const dueTotal = queue.length - newTotal;
    return { total: queue.length, dueTotal, newTotal };
}

// Construit les petits badges colorés (niveau JLPT + scripts kana) reflétant l'objectif
// actuellement choisi — remplace le simple chevron "→" pour donner un aperçu direct.
export function buildGoalBadgesHtml() {
    const items = [];
    getDailyGoalLevels().forEach(l => {
        items.push({
            label: state.jlptMapping?.levels?.[l]?.label || l.toUpperCase(),
            color: state.jlptMapping?.levels?.[l]?.color || 'var(--accent)'
        });
    });
    getDailyGoalKanaScripts().forEach(k => {
        items.push({ label: KANA_SCRIPT_LABELS[k] || k, color: '#9D6EFF' });
    });
    if (items.length === 0) return `<span class="dash-goal-chevron">→</span>`;

    const shown = items.slice(0, 2);
    const overflow = items.length - shown.length;
    const badges = shown.map(it =>
        `<span class="dash-goal-badge" style="background:${it.color}22;color:${it.color};border:1px solid ${it.color}44">${it.label}</span>`
    ).join('');
    const overflowBadge = overflow > 0
        ? `<span class="dash-goal-badge" style="background:rgba(255,255,255,0.08);color:var(--gray)">+${overflow}</span>`
        : '';
    return badges + overflowBadge;
}

export async function renderDashboardReviewCta() {
    const el = document.getElementById('dashboard-review-cta');
    if (!el) return;

    const { total, dueTotal, newTotal } = await getDashboardDueCount();
    const goalRow = `
        <div class="dash-goal-row" onclick="showDailyGoalModal()">
            <span class="dash-goal-icon">⚙</span>
            <span class="dash-goal-text" id="dashboard-goal-sub">Règle ton niveau de carte</span>
            <span class="dash-goal-badges" id="dashboard-goal-badges">${buildGoalBadgesHtml()}</span>
        </div>
    `;

    if (total === 0) {
        el.innerHTML = `${goalRow}<div class="review-cta-empty">🎉 Rien à réviser aujourd'hui !</div>`;
        return;
    }

    el.innerHTML = `
        ${goalRow}
        <div class="review-cta-label">CARTES DU JOUR À RÉVISER</div>
        <div class="review-cta-split">
            <div class="review-cta-split-box">
                <div class="review-cta-split-num">${newTotal}</div>
                <div class="review-cta-split-label">Nouvelles</div>
            </div>
            <div class="review-cta-split-box">
                <div class="review-cta-split-num">${dueTotal}</div>
                <div class="review-cta-split-label">À réviser</div>
            </div>
        </div>
        <button class="review-cta-btn" onclick="startDashboardReview()">Commencer · ${total} Cartes →</button>
    `;
}

/**
 * Lance directement depuis l'accueil la MÊME file que celle annoncée par le bouton.
 * ⚠️ ATTENTION : launchMixedReviewSession n'appartient à aucun module actuellement porté
 * (système de session de révision mixte, probablement partagé avec l'écran "Apprendre" —
 * à localiser précisément lors d'un futur chantier). Vrai appel JS non importé.
 */
export async function startDashboardReview() {
    const queue = await buildReviewQueue({ types: ['vocab', 'grammar', 'kanji'], levels: getDailyGoalLevels(), newLimit: getAccueilEffectiveNewLimit(), excludeMastered: true, includeKana: true, kanaScripts: getDailyGoalKanaScripts() });
    launchMixedReviewSession(queue, 'mixed-review-dashboard', true);
}

/* ══════════════════════════════════════════════════
   ÉCRAN D'ACCUEIL
══════════════════════════════════════════════════ */

/**
 * Équivalent EXACT de showDashboard(isBack) du monolithe.
 */
export function showDashboard(isBack = false) {
    if (!isBack) history.pushState({ view: 'dashboard' }, '');
    showBottomNav();

    const streak = getStreakData();

    const hour = new Date().getHours();
    const greeting = hour < 5 ? 'Bonne nuit' : hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';

    document.getElementById('main-content').innerHTML = `
        <div class="dash-wrap">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
                <img src="https://api.dicebear.com/7.x/bottts/svg?seed=tanuki" class="tanuki-img" alt="">
                <div style="font-size:0.8125rem;line-height:1.6;flex:1;">
                    ${greeting} ! <br>Prêt pour tes révisions ?
                </div>
            </div>
            <div class="dash-card dash-review-cta" id="dashboard-review-cta">
                <div style="color:var(--gray);font-size:0.75rem">Chargement des révisions…</div>
            </div>
            <div class="dash-card streak-week-card" onclick="showProgressionDetail()">
                <div class="streak-week-header">
                    <div class="streak-week-icon-box">続</div>
                    <div class="streak-week-title-block">
                        <div class="streak-week-label">Série en cours</div>
                        <div class="streak-week-num">${streak.currentStreak} jour${streak.currentStreak > 1 ? 's' : ''}</div>
                    </div>
                    <div class="streak-week-record">Record<br>${streak.bestStreak}j</div>
                </div>
                ${buildWeekStreakHtml(streak)}
            </div>
            <div class="dash-card weakness-widget" id="dashboard-weakness-widget" style="display:none;"></div>
            <div class="dash-card dash-mastery-card">
                <div class="section-title" style="font-size:0.6875rem;color:var(--text);text-transform:uppercase;letter-spacing:1px;margin-bottom:14px;">Progression</div>
                <div id="progression-list"></div>
            </div>
        </div>`;
    if (typeof renderDashboard === 'function') renderDashboard();
    renderWeaknessWidget();
    renderDashboardReviewCta();
}

/**
 * Équivalent EXACT de navDashboard() du monolithe.
 * ⚠️ ATTENTION : setActiveBottomNav existe dans ce même fichier (voir plus bas) — appel
 * interne normal, pas une landmine.
 */
export function navDashboard() {
    document.getElementById('page-title').innerText = '漢字 Study';
    showDashboard();
    renderDashboard();
    setActiveBottomNav('accueil');
}

// ⚠️ ATTENTION : loadKanas (features/kana.js) — vérifié programmatiquement : SANS risque de
// cycle dans l'état actuel du graphe, mais laissé en landmine par prudence structurelle (voir
// avertissement en en-tête de fichier : dashboard.js importe déjà kanji.js, qui importe
// navigation.js — si navigation.js importait un jour dashboard.js en retour, même en passant
// par kanji.js plutôt que par kana.js, ce serait un cycle. Autant ne jamais ajouter de lien
// dashboard.js -> kana.js non plus, par cohérence, même si celui-là seul ne cycle pas encore).
export function navKana() { showKanaLearningPicker(); }
// ⚠️ ATTENTION : showNiveauxScreen existe dans ce même fichier (voir plus bas) — appel
// interne normal, pas une landmine à proprement parler, juste noté pour cohérence.
export function navNiveaux() { showNiveauxScreen(); }

/* ══════════════════════════════════════════════════
   ÉCRAN "NIVEAUX" — cartes pleine largeur avec vraie progression
══════════════════════════════════════════════════ */

/**
 * Équivalent EXACT de showNiveauxScreen(isBack) du monolithe.
 * ⚠️ ATTENTION : showCategoryDirect (routeur cross-feature, hors périmètre de tout
 * fichier actuel — même landmine que dans core/navigation.js).
 */
export async function showNiveauxScreen(isBack = false) {
    if (!isBack) history.pushState({ view: 'niveaux' }, '');
    hideBottomNav();
    const mainContent = document.getElementById('main-content');
    document.getElementById('page-title').innerText = 'Niveaux';

    if (!state.jlptMapping) {
        mainContent.innerHTML = '<div style="padding:20px;color:var(--gray)">Chargement des niveaux…</div>';
        return;
    }

    mainContent.innerHTML = `${backFAB()}
        <div class="niveaux-wrap">
            <div class="niveaux-header">
                <div class="niveaux-title-main">Niveaux</div>
                <div class="niveaux-subtitle-main">Ton vocabulaire par niveau JLPT.</div>
            </div>
            <div id="niveaux-list">
                <div style="padding:20px;text-align:center;color:var(--gray)"><div class="spinner"></div></div>
            </div>
        </div>`;

    const listEl = document.getElementById('niveaux-list');
    const sortedLevels = Object.entries(state.jlptMapping.levels).sort((a, b) => a[1].order - b[1].order);

    const cardsHtml = await Promise.all(sortedLevels.map(async ([levelId, levelData]) => {
        const vg = await getLevelVocabGrammarStats(levelId);
        const hasData = vg.vocabTotal > 0;
        const pct = hasData ? Math.round((vg.vocabMastered / vg.vocabTotal) * 100) : 0;

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
            <div class="niveaux-card" style="border-color:${levelData.color}99; box-shadow:0 0 18px ${levelData.color}59; background:${levelData.color}1f;" onclick="showCategoryDirect('${levelId}','vocab')">
                <div class="niveaux-badge" style="background:${levelData.color}22;color:${levelData.color};border:1px solid ${levelData.color}44">${levelData.label}</div>
                <div class="niveaux-info">
                    <div class="niveaux-card-title">${levelData.label_full}</div>
                    <div class="niveaux-card-sub">${vg.vocabMastered} / ${vg.vocabTotal} mots</div>
                    <div class="niveaux-progress-bar"><div class="niveaux-progress-fill" style="width:${pct}%;background:${levelData.color}"></div></div>
                    ${buildNiveauxWaveSvg(levelData.color)}
                </div>
                <div class="niveaux-pct">${pct}%</div>
            </div>`;
    }));

    listEl.innerHTML = cardsHtml.join('');
}

export function buildNiveauxWaveSvg(color) {
    return `<svg class="niveaux-wave" viewBox="0 0 160 32" preserveAspectRatio="none">
        <path d="M0,24 Q20,8 40,20 T80,10 T120,18 T158,14" fill="none" stroke="${color}" stroke-width="2" opacity="0.55"/>
        <circle cx="158" cy="14" r="3.5" fill="${color}" style="filter:drop-shadow(0 0 6px ${color})"/>
    </svg>`;
}

/* ══════════════════════════════════════════════════
   BARRE DE NAVIGATION EN BAS (façon Hibi)
══════════════════════════════════════════════════ */
export function setActiveBottomNav(key) {
    ['accueil', 'recherche', 'apprendre', 'revisions'].forEach(k => {
        const btn = document.getElementById(`bnav-${k}`);
        if (btn) btn.classList.toggle('active', k === key);
    });
}

/* ══════════════════════════════════════════════════
   DÉTAIL DE PROGRESSION
══════════════════════════════════════════════════ */

/**
 * Équivalent EXACT de showProgressionDetail(isBack) du monolithe.
 */
export async function showProgressionDetail(isBack = false) {
    if (!isBack) history.pushState({ view: 'progression' }, '');
    hideBottomNav();
    const streak = getStreakData();
    const stats = getStats();

    const levels = ['n5', 'n4', 'n3', 'n2', 'n1'];
    let vocabTotal = 0, vocabMastered = 0;
    for (const lvl of levels) {
        const vg = await getLevelVocabGrammarStats(lvl);
        vocabTotal += vg.vocabTotal;
        vocabMastered += vg.vocabMastered;
    }

    const successPct = stats.totalReviews > 0 ? Math.round((stats.successCount / stats.totalReviews) * 100) : 0;
    const currentMonthKey = new Date().toISOString().slice(0, 7);
    const monthCount = stats.monthKey === currentMonthKey ? stats.monthCount : 0;

    document.getElementById('main-content').innerHTML = `${backFAB('history.back()')}
        <div class="progression-page">
            <div class="progression-title">Ta progression</div>
            <div class="progression-subtitle">${stats.sessionsCount} session${stats.sessionsCount > 1 ? 's' : ''} · ${streak.currentStreak} jour${streak.currentStreak > 1 ? 's' : ''} d'affilée</div>

            <div class="streak-detail-card">
                <div class="streak-detail-header">
                    <div><div class="streak-detail-num">${streak.currentStreak}</div><div class="streak-detail-label">Série actuelle</div></div>
                    <div><div class="streak-detail-num">${streak.bestStreak}</div><div class="streak-detail-label">Record</div></div>
                </div>
                ${buildMonthCalendar(streak)}
            </div>

            <div class="progression-stats-grid">
                <div class="progression-stat-card"><div class="progression-stat-num">${successPct}%</div><div class="progression-stat-label">Taux de réussite</div></div>
                <div class="progression-stat-card"><div class="progression-stat-num">${monthCount}</div><div class="progression-stat-label">Cartes ce mois-ci</div></div>
                <div class="progression-stat-card"><div class="progression-stat-num">${vocabMastered} / ${vocabTotal}</div><div class="progression-stat-label">Mots maîtrisés</div></div>
            </div>
        </div>`;
}

function buildProgRow(label, done, total, icon) {
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return `
        <div class="prog-card-item">
            <div class="prog-circle-badge" style="--pct:${pct}"><span>${pct}%</span></div>
            <div class="prog-card-info">
                <div class="prog-card-label">${icon ? icon + ' ' : ''}${label}</div>
                <div class="prog-card-stats">${done} / ${total}</div>
            </div>
        </div>
    `;
}

/**
 * Équivalent EXACT de renderDashboard() du monolithe — remplit #progression-list.
 */
export async function renderDashboard() {
    const container = document.getElementById('progression-list');
    if (!container) {
        console.warn("Conteneur 'progression-list' non trouvé dans le DOM.");
        return;
    }

    container.innerHTML = '<div style="color:var(--gray);font-size:0.75rem;padding:8px 0">Chargement des statistiques…</div>';

    const jlptLevels = [
        { jlpt: 5, id: 'n5', label: 'N5 - Débutant' },
        { jlpt: 4, id: 'n4', label: 'N4 - Élémentaire' },
        { jlpt: 3, id: 'n3', label: 'N3 - Intermédiaire' },
        { jlpt: 2, id: 'n2', label: 'N2 - Avancé' },
        { jlpt: 1, id: 'n1', label: 'N1 - Expert' }
    ];

    const rowsHtml = await Promise.all(jlptLevels.map(async levelDef => {
        const chars = await getLevelKanjiChars(levelDef.id) || [];
        const totalKanji = chars.length;
        const totalMastery = chars.reduce((sum, c) => sum + getKanjiMastery(c), 0);
        const avgMastery = totalKanji > 0 ? Math.round(totalMastery / totalKanji) : 0;
        const practicedKanji = chars.filter(c => {
            return localStorage.getItem(`quiz_${c}`) || localStorage.getItem(`trace_${c}`);
        }).length;

        const vg = await getLevelVocabGrammarStats(levelDef.id);

        const kanjiSubRow = buildProgRow('Kanji', practicedKanji, totalKanji, '🔤');
        const vocabSubRow = vg.vocabTotal > 0 ? buildProgRow('Vocabulaire', vg.vocabMastered, vg.vocabTotal, '📚') : '';
        const grammarSubRow = vg.grammarTotal > 0 ? buildProgRow('Grammaire', vg.grammarMastered, vg.grammarTotal, '📝') : '';

        const parts = [avgMastery];
        if (vg.vocabTotal > 0) parts.push(Math.round((vg.vocabMastered / vg.vocabTotal) * 100));
        if (vg.grammarTotal > 0) parts.push(Math.round((vg.grammarMastered / vg.grammarTotal) * 100));
        const globalPct = Math.round(parts.reduce((a, b) => a + b, 0) / parts.length);

        const levelKey = `lvl-${levelDef.id}`;
        const levelColor = state.jlptMapping?.levels?.[levelDef.id]?.color || 'var(--accent)';
        return `
            <div class="prog-level-card" style="border-color:${levelColor}55; box-shadow:0 0 16px ${levelColor}22; background:${levelColor}1f;">
                <div class="prog-level-header" onclick="document.getElementById('${levelKey}').classList.toggle('open'); this.querySelector('.prog-level-arrow').classList.toggle('open')">
                    <span class="prog-level-arrow">▶</span>
                    <div class="prog-level-circle" style="--pct:${globalPct}; --ring-color:${levelColor}"><span>${globalPct}%</span></div>
                    <span class="prog-level-title">${levelDef.label}</span>
                </div>
                <div class="prog-level-items" id="${levelKey}">
                    ${kanjiSubRow}${vocabSubRow}${grammarSubRow}
                </div>
            </div>
        `;
    }));

    container.innerHTML = rowsHtml.join('');
}
