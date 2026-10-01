// Outil de test : rejeu d'un journal d'événements (partie 7, S6 et S7 : « rejouer un journal »).
// Pas un fichier de test en soi (il ne se termine pas par .test.js).

import { applyEvent, createEmptyLearningState } from '../../src/learning/effects.js';

/**
 * Rejoue des événements dans l'ordre. `onStep(before, after, event, changed)` est appelé après
 * chaque événement, pour vérifier une propriété pas à pas.
 */
export function replay(events, { initial = createEmptyLearningState(), onStep, config, deps } = {}) {
  let state = initial;
  for (const event of events) {
    const { state: next, changed } = applyEvent(state, event, config, deps);
    if (onStep) onStep(state, next, event, changed);
    state = next;
  }
  return state;
}

// Générateur pseudo-aléatoire reproductible (mulberry32) : un même germe donne toujours le
// même journal.
export function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
