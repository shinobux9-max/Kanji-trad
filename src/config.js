// Ocha v2 — Configuration du moteur guidé
//
// Tous les paramètres configurables des parties 1 à 5 du document de conception
// (docs/conception/). Ce sont des valeurs de départ, à ajuster après usage réel :
// on les modifie ici, jamais ailleurs dans le code (REGLES-CONSTRUCTION.md, §2 et §4).
//
// Chaque valeur indique la section du document d'où elle vient.
// Ce fichier ne contient que des données, sans aucune logique métier ni dépendance.
// Seule fonction : deepFreeze, qui rend la configuration immuable pour qu'aucun module
// ne puisse modifier un paramètre par erreur.

function deepFreeze(obj) {
  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object') deepFreeze(value);
  }
  return Object.freeze(obj);
}

export const GUIDED_CONFIG = deepFreeze({

  // ── Partie 1 · États des éléments ─────────────────────────────────────────

  stateThresholds: {
    acquiredIntervalDays: 21,     // 1.2 · En cours → Acquis : intervalle SRS ≥ 21 jours
    masteredIntervalDays: 60      // 1.2 · Acquis → Maîtrisé : intervalle SRS ≥ 60 jours
  },

  declaredVerificationWindowDays: {
    min: 21,                      // 1.3 · première vérification d'un élément déclaré ou testé,
    max: 45                       //       répartie de façon déterministe dans cette fenêtre
  },

  // ── Partie 2 · Graphe pédagogique ─────────────────────────────────────────

  prerequisiteThresholds: {       // 2.4 · part des prérequis satisfaits (au moins En cours)
    grammar: 1.0,                 //       toute la grammaire exigée
    vocab: 0.75,
    kanji: 0.75,
    expression: 0.75
  },

  maxTaughtElements: 8,           // 2.5 · au-delà : avertissement du validateur, pas une erreur

  // ── Partie 3 · Événements, faiblesses, journal ────────────────────────────

  firstCheckDelayDays: 1,         // 3.4 · première vérification après une première évaluation

  weaknessResolveStreak: 3,       // 3.5 · réussites d'affilée pour rendre une faiblesse inactive
                                  //       (expérimental)

  journal: {
    detailDays: 30,               // 3.8 · détail complet conservé
    maxDetailedEvents: 5000       // 3.8 · plafond du détail ; au-delà, résumé quotidien
  },

  // ── Partie 4 · Sélection et composition des sessions ──────────────────────

  sessionFormats: {               // 4.4 · les quotas sont des plafonds, pas des objectifs
    short:  { targetMinutes: 5,  maxNew: 3,  maxReviews: 5,  context: false },
    normal: { targetMinutes: 12, maxNew: 6,  maxReviews: 10, context: 'short' },
    long:   { targetMinutes: 25, maxNew: 10, maxReviews: 20, context: true }
  },

  kanaNewPerSession: 5,           // 4.4 · kana du bloc Kana, hors budget de nouveautés (O1)
  kanaBlockUntil: 'acquired',     // 4.5 · bloc Kana des débutants jusqu'à Acquis

  rotationTieBreak: ['grammar', 'vocab', 'expression', 'kanji'],
                                  // 4.5 · départage de la rotation en cas d'égalité (L1)

  recentWindowDays: 7,            // 4.2 · éléments « récents »
  pendingDiscoveredLimit: 10,     // 4.5 · frein à la nouveauté (Découverts en attente)

  openingReinforcementMinFails: 2,// 4.5 · faiblesse importante : renforcement après la Révision (O4)

  timeOverrunTolerance: 0.20,     // 4.5 · dépassement toléré de la durée cible

  reviewShare: {                  // 4.6 · part du temps de session consacrée à la révision
    normal: 0.35,                 //       zone normale (avec le quota maxReviews)
    important: 0.60,              //       zone importante (budget de temps)
    massive: 0.85                 //       zone massive (budget de temps, expérimental, O6)
  },
  backlogMassiveFactor: 3,        // 4.6 · dues > 3 × quota = zone massive

  reinforcement: {                // 4.7
    errorsOnSameElement: 2,       //       erreurs sur un même élément pour déclencher
    blockErrorRate: 0.5,          //       taux d'erreur d'un bloc de Pratique pour déclencher
    maxPerSession: 2              //       plafond global, renforcement d'ouverture compris
  },

  sessionResumeHours: 12,         // 4.8 · délai glissant de reprise après la dernière activité

  maxSessionReasons: 3,           // 4.9 · motifs affichés dans « Pourquoi cette session ? »

  blockDurations: {               // 4.3 · estimations, recalées ensuite sur les durées réelles
    reviewCard: 12,               //       secondes par carte
    newWord: 45,                  //       secondes par mot
    newKanji: 90,                 //       secondes par kanji
    newExpression: 60,            //       secondes par expression
    kanaBlock: 120,               //       secondes par bloc Kana
    practiceQuestion: 20,         //       secondes par question
    reinforcement: 90,            //       secondes par renforcement
    lessonDefaultMinutes: 4       //       minutes, si la leçon n'a pas d'estimated_minutes
  },

  // ── Partie 5 · Génération et adaptation des exercices ─────────────────────

  representation: {
    kanaReadable: 'learning_no_weakness', // 5.1 · kana au moins En cours, sans faiblesse active
    kanjiWithoutFurigana: 'acquired',     // 5.1 · kanji ET mot au moins Acquis
    romajiRubyMaxShare: 0.30              // 5.1 · au-delà, toute la phrase passe en romaji
  },

  naturalnessPhases: {            // 5.4 · part des leçons N5 au moins En cours (expérimental)
    phase2: 0.25,
    phase3: 0.60
  }
});

// Ocha v2 — Réglages initiaux de l'utilisateur
//
// Valeurs de départ des réglages que l'utilisateur peut ensuite changer (Paramètres › Rythme).
// Elles ne sont pas des règles du moteur : GUIDED_CONFIG décrit les règles, ce bloc décrit les
// choix initiaux. Non fixées par le document de conception, décidées le 2026-09-29
// (voir ETAT-ACTUEL.md, « Décisions complémentaires »).

export const DEFAULT_USER_SETTINGS = deepFreeze({
  dailyNewBudget: 10,       // 4.4 · « Nouveautés par jour » : éléments de contenu (grammaire,
                            //       vocabulaire, kanji, expressions) qui quittent Nouveau, tous
                            //       écrans confondus. Les kana ont leur propre plafond
                            //       (kanaNewPerSession) et ne consomment pas ce budget (O1).
  sessionFormat: 'normal'   // 4.4 · format de session : 'short', 'normal' ou 'long'
});
