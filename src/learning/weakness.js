// Ocha v2 — Faiblesses
//
// Partie 3, 3.5. Une faiblesse est un signal attaché à un élément, indépendant de son état
// (partie 1, 1.4). Fonctions PURES : elles reçoivent l'entrée de faiblesse et la date, et
// renvoient la nouvelle entrée. Quand une réponse compte comme échec ou comme réussite
// (QUESTION_ANSWERED, REVIEW_GRADED) est décidé par les effets d'événement (tâche 6), pas ici.
//
// Entrée de faiblesse (magasin `weaknesses`, partie 9, 9.2) :
//   consecutiveFails   échecs consécutifs
//   totalFails         échecs au total
//   successStreak      réussites d'affilée depuis le dernier échec
//   lastFailDate       date du dernier échec (ISO)
//   resolvedAt         date à laquelle la faiblesse est devenue inactive, ou null si active
// Les autres champs de l'entrée (sa clé, notamment) sont conservés tels quels.
//
// Ce qui change par rapport à l'ancien updateWeaknessTracking (3.5, « Demain ») :
//   - une réussite ne supprime plus l'entrée : elle fait baisser consecutiveFails d'un cran ;
//   - après `weaknessResolveStreak` réussites d'affilée, sans échec consécutif restant, la
//     faiblesse devient INACTIVE (resolvedAt), mais l'entrée est conservée ;
//   - un nouvel échec réactive une faiblesse inactive.
// Ce qui est repris à l'identique : computeWeaknessPriority, et le fait qu'une réussite sur un
// élément sans faiblesse ne crée rien.

import { GUIDED_CONFIG } from '../config.js';
import { toDate } from './dates.js';

const MS_PER_DAY = 86400000;

/** Une faiblesse active : une entrée existe et n'est pas résolue. */
export function isWeaknessActive(record) {
  return Boolean(record) && (record.resolvedAt === null || record.resolvedAt === undefined);
}

/**
 * Applique un échec.
 * @param {object|null|undefined} record  entrée actuelle, absente si l'élément n'a jamais échoué
 * @param {string|Date} now
 * @returns {object}                      nouvelle entrée (l'entrée reçue n'est pas modifiée)
 */
export function applyWeaknessFailure(record, now) {
  const date = toDate(now).toISOString();
  const base = record || { consecutiveFails: 0, totalFails: 0 };
  return {
    ...base,
    consecutiveFails: base.consecutiveFails + 1,
    totalFails: base.totalFails + 1,
    successStreak: 0,
    lastFailDate: date,
    resolvedAt: null // un échec réactive une faiblesse inactive
  };
}

/**
 * Applique une réussite.
 * @param {object|null|undefined} record  entrée actuelle
 * @param {string|Date} now
 * @param {object} config                 configuration (GUIDED_CONFIG par défaut)
 * @returns {object|null}                 nouvelle entrée ; null si l'élément n'avait pas
 *                                        d'entrée (une réussite ne crée rien)
 */
export function applyWeaknessSuccess(record, now, config = GUIDED_CONFIG) {
  const date = toDate(now).toISOString();
  if (!record) return null;

  const next = {
    ...record,
    consecutiveFails: Math.max(0, record.consecutiveFails - 1),
    successStreak: (record.successStreak || 0) + 1
  };
  if (isWeaknessActive(record) &&
      next.consecutiveFails === 0 &&
      next.successStreak >= config.weaknessResolveStreak) {
    next.resolvedAt = date;
  } else {
    // Une faiblesse déjà inactive garde la date de sa résolution.
    next.resolvedAt = record.resolvedAt ?? null;
  }
  return next;
}

/**
 * Priorité d'une faiblesse, reprise à l'identique de l'ancien code : échecs consécutifs
 * (poids fort), échecs au total (poids faible), récence du dernier échec (décroissance
 * linéaire). Elle s'applique aux faiblesses ACTIVES (3.5) : les inactives ne doivent être ni
 * affichées ni renforcées, c'est à l'appelant de les écarter avec isWeaknessActive.
 *
 * @param {object} record
 * @param {string|Date} now
 * @param {object} config
 * @returns {number}
 */
export function computeWeaknessPriority(record, now, config = GUIDED_CONFIG) {
  const p = config.weaknessPriority;
  const daysSince = (toDate(now).getTime() - new Date(record.lastFailDate).getTime()) / MS_PER_DAY;
  const recencyFactor = Math.max(0, 1 - daysSince / p.recencyWindowDays);
  return (record.consecutiveFails || 0) * p.consecutiveFailWeight +
         (record.totalFails || 0) * p.totalFailWeight +
         recencyFactor * p.recencyWeight;
}
