/**
 * js/learning/srs.js
 * Système SRS (SM-2 allégé) — reproduit fonction par fonction les sections
 * "SRS (Spaced Repetition System)", "STATS PERSISTANTES" et "buildReviewQueue() —
 * constructeur de file CENTRALISÉ" du monolithe kanji.js.
 *
 * Contient : getSrsInfo/saveSrsInfo/gradeReview, les stats persistantes, les deux
 * constructeurs de file (buildDueQueue "par type×niveau" ET buildReviewQueue "quota global"
 * — les deux coexistent, comportement volontairement inchangé), ainsi que les utilitaires
 * partagés getEntryTrackingId/shuffleArray (pas de module utils.js dédié dans l'architecture
 * cible : les futures features doivent les importer d'ici plutôt qu'en recréer une copie).
 */

import { getTrackingData, saveTrackingData, getStorageItem, setStorageItem, getItemStatus, getWeaknessData } from '../core/storage.js';
import { getLevelVocabData, getLevelGrammarData, getLevelKanjiChars, getKanaFlatList } from '../core/data-loader.js';
import { updateWeaknessTracking } from './weakness.js';

// Nombre max de nouvelles cartes introduites par session de révision (par combinaison
// type×niveau pour buildDueQueue — countDueItems en dépend directement).
export const SRS_NEW_PER_SESSION = 10;

/* ══════════════════════════════════════════════════
   SRS CORE — lecture/écriture de l'entrée .srs partagée
   avec le tracking (même objet que trackItem(), voir core/storage.js)
══════════════════════════════════════════════════ */

export function getSrsInfo(itemId) {
    return getTrackingData()[itemId]?.srs || null;
}

export function saveSrsInfo(itemId, srsData) {
    const tracking = getTrackingData();
    if (!tracking[itemId]) tracking[itemId] = {};
    tracking[itemId].srs = srsData;
    saveTrackingData(tracking);
}

/**
 * Équivalent EXACT de gradeReview(itemId, quality, meta) du monolithe.
 * quality : 0 = Encore (échec), 1 = Difficile, 2 = Bien, 3 = Facile.
 * meta (optionnel) : { type, label } — transmis tel quel à updateWeaknessTracking, n'affecte
 * jamais le calcul SRS lui-même.
 */
export function gradeReview(itemId, quality, meta = null) {
    const now = new Date();
    const existing = getSrsInfo(itemId) || { interval: 0, easeFactor: 2.5, repetitions: 0 };
    let { interval, easeFactor, repetitions } = existing;

    if (quality === 0) {
        // Échec : on repart de zéro, ease pénalisée, révision dès demain
        repetitions = 0;
        interval = 1;
        easeFactor = Math.max(1.3, easeFactor - 0.2);
    } else {
        repetitions += 1;
        if (quality === 1) { // Difficile
            interval = repetitions === 1 ? 1 : Math.round(interval * 1.2);
            easeFactor = Math.max(1.3, easeFactor - 0.15);
        } else if (quality === 2) { // Bien
            interval = repetitions === 1 ? 1 : (repetitions === 2 ? 3 : Math.round(interval * easeFactor));
        } else { // Facile
            interval = repetitions === 1 ? 2 : (repetitions === 2 ? 4 : Math.round(interval * easeFactor * 1.3));
            easeFactor += 0.15;
        }
    }

    const nextReviewDate = new Date(now);
    nextReviewDate.setDate(nextReviewDate.getDate() + interval);

    const srsData = {
        interval, easeFactor, repetitions,
        lastReviewDate: now.toISOString(),
        nextReviewDate: nextReviewDate.toISOString()
    };
    saveSrsInfo(itemId, srsData);
    recordReviewEvent(quality);
    updateWeaknessTracking(itemId, quality, meta);
    return srsData;
}

/* ══════════════════════════════════════════════════
   STATS PERSISTANTES (réussite globale, sessions, cartes du mois)
   Alimentées automatiquement à chaque gradeReview(), peu importe le type
   (vocab/grammaire/kanji/mixte). Regroupées ici (plutôt qu'un module séparé non
   prévu dans l'architecture cible) car gradeReview() appelle recordReviewEvent()
   directement à chaque notation — les séparer romprait ce lien sans bénéfice clair.
══════════════════════════════════════════════════ */
const STATS_KEY = 'kanji_trad_stats';

