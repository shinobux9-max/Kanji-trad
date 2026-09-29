# Kanji-trad — État actuel (remplace/complète HANDOFF.md)

Ce document est un instantané de l'état du projet, pas un journal de sessions. Pour
l'historique détaillé de la modularisation ESM elle-même, voir `HANDOFF.md`.

## Architecture

- `index.html` — charge `css/*.css` (9 fichiers) + `<script type="module" src="js/app.js">`
- `js/core/` — `state.js` (état global unique), `navigation.js` (history.pushState, MODAL_EXIT_REGISTRY/SCREEN_REGISTRY), `storage.js`, `data-loader.js`, `constants.js`
- `js/features/` — `kanji.js`, `vocabulary.js`, `grammar.js`, `kana.js`, `strokes.js`, `free-training.js`, `oral.js` (~~`quiz.js`~~ **supprimé**, voir plus bas)
- `js/learning/` — `srs.js`, `weakness.js`, `exercises.js` (parcours "Commençons l'apprentissage"), `learning-path.js` (Learning Path par unités — système distinct, pas le même que exercises.js)
- `js/ui/` — `common.js`, `dashboard.js`, `modals.js` (recherche), `cards.js` (Réviser/Apprendre, sélecteurs de mode, session mixte, dossiers)
- `js/app.js` — bootstrap + expose sur `window.*` toute fonction référencée par un `onclick="..."` généré en HTML (mécanisme obligatoire, voir plus bas)

**22 fichiers JS, aucun cycle d'import.** Vérifié à chaque changement via un script Python DFS (voir méthode plus bas).

## Convention critique : window.* pour les onclick

Le HTML est généré dynamiquement avec des `onclick="maFonction(...)"`. Ces fonctions ne
sont PAS automatiquement globales en ESM — elles doivent être explicitement exposées via
`window.maFonction = maFonction` dans `app.js`. Un oubli ici = `ReferenceError` silencieuse
au clic, jamais détectée par un simple `node --check`.

**Piège découvert plusieurs fois** : un onclick conditionnel du type
`onclick="${flipped ? '' : 'maFonction()'}"` ou un argument nu comme
`enterBulkSelectMode(maFonction)` n'est pas capté par une recherche simple de `onclick="maFonction(`.

**Méthode de vérification fiable** (à relancer après tout ajout de code générant du HTML) :
extraire tout le contenu des template strings, chercher tous les `on\w+="..."` (y compris les
`${...}` imbriqués), croiser avec les imports de `app.js`. Egalement vérifier les appels BRUTS
(pas dans un onclick) vers des fonctions d'un autre fichier — ce sont des "landmines" quand un
cycle d'import empêche l'import réel, résolues elles aussi via `window.*`.

## Autres conventions établies

- **FAB (bouton flottant)** : `backFAB()`/`continueFAB()` (`ui/common.js`) — tout bouton
  retour/continuer est en position fixe, plus aucun bouton inline dans le flux normal.
- **Barre de navigation du bas** : visible uniquement sur Accueil/Apprendre/Réviser
  (`showBottomNav()`/`hideBottomNav()`, `ui/common.js`) — masquée sur tout sous-écran.
- **Feedback de quiz unifié** : `buildAnswerFeedbackHtml()` (`ui/common.js`) — ❌ Tu as
  répondu / ✅ La bonne réponse était (avec badge 👁️ cliquable si une fiche existe) / ⚠️
  Nuance en bas si disponible. Utilisé par TOUS les exercices à choix (vocab, grammaire,
  entraînement libre, leçon, Learning Path).
- **Exemples de phrases** : `buildSpeakableExampleHtml()` (`ui/common.js`) — même design
  visuel (bordure gauche accent, 🔊 cliquable) partout (kanji/vocab/grammaire).
- **Sessions dans `state.*`, jamais en variable de module** : toute session active
  (`state.reviewSession`, `state.mixedReviewSession`, etc.) est nettoyée automatiquement par
  `navigation.js::closeAllOverlaysAndSessions()` à chaque navigation.
- **Navigation hiérarchique stricte** : un bouton retour/FAB doit TOUJOURS utiliser
  `history.back()`, jamais appeler directement la fonction de l'écran parent (qui pousserait
  un nouvel état au lieu d'y revenir — bug de boucle infinie déjà rencontré 3 fois).

## Ce qui a été retiré (ne pas chercher à réintégrer sans raison)

- `features/quiz.js` (modal lecture/sens kanji, 7 modes) — décision explicite, les autres
  systèmes de révision suffisent. Le bouton "⚡ Quiz" des dossiers utilise maintenant
  `startKanjiQuizForFolder()` (`ui/cards.js`), branché sur le même sélecteur que Réviser>Kanji.
- Ancienne navigation par grade (Primaire/Collège) — `loadCategory`/`loadSeriesPage`,
  jamais atteignable depuis l'interface actuelle.
- ~10 fonctions mortes confirmées (`choiceLabel`, `createBadge`, etc.) + ~100 classes CSS
  mortes associées.

## Chantiers en cours / restants

- **Phase 3** (audit de cohérence — tous les écrans utilisent bien les patterns ci-dessus) :
  jamais fait systématiquement.
- **Phase 4** (nettoyage des commentaires ⚠️ ATTENTION devenus obsolètes) : fait au fil de
  l'eau sur les fichiers touchés, jamais de passe systématique.
- **Phase 5** (revue structurelle) : `ui/cards.js` a grossi (~1000 lignes, plusieurs
  responsabilités : sélecteurs de mode, écrans niveaux, session mixte, dossiers) — à
  éventuellement scinder.
- Aucun bug fonctionnel connu à ce jour (tout ce qui a été testé et rapporté a été corrigé).

## Méthode de travail établie

- Patcher par `str_replace` ciblé, jamais réécrire un fichier entier.
- `node --input-type=module --check` après chaque fichier JS modifié.
- Vérifier l'absence de cycle après tout nouvel import (script DFS).
- Ne jamais improviser un comportement non vérifié — si le monolithe original n'est plus
  accessible (le Project a été entièrement remplacé par les fichiers modulaires), demander
  à l'utilisateur de le remettre temporairement plutôt que de deviner.
- Messages de commit git sur **une seule ligne** (l'utilisateur est sur PowerShell, pas bash
  — les messages multi-lignes avec guillemets échappés cassent le terminal).
