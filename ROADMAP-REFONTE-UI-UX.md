# Kanji-trad — Roadmap refonte UI/UX

Suivi de la refonte écran par écran lancée sur la base de `SYNTHESE-UI-UX.md`. Méthode établie
pour chaque point : grounding (lecture du code réel) → plan borné → validation (`node --check` +
disclosure des signalements du hook design). Cocher au fur et à mesure.

---

## ✅ Fait

- [x] Séparation typographique globale (Inter UI / Noto Sans JP contenu japonais)
- [x] Écran Réviser — feedback de quiz : conflit de marges `.vocab-nuance-box`
- [x] Écran Apprendre — effet mur de blocs, "Mes dossiers" sorti de la grille
- [x] Écran Accueil — titres de widgets unifiés (`.dash-widget-title`)
- [x] Écrans listes/niveaux Grammaire/Kanji/Kana — en-tête Kana aligné sur `.cat-header`
- [x] Fiches de détail Kanji/Vocabulaire — titres de section unifiés (`.detail-section-label`)
- [x] Entraînement libre (config) — titres de section unifiés
- [x] Écran résultats/scores de quiz (tracé) — dégradé retiré sur `.quiz-score-big`
- [x] Modale "Objectif du jour" — lignes unifiées avec `.ft-radio-row`
- [x] Écran Dossiers — halo de carte unifié + bug bouton Quiz corrigé (crash + navigation retour)

---

## ✅ Niveau 1 — écrans de contenu (terminé)

- [x] **Vocabulaire — écran liste** : déjà cohérent visuellement (halo, classes partagées) ;
  écart fonctionnel trouvé et corrigé — bouton "🔁 Réviser" manquant (`dueCount` calculé mais
  jamais affiché), maintenant branché sur `showVocabReviewModeSelector()`.
- [x] **Grammaire — écran liste + fiche détail** : fiche détail déjà cohérente. Écran liste :
  même écart que Vocabulaire (bouton "🔁 Réviser" jamais tenté), ajouté avec `buildDueQueue(data)
  .length` + `showGrammarReviewModeSelector()`.
- [x] **Kana — sélecteur de révision + consultation** : déjà cohérents (`.niveaux-wrap`/
  `.niveaux-card`), aucun changement nécessaire.
- [x] `showVocabReviewModeSelector`/`showGrammarReviewModeSelector` exposées sur `window.*`
  dans `app.js` (piège n°1 du projet — étaient absentes, auraient cassé silencieusement au clic).

## Restant — Niveau 2 : écrans de parcours/session (plus gros, jamais touchés)

- [x] **Entraînement libre — écran de session** (`renderTrainingScreen`/
  `renderTrainingQuizExercise`) — audité, **déjà entièrement cohérent** : réutilise `.review-page`/
  `.review-header`/`.review-card`/`.review-options`/`.review-option-btn`/`buildAnswerFeedbackHtml()`.
  Aucun changement nécessaire.

**⏸️ Pause ici (fin de session) — reprendre par le point suivant :**

5. **Parcours guidé / Learning Path** (`learning/learning-path.js`, ~780 lignes) — écran de liste
   des unités, micro-écrans de concept, exercices mixtes, résultat de fin d'unité. Chantier
   entier jamais ouvert cette refonte (seul le bug `learningPathFAB()` a été corrigé en Phase 3,
   côté navigation, pas design).
6. **Onboarding "Commençons l'apprentissage"** (`learning/exercises.js`, ~820 lignes) — slides
   d'intro, écran de choix, leçons pas-à-pas. Jamais audité.
7. **Test oral** (`features/oral.js`) — jamais regardé.

## Restant — Niveau 3 : composants transversaux

8. **Recherche unifiée** (`ui/modals.js`) — panneau de résultats, filtres, chips. Jamais audité.
9. **Popups de renvoi léger** (`showLessonReferencePopup`, `showVocabReferencePopup`,
   `showKanaTablePopup`) — structure déjà cohérente (`.mode-selection-card` partagée, vu en
   auditant la modale Objectif du jour), mais contenu interne jamais vérifié en détail.
10. **Écran Progression / calendrier de série** (`showProgressionDetail`, `ui/dashboard.js`) —
    jamais audité.
11. **Dialogues de gestion des dossiers** (créer/renommer/supprimer) — utilisent actuellement
    `prompt()`/`confirm()` natifs du navigateur, donc non stylisables. Pas un bug, mais un vrai
    écart avec le reste de l'app (aucun autre flux ne repose sur des dialogues natifs) — à
    discuter séparément si on veut les remplacer par des modales maison.

## Restant — Niveau 4 : chantier transversal déjà identifié, volontairement mis de côté 2 fois

12. **Échelle typographique globale** — 25 valeurs de `font-size` distinctes recensées dans le
    CSS dès le premier audit, pas de palier modulaire cohérent (12/14/16/18/24/32 recommandé).
    Explicitement reporté deux fois cette session ("on laisse ça de côté pour l'instant").
13. **Texte UI < 11px** (signalements récurrents du hook Impeccable, "attribution unknown",
    donc probablement liés au point 12) — même mise de côté.

---

## Ordre suggéré

Niveau 1 d'abord (referme proprement les 4 familles de contenu déjà entamées), puis Niveau 2
dans l'ordre listé (Entraînement libre session → Learning Path → Onboarding → Oral, du plus
petit/proche de ce qui vient d'être fait au plus gros chantier autonome), puis Niveau 3, et le
Niveau 4 seulement si tu décides de le rouvrir — il a été mis de côté volontairement, pas oublié.

Chaque point suit le même triptyque déjà utilisé (grounding → plan → validation), présenté et
confirmé avant toute modification, comme pour tous les écrans précédents.
