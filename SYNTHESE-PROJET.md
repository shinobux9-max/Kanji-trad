# Kanji-trad — Synthèse technique et produit

Document autonome, à jour au 2026-09-17, destiné à donner à un autre assistant IA (sans accès à
l'historique de conversation) une vision immédiate et fiable de l'état du projet. Pour l'historique
détaillé de la modularisation ESM elle-même, voir `HANDOFF.md` ; pour l'instantané d'architecture
équivalent maintenu au fil de l'eau, voir `ETAT-ACTUEL.md` et `REGLES-CONSTRUCTION.md` (ce fichier
en est une synthèse réécrite, pas une copie).

Kanji-trad est une application web (PWA, `sw.js`) d'apprentissage du japonais (kanji, vocabulaire,
grammaire, kana) organisée par niveaux JLPT (N5→N1), avec système de révision espacée (SRS),
Learning Path par unités, et entraînement libre.

---

## 1. Architecture modulaire ESM

`index.html` charge `css/*.css` (9 fichiers : base, layout, components, kanji, vocab, grammar,
review, learning, quiz) puis `<script type="module" src="js/app.js">`. **24 fichiers JS, ~10 300
lignes, 0 cycle d'import** (vérifié programmatiquement par script DFS après chaque ajout d'import).

```
js/
├── app.js                    bootstrap init() + EXPOSED_FUNCTIONS (window.*)
├── core/
│   ├── state.js               état global mutable unique (voir §2.3)
│   ├── navigation.js          history.pushState, SCREEN_REGISTRY / MODAL_EXIT_REGISTRY,
│   │                          closeAllOverlaysAndSessions(), pushModalState()
│   ├── storage.js             suivi maîtrise (trackItem/getItemStatus)
│   ├── data-loader.js         chargement JSON par niveau JLPT (data/{level}/vocab|grammar.json)
│   └── constants.js           listes de niveaux/scripts
├── features/
│   ├── kanji.js                fiche détail, dossiers/favoris, grilles, quiz overrides
│   ├── vocabulary.js           liste, fiche, révision (flashcard/QCM/cloze)
│   ├── grammar.js              liste, fiche, révision, popups de renvoi
│   ├── kana.js                 grille hira/kata, révision, tracé kana
│   ├── strokes.js               tracé kanji (Stroke Order Quiz, HanziWriter)
│   ├── free-training.js        entraînement libre configurable, sans effet SRS
│   └── oral.js                 synthèse vocale, test oral
├── learning/
│   ├── srs.js                  file de révision centralisée (SRS)
│   ├── weakness.js             widget "À renforcer"
│   ├── exercises.js            parcours "Commençons l'apprentissage" (onboarding + leçons)
│   └── learning-path.js        Learning Path par unités (curriculum.json), système distinct
└── ui/
    ├── common.js                composants transversaux (FAB, feedback, exemples — voir §2)
    ├── dashboard.js             écran Accueil + écrans "Niveaux" vocab
    ├── modals.js                recherche unifiée (filtres, panneau, résultats)
    ├── cards.js                 écrans Réviser/Apprendre + routeur showCategoryDirect/loadJLPTCategory
    ├── kanji-review.js          sélecteur de mode + session flashcard kanji + dossiers
    ├── niveaux-screens.js       écrans "Niveaux" grammaire/kanji
    └── mixed-review.js          session de révision mixte (vocab+grammaire+kanji+kana)
```

**`app.js` est le seul point d'exposition `window.*`** : il importe toutes les fonctions encore
référencées par des `onclick="..."` générés en HTML à travers tout le projet, et les assigne dans
un objet `EXPOSED_FUNCTIONS` unique (`Object.entries(EXPOSED_FUNCTIONS).forEach(([name, fn]) =>
{ window[name] = fn; })`). Voir §2.1 pour pourquoi c'est obligatoire.

---

## 2. Conventions critiques (à respecter impérativement)

### 2.1 — `window.*` obligatoire pour les onclick dynamiques

