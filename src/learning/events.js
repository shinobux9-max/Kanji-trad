// Ocha v2 — Événements pédagogiques : format et validation
//
// Partie 3 (3.2, 3.3, 3.10), partie 2 (références `{ type, id }`), partie 9 (9.3, étape 1 de
// recordLearningEvent : « valider »).
//
// Ce fichier dit à quoi ressemble un événement valide. Il ne calcule aucun effet (tâches 6
// et 7) et n'écrit rien (tâche 8). validateEvent renvoie la liste des problèmes, vide si
// l'événement est valide ; c'est recordLearningEvent qui décidera de le rejeter.
//
// Format commun (3.2) :
//   { id, type, at, sessionId?, context, payload }
//
// Le schéma est STRICT : un champ inconnu (en tête, dans `context` ou dans `payload`) est un
// problème. Un champ prévu plus tard (par exemple le champ de sens d'A2-01) sera ajouté ici
// le moment venu, par modification ciblée.

// ── Valeurs autorisées ──────────────────────────────────────────────────────

export const EVENT_TYPES = Object.freeze([
  'SESSION_STARTED', 'SESSION_COMPLETED', 'SESSION_ABANDONED',
  'ACTIVITY_STARTED', 'ACTIVITY_COMPLETED', 'ACTIVITY_SKIPPED',
  'CONTENT_INTRODUCED', 'QUESTION_ANSWERED', 'REVIEW_GRADED',
  'REINFORCEMENT_TRIGGERED', 'KNOWLEDGE_DECLARED', 'KNOWLEDGE_DECLARATION_UNDONE'
]);

const SESSION_TYPES = new Set(['SESSION_STARTED', 'SESSION_COMPLETED', 'SESSION_ABANDONED']);

export const CONTEXT_VALUES = Object.freeze({
  mode: Object.freeze(['guided', 'free']),
  source: Object.freeze(['home', 'learn', 'library', 'explore', 'read', 'practice', 'review',
    'folder', 'fiche', 'onboarding', 'settings']),
  activityType: Object.freeze(['lesson', 'mission', 'reading', 'quiz', 'writing', 'speaking',
    'srs_review', 'placement', 'declaration']),
  exerciseType: Object.freeze(['flashcard', 'self_report', 'qcm', 'cloze', 'writing', 'speaking',
    'comprehension', 'naturalness', 'register'])
});

export const REF_TYPES = Object.freeze(['grammar', 'vocab', 'kanji', 'kana', 'expression']);

// Forme des identifiants d'éléments (partie 1, 1.1 ; partie 2, 2.2).
const REF_ID_SHAPES = {
  grammar: (id) => /^n[1-5]_g_.+$/.test(id),
  vocab: (id) => /^(n[1-5]|hj)_v_.+$/.test(id),
  kanji: (id) => [...id].length === 1,
  kana: (id) => /^kana_.+$/.test(id),
  expression: (id) => /^ex_.+$/.test(id)
};

const SESSION_FORMATS = ['short', 'normal', 'long'];
const DECLARATION_ORIGINS = ['declared', 'tested'];
const DECLARATION_SCOPES = ['kana', 'n5', 'n4', 'n3', 'n2', 'n1'];
const REINFORCEMENT_REASONS = ['error', 'weakness', 'forgotten'];

// Horodatage UTC canonique (celui de Date.prototype.toISOString, millisecondes facultatives) :
// l'index du journal trie les dates comme des chaînes, elles doivent donc toutes avoir la
// même forme.
const UTC_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

// ── Identifiants ────────────────────────────────────────────────────────────

/**
 * Nouvel identifiant d'événement. L'émetteur le crée UNE fois et le garde : renvoyer le même
 * événement (double clic, nouvelle tentative) avec le même identifiant n'aura d'effet qu'une
 * fois (idempotence, partie 9, 9.3).
 *
 * @param {() => string} randomUUID  source d'aléa (crypto.randomUUID par défaut)
 */
export function createEventId(randomUUID = () => globalThis.crypto.randomUUID()) {
  return `evt_${randomUUID()}`;
}

// ── Validation ──────────────────────────────────────────────────────────────

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isText = (v) => typeof v === 'string' && v !== '';
const isCount = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0;

function checkKeys(obj, allowed, where, problems) {
  for (const key of Object.keys(obj)) {
    if (!allowed.includes(key)) problems.push(`${where} : champ inconnu « ${key} »`);
  }
}

function checkRef(ref, where, problems, refs) {
  if (!isObject(ref)) {
    problems.push(`${where} : référence { type, id } attendue`);
    return;
  }
  checkKeys(ref, ['type', 'id'], where, problems);
  if (!REF_TYPES.includes(ref.type)) {
    problems.push(`${where} : type d'élément inconnu « ${String(ref.type)} »`);
    return;
  }
  if (!isText(ref.id) || !REF_ID_SHAPES[ref.type](ref.id)) {
    problems.push(`${where} : identifiant « ${String(ref.id)} » invalide pour le type ${ref.type}`);
    return;
  }
  refs.push(ref);
}