export function getStats() {
    return getStorageItem(STATS_KEY, { totalReviews: 0, successCount: 0, sessionsCount: 0, monthKey: null, monthCount: 0 });
}

export function saveStats(s) {
    setStorageItem(STATS_KEY, s);
}

export function recordReviewEvent(quality) {
    const s = getStats();
    s.totalReviews++;
    if (quality >= 2) s.successCount++; // Bien ou Facile = réussite

    const currentMonthKey = new Date().toISOString().slice(0, 7);
    if (s.monthKey !== currentMonthKey) { s.monthKey = currentMonthKey; s.monthCount = 0; }
    s.monthCount++;

    saveStats(s);
}

export function recordSessionCompleted() {
    const s = getStats();
    s.sessionsCount++;
    saveStats(s);
}

// Point #6 V2 — Relearning intra-session : une carte ratée ("Encore") réapparaît quelques
// questions plus tard dans LA MÊME session, en plus (pas à la place) de sa reprogrammation
// SRS normale via gradeReview(). Générique, utilisée par toutes les sessions de révision
// (kanji, vocab, grammaire, kana, mixte).
export function scheduleRelearning(session, entry) {
    if (!session || !session.queue) return;
    const gap = 3 + Math.floor(Math.random() * 4); // réapparaît 3 à 6 questions plus tard
    const insertAt = Math.min(session.index + 1 + gap, session.queue.length);
    session.queue.splice(insertAt, 0, entry);
}

/* ══════════════════════════════════════════════════
   FILES DE RÉVISION "PAR TYPE×NIVEAU" (buildDueQueue et dérivées)
   ─────────────────────────────────────────────────
   Distinct de buildReviewQueue() (non porté ici, voir en-tête du fichier) : ici le quota
   SRS_NEW_PER_SESSION est appliqué PAR appel (donc par combinaison type×niveau côté appelant),
   comportement volontairement inchangé — utilisé par la révision ciblée de l'onglet "Réviser".
══════════════════════════════════════════════════ */

export function buildDueQueue(items) {
    const now = new Date();
    const due = [];
    const fresh = [];

    items.forEach(item => {
        const srs = getSrsInfo(item.id);
        if (!srs) {
            fresh.push(item);
        } else if (new Date(srs.nextReviewDate) <= now) {
            due.push(item);
        }
    });

    return [...due, ...fresh.slice(0, SRS_NEW_PER_SESSION)];
}

export function countDueItems(items) {
    return buildDueQueue(items).length;
}

// Comme buildDueQueue, mais retourne le détail due/nouveaux séparément (affichage à la Hibi)
// Nombre de jours de retard d'un item par rapport à son échéance SRS (0 si pas encore dû ou
// pas de planning du tout — les nouvelles cartes n'ont pas de "retard").
export function getDaysOverdue(itemId) {
    const srs = getSrsInfo(itemId);
    if (!srs) return 0;
    return (Date.now() - new Date(srs.nextReviewDate).getTime()) / 86400000;
}

// Score approximatif 0-100 dérivé du SRS (répétitions + facilité), affichage visuel uniquement.
// Ce n'est PAS un vrai score de rétention scientifique, juste une approximation cohérente.
export function getSrsConfidencePct(itemId) {
    const srs = getSrsInfo(itemId);
    if (!srs) return null; // jamais révisé
    const repScore = Math.min(srs.repetitions * 15, 70);
    const easeScore = Math.min(Math.max((srs.easeFactor - 1.3) / (2.5 - 1.3), 0), 1) * 30;
    return Math.min(100, Math.round(repScore + easeScore));
}

