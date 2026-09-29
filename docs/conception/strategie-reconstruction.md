# Ocha — Stratégie de reconstruction

**Statut** : décision de principe, à intégrer dans la **partie 9 · Architecture technique
d'intégration** du document de conception du moteur guidé.

**À utiliser quand** : le document de conception est terminé (parties 1 à 9 validées).
Aucune construction ne commence avant.

---

## 1. La décision

Ocha sera reconstruit sur une **nouvelle base de code**, avec **reprise sélective** de
l'existant :

- **les données JSON sont conservées**, et enrichies ;
- **la logique éprouvée des modules JS actuels est reprise**, adaptée aux nouvelles
  interfaces, sans changer son comportement ;
- **tout le reste est écrit à neuf** selon le document de conception : noyau, écrans, CSS.

L'app actuelle reste **intacte et utilisable** pendant toute la construction.

---

## 2. Pourquoi

**Pourquoi c'est possible** : Ocha n'a pas encore d'utilisateurs. Il n'y a aucune
progression à préserver, aucune migration à assurer, aucun risque de casser l'usage de
quelqu'un. Avec des utilisateurs, cette approche serait déconseillée.

**Pourquoi ne pas modifier l'existant en place** : le nouveau modèle touche le cœur de l'app
(structure du suivi, journal d'événements, sessions qui survivent à la navigation,
paramètres, affichage unique du japonais, tout le visuel). Le code actuel est, lui, construit
pour reproduire fidèlement l'ancien monolithe. Faire entrer le nouveau modèle dedans
demanderait des exceptions partout et beaucoup de contournements.

**Pourquoi ne pas tout réécrire** : une partie du code fonctionne et a été éprouvée. La
réécrire ferait courir le risque de perdre des comportements subtils sans s'en apercevoir.

---

## 3. Ce qui est fait de chaque partie

### 3.1 Données JSON : conservées et enrichies

Tous les fichiers de données restent la base commune (vocabulaire, grammaire, kanji, kana,
exemples, particules, introduction, curriculum). On y **ajoute** ce que le document de
conception demande :

- `requires` sur les leçons de grammaire (dépendances, partie 2) ;
- `requires`, `teaches` et identifiants de questions dans `missions.json` et `lectures.json` ;
- les nouveaux fichiers : `registres.json`, `expressions.json`, `vocab-hors-jlpt.json`,
  `lieux.json`, `missions.json`, `lectures.json` ;
- les corrections de données déjà repérées (voir section 6).

`GUIDE-CONTENU.md` et le README des données sont mis à jour en même temps.

### 3.2 JavaScript : logique reprise, noyau neuf

**Écrit à neuf**, d'après le document de conception :

| Domaine | Référence |
|---|---|
| Suivi des éléments (nouvelle structure, état calculé) | partie 1 |
| Graphe pédagogique, normalisation `{ type, id }`, script de validation | partie 2 |
| Journal d'événements et état utilisateur | partie 3 |
| Moteur guidé, composition et adaptation des sessions | parties 4 à 7 |
| Navigation (sessions qui survivent, ⌂ et onglets qui remplacent la pile, paramètres en panneau) | maquette v4 |
| Paramètres (lus au démarrage, trois niveaux) | maquette v4 |
| Fonction unique d'affichage du japonais | maquette v4 |
| Dossiers v2 (tous types d'éléments, dossier « À revoir ») | maquette v4, partie 1 |
| Tous les écrans | maquette v4 |

**Repris et adapté** : la logique est conservée, seules ses entrées et sorties changent
pour s'intégrer au nouveau noyau (notamment : émettre des événements au lieu d'écrire
directement dans le suivi).

| Module actuel | À reprendre | Remarque |
|---|---|---|
| `srs.js` | `gradeReview` (calcul des intervalles), `getDaysOverdue`, `computeQueuePriorityTier`, `prioritizeQueue`, `scheduleRelearning` | les deux constructeurs de file (`buildDueQueue`, `buildReviewQueue`) sont remplacés par le moteur ; garder leurs règles utiles comme référence |
| `weakness.js` | `computeWeaknessPriority`, logique de `updateWeaknessTracking` | la mise à jour passe par le journal d'événements |
| `data-loader.js` | chargement des données, `kanaToRomaji`, `kanaToRomajiPrecise`, `getItemRomaji`, `getKanaFlatList`, recherches de leçons | à compléter pour les nouveaux fichiers |
| `vocabulary.js`, `grammar.js` | générateurs d'exercices (`buildMeaningQCM`, `buildGrammarCloze`…) | ajouter les identifiants de questions générées (partie 2) |
| `strokes.js`, `kana.js` | intégration HanziWriter, tracé, bouton indice, quiz de tracé | sans le marquage automatique (section 5) |
| `oral.js` | `normalizeOralResult`, `isResultCorrect`, `speakText`, `speakSentence` | sans le marquage automatique (section 5) |
| `common.js` | structure de `buildAnswerFeedbackHtml` et `buildSpeakableExampleHtml`, principe des popups d'aperçu, `escapeHtml`, `mdBold`, traitement des furigana | le rendu visuel suit le nouveau design system |
| `sw.js` | stratégie de cache (réseau d'abord pour HTML/JSON, cache d'abord pour les assets) | ajouter la mise en cache de la musique à la première écoute (par la page, pas par le service worker) |

**Méthode de reprise** : un module à la fois, avec une **liste de contrôle** des
comportements à retrouver (par exemple, pour `gradeReview` : intervalles obtenus après
« Oublié » (ancien « Encore »), « Difficile », « Bien », « Facile » à chaque répétition). Chaque module repris
est vérifié contre cette liste avant de passer au suivant.