function checkRefList(list, where, problems, refs) {
  if (!Array.isArray(list) || list.length === 0) {
    problems.push(`${where} : liste non vide de références attendue`);
    return;
  }
  const seen = new Set();
  list.forEach((ref, i) => {
    checkRef(ref, `${where}[${i}]`, problems, refs);
    if (isObject(ref)) {
      const key = `${ref.type}:${ref.id}`;
      if (seen.has(key)) problems.push(`${where} : élément en double ${key}`);
      seen.add(key);
    }
  });
}

function checkEnum(value, allowed, where, problems) {
  if (!allowed.includes(value)) problems.push(`${where} : valeur inconnue « ${String(value)} »`);
}

function checkContext(event, problems) {
  const where = 'context';
  const { context } = event;
  // Les événements de session portent sur la session elle-même, pas sur une activité : leur
  // contexte ne dit que le mode et la source.
  if (!isObject(context)) {
    problems.push(`${where} : objet attendu`);
    return;
  }
  checkKeys(context, ['mode', 'source', 'activityType', 'activityId', 'folderId', 'exerciseType'],
    where, problems);
  checkEnum(context.mode, CONTEXT_VALUES.mode, `${where}.mode`, problems);
  checkEnum(context.source, CONTEXT_VALUES.source, `${where}.source`, problems);
  if (SESSION_TYPES.has(event.type)) {
    if (context.activityType !== undefined) {
      problems.push(`${where}.activityType : sans objet pour un événement de session`);
    }
  } else {
    checkEnum(context.activityType, CONTEXT_VALUES.activityType, `${where}.activityType`, problems);
  }
  if (context.exerciseType !== undefined) {
    checkEnum(context.exerciseType, CONTEXT_VALUES.exerciseType, `${where}.exerciseType`, problems);
  }
  if (context.activityId !== undefined && !isText(context.activityId)) {
    problems.push(`${where}.activityId : texte non vide attendu`);
  }
  if (context.folderId !== undefined && !(isText(context.folderId) && context.folderId.startsWith('fld_'))) {
    problems.push(`${where}.folderId : identifiant « fld_… » attendu`);
  }
}

// Charge utile de chaque type (3.3) : champs autorisés et vérifications.
const PAYLOADS = {
  SESSION_STARTED: {
    keys: ['sessionType', 'plannedMinutes', 'plan'],
    check(p, problems) {
      checkEnum(p.sessionType, SESSION_FORMATS, 'payload.sessionType', problems);
      if (!isCount(p.plannedMinutes)) problems.push('payload.plannedMinutes : nombre ≥ 0 attendu');
      // Contenu du plan défini par le moteur guidé (étape 4).
      if (!Array.isArray(p.plan)) problems.push('payload.plan : liste attendue');
    }
  },
  SESSION_COMPLETED: {
    keys: ['actualMinutes', 'completedActivities'],
    check(p, problems) {
      if (!isCount(p.actualMinutes)) problems.push('payload.actualMinutes : nombre ≥ 0 attendu');
      if (!Array.isArray(p.completedActivities)) problems.push('payload.completedActivities : liste attendue');
    }
  },
  SESSION_ABANDONED: {
    keys: ['lastActivity', 'actualMinutes'],
    check(p, problems) {
      if (!isCount(p.actualMinutes)) problems.push('payload.actualMinutes : nombre ≥ 0 attendu');
      // Contenu défini par le moteur guidé (étape 4) ; null si aucune activité n'a commencé.
      if (!Object.hasOwn(p, 'lastActivity')) problems.push('payload.lastActivity : champ attendu');
    }
  },
  ACTIVITY_STARTED: {
    keys: ['activityId', 'activityType'],
    check(p, problems) { checkActivity(p, problems); }
  },
  ACTIVITY_COMPLETED: {
    keys: ['activityId', 'activityType', 'durationSeconds', 'score'],
    check(p, problems) {
      checkActivity(p, problems);
      if (!isCount(p.durationSeconds)) problems.push('payload.durationSeconds : nombre ≥ 0 attendu');
      if (p.score !== undefined && !(typeof p.score === 'number' && Number.isFinite(p.score))) {
        problems.push('payload.score : nombre attendu');
      }
    }
  },
  ACTIVITY_SKIPPED: {
    keys: ['activityId', 'activityType'],
    check(p, problems) { checkActivity(p, problems); }
  },
  CONTENT_INTRODUCED: {
    keys: ['element'],
    check(p, problems, refs) { checkRef(p.element, 'payload.element', problems, refs); }
  },
  QUESTION_ANSWERED: {
    keys: ['questionId', 'target', 'correct', 'answer'],
    check(p, problems, refs) {
      if (!isText(p.questionId)) problems.push('payload.questionId : texte non vide attendu');
      checkRefList(p.target, 'payload.target', problems, refs);
      if (typeof p.correct !== 'boolean') problems.push('payload.correct : booléen attendu');
      // `answer` est facultatif (« Je savais / Je ne savais pas » n'a pas de réponse saisie).
    }
  },
  REVIEW_GRADED: {
    keys: ['element', 'quality'],
    check(p, problems, refs, event) {
      checkRef(p.element, 'payload.element', problems, refs);
      if (![0, 1, 2, 3].includes(p.quality)) problems.push('payload.quality : 0, 1, 2 ou 3 attendu');
      // Partie 3 · 3.10, invariant 3 : seulement dans une vraie révision SRS.
      if (isObject(event.context) && event.context.activityType !== 'srs_review') {
        problems.push('REVIEW_GRADED hors d\'une révision SRS (context.activityType doit valoir srs_review)');
      }
    }
  },
  REINFORCEMENT_TRIGGERED: {
    keys: ['element', 'reason', 'sourceActivity'],
    check(p, problems, refs) {
      checkRef(p.element, 'payload.element', problems, refs);
      checkEnum(p.reason, REINFORCEMENT_REASONS, 'payload.reason', problems);
      // Contenu défini par le moteur guidé (étape 4).
      if (!Object.hasOwn(p, 'sourceActivity')) problems.push('payload.sourceActivity : champ attendu');
    }
  },
  KNOWLEDGE_DECLARED: {
    keys: ['elements', 'scope', 'origin', 'declarationId'],
    check(p, problems, refs) {
      const hasElements = p.elements !== undefined;
      const hasScope = p.scope !== undefined;
      if (hasElements === hasScope) {
        problems.push('payload : exactement un de « elements » ou « scope » attendu');
      }
      if (hasElements) checkRefList(p.elements, 'payload.elements', problems, refs);
      if (hasScope) checkEnum(p.scope, DECLARATION_SCOPES, 'payload.scope', problems);
      checkEnum(p.origin, DECLARATION_ORIGINS, 'payload.origin', problems);
      if (!isText(p.declarationId)) problems.push('payload.declarationId : texte non vide attendu');
    }
  },
  KNOWLEDGE_DECLARATION_UNDONE: {
    keys: ['declarationId'],
    check(p, problems) {
      if (!isText(p.declarationId)) problems.push('payload.declarationId : texte non vide attendu');
    }
  }
};

