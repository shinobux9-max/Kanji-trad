# Ocha v2 — État actuel

**S'applique à** : la branche `ocha-v2` uniquement.

Ce fichier dit **où en est la reconstruction**. Il évolue à chaque tâche. Ce que Ocha doit
devenir est décrit dans `docs/conception/` (verrouillé) ; comment travailler, dans
`REGLES-CONSTRUCTION.md`.

---

## Étape en cours

**Étape 1 · Stockage et apprentissage** (partie 9, 9.9) — découpage validé le 2026-10-01 ;
tâches 1 à 3 faites, tâche 4 à faire.

Sous PowerShell, lancer les tests avec `npm.cmd test` (la stratégie d'exécution de Windows
bloque `npm test`).

### Étape 1 · Stockage et apprentissage — en cours

| Tâche | Contenu | Tests | État |
|---|---|---|---|
| 1 | Contrat de stockage et version en mémoire (`src/store/contract.js`, `src/store/memory.js`) : les 9 magasins de 9.2, transaction multi-magasins tout ou rien, panne déclenchable à la demande | suite de contrat réutilisable, atomicité | ✅ fait |
| 2 | SRS repris (`src/learning/srs.js`) : `gradeReview` pur et `getDaysOverdue` seulement ; constantes dans `GUIDED_CONFIG.srsAlgorithm` | non-régression : chaque note à chaque répétition, intervalles 1, 3, 8, 20, 50, 125 avec « Bien » | ✅ fait |
| 3 | État calculé (`src/learning/state.js`) : `new` → `mastered`, par les règles générales (seuils 21 / 60) | invariants 1.8 ; cohérence `declaredVerificationWindowDays.min ≥ acquiredIntervalDays` | ✅ fait |
| 4 | Faiblesses (`src/learning/weakness.js`) : échec, réussite, résolution après 3 réussites, réactivation, `computeWeaknessPriority` ; constantes dans `GUIDED_CONFIG.weaknessPriority` | tableau 3.5, priorité identique à l'ancien code | à faire |
| 5 | Format et validation des événements (`src/learning/events.js`) : 12 types, contexte, références `{ type, id }`, identifiant | rejets et acceptations | à faire |
| 6 | Effets, 1re partie (`src/learning/effects.js`) : `CONTENT_INTRODUCED` ; `QUESTION_ANSWERED` avec création de l'entrée SRS à J+1 et exception du test de positionnement ; `REVIEW_GRADED` avec vérification ; outil de rejeu pour les tests | S6, S7, C1, C4, synthèse 3.4 | à faire |
| 7 | Effets, 2e partie : `KNOWLEDGE_DECLARED` (entrée SRS de vérification), `KNOWLEDGE_DECLARATION_UNDONE`, avancement des activités | aucun recul pour chaque I de 21 à 45 et chaque note ; annulation | à faire |
| 8 | `recordLearningEvent` (`src/learning/record.js`, `index.js`) : file un par un, calcul sur copie, une transaction, idempotence, notification, chargement initial, instantané | C2 (test statique), C3, idempotence, ordre | à faire |
| 9 | Journal (`src/learning/journal.js`) : résumé quotidien, compaction 30 jours / 5 000 événements | C5 | à faire |
| 10 | Budget quotidien (`src/learning/budget.js`) : éléments qui quittent Nouveau, tous écrans confondus ; kana et déclarations exclus | nouveautés prises hors mode guidé (base de S10) | à faire |
| 11 | Échec d'écriture (9.4) : compaction puis une seule nouvelle tentative, file volatile, état « en échec », `retry()` | 9.4, avec un stockage qui échoue à la demande | à faire |
| 12 | IndexedDB (`src/store/indexeddb.js`, `src/store/schema.js`) : base `ocha`, schéma v1, migrations numérotées, `meta` | schéma testé dans Node ; adaptateur vérifié par la page `tests/browser/` | à faire |
| 13 | Clôture : scénario de bout en bout sur la mémoire, `check-layers`, rapport `docs/rapports/etape1.md` | toute la suite verte | à faire |

### Étape 0 · Préparation — ✅ terminée

| Tâche | Contenu | État |
|---|---|---|
| 1 | Branche `ocha-v2`, arborescence, `.gitignore` | ✅ fait (commit `c1a0f7b`) |
| 2 | Gouvernance et documentation | ✅ fait (commit `a7b701a`) |
| 3 | `src/config.js` avec `GUIDED_CONFIG` et réglages initiaux | ✅ fait |
| 4 | `tools/check-layers.mjs` | ✅ fait |
| 5 | `tools/validate-data.mjs` | ✅ fait |
| 6 | Nettoyage des données, validation sans erreur | ✅ fait |

---

## Contenu de la branche

- **Nouvelle base** : `src/config.js`, `src/store/` (contrat de stockage, version en
  mémoire), `src/learning/` (`srs.js`, `state.js`), `tools/check-layers.mjs`,
  `tools/validate-data.mjs`, `tests/` (106 tests), `docs/conception/`, `docs/rapports/`, `package.json` (modules ESM).
  Les autres dossiers de `src/` sont vides pour l'instant.