/* ══════════════════════════════════════════════════
   buildReviewQueue() — constructeur de file CENTRALISÉ
   ─────────────────────────────────────────────────
   Contrairement à buildDueQueue() (limite "10 nouvelles" appliquée PAR combinaison
   type×niveau, utilisée par la révision ciblée de l'onglet "Réviser" — comportement
   volontairement inchangé), cette fonction applique un quota de nouvelles cartes GLOBAL sur
   toute la session, réparti en tour de rôle entre les combinaisons sélectionnées. Utilisée
   pour les sessions qui mélangent plusieurs types/niveaux (bouton "Aujourd'hui" de l'accueil,
   onglet "Apprendre"). Ne modifie ni ne remplace buildDueQueue() : les deux coexistent.
══════════════════════════════════════════════════ */

// Récupère les items bruts (forme attendue par buildDueQueue : au moins un champ .id) pour un
// type de contenu et un niveau JLPT donnés. Kana volontairement absent d'ici (traité à part
// dans buildReviewQueue via includeKana, comme dans le monolithe).
export async function getRawItemsForTypeLevel(type, level) {
    if (type === 'vocab') {
        const vd = await getLevelVocabData(level);
        return (vd && vd.data) ? vd.data : [];
    }
    if (type === 'grammar') {
        const gd = await getLevelGrammarData(level);
        return (gd && gd.data) ? gd.data : [];
    }
    if (type === 'kanji') {
        const chars = await getLevelKanjiChars(level);
        return chars ? chars.map(c => ({ id: c })) : [];
    }
    return [];
}

// Répartit un quota de nouvelles cartes en tour de rôle entre plusieurs pools
// (buckets = [{ key, pool: [...] }]) — pure, sans effet de bord.
export function distributeNewQuota(buckets, quota) {
    const picked = [];
    const pools = buckets.map(b => ({ key: b.key, pool: [...b.pool] }));
    let remaining = quota;
    while (remaining > 0 && pools.some(p => p.pool.length)) {
        for (const p of pools) {
            if (remaining <= 0) break;
            if (p.pool.length) {
                picked.push({ key: p.key, item: p.pool.shift() });
                remaining--;
            }
        }
    }
    return picked;
}

// Reconstruit la forme d'entrée de file attendue par les écrans de révision mixte
// ({ type, item }) — le kanji est normalisé en { char }, comme le fait getMixedDueQueue().
export function makeQueueEntry(type, level, rawItem, isNew) {
    if (type === 'kanji') return { type, level, item: { char: rawItem.id }, isNew };
    return { type, level, item: rawItem, isNew };
}

// Sépare due/fresh SANS plafonner les nouvelles (le plafonnement se fait globalement plus
// loin dans buildReviewQueue, contrairement à buildDueQueue qui plafonne ici même).
export function splitDueAndFreshRaw(items) {
    const now = new Date();
    const due = [];
    const fresh = [];
    items.forEach(item => {
        const srs = getSrsInfo(item.id);
        if (!srs) fresh.push(item);
        else if (new Date(srs.nextReviewDate) <= now) due.push(item);
    });
    return { due, fresh };
}

/**
 * buildReviewQueue({ types, levels, includeDue, newLimit, excludeMastered, includeKana, kanaScripts })
 * - types   : sous-ensemble de ['vocab','grammar','kanji']
 * - levels  : sous-ensemble de ['n5','n4','n3','n2','n1']
 * - includeDue : si false, ignore les cartes dues (par défaut true — jamais plafonnées)
 * - newLimit : nombre MAXIMUM de nouvelles cartes pour TOUTE la session, réparties en tour de
 *   rôle — le kana y participe comme une combinaison de plus (pas de quota séparé)
 * - excludeMastered : si true, retire les items marqués "mastered" du pool des NOUVELLES
 *   cartes uniquement — jamais des cartes dues (le SRS reste seul juge de ce qui est "dû")
 * - includeKana : si true, ajoute le kana à la file (par défaut false)
 * - kanaScripts : sous-ensemble de ['hira','kata'], ignoré si includeKana=false
 * Retourne un tableau mélangé (par priorité) de { type, level, item, isNew }.
 */