Le HTML est généré dynamiquement avec des `onclick="maFonction(...)"`. En ESM, les fonctions
importées **ne sont pas automatiquement globales** — un onclick exécute dans le contexte
`window`, pas dans le scope du module qui a généré le HTML. Toute fonction encore référencée
depuis un onclick doit être explicitement exposée via `window.maFonction = maFonction` — en
pratique, ajoutée à l'objet `EXPOSED_FUNCTIONS` de `app.js`, **jamais** via un `window.x = x`
éparpillé ailleurs.

Un oubli = `ReferenceError` silencieuse au clic, jamais détectée par `node --check` (qui ne
valide que la syntaxe, pas les références).

**Trois formes à vérifier, pas juste la plus simple :**
- `onclick="maFonction(...)"` — facile à repérer.
- `onclick="${condition ? '' : 'maFonction()'}"` — conditionnelle, ratée par une recherche
  simple de `onclick="maFonction(`.
- Argument nu passé à une autre fonction : `enterBulkSelectMode(maFonction)`.
- **Appel brut hors onclick**, dans le code JS d'un AUTRE fichier — landmine de cycle d'import
  quand un import réel créerait un cycle (ex : `core/navigation.js` appelle `closeDetail()`
  sans l'importer, car `features/kanji.js` importe déjà `pushModalState()` depuis
  `navigation.js` — un import en retour créerait `navigation.js -> kanji.js -> navigation.js`).
  Ces landmines volontaires sont systématiquement commentées `⚠️ ATTENTION` avec la raison
  précise (voir §3.3, Phase 4).

**Méthode de vérification fiable** : extraire tout le contenu des template strings de tous les
fichiers, chercher tous les `on\w+="..."` (y compris `${...}` imbriqués), croiser avec les
imports de `app.js`. Séparément, chercher les appels de fonctions non déclarées localement dans
chaque fichier pour capter les landmines hors-onclick.

### 2.2 — Navigation stricte via `history.back()`

**Un bouton retour/FAB doit TOUJOURS appeler `history.back()`, jamais la fonction de l'écran
parent directement.** Appeler `showEcranParent()` directement pousse un NOUVEL état d'historique
au lieu d'y revenir — bug de boucle infinie/historique corrompu, rencontré et corrigé **4 fois**
sur ce projet (`showCategoryDirect`, la grille kana, `showProgressionDetail`, et
`learningPathFAB()` en Phase 3, voir §3.1).

Le bon pattern : le registre (`SCREEN_REGISTRY`/`MODAL_EXIT_REGISTRY` dans `core/navigation.js`)
doit avoir une entrée qui appelle la fonction d'écran avec `isBack = true` (pas de nouveau push).
`history.back()` déclenche cette entrée automatiquement via `popstate`.

Composants partagés (`ui/common.js`) :
- `backFAB(onclickFn = 'history.back()', icon = '←')` — bouton retour flottant, position fixe.
  **Ne jamais réimplémenter localement** (bug trouvé : `learningPathFAB()` dupliquait le style
  ET appelait la fonction parente directement au lieu de `history.back()`).
- `continueFAB(onclickFn, label)` — bouton "Continuer" flottant.
- Si un écran est nouveau, ajouter son entrée au registre **avant** de créer son bouton retour.

### 2.3 — Sessions dans `state.*`, jamais en variable de module

Toute session active (`state.reviewSession`, `state.grammarReviewSession`,
`state.mixedReviewSession`, `state.kanjiReviewSession`, `state.learningSession`,
`state.lessonSession`, `state.trainingSession`...) vit dans `core/state.js`, nettoyée
automatiquement à chaque navigation par `core/navigation.js::closeAllOverlaysAndSessions()`.

**Bug réel trouvé et corrigé en Phase 3** : `features/vocabulary.js` et `features/grammar.js`
gardaient leur session de révision dans un `let` local au module au lieu de `state.reviewSession`
/`state.grammarReviewSession` — `closeAllOverlaysAndSessions()` nettoyait donc un champ que
personne ne lisait, la session n'était jamais réellement réinitialisée à la navigation. Corrigé :
les deux fichiers utilisent maintenant `state.*` partout.

Exceptions documentées et acceptées (pas des oublis) : `kanaReviewSession` (`features/kana.js`)
reste un `let` local, nettoyée via sa propre fonction exportée `resetKanaReviewSession()` appelée
par `closeAllOverlaysAndSessions()` — fonctionnellement équivalent, juste un mécanisme différent.