- **Ancienne app** (`js/`, `css/`, `index.html`, `sw.js`…) : conservée **comme référence**
  pour reprendre la logique des modules listés dans la stratégie de reconstruction. Elle
  n'est pas modifiée. Son sort (déplacement ou suppression) sera décidé à l'étape 5, quand la
  nouvelle interface arrivera.
- **Anciens documents de l'app** : dans `docs/legacy/`, pour référence uniquement. Ils ne
  s'appliquent pas à la v2.
- **Données** (`data/`) : N5 et fichiers communs validés sans erreur
  (`node tools/validate-data.mjs`) ; N4 à N1 hors périmètre de validation.

## Autres branches

- `Modularisation` : app actuelle, avec le travail de style le plus récent. Non touchée.
- `UI-sans-refonte` : point de départ de `ocha-v2`. Non touchée.

Le dépôt s'appelle désormais `Ocha` (https://github.com/shinobux9-max/Ocha).

---

## Décisions complémentaires

Décisions prises pendant la reconstruction, qui complètent le document de conception sans
modifier ses parties verrouillées.

| Date | Décision | Où |
|---|---|---|
| 2026-09-29 | Réglages initiaux : 10 nouveautés par jour (contenu seulement, kana exclus), format de session normal | `src/config.js`, `DEFAULT_USER_SETTINGS` |
| 2026-09-29 | Commande de test : `npm test` (`node --test "tests/**/*.test.js"`), `node --test tests/` ne fonctionnant pas avec Node 22+ | `package.json`, `REGLES-CONSTRUCTION.md` v2.2 |
| 2026-09-29 | `src/app.js` (démarrage) a les mêmes droits que l'interface : imports, accès au navigateur, `store/settings.js` seulement | `tools/check-layers.mjs`, `REGLES-CONSTRUCTION.md` v2.2 |
| 2026-09-30 | Addendum A1 : le champ des constructions générées s'appelle `construction` (`pattern` reste le motif d'affichage) | `docs/conception/addendum-A1-construction.md` |
| 2026-09-30 | `particles.json` déplacé dans `data/n5/` ; `concepts`, `curriculum` et `mapping` restent en place jusqu'à l'étape 5, car l'ancienne app les charge | `data/` |
| 2026-09-30 | `group` non conjugables admis : adverbe, pronom, interrogatif, démonstratif, conjonction, temps, quantité, interjection | `tools/validate-data.mjs` |
| 2026-09-30 | Avertissements ajoutés : kanji absent des listes, catégorie isolée, catégories en double | `tools/validate-data.mjs` |
| 2026-09-30 | Unicité des identifiants entre fichiers (par espace), préfixes obligatoires, `kanji_list` à un kanji par entrée | `tools/validate-data.mjs` |
| 2026-10-01 | 結婚 et 練習 restent des noms (« mariage », « entraînement »), non transformés en verbes en する | `data/n5/vocab.json` |
| 2026-10-01 | Addendum A2 : l'ENTRY est l'unique unité de progression du vocabulaire ; tags officiels, non sémantiques, plats et contrôlés | `docs/conception/addendum-A2-liaison.md` |
| 2026-10-01 | Constantes de l'ancien `gradeReview` et de `computeWeaknessPriority` déplacées dans `GUIDED_CONFIG` (`srsAlgorithm`, `weaknessPriority`), à valeurs strictement identiques : explicitation des paramètres, pas un nouvel algorithme | `src/config.js` (tâches 2 et 4) |
| 2026-10-01 | Frontière du jour : date locale de l'appareil, pour la clé `daily` et le budget quotidien | `src/learning/journal.js`, `budget.js` |
| 2026-10-01 | La compaction ne résume jamais le jour en cours ; le plafond de 5 000 événements peut être dépassé ce jour-là, la justesse du budget primant | `src/learning/journal.js` |
| 2026-10-01 | La création d'une entrée SRS est un effet d'événement (J+1 à la première évaluation, 21 à 45 jours à la déclaration) ; `srs.js` ne contient que `gradeReview` et `getDaysOverdue` | `src/learning/effects.js`, `srs.js` |
| 2026-10-01 | Entrée SRS d'une déclaration : intervalle égal au délai déterministe de vérification (21 à 45 jours), 3 répétitions (contrainte réelle : au moins 2, sinon `gradeReview` ferait reculer un élément Acquis), facilité 2,5, aucune date de dernière révision ; la première vraie révision suit l'algorithme normal | `src/learning/effects.js` (tâche 7) |
| 2026-10-01 | L'état d'un élément déclaré se calcule par les règles générales (intervalle ≥ `acquiredIntervalDays` ⇒ Acquis) ; aucune règle « déclaré = Acquis » ; un test garantit `declaredVerificationWindowDays.min ≥ acquiredIntervalDays` | `src/learning/state.js` (tâche 3) |
| 2026-10-01 | Annulation d'une déclaration : un élément `verified` a été révisé depuis, et ses révisions priment | `src/learning/effects.js` (tâche 7) |
| 2026-10-01 | Session et mission persistées dans la transaction de l'événement : `recordLearningEvent(event, { session })`, instantané opaque pour `learning` jusqu'à l'étape 4 | `src/learning/record.js` |
| 2026-10-01 | Choix techniques de `learning` : horloge prise dans `event.at`, existence des éléments vérifiée par une fonction injectée (le contenu arrive à l'étape 2), `src/learning/index.js` seule surface publique (test statique pour C2) | `src/learning/` |
| 2026-10-01 | `computeQueuePriorityTier`, `prioritizeQueue` et `scheduleRelearning` reportés à l'étape 4 (moteur), avec un hasard injecté | — |
| 2026-10-01 | IndexedDB sans dépendance de test : contrat testé sur la version en mémoire dans Node, adaptateur IndexedDB vérifié par une page manuelle (`tests/browser/`) | tâche 12 |
| 2026-10-01 | `getDaysOverdue` reprend le comportement réel de l'ancien code : écart signé à l'échéance, négatif avant l'échéance, malgré l'ancien commentaire qui annonçait 0 | `src/learning/srs.js` |

---

## Points ouverts

- **Identifiant de code de l'origine « appris »** : la conception fixe `declared` et `tested`
  (partie 3), mais pas l'identifiant de `appris`. À trancher avant la tâche 6, qui l'écrit
  à la première évaluation. Proposition : `learned`.
- **Dossiers** : le magasin `folders` existe dans le schéma v1 ; son accès (par `learning`,
  jamais directement par l'interface) sera défini à l'étape 5.
- **Champ de sens dans `QUESTION_ANSWERED`** : nom fixé par A2-01, ajouté ensuite ; rien
  n'est anticipé à l'étape 1.
- **Export / import** (bouton du bandeau 9.4) : étape 6. L'étape 1 expose l'état d'échec et
  `retry()`.
- **`fake-indexeddb`** : à reconsidérer seulement si la vérification manuelle de l'adaptateur
  IndexedDB devient pénalisante.
- **Architecture lexicale A2** : document de liaison validé
  (`docs/conception/addendum-A2-liaison.md`). Prochain chantier : A2-01, schéma concret
  ENTRY → SENSE (étape 2). La place des projets A2-06 à A2-09 reste à arbitrer.
- **`data/n5/exemples.json` à reconstruire** : 436 exemples par kanji sans hiragana, exemples
  de vocabulaire découpés par des espaces (voir `docs/rapports/etape0-tache6.md`). À traiter
  avec la migration A2 ou un projet dédié.
- **N4** : dans l'ancien format de données (identifiants, `group`, exemples, romaji). À migrer
  au format v2 avant son intégration au moteur guidé. Le validateur ne couvre que le N5 d'ici
  là.
- **75 leçons de grammaire sans `requires`** : dépendances à écrire (travail pédagogique).
- **À l'étape 5** : déplacer `concepts/n5.json` vers `data/n5/concepts.json`, et
  `curriculum/n5.json` et `mapping.json` vers `data/legacy/`.

---

## Journal des tâches

| Date | Étape · tâche | Résumé | Commit |
|---|---|---|---|
| 2026-09-29 | 0 · 1 | Branche `ocha-v2` créée depuis `UI-sans-refonte`, arborescence, `.gitignore` | `c1a0f7b` |
| 2026-09-29 | 0 · 2 | Documents de conception, nouvelles règles et état ; anciens documents rangés dans `docs/legacy/` | `a7b701a` |
| 2026-09-29 | 0 · 3 | `src/config.js` : GUIDED_CONFIG (parties 1 à 5), réglages initiaux de l'utilisateur ; `package.json` en ESM | — |
| 2026-09-29 | 0 · 4 | `tools/check-layers.mjs` et ses 19 tests, commande `npm test`, droits de `src/app.js` | — |
| 2026-09-30 | — | Addendum A1 (`construction`) ; `particles.json` déplacé dans `data/n5/` | — |
| 2026-09-30 | 0 · 5 | `tools/validate-data.mjs` et ses 23 tests, périmètre N5 | — |
| 2026-10-01 | 0 · 6 | Nettoyage structurel des données : validation sans erreur (rapport : `docs/rapports/etape0-tache6.md`) | — |
| 2026-10-01 | — | Addendum A2 : liaison entre l'architecture sémantique A2 et la conception | — |
| 2026-10-01 | 1 · — | Découpage de l'étape 1 en 13 tâches et arbitrages préalables validés | — |
| 2026-10-01 | 1 · 1 | Contrat de stockage (9 magasins, transactions tout ou rien, `StorageError`), version en mémoire avec pannes à la demande, suite de contrat réutilisable ; 32 tests | — |
| 2026-10-01 | 1 · 2 | `gradeReview` et `getDaysOverdue` repris en fonctions pures, constantes dans `GUIDED_CONFIG.srsAlgorithm` ; oracle de l'ancien calcul sur toutes les suites de 7 notes ; 13 tests | — |
| 2026-10-01 | 1 · 3 | État calculé (`computeState`, `STATES`, `STATE_ORDER`) par l'intervalle seul ; vérification des invariants 2 et 3 (`checkElementFacts`) ; cohérence de la configuration (`tests/config.test.js`) ; 19 tests | — |
