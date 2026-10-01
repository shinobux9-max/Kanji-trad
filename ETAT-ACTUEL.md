# Ocha v2 — État actuel

**S'applique à** : la branche `ocha-v2` uniquement.

Ce fichier dit **où en est la reconstruction**. Il évolue à chaque tâche. Ce que Ocha doit
devenir est décrit dans `docs/conception/` (verrouillé) ; comment travailler, dans
`REGLES-CONSTRUCTION.md`.

---

## Étape en cours

**Étape 1 · Stockage et apprentissage** (partie 9, 9.9) — découpage validé le 2026-10-01 ;
tâches 1 à 11 faites, tâche 12 à faire.

Sous PowerShell, lancer les tests avec `npm.cmd test` (la stratégie d'exécution de Windows
bloque `npm test`).

### Étape 1 · Stockage et apprentissage — en cours

| Tâche | Contenu | Tests | État |
|---|---|---|---|
| 1 | Contrat de stockage et version en mémoire (`src/store/contract.js`, `src/store/memory.js`) : les 9 magasins de 9.2, transaction multi-magasins tout ou rien, panne déclenchable à la demande | suite de contrat réutilisable, atomicité | ✅ fait |
| 2 | SRS repris (`src/learning/srs.js`) : `gradeReview` pur et `getDaysOverdue` seulement ; constantes dans `GUIDED_CONFIG.srsAlgorithm` | non-régression : chaque note à chaque répétition, intervalles 1, 3, 8, 20, 50, 125 avec « Bien » | ✅ fait |
| 3 | État calculé (`src/learning/state.js`) : `new` → `mastered`, par les règles générales (seuils 21 / 60) | invariants 1.8 ; cohérence `declaredVerificationWindowDays.min ≥ acquiredIntervalDays` | ✅ fait |
| 4 | Faiblesses (`src/learning/weakness.js`) : échec, réussite, résolution après 3 réussites, réactivation, `computeWeaknessPriority` ; constantes dans `GUIDED_CONFIG.weaknessPriority` | tableau 3.5, priorité identique à l'ancien code | ✅ fait |
| 5 | Format et validation des événements (`src/learning/events.js`) : 12 types, contexte, références `{ type, id }`, identifiant | rejets et acceptations | ✅ fait |
| 6 | Effets, 1re partie (`src/learning/effects.js`) : `CONTENT_INTRODUCED` ; `QUESTION_ANSWERED` avec création de l'entrée SRS à J+1 et exception du test de positionnement ; `REVIEW_GRADED` avec vérification ; outil de rejeu pour les tests | S6, S7, C1, C4, synthèse 3.4 | ✅ fait |
| 7 | Effets, 2e partie : `KNOWLEDGE_DECLARED` (entrée SRS de vérification), `KNOWLEDGE_DECLARATION_UNDONE`, avancement des activités | aucun recul pour chaque I de 21 à 45 et chaque note ; annulation | ✅ fait |
| 8 | `recordLearningEvent` (`src/learning/record.js`, `index.js`) : file un par un, calcul sur copie, une transaction, idempotence, notification, chargement initial, instantané | C2 (test statique), C3, idempotence, ordre | ✅ fait |
| 9 | Journal (`src/learning/journal.js`) : résumé quotidien, compaction 30 jours / 5 000 événements | C5 | ✅ fait |
| 10 | Budget quotidien (`src/learning/budget.js`) : éléments qui quittent Nouveau, tous écrans confondus ; kana et déclarations exclus | nouveautés prises hors mode guidé (base de S10) | ✅ fait |
| 11 | Échec d'écriture (9.4) : compaction puis une seule nouvelle tentative, file volatile, état « en échec », `retry()` | 9.4, avec un stockage qui échoue à la demande | ✅ fait |
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
  mémoire), `src/learning/` (`index.js`, `record.js`, `srs.js`, `state.js`,
  `weakness.js`, `events.js`, `effects.js`, `journal.js`, `budget.js`,
  `dates.js`), `tools/check-layers.mjs`, `tools/validate-data.mjs`, `tests/` (252 tests), `docs/conception/`, `docs/rapports/`, `package.json` (modules ESM).
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
| 2026-10-01 | Faiblesses : une réussite sur une faiblesse inactive la laisse inactive et garde sa date de résolution ; `computeWeaknessPriority` reste le calcul brut de l'ancien code, et c'est à l'appelant d'écarter les faiblesses inactives (`isWeaknessActive`) | `src/learning/weakness.js` |
| 2026-10-01 | Format des événements : schéma strict (champ inconnu refusé) ; `at` en UTC canonique (forme de `toISOString`) pour que l'index du journal trie correctement ; préfixes `evt_`, `ses_`, `fld_` ; `context.activityType` obligatoire sauf pour les événements de session, où il est sans objet ; `sessionId` obligatoire pour ces derniers ; forme des identifiants d'éléments vérifiée par type (partie 1, 1.1) | `src/learning/events.js` |
| 2026-10-01 | Déclaration par niveau : `scope` vaut `kana`, `n5`, `n4`, `n3`, `n2` ou `n1` (un seul niveau, celui choisi ; les niveaux inférieurs sont inclus par les effets, partie 1, 1.5) | `src/learning/events.js` |
| 2026-10-01 | Charges utiles définies par le moteur (`plan`, `completedActivities`, `lastActivity`, `sourceActivity`) : présence vérifiée, contenu fixé à l'étape 4 | `src/learning/events.js` |
| 2026-10-01 | L'origine technique « appris » est identifiée par `learned` ; les trois origines sont donc `learned`, `declared`, `tested`. `verified` reste un fait distinct de l'origine, posé seulement pour `declared` et `tested` | `src/learning/effects.js` |
| 2026-10-01 | Entrée SRS d'une première évaluation : intervalle `firstCheckDelayDays` (1 jour), facilité initiale 2,5, 0 répétition, aucune date de dernière révision, échéance le lendemain à la même heure locale ; l'origine `learned` est posée en même temps (un élément Découvert n'a pas d'origine) | `src/learning/effects.js` |
| 2026-10-01 | Délai de vérification d'une déclaration : 21 + (empreinte FNV-1a 32 bits de « date de la déclaration \| identifiant de l'élément » modulo 25) jours après la déclaration, la date étant l'horodatage `at` de la déclaration ; même élément et même déclaration donnent toujours le même délai (partie 1, 1.3) | `src/learning/effects.js` |
| 2026-10-01 | Déclaration par niveau : le contenu fournit les éléments d'un niveau (`elementsOfScope`, injectée) ; `learning` applique le cumul kana → N5 → N4 → … jusqu'au niveau choisi | `src/learning/effects.js` |
| 2026-10-01 | Trace d'une déclaration (magasin `declarations`) : `{ id, at, origin, scope ou elements, previous, undoneAt }`, où `previous` contient les faits d'avant des seuls éléments modifiés (`null` s'ils n'en avaient pas) ; la trace est conservée après annulation | `src/learning/effects.js` |
| 2026-10-01 | Annulation d'une déclaration : un élément n'est rétabli que s'il est encore exactement tel que la déclaration l'a laissé (cela couvre « vérifié depuis » et une déclaration plus récente) ; un élément sans faits avant la déclaration est retiré du magasin ; une déclaration déjà annulée est sans effet ; une déclaration inconnue ou un identifiant réutilisé est une erreur | `src/learning/effects.js` |
| 2026-10-01 | Avancement : faits `startedAt` et `completedAt` (premières dates, jamais repoussées), statut calculé (`computeActivityStatus`) ; `ACTIVITY_SKIPPED` ne change pas l'avancement (le moteur le lit dans le journal) ; l'étape atteinte d'une mission en cours est enregistrée avec la session | `src/learning/effects.js`, `state.js` |
| 2026-10-01 | `KNOWLEDGE_DECLARATION_UNDONE` constitue l'exception explicite à S6 et S7 : lorsqu'elle rétablit les faits antérieurs à une déclaration, elle peut supprimer ou modifier une entrée SRS et faire reculer l'état sans `REVIEW_GRADED` ni « Oublié ». Aucun autre événement ne bénéficie de cette exception (règle spécifique de 1.5 et 3.4, qui prime sur la formulation générale des critères) | `tests/learning/effects-knowledge.test.js` |
| 2026-10-01 | Interface du traitement central : `createLearning({ store, config, elementExists, elementsOfScope, warn })` donne `load()`, `recordLearningEvent(event, { session })`, `getSnapshot()`, `getSession()`, `subscribe()`. Résultat : `recorded`, `duplicate` (même identifiant déjà enregistré : aucun effet), `rejected` (invalide, ou incompatible avec l'état : rien n'est écrit, signalement par `warn`, `console.warn` par défaut) ou `pending` (échec du stockage, voir 9.4 ci-dessous) ; l'état en mémoire ne change qu'après confirmation du stockage | `src/learning/record.js` |
| 2026-10-01 | Session en cours : enregistrée sous la clé `current` du magasin `sessions`, sous la forme `{ id: 'current', value }`, contenu opaque pour `learning` jusqu'à l'étape 4 ; `session: null` l'efface, l'option absente n'y touche pas | `src/learning/record.js` |
| 2026-10-01 | L'instantané (`getSnapshot`) et la session sont gelés : un écran ne peut pas les modifier | `src/learning/record.js` |
| 2026-10-01 | Surface publique de `learning` (`index.js`) : traitement central, construction et validation d'événements, fonctions de lecture (état, avancement, faiblesse active, priorité, retard). Aucune fonction d'écriture n'est exposée (`gradeReview`, `applyWeakness…`, `applyEvent`) ; un test statique (C2) refuse tout import d'un module interne de `learning` depuis une autre couche | `src/learning/index.js`, `tests/learning/surface.test.js` |
| 2026-10-01 | Résumé quotidien tenu à jour à chaque événement enregistré, dans la même transaction (et non au moment de la compaction) : aucun jour n'est jamais sans résumé, et la compaction ne fait que supprimer du détail déjà résumé ; doublons, événements rejetés et échecs du stockage n'y comptent pas | `src/learning/journal.js`, `record.js` |
| 2026-10-01 | Contenu du résumé d'un jour (clé : jour local) : réponses justes et fausses par mode puis par type d'exercice (`none` sans type), révisions SRS par note (pour la régularité), activités terminées, secondes d'activités terminées et minutes de sessions guidées, gardées séparément | `src/learning/journal.js` |
| 2026-10-01 | Compaction : sont conservés tout le jour en cours, puis le détail des 30 derniers jours locaux (jour en cours compris) dans la limite de 5 000 événements au total, les plus récents d'abord ; un événement daté dans le futur est conservé. Elle a lieu au chargement, une fois par jour au plus (`meta.lastCompaction`) ; un échec est signalé sans bloquer le chargement ; `compactJournal()` la déclenche à la demande | `src/learning/journal.js`, `record.js` |
| 2026-10-01 | Horloge injectable (`now`) dans `createLearning`, utilisée pour la compaction et pour le jour du budget ; les effets d'un événement utilisent toujours sa date `at` | `src/learning/record.js` |
| 2026-10-01 | Budget quotidien : un élément « quitte Nouveau » quand son état calculé passe de Nouveau à un autre état sous l'effet d'un événement d'apprentissage (présentation, première réponse évaluée, première note SRS) ; déclarations, annulations et test de positionnement n'en font jamais partie. Ce fait est établi au moment de l'événement et compté par type dans le résumé du jour (`introduced`, kana compris), dans la même transaction ; le budget du jour (kana exclus) se lit dans ce résumé, il ne dépend donc ni de la compaction ni d'un rejeu | `src/learning/budget.js`, `journal.js`, `record.js` |
| 2026-10-01 | `getNewContentBudget(dailyNewBudget)` donne `{ date, used, limit, remaining }` pour le jour local de l'horloge ; le plafond, réglage de l'utilisateur, est reçu en argument ; `learning` compte, le moteur décide (étape 4) | `src/learning/record.js` |
| 2026-10-01 | Un élément ramené à Nouveau par l'annulation d'une déclaration consomme le budget s'il est ensuite présenté ou évalué : une déclaration n'est pas un apprentissage | `src/learning/budget.js` |
| 2026-10-01 | Échec d'écriture (9.4) : sur une panne du stockage (`StorageError`), compaction immédiate puis une seule nouvelle tentative ; si elle échoue, l'événement passe au statut `pending` et attend dans une file volatile, en mémoire. L'échec est visible par `getWriteFailure()` (`{ since, kind, message, pendingCount }`, `since` étant le début de l'échec) et `onWriteFailureChange()`. Pendant l'échec, tout événement valide rejoint la file sans être tenté, pour garder l'ordre ; un événement invalide reste rejeté. `retry()` enregistre la file dans l'ordre, s'arrête au premier échec, écarte en le signalant un événement devenu incompatible avec l'état ; l'idempotence évite les doublons. La file est perdue si l'app se ferme : aucune seconde persistance | `src/learning/record.js` |
| 2026-10-01 | Seule une panne du stockage déclenche 9.4 ; toute autre erreur rejette la promesse, sans compaction ni nouvelle tentative | `src/learning/record.js` |
| 2026-10-01 | `REVIEW_GRADED` sur un élément sans entrée SRS : la note est sa première évaluation (partie 1 : « question d'exercice ou note SRS »), donc `gradeReview` s'applique aussitôt à partir de l'entrée de départ de l'ancien code, alors que `QUESTION_ANSWERED` crée une entrée à J+1 sans la noter ; date d'introduction et origine `learned` posées si absentes | `src/learning/effects.js` |

---

## Points ouverts

- **9.4 côté écran** (étape 5) : sur `pending`, mettre aussitôt en pause les exercices évalués,
  afficher le bandeau « Ta dernière réponse n'a pas pu être enregistrée. » avec Réessayer
  (`retry()`) et Exporter mes données, laisser la consultation possible. L'export (étape 6)
  devra préciser s'il inclut les événements en attente.
- **C4 côté écran** : la tâche 6 garantit que `REVIEW_GRADED` porte à lui seul les effets
  d'une révision. Que l'écran de révision n'émette qu'un seul événement par carte se vérifiera
  avec l'interface (étape 5).
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
| 2026-10-01 | 1 · 4 | Faiblesses progressives (échec, réussite, résolution après 3 réussites, réactivation), `computeWeaknessPriority` repris à l'identique (constantes dans `GUIDED_CONFIG.weaknessPriority`) ; lecture des dates commune (`dates.js`, `srs.js` patché) ; 17 tests | — |
| 2026-10-01 | 1 · 5 | Format et validation des 12 types d'événements (`validateEvent`, existence des éléments injectée), invariant 3 de 3.10 (`REVIEW_GRADED` seulement en révision SRS), `createEventId` ; 15 tests | — |
| 2026-10-01 | 1 · 6 | Effets purs de `CONTENT_INTRODUCED`, `QUESTION_ANSWERED` (exception du test de positionnement) et `REVIEW_GRADED` (vérification) ; rejeu de journaux aléatoires pour S6 et S7, C1, C4 côté traitement ; `addCalendarDays` dans `dates.js` (`srs.js` patché) ; 20 tests | — |
| 2026-10-01 | 1 · 7 | Effets de `KNOWLEDGE_DECLARED` (délai déterministe, cumul des niveaux, trace), de son annulation et de l'avancement des activités ; S6 et S7 sur des journaux avec déclarations ; `computeActivityStatus` ; `effects.test.js` adapté ; délai dépendant de la date de déclaration et de l'identifiant (correctif de relecture) ; 27 tests | — |
| 2026-10-01 | 1 · 8 | `recordLearningEvent` : validation, calcul sur l'état en mémoire, une transaction (événement, faits, session), idempotence, file interne, notifications, chargement, instantané gelé ; surface publique `index.js` ; C2 (test statique), C3 (rechargement et rejeu) ; 23 tests | — |
| 2026-10-01 | 1 · 9 | Résumé quotidien dans la transaction de chaque événement, compaction (jour en cours jamais compacté), compaction quotidienne au chargement, `getDailySummaries`, `localDayKey` ; C5 ; horloge fixée dans `record.test.js` ; 15 tests | — |
| 2026-10-01 | 1 · 10 | Budget quotidien de nouveautés : `elementsLeavingNew`, comptage par type dans le résumé du jour, `getNewContentBudget` ; base de S10 ; `journal.test.js` adapté (champ `introduced`) ; 13 tests | — |
| 2026-10-01 | 1 · 11 | Échec d'écriture (9.4) : compaction puis une seule nouvelle tentative, file volatile, statut `pending`, échec observable, `retry()` dans l'ordre ; trois tests des tâches 8 et 9 adaptés au nouveau comportement ; 16 tests | — |