### 2.4 — Autres conventions établies

- **Barre de navigation du bas** : visible uniquement sur Accueil/Apprendre/Réviser
  (`showBottomNav()`/`hideBottomNav()`, `ui/common.js`) — tout sous-écran appelle
  `hideBottomNav()` à son entrée.
- **Feedback de quiz unifié** : `buildAnswerFeedbackHtml()` (`ui/common.js`) — ❌ Tu as
  répondu / ✅ La bonne réponse était / ⚠️ Nuance — utilisé par TOUS les exercices à choix.
- **Exemples de phrases** : `buildSpeakableExampleHtml()` (`ui/common.js`) — même design
  visuel partout (kanji/vocab/grammaire).
- Patcher par `str_replace` ciblé, jamais réécrire un fichier entier (sauf création).
- `node --input-type=module --check < fichier.js` après chaque fichier JS modifié.
- Vérifier l'absence de cycle après tout nouvel import (script DFS sur le graphe extrait via
  regex `from '...'`).

---

## 3. État des refactors récents

La modularisation ESM elle-même est **complète depuis longtemps** (voir `HANDOFF.md`) — plus
aucun chantier de portage de fonctionnalité. Le travail récent est un audit de cohérence et de
propreté sur une base déjà fonctionnelle.

### 3.1 — Phase 3 : audit de cohérence des écrans (commit `6b4bc1a`)

Vérification systématique de tous les écrans contre les conventions du §2, via scripts d'analyse
statique + lecture manuelle de vérification. 6 corrections trouvées et appliquées :