function checkActivity(p, problems) {
  if (!isText(p.activityId)) problems.push('payload.activityId : texte non vide attendu');
  checkEnum(p.activityType, CONTEXT_VALUES.activityType, 'payload.activityType', problems);
}

/**
 * Vérifie un événement. Ne modifie rien.
 *
 * @param {object} event
 * @param {object} [options]
 * @param {(ref: {type: string, id: string}) => boolean} [options.elementExists]
 *        si fournie, chaque élément référencé doit exister (le contenu arrive à l'étape 2 ;
 *        les tests passent un faux catalogue). Le périmètre d'une déclaration par niveau
 *        (`scope`) n'est pas vérifié ici.
 * @returns {string[]}  problèmes trouvés ; vide si l'événement est valide
 */
export function validateEvent(event, { elementExists } = {}) {
  const problems = [];
  if (!isObject(event)) return ['événement : objet attendu'];

  checkKeys(event, ['id', 'type', 'at', 'sessionId', 'context', 'payload'], 'événement', problems);

  if (!(isText(event.id) && event.id.startsWith('evt_') && event.id.length > 4)) {
    problems.push('id : identifiant « evt_… » attendu');
  }
  if (!EVENT_TYPES.includes(event.type)) {
    problems.push(`type : type d'événement inconnu « ${String(event.type)} »`);
  }
  if (!(typeof event.at === 'string' && UTC_ISO.test(event.at) && !Number.isNaN(Date.parse(event.at)))) {
    problems.push('at : horodatage UTC ISO attendu (forme de toISOString)');
  }
  if (event.sessionId !== undefined && !(isText(event.sessionId) && event.sessionId.startsWith('ses_'))) {
    problems.push('sessionId : identifiant « ses_… » attendu');
  }
  if (SESSION_TYPES.has(event.type) && event.sessionId === undefined) {
    problems.push('sessionId : obligatoire pour un événement de session');
  }

  checkContext(event, problems);

  const spec = PAYLOADS[event.type];
  const refs = [];
  if (spec) {
    if (!isObject(event.payload)) {
      problems.push('payload : objet attendu');
    } else {
      checkKeys(event.payload, spec.keys, 'payload', problems);
      spec.check(event.payload, problems, refs, event);
    }
  }

  if (elementExists) {
    for (const ref of refs) {
      if (!elementExists(ref)) problems.push(`élément inexistant : ${ref.type} ${ref.id}`);
    }
  }

  return problems;
}
