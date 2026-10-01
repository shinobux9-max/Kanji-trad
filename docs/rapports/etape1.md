# Ocha v2 — Rapport de clôture de l'étape 1 · Stockage et apprentissage

**Date** : 2026-10-01
**Référence** : partie 9, 9.9 (étape 1) ; découpage en 13 tâches validé le 2026-10-01
(`ETAT-ACTUEL.md`).

---

## 1. Résultat

| Vérification | Résultat |
|---|---|
| `npm test` (Node) | **262 tests, tous verts** : 220 pour l'étape 1, 42 pour l'étape 0 |
| `node tools/check-layers.mjs` | aucune violation (15 fichiers de `src/`) |
| `tests/browser/store-contract.html` (Chromium) | **20 / 20** ; 3 cas de pannes simulées non applicables à IndexedDB |
| Code livré et code testé | identiques, fichier par fichier, aux archives des tâches 1 à 12 |

Critères de la partie 9 (9.9) pour l'étape 1 : **S6, S7, C1 à C5, 9.4**. Tous sont couverts
par des tests automatiques ; C4 l'est pour sa partie « traitement », sa partie « écran »
relève de l'étape 5 (voir 5).

---

## 2. Ce qui a été construit

| Couche | Fichier | Rôle |
|---|---|---|
| `store` | `contract.js` | contrat commun : 9 magasins (9.2), transactions tout ou rien, `StorageError` |
| `store` | `memory.js` | stockage en mémoire, pannes à la demande (tests) |
| `store` | `schema.js` | base `ocha`, schéma v1, migrations numérotées, `meta` initial |
| `store` | `indexeddb.js` | stockage de l'app, même sémantique que la mémoire |
| `learning` | `index.js` | seule surface publique ; aucune fonction d'écriture exposée |
| `learning` | `record.js` | `recordLearningEvent` : validation, une transaction, idempotence, file, notifications, chargement, échec d'écriture (9.4), compaction, budget |
| `learning` | `events.js` | format et validation des 12 types d'événements |
| `learning` | `effects.js` | effets pédagogiques (fonction pure) : présentation, réponse, révision, déclaration et annulation, avancement |
| `learning` | `state.js` | état calculé (5 états), avancement des activités, invariants des faits |
| `learning` | `srs.js` | `gradeReview` et `getDaysOverdue`, repris à l'identique |
| `learning` | `weakness.js` | faiblesses progressives ; priorité reprise à l'identique |
| `learning` | `journal.js` | résumé quotidien, plan de compaction |
| `learning` | `budget.js` | éléments qui quittent Nouveau, budget du jour |
| `learning` | `dates.js` | dates reçues en argument, jours calendaires et jour local |
| `config` | `config.js` | ajout de `srsAlgorithm` et `weaknessPriority` (valeurs de l'ancien code) |

Les couches `content`, `exercises`, `engine` et `ui` restent vides : elles viennent aux
étapes 2 à 5. `learning` reçoit du contenu ce dont il a besoin par injection
(`elementExists`, `elementsOfScope`), ce qui l'a rendu testable sans l'étape 2.

---

## 3. Critères et où ils sont vérifiés

| Critère | Vérification | Fichiers |
|---|---|---|
| S6 · aucun intervalle modifié hors `REVIEW_GRADED` (sauf création, déclaration, annulation) | rejeu de 70 journaux aléatoires, contrôle après chaque événement ; scénario de bout en bout | `effects.test.js`, `effects-knowledge.test.js`, `e2e.test.js` |
| S7 · aucun recul hors « Oublié » (et annulation d'une déclaration) | idem | idem |
| C1 · même effet quel que soit l'écran | une même réponse depuis six contextes ; une révision depuis Réviser et le mode guidé | `effects.test.js` |
| C2 · toute écriture passe par `recordLearningEvent` | test statique des imports (analyse de `check-layers`) ; surface publique sans fonction d'écriture | `surface.test.js` |
| C3 · état rechargé = état affiché | 15 journaux aléatoires ; sur IndexedDB réelle ; scénario de bout en bout (trois rechargements comparés, plus un par jour de révision) | `record.test.js`, `tests/browser/`, `e2e.test.js` |
| C4 · une révision, un seul événement | côté traitement : `REVIEW_GRADED` porte seul SRS et faiblesse | `effects.test.js` |
| C5 · compacter ne change aucun état | 10 journaux avec compaction forcée ; scénario de bout en bout | `journal.test.js`, `e2e.test.js` |
| 9.4 · échec d'écriture | compaction puis une seule nouvelle tentative, file volatile, ordre, `retry()`, redémarrage | `write-failure.test.js`, `e2e.test.js` |
| S10 (base) · nouveautés comptées tous écrans confondus | le cas cité par la partie 7 ; le respect par le moteur est pour l'étape 4 | `budget.test.js`, `e2e.test.js` |
| Invariants de 1.8 et 3.10 | tests dédiés et contrôle après chaque événement | `state.test.js`, `effects*.test.js`, `e2e.test.js` |
| Non-régression des modules repris | oracle de l'ancien `gradeReview` sur toutes les suites de 7 notes (21 844 révisions) ; oracle de `computeWeaknessPriority` | `srs.test.js`, `weakness.test.js` |

Le scénario de bout en bout (`e2e.test.js`) fait vivre `learning` du 1er octobre au
23 décembre :

- déclaration des kana ;
- leçon dans une session guidée ;
- pratique libre avec double envoi ;
- test de positionnement ;
- événements refusés ;
- échec d'écriture et reprise ;
- « Je le connais déjà » et annulation ;
- révisions jusqu'à la maîtrise ;
- déclaration du N5 avec une révision intercalée, puis annulation ;
- compaction au chargement et budget de chaque jour.

Les invariants, S6 et S7 sont vérifiés après chacun des événements.

---

## 4. Méthode de vérification

Chaque tâche a été vérifiée par **sabotage** : une règle est volontairement cassée, et au
moins un test doit échouer. Environ 70 sabotages ont été faits sur l'étape. Ceux qu'aucun
test n'attrapait ont révélé des trous, comblés avant livraison :

| Tâche | Trou révélé | Correction |
|---|---|---|
| 8 | retirer la file interne passait inaperçu (la mémoire confirme trop vite) | test avec un stockage qui confirme en retard |
| 10 | le jour UTC passait inaperçu ; l'exclusion des déclarations reposait sur un hasard | heure de test à 0 h 30 ; garde rendue effective |
| 11 | date de début d'échec écrasée ; erreur hors stockage traitée comme une panne | horloge qui avance ; comptage des tentatives |
| 12 | IndexedDB peut terminer dans le désordre deux transactions sur des magasins différents | nouveau cas de contrat commun, file d'exécution |
| 13 | le scénario ne visitait ni kana appris, ni déclaration sur un élément maîtrisé, ni double envoi, ni révision avant annulation | situations ajoutées |

Un seul sabotage reste hors de portée du scénario : la compaction du jour en cours, qui ne
peut se produire qu'au-delà de 5 000 événements dans la journée ; elle est couverte par les
tests unitaires de la tâche 9.

Deux attendus de test erronés ont aussi été corrigés en relecture (tâches 6 et 7) ; le code
était juste.

---

## 5. Points transmis aux étapes suivantes

| Étape | Point |
|---|---|
| 2 · Contenu | fournir `elementExists` et `elementsOfScope` à `createLearning` ; nom du champ de sens dans `QUESTION_ANSWERED` (A2-01) |
| 4 · Moteur | `computeQueuePriorityTier`, `prioritizeQueue`, `scheduleRelearning` (hasard injecté) ; contenu de la session (`plan`, `completedActivities`, `lastActivity`, `sourceActivity`) ; respect du budget à la composition, à la reprise et avant chaque bloc (S10) ; lecture des faiblesses actives seulement |
| 5 · Interface | C4 côté écran ; 9.4 côté écran (pause des exercices évalués, bandeau, Réessayer) ; n'avancer que sur `recorded` ; accès aux dossiers par `learning` |
| 6 · PWA | export / import (et sort des événements en attente) ; `navigator.storage.persist()` |
| Toutes | relancer `tests/browser/store-contract.html` après toute modification de `src/store/` |

Les décisions prises pendant l'étape sont consignées dans `ETAT-ACTUEL.md`, section
« Décisions complémentaires ».