### 3.3 CSS : nouveau design system

Le CSS ne dépend pas du JavaScript : il part du **design system** mis au point pendant les
maquettes. Source principale : `kt-theme.css` de la maquette v4, réécrit proprement pour
l'app. Il comprend notamment :

- les jetons de couleur (`--ai`, `--shu`, `--hl`, `--warn`, couleurs SRS, 5 crans de
  maîtrise), en thème clair et sombre ;
- les polices (Figtree, Zen Kaku Gothic New, Shippori Mincho B1) ;
- l'effet glassy avec son plancher d'opacité, le voile, les fonds, l'ambiance sakura ;
- les composants : fiches (dont la fiche de grammaire), badges de registre et on/kun,
  boutons fixes, panneaux, barre du bas, header ;
- les règles : espacements en multiples de 4 px, 4 rayons, zones tactiles de 44 px,
  respect de « réduire les animations ».

### 3.4 HTML : une coquille

L'app génère presque tous ses écrans en JavaScript. `index.html` n'est qu'une coquille. On
en garde les éléments techniques (métadonnées, lien vers le manifeste, enregistrement du
service worker, balise viewport) ; le reste est produit par le nouveau code.

### 3.5 La maquette v4 : une référence, pas une base de code

La maquette sert de référence pour les écrans, les interactions et le CSS. Elle n'est **pas**
transformée en application : elle simule le moteur, embarque ses données, utilise des
scripts classiques au lieu de modules ESM, et contient des béquilles propres à
l'environnement des artefacts (`kt-extra.js`, `kt-strokes.js`, délai de secours du retour).

---

## 4. Organisation du travail

- **L'app actuelle reste intacte**, dans sa branche. La nouvelle version se construit à côté,
  dans une branche dédiée (ou un dossier séparé, à décider en partie 9), jusqu'à ce qu'elle
  la remplace.
- **Ordre de construction** (à préciser en partie 9) : noyau (suivi, journal, état) → modules
  repris → moteur guidé → écrans → contenu.
- **Nouvelles règles de construction.** `REGLES-CONSTRUCTION.md` décrit l'ancienne base. La
  nouvelle base aura son propre jeu de règles, pour qu'un agent n'applique pas les anciennes
  par erreur. Points à trancher :
  - la règle « patcher par `str_replace`, jamais réécrire un fichier entier » ne s'applique
    pas à une construction neuve ; elle redeviendra valable une fois la base en place ;
  - le mécanisme `window.*` et les `onclick` peuvent disparaître si la nouvelle base passe
    par des écouteurs d'événements, comme la maquette (ce qui supprime le « piège n°1 » du
    projet) ;
  - les règles toujours valables sont reprises : `node --check` sur chaque fichier JS,
    retour par `history.back()`, messages de commit sur une seule ligne (PowerShell).

---

## 5. Comportements de l'ancien code à ne pas reproduire

Relevés en lisant le code actuel :

- **Favori et maîtrise dans le même champ `status`** : l'un efface l'autre. Le favori est
  supprimé, et l'état n'est plus un champ saisi (partie 1).
- **Maîtrise automatique après une seule réussite** :
  - `oral.js` marque un kanji « maîtrisé » après une seule prononciation reconnue correcte ;
  - `strokes.js` et `kana.js` (`markMastered`) marquent un caractère « maîtrisé » après un
    seul tracé propre.

  Dans le nouveau modèle, ce sont des réponses évaluées comme les autres (partie 3).
- **Clés `mastered_<caractère>`** écrites dans `localStorage` par `markMastered` et
  `oral.js`, que rien d'autre n'utilise. Elles disparaissent.
- **Nettoyage de toute session à chaque navigation** (`closeAllOverlaysAndSessions`) :
  remplacé par un mécanisme commun qui laisse survivre les sessions longues (session
  guidée, mission en cours).
- **Clé de paramètres jamais lue** (`kanji_trad_settings`) : les paramètres sont lus au
  démarrage et appliqués partout.
- **Entrée SRS créée uniquement par les révisions** : un élément qui passe En cours par un
  exercice reçoit aussi son entrée SRS (partie 1).

---

## 6. Corrections de données à faire au passage

- Catégorie mal orthographiée `cactions_generiques`, et doublon `personnes_famille` /
  `famille_personnes` dans le vocabulaire N5.
- Mots de base du N5 absents : 円, おはようございます, ありがとう(ございます), すみません,
  お願いします (les formules iront dans `expressions.json`).
- Furigana erronés dans `exemples.json` (一 lu いち dans 一つ, 買 lu ばい).
- Romaji erroné dans un exemple de la leçon か (`n5_g_17`) : « Ashita gaisha e ikimasu ka »
  pour 会社 (かいしゃ, *kaisha*).
- N4 : lectures en romaji au lieu de kana, certaines fausses ; thèmes en anglais, non alignés
  sur ceux du N5.
- Clés de stockage : les préfixes `kanji_trad_` peuvent devenir `ocha_` avec la nouvelle
  base, puisqu'il n'y a aucune donnée à conserver.

---

## 7. Résumé

| Partie | Traitement |
|---|---|
| JSON | conservés, enrichis, corrigés |
| JS | noyau et écrans neufs ; logique éprouvée reprise et adaptée, module par module |
| CSS | neuf, d'après le design system de la maquette v4 |
| HTML | coquille technique conservée, reste généré par le JS |
| Maquette v4 | référence, pas base de code |
| App actuelle | intacte dans sa branche jusqu'au remplacement |
