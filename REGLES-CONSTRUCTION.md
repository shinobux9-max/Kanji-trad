# Kanji-trad — Règles de construction

Playbook technique établi au fil des sessions. Voir aussi `ETAT-ACTUEL.md` (architecture,
état du projet) et `HANDOFF.md` (historique de la modularisation ESM).

## Méthode de travail générale

- Patcher par `str_replace` ciblé — jamais réécrire un fichier entier, sauf création.
- `node --input-type=module --check < fichier.js` après CHAQUE fichier JS modifié, avant
  de le livrer.
- Ne jamais demander d'upload d'un fichier déjà présent dans le contexte/le Project.
- Ne jamais improviser un comportement non vérifié. Si le monolithe original n'est plus
  accessible (le Project a été entièrement remplacé par les fichiers modulaires), demander
  à l'utilisateur de le remettre temporairement (`monolithe_kanji.js`) plutôt que de deviner.
- **Messages de commit git sur une seule ligne.** L'utilisateur est sur PowerShell (Windows),
  pas bash — un message multi-lignes avec guillemets échappés casse le terminal
  (`pathspec '...' did not match any file(s)`).

## Vérifications avant de livrer un changement JS

1. **Syntaxe** : `node --check` sur chaque fichier touché.
2. **Cycle d'import** : script DFS sur le graphe d'imports (extrait via regex `from '...'`)
   après tout nouvel import ajouté, dans les deux sens.
3. **Exposition `window.*`** : voir section dédiée ci-dessous — c'est la source de bug la
   plus fréquente et la plus difficile à repérer visuellement.

## Le mécanisme window.* — piège n°1 du projet

Le HTML est généré dynamiquement avec des `onclick="maFonction(...)"`. Ces fonctions ne
sont PAS automatiquement globales en ESM (modules) : elles doivent être explicitement
exposées via `window.maFonction = maFonction` dans `app.js`. Un oubli = `ReferenceError`
silencieuse au clic, invisible à la compilation.

**Trois formes à vérifier, pas juste la plus simple :**
- `onclick="maFonction(...)"` — la plus facile à repérer.
- `onclick="${condition ? '' : 'maFonction()'}"` — conditionnelle, ratée par une recherche
  simple de `onclick="maFonction(`.
- Argument nu passé à une autre fonction : `enterBulkSelectMode(maFonction)`.
- **Appel brut hors onclick**, dans le code JS d'un AUTRE fichier (landmine de cycle
  d'import) — ex: `navigation.js` appelle `closeDetail()` sans l'importer, car
  `kanji.js` importe déjà `navigation.js` (cycle direct sinon).

**Méthode fiable** : extraire tout le contenu des template strings de tous les fichiers,
chercher tous les `on\w+="..."` (y compris `${...}` imbriqués), croiser avec les imports de
`app.js`. Séparément, chercher les appels de fonctions non déclarées localement dans chaque
fichier (approche proche d'un lint "no-undef") pour capter les landmines hors-onclick.

Avant de conclure qu'une fonction est "manquante", vérifier que ce n'est pas un faux
positif : les CONSTANTES/objets (`MODAL_EXIT_REGISTRY[x]`, pas un appel de fonction) et les
classes CSS utilisées via `class="nom${...}"` (collé, sans espace) échappent souvent aux
scripts de détection simples.

## Conventions de design établies — à réutiliser, jamais recréer

- **FAB (bouton flottant)** : `backFAB(onclick, icone)` / `continueFAB(onclick, label)`
  (`ui/common.js`). Tout bouton retour/continuer est en position fixe — plus aucun bouton
  inline dans le flux normal du contenu. Penser à ajuster le `padding-top`/`padding-bottom`
  du conteneur pour que le FAB ne recouvre pas de contenu.
- **Barre de navigation du bas** : visible UNIQUEMENT sur Accueil/Apprendre/Réviser
  (`showBottomNav()`/`hideBottomNav()`, `ui/common.js`). Tout sous-écran (niveau, liste,
  fiche, sélecteur de mode, session) appelle `hideBottomNav()` à son entrée.
- **Feedback de quiz** : `buildAnswerFeedbackHtml()` (`ui/common.js`) — structure fixe :
  ❌ Tu as répondu (mot) [badge 👁️ si une fiche existe] / ✅ La bonne réponse était (mot)
  [badge] / ⚠️ Nuance (si fournie, séparée). Utilisée par TOUS les exercices à choix, sans
  exception — ne jamais recréer une variante locale, même "juste pour ce cas".
- **Exemples de phrases** : `buildSpeakableExampleHtml()` (`ui/common.js`) — même design
  partout (bordure gauche accent, 🔊 cliquable sur toute la carte, pas juste l'icône).
- **Popups légères "aperçu"** (par opposition à navigation complète) : pattern
  `showXReferencePopup()`/`closeXReferencePopup()` — reste DANS l'écran courant (une
  session de révision, par exemple) au lieu de la remplacer. Voir
  `showLessonReferencePopup` (grammaire) et `showVocabReferencePopup` (vocabulaire) comme
  modèles avant d'en créer une nouvelle pour un autre type de contenu.

## Navigation — règle stricte à ne jamais enfreindre

**Un bouton retour/FAB doit TOUJOURS appeler `history.back()`, jamais la fonction de
l'écran parent directement.** Appeler `showEcranParent()` directement (même sans argument)
pousse un NOUVEL état d'historique au lieu d'y revenir — créant une boucle infinie
(rencontrée et corrigée 3 fois sur ce projet : `showCategoryDirect`, la grille kana,
`showProgressionDetail`).

Le bon pattern : le registre (`SCREEN_REGISTRY`/`MODAL_EXIT_REGISTRY` dans
`core/navigation.js`) doit déjà avoir une entrée qui appelle la fonction d'écran avec
`isBack = true` (pas de nouveau push). `history.back()` déclenche cette entrée
automatiquement via `popstate` — c'est TOUJOURS la bonne réponse pour un bouton "retour".

Si un écran est nouveau et n'a pas encore d'entrée dans le registre, l'ajouter AVANT de
créer son bouton retour, pas après.

## Sessions d'état

Toute session active (révision, entraînement, leçon...) vit dans `state.*`
(`core/state.js`), jamais en variable locale à un module. Elle est nettoyée
automatiquement par `core/navigation.js::closeAllOverlaysAndSessions()` à chaque
navigation — pas besoin de la nettoyer manuellement ailleurs.

## Ce qui a été délibérément retiré — ne pas réintégrer sans raison explicite

- `features/quiz.js` (modal lecture/sens kanji) — décision utilisateur, les autres
  systèmes de révision suffisent.
- Ancienne navigation par grade (Primaire/Collège) — `loadCategory`/`loadSeriesPage`.
- ~10 fonctions mortes confirmées + ~100 classes CSS mortes associées (détail dans
  l'historique git, pas la peine de le retracer ici).

## Nettoyage de code mort — méthode

Une fonction exportée mais jamais "vraiment" utilisée nulle part (ni import, ni onclick,
ni appel interne) est candidate à la suppression — mais vérifier D'ABORD dans le monolithe
d'origine (si disponible) si elle a un usage prévu qu'on aurait simplement oublié de
brancher (cas vécu : `addDailyNewCardsUsed`, `launchMixedReviewSession` — pas du code
mort, du code jamais fini). Ne jamais supprimer une fonction sans avoir vérifié ses
usages avec le script de détection complet (constantes + appels bruts + onclick), pas
une simple recherche visuelle.