1. `ui/cards.js` (aujourd'hui `ui/mixed-review.js`) — bouton retour `back-btn` inline remplacé
   par `backFAB()` standard.
2. `learning/learning-path.js` — `learningPathFAB()` appelait l'écran parent directement au lieu
   de `history.back()` (4ᵉ occurrence du bug de boucle décrit au §2.2) — remplacé par un simple
   appel à `backFAB('history.back()')`.
3. `core/navigation.js` — entrée `SCREEN_REGISTRY['learning-path-home']` manquante (conséquence
   du point 2, masquée tant que le direct-call fonctionnait "visuellement").
4. `features/free-training.js` — `showFreeTrainingConfig()` n'appelait jamais `hideBottomNav()`.
5. `features/vocabulary.js` — session de révision dans un `let` local (voir §2.3).
6. `features/grammar.js` — même bug que le point 5.

### 3.2 — Phase 5 : découpage de `ui/cards.js` (commit `6b4bc1a`, même commit que Phase 3)

`ui/cards.js` regroupait 4 responsabilités distinctes (802 lignes) ; découpé en 4 fichiers :

| Fichier | Contenu | Lignes |
|---|---|---|
| `ui/cards.js` (réduit) | Écrans d'accueil Réviser/Apprendre + routeur cross-feature | 370 |
| `ui/kanji-review.js` (nouveau) | Sélecteur de mode + session flashcard kanji + dossiers | 205 |
| `ui/niveaux-screens.js` (nouveau) | Écrans "Niveaux" grammaire/kanji | 124 |
| `ui/mixed-review.js` (nouveau) | Session de révision mixte | 134 |

`app.js` mis à jour (4 imports séparés, `EXPOSED_FUNCTIONS` regroupé par fichier d'origine —
même liste de fonctions exposées, aucune perte). Vérifié : `node --check` sur les 24 fichiers,
script DFS (aucun cycle), croisement usages↔imports sur les 4 fichiers touchés.

### 3.3 — Phase 4 : nettoyage des commentaires `⚠️ ATTENTION` obsolètes (commits `98853d1`, `6e492f9`)

56 commentaires `⚠️ ATTENTION` audités sur 12 fichiers, puis 6 occurrences supplémentaires de
"pas encore porté" sans le marqueur. La quasi-totalité datait d'une époque où le module cité
n'existait pas encore ("pas encore porté", "hors périmètre de tout fichier actuel", "lèvera une
ReferenceError tant que X n'existe pas") — **la raison structurelle du landmine (cycle d'import
via `pushModalState`) reste valide dans 100% des cas vérifiés**, seule la description du statut
de portage était fausse (tout est porté). ~24 commentaires corrigés sur 6 fichiers
(`core/navigation.js`, `core/state.js`, `ui/dashboard.js`, `features/kanji.js`,
`features/strokes.js`, `features/kana.js`, `features/free-training.js`), chaque correction
vérifiée programmatiquement (script DFS "cette fonction, importée dans ce fichier, créerait-elle
un cycle ?") avant d'être écrite, plus `node --check` après chaque fichier.

Une passe "landmines" séparée (onclick dynamiques complexes, appels bruts inter-fichiers,
complétude des registres de navigation) n'a trouvé **aucune anomalie supplémentaire** au-delà de
ce que la Phase 3 avait déjà corrigé — confirmé par deux scripts d'analyse indépendants +
vérification manuelle de chaque candidat.

### 3.4 — Fichiers monolithes conservés comme référence

`monolithe kanji.js` et `monolithe kanji.css` à la racine du dépôt sont l'**ancien code source
pré-modularisation**, gardés uniquement comme référence de dernier recours (règle du projet :
"si le monolithe original n'est plus accessible, demander à l'utilisateur de le remettre
temporairement plutôt que de deviner"). **Ils ne sont jamais chargés par l'application** —
`index.html` charge exclusivement les 24 fichiers `js/` modulaires et les 9 fichiers `css/`.
Non trackés par git (fichiers de travail locaux).

### 3.5 — Historique disponible sur demande

Chaque phase peut être détaillée davantage si nécessaire (liste complète des commentaires
corrigés, contenu exact des diffs, méthodologie des scripts d'analyse) — non reproduit ici pour
garder ce document consultable rapidement.

---

## 4. Plugins UI/UX installés (commit `94a5834`)

Deux packages npm installés via `npx` dans `.claude/` (scope projet), tous deux vérifiés avant
installation (package réel, auteur identifié, usage significatif — pas de package suspect).

### 4.1 — `ui-ux-pro-max-cli` (v2.15.0)

Installe 7 skills dans `.claude/skills/` :
`banner-design`, `brand`, `design`, `design-system`, `slides`, `ui-styling`, `ui-ux-pro-max`.

Fournit des données de référence consultables (styles, palettes produit, associations de
polices, guidelines UX, icônes, presets d'animation GSAP, types de graphiques, stacks
techniques) pour assister la conception d'interfaces, logos, bannières, présentations HTML,
identité de marque. Purement passif — aucun hook, s'active seulement quand une skill est
invoquée.

### 4.2 — `impeccable` (v4.1.0)

Installe :
- `.claude/skills/impeccable/` — inclut un exécutable compilé `impeccable.exe`
  (Windows x64, ~14,7 Mo).
- `.claude/agents/` — 4 agents : `impeccable-asset-producer`, `impeccable-documenter`,
  `impeccable-finish-reviewer`, `impeccable-manual-edit-applier`.
- `.claude/settings.local.json` — **hooks actifs** :
  - `PostToolUse` (matcher `Edit|Write`) → lance `impeccable hook` (timeout 5s, "Checking UI
    changes") après chaque modification de fichier.
  - `Stop` → relance `impeccable hook` (timeout 30s, "Design deep pass") en fin de session.

**Différence clé avec UI/UX Pro Max : ce plugin est actif en permanence**, pas seulement invoqué
à la demande — chaque édition de fichier dans ce projet déclenche désormais automatiquement une
vérification anti-pattern design via le binaire. Objectif affiché : détection d'anti-patterns
UI/UX, accessibilité, cohérence de design system, en continu pendant le développement plutôt
qu'en revue ponctuelle.

### 4.3 — Objectif combiné

`ui-ux-pro-max` fournit la matière première (données/références de design) que les skills
`design`/`brand`/`ui-styling` consomment à la demande ; `impeccable` fournit la boucle de
contrôle continue (hooks) qui vérifie que ce qui est produit respecte les règles. Les deux
packages installent des sous-skills qui se recoupent partiellement (`brand`, `design`,
`design-system`, `ui-styling` proviennent de `ui-ux-pro-max-cli` ; `impeccable` est autonome) —
pas de conflit connu à ce jour, jamais testés ensemble en conditions réelles sur un écran de
Kanji-trad.
