# Checklist de premier test — bascule ESM + CSS modulaire

Rien de tout ça n'a été exécuté dans un vrai navigateur. Priorité : trouver les bugs vite,
pas tout tester à fond dès le premier passage.

## 0. Avant de commencer
- Uploader `index.html`, le dossier `css/`, le dossier `js/` à la racine du dépôt, à côté
  des fichiers existants (`kanji.js`, `kanji.css`, `data/`, `manifest.json`, etc.).
- Ne PAS supprimer `kanji.js`/`kanji.css` — ils ne sont plus chargés mais servent de filet
  de sécurité (revert `index.html` seul si besoin).

## 1. Ça charge, ou pas ? (le plus important)
- Ouvrir la console développeur AVANT de charger la page.
- Si l'accueil affiche le spinner sans jamais rien afficher → erreur JS bloquante, regarder
  la console : c'est presque toujours soit un chemin d'import cassé (typo dans un `from
  '../...'`), soit un id DOM manquant.
- Si l'accueil s'affiche mais complètement sans style → un des 9 fichiers CSS ne charge pas
  (onglet Réseau, filtrer par CSS, chercher un 404).

## 2. Navigation de base
- Les 4 boutons du bas (Accueil / Apprendre / Réviser / Rechercher) répondent au clic.
- Le bouton retour du navigateur/téléphone ferme proprement les écrans (pas de blocage).
- Ouvrir une fiche kanji, un mot de vocabulaire, une leçon de grammaire — le tracé HanziWriter
  s'anime, les exemples s'affichent.

## 3. Recherche
- Taper dans la barre de recherche → résultats vocab/grammaire/kanji/kana qui s'affichent.
- Cliquer un résultat kanji → ouvre bien la fiche (pas de ReferenceError en console).
- Le micro de recherche (🎤) : au pire ne fait rien si non supporté, ne doit pas planter.

## 4. Une session de révision de chaque type (juste une carte suffit pour valider)
- Vocabulaire, grammaire, kanji (flashcard), kana — chacun a son propre système, donc un bug
  dans l'un ne prédit pas forcément un bug dans les autres.
- Le tracé kanji (bouton ✍️ dans la fiche détail) — HanziWriter + `startStrokeQuiz`.

## 5. Entraînement libre + Learning Path
- Écran de configuration de l'entraînement libre s'affiche et lance une session.
- Depuis Apprendre, démarrer/reprendre le parcours guidé (unités N5) — le swipe/tap pour
  naviguer dans les concepts fonctionne (glisser ou toucher l'écran).
- Une leçon de grammaire "Commençons l'apprentissage" (onboarding 5 slides + leçon).

## 6. Boutons connus pour être encore cassés (normal, pas un bug à signaler)
- Tout ce qui touche `showCategoryDirect` (certaines cartes de niveau dans l'ancien système
  de catégories) — chantier jamais fait, documenté dans HANDOFF.md.
- Le bouton pause de la vue "tracé kanji" (`toggleStrokePause`) — déjà inerte dans
  l'app d'origine, pas une régression.

## Si quelque chose casse
Le plus utile à me remonter : le message exact de la console (erreur + fichier + ligne),
et l'action qui l'a déclenché. Je corrige au fur et à mesure.
