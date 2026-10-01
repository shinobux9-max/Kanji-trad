# Ocha v2 — Passation de conversation

**Date** : 2026-10-01 (après la clôture de l'étape 1)
**But** : reprendre le travail dans une nouvelle conversation sans rien perdre. Ce fichier
résume **où on en est, comment on travaille, et ce qui vient ensuite**. Le détail est dans les
documents de référence du dépôt, listés en section 6.

---

## 1. Le projet en une minute

**Ocha** (anciennement Kanji-trad) est une PWA d'apprentissage du japonais pour francophones,
du N5 au N1, en HTML/CSS/JavaScript vanilla (modules ESM, aucun framework). Dépôt GitHub :
`https://github.com/shinobux9-max/Ocha`.

Ocha est **reconstruit sur une nouvelle base de code**, dans la branche **`ocha-v2`**, à partir
d'un **document de conception complet et verrouillé** (`docs/conception/`). L'ancienne app
reste intacte sur les branches `Modularisation` (app publiée, style le plus récent) et
`UI-sans-refonte` (point de départ de `ocha-v2`).

Ocha n'a **pas encore d'utilisateurs** : aucune donnée à migrer.

---

## 2. Où on en est

### Terminé

| Quoi | Résultat |
|---|---|
| Document de conception, parties 1 à 9 | verrouillé |
| Addendums A1 (`construction`) et A2 (l'ENTRY est l'unité de progression du vocabulaire ; tags officiels) | validés |
| Règles de construction v2.2 | verrouillées |
| **Étape 0 · Préparation** (6 tâches) | branche, gouvernance, `src/config.js`, `tools/check-layers.mjs`, `tools/validate-data.mjs`, nettoyage des données |
| **Étape 1 · Stockage et apprentissage** (13 tâches) | `src/store/` et `src/learning/` complets ; rapport `docs/rapports/etape1.md` |
| Tests | **262 tests Node, tous verts** (`npm.cmd test`) ; **20 / 20** dans le navigateur (`tests/browser/store-contract.html`) |
| Couches | `node tools/check-layers.mjs` : aucune violation |

### Ce que l'étape 1 a construit (contrats que la suite doit respecter)

- **`src/store/`** : contrat commun (`contract.js` : 9 magasins, transactions tout ou rien,
  `StorageError`), version en mémoire pour les tests (`memory.js`), schéma v1 et migrations
  (`schema.js`), IndexedDB (`indexeddb.js`), avec la même sémantique.
- **`src/learning/`** : seule surface publique **`index.js`**. Le seul chemin d'écriture est
  `createLearning(…).recordLearningEvent(event, { session })`, qui renvoie `recorded`,
  `duplicate`, `rejected` ou `pending` (échec d'écriture, 9.4). Lecture : `getSnapshot()`
  (gelé), `getSession()`, `getNewContentBudget(limit)`, `getDailySummaries()`,
  `getWriteFailure()` ; calculs purs : `computeState`, `computeActivityStatus`,
  `isWeaknessActive`, `computeWeaknessPriority`, `getDaysOverdue`.
- **Ce que le contenu devra fournir à `learning`** (injecté à `createLearning`) :
  `elementExists(ref)` (validation des événements) et `elementsOfScope(level)` (éléments
  d'**un** niveau : `kana`, `n5`, `n4`… ; le cumul des niveaux est fait par `learning`).
- **Forme des références** (`src/learning/events.js`) : `{ type, id }`, types `grammar`,
  `vocab`, `kanji`, `kana`, `expression` ; identifiants `nX_g_…`, `nX_v_…` ou `hj_v_…` (dans
  `vocab`), un caractère pour un kanji, `kana_…`, `ex_…`. Schéma d'événement **strict** : un
  champ inconnu est refusé (le champ de sens viendra avec A2-01).

### À faire ensuite

**Étape 2 · Contenu et graphe** (partie 9, 9.9) : chargement des données, normalisation
`{ type, id }`, graphe (`requires`, `teaches`, `uses`), relations dérivées, `forms` /
`construction` ; tests **R1, R4, S1**. Comme pour les étapes 0 et 1, **la découper d'abord en
tâches courtes et faire valider le découpage avant tout code.**

Le chantier **A2-01 · Schéma concret ENTRY → SENSE** s'y rattache : mené par l'utilisateur avec
ChatGPT (décisions), puis formalisé et implémenté avec Claude. Le découpage de l'étape 2 doit
dire comment il s'articule avec elle (ordre, dépendances).

---

## 3. Méthode de travail établie

### Répartition des rôles

- **L'utilisateur et ChatGPT** : décisions d'architecture et de produit, relecture critique de
  chaque livrable de Claude (ChatGPT relit aussi le code des archives).
- **Claude** : rédaction des documents, code, scripts, tests, vérifications.
- Chaque livrable est **relu par ChatGPT** avant d'être commité. Les corrections demandées sont
  appliquées par un patch ciblé, puis le livrable est revalidé.

### Comment Claude livre

- **Une tâche à la fois.** Une tâche n'est terminée qu'avec ses tests verts, `ETAT-ACTUEL.md`
  à jour et son commit. Claude rappelle de commiter la tâche précédente avant d'en
  décompresser une nouvelle.
- Les fichiers sont livrés dans une **archive zip** qui reproduit l'arborescence du dépôt :
  ```
  Expand-Archive -Path "$HOME\Downloads\NOM.zip" -DestinationPath . -Force
  ```
- **`ETAT-ACTUEL.md` est livré complet dans chaque archive**, jamais sous forme d'ajustements
  à reporter à la main (préférence de l'utilisateur).
- Chaque livraison donne : le contenu, les choix à contrôler (signalés, pas tranchés seul),
  les commandes de vérification avec les résultats attendus (nombre de tests), et un commit
  sur **une seule ligne**.
- **Vérification par sabotage** : avant de livrer, Claude casse volontairement chaque règle
  importante et vérifie qu'au moins un test échoue. Un sabotage qui passe révèle un trou de
  test, comblé avant la livraison et signalé.
- Claude vérifie le code et les données réels (fichiers du Project, archives) avant
  d'affirmer quelque chose sur eux.

### Environnement de l'utilisateur

- **Windows, PowerShell**, VS Code, Node.js 24.
- Tests : **`npm.cmd test`** (`npm test` est bloqué par PowerShell).
- Tests navigateur du stockage : `node tests/browser/serve.mjs`, puis
  `http://localhost:8123/tests/browser/store-contract.html`. À relancer après toute
  modification de `src/store/`.
- Les fichiers Markdown et JSON se modifient **dans VS Code**, jamais avec PowerShell.
- Les avertissements Git `LF will be replaced by CRLF` sont sans conséquence.

### Principes à respecter

- **Ne jamais improviser** : ce qui n'est pas dans la conception est signalé, pas inventé.
- **Les documents verrouillés ne se modifient pas en passant** : toute évolution passe par un
  addendum (conception) ou une nouvelle version (snapshots A2).
- Les décisions prises en cours de route sont consignées dans `ETAT-ACTUEL.md`, section
  « Décisions complémentaires ».

---

## 4. Décisions à garder en tête pour l'étape 2

- **Unité d'apprentissage** : l'ENTRY. Les SENSE n'ont aucun état pédagogique ; une réponse
  sur un sens fait progresser l'ENTRY entière. Un identifiant de sens pourra être journalisé
  dans `QUESTION_ANSWERED` (nom fixé par A2-01), sans effet.
- **Tags** : portés par ENTRY, SENSE ou expression ; jamais en double d'un champ existant ;
  une expression utilise `places`, pas un tag de lieu ; le moteur guidé ne lit pas les tags
  en v1.
- **Périmètre du validateur** : `VALIDATED_LEVELS = ['n5']`. Le N4 est dans l'ancien format.
- **Données** : `particles.json` est dans `data/n5/` ; `concepts/n5.json`,
  `curriculum/n5.json` et `mapping.json` restent en place jusqu'à l'étape 5, car l'ancienne
  app les charge. 結婚 et 練習 restent des noms.
- **Dates** : horodatages en UTC canonique (forme de `toISOString`) ; le jour (budget, résumé
  quotidien) est le jour **local** de l'appareil.
- **Réglages initiaux** : 10 nouveautés par jour (contenu seulement, kana exclus), format de
  session normal. `engine` et `exercises` reçoivent les réglages **en argument**.
- **`src/app.js`** a les mêmes droits que l'interface.
- Toutes les décisions de l'étape 1 sont dans `ETAT-ACTUEL.md`.

---

## 5. Points ouverts

| Pour | Point |
|---|---|
| Étape 2 | articulation avec A2-01 ; place des projets A2-06 à A2-09 ; `data/n5/exemples.json` à reconstruire (436 exemples par kanji sans hiragana, exemples de vocabulaire découpés par des espaces, 買 lu ばい et 一つ lu いち) ; corrections de la stratégie (§6) encore à faire : catégorie `cactions_generiques`, doublon `personnes_famille` / `famille_personnes`, 円 absent du vocabulaire N5, おはようございます absent des expressions ; 75 leçons de grammaire sans `requires` (le moteur suit l'ordre de référence en attendant) ; N4 à migrer au format v2 avant son intégration |
| Étape 4 | `computeQueuePriorityTier`, `prioritizeQueue`, `scheduleRelearning` (hasard injecté) ; contenu de la session ; respect du budget (S10) |
| Étape 5 | C4 et 9.4 côté écran (pause des exercices évalués, bandeau, Réessayer) ; n'avancer que sur `recorded` ; accès aux dossiers par `learning` ; déplacer `concepts/n5.json` vers `data/n5/concepts.json`, et `curriculum/n5.json` et `mapping.json` vers `data/legacy/` |
| Étape 6 | export / import (et sort des événements en attente) ; `navigator.storage.persist()` |

---

## 6. Documents de référence

À mettre dans les connaissances du Project de la nouvelle conversation, **versions de la
branche `ocha-v2`** :

| Fichier | Rôle |
|---|---|
| `PASSATION-CONVERSATION.md` | ce fichier |
| `ETAT-ACTUEL.md` | état de la reconstruction, décisions complémentaires, points ouverts |
| `REGLES-CONSTRUCTION.md` | règles de la branche `ocha-v2` (v2.2) |
| `docs/conception/00-sommaire.md`, `strategie-reconstruction.md` | sommaire, ce qui est repris |
| `docs/conception/partie-1-…` à `partie-9-…` | conception verrouillée (la **partie 2** surtout pour l'étape 2) |
| `docs/conception/addendum-A1-construction.md`, `addendum-A2-liaison.md` | addendums |
| `docs/conception/GUIDE-CONTENU.md`, `README.md` | rédaction et **structure de chaque fichier de données** (registres §4, phrase §5, `expressions.json` §7, `lectures.json` §8, `lieux.json` et `missions.json` §9) |
| `docs/rapports/etape1.md` | clôture de l'étape 1, points transmis |
| `src/config.js` | paramètres du moteur (avec `srsAlgorithm`, `weaknessPriority`) |
| `src/learning/index.js`, `events.js`, `record.js` | contrats que le contenu doit respecter |
| `tools/validate-data.mjs`, `tools/check-layers.mjs` | validation des données et des couches |
| les fichiers de `data/` (N5 et communs : `expressions.json`, `registres.json`, `lieux.json`, `vocab-hors-jlpt.json`, `missions.json`, `lectures.json`…) | **versions nettoyées** de l'étape 0 |
| `data-loader.js` (ancienne app) | logique de chargement à reprendre (stratégie, §3.2) |
| les six snapshots A2 et `Ocha_Decisions_A2_Unite_Apprentissage_Tags.md` | architecture sémantique (pour A2-01) |

**Ne pas mettre** : les fichiers de l'ancienne app autres que `data-loader.js` (`index.html`,
`sw.js`, `hanzi-writer.js`, modules JS…), ni les anciens `ETAT-ACTUEL.md` et
`REGLES-CONSTRUCTION.md` de l'ancienne app.

---

## 7. Premier message suggéré pour la nouvelle conversation

> Nous reprenons la reconstruction d'Ocha v2. L'étape 1 est terminée. Lis
> `PASSATION-CONVERSATION.md`, puis `ETAT-ACTUEL.md`, `REGLES-CONSTRUCTION.md`,
> `docs/conception/00-sommaire.md` et `docs/rapports/etape1.md`. Vérifie que les fichiers du
> Project sont bien les versions `ocha-v2` (données nettoyées comprises). Propose ensuite le
> découpage de l'**étape 2 · Contenu et graphe** en tâches courtes, en t'appuyant sur la
> partie 2, les addendums A1 et A2, la stratégie de reconstruction et les contrats de
> `src/learning/`, et dis comment A2-01 s'y articule. Ne code rien avant que le découpage soit
> validé.