export async function buildReviewQueue({
    types = ['vocab', 'grammar', 'kanji'],
    levels = ['n5', 'n4', 'n3', 'n2', 'n1'],
    includeDue = true,
    newLimit = SRS_NEW_PER_SESSION,
    excludeMastered = false,
    includeKana = false,
    kanaScripts = ['hira', 'kata']
} = {}) {
    const buckets = [];

    for (const level of levels) {
        for (const type of types) {
            const items = await getRawItemsForTypeLevel(type, level);
            if (!items.length) continue;
            let { due, fresh } = splitDueAndFreshRaw(items);
            if (excludeMastered) {
                fresh = fresh.filter(it => getItemStatus(it.id) !== 'mastered');
            }
            if (due.length || fresh.length) buckets.push({ type, level, due, fresh });
        }
    }

    // Kana : axe "script" (hiragana/katakana) plutôt que niveau JLPT, donc traité à part.
    if (includeKana) {
        for (const script of kanaScripts) {
            const items = getKanaFlatList(script);
            if (!items.length) continue;
            let { due, fresh } = splitDueAndFreshRaw(items);
            if (excludeMastered) {
                fresh = fresh.filter(it => getItemStatus(it.id) !== 'mastered');
            }
            if (due.length || fresh.length) buckets.push({ type: 'kana', level: script, due, fresh });
        }
    }

    const queue = [];

    if (includeDue) {
        buckets.forEach(b => b.due.forEach(rawItem => queue.push(makeQueueEntry(b.type, b.level, rawItem, false))));
    }

    const freshBuckets = buckets.filter(b => b.fresh.length).map(b => ({ key: `${b.type}_${b.level}`, pool: b.fresh }));
    const freshBucketMeta = {};
    buckets.forEach(b => { freshBucketMeta[`${b.type}_${b.level}`] = { type: b.type, level: b.level }; });

    distributeNewQuota(freshBuckets, newLimit).forEach(({ key, item }) => {
        const meta = freshBucketMeta[key];
        queue.push(makeQueueEntry(meta.type, meta.level, item, true));
    });

    return prioritizeQueue(queue);
}

/* ══════════════════════════════════════════════════
   PRIORISATION DE LA FILE — dues urgentes > dues normales > nouvelles difficiles > nouvelles normales
══════════════════════════════════════════════════ */
export const URGENT_OVERDUE_DAYS = 2;

// Id de tracking d'une entrée { type, item } — même convention que trackItem/gradeReview
// (kanji : le caractère lui-même ; les autres : item.id déjà au bon format). Utilitaire
// partagé : les futures features (révision mixte, entraînement libre) doivent l'importer
// d'ici plutôt qu'en recréer une copie, pour n'avoir qu'une seule définition dans l'app.
export function getEntryTrackingId(entry) {
    return entry.type === 'kanji' ? entry.item.char : entry.item.id;
}

// Palier de priorité d'une entrée { type, level, item, isNew } :
//   0 = due urgente (retard >= URGENT_OVERDUE_DAYS jours) — le plus grand risque d'oubli
//   1 = due normale (due mais pas encore très en retard)
//   2 = nouvelle "difficile" (jamais vue, mais déjà présente dans le tracker de faiblesse)
//   3 = nouvelle normale
export function computeQueuePriorityTier(entry) {
    const id = getEntryTrackingId(entry);
    if (!entry.isNew) {
        return getDaysOverdue(id) >= URGENT_OVERDUE_DAYS ? 0 : 1;
    }
    return getWeaknessData()[id] ? 2 : 3;
}

// Fisher-Yates — utilitaire partagé (voir remarque sur getEntryTrackingId ci-dessus : une
// seule définition, les autres modules doivent l'importer d'ici).
export function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// Mélange aléatoire appliqué uniquement À L'INTÉRIEUR de chaque palier de priorité — pas de
// monotonie (jamais "tout le vocab avant tout le kanji"), tout en respectant la priorité
// globale entre paliers.
export function prioritizeQueue(queue) {
    const tiers = [[], [], [], []];
    queue.forEach(entry => tiers[computeQueuePriorityTier(entry)].push(entry));
    return tiers.flatMap(tier => shuffleArray(tier));
}
