# HANDOFF — Refactoring ESM de kanji.js (Kanji-trad)

## Contexte du projet

Application web/PWA d'apprentissage du japonais. Le monolithe original `kanji.js`
(~9700 lignes) contient toute la logique métier, le rendu DOM et les interactions.
L'objectif : le migrer progressivement vers des ES Modules, **section par section**,
sans jamais changer le comportement observable de l'app ni ajouter de fonctionnalité.

**Règle absolue rappelée par l'utilisateur en cours de route** : ceci est une
modularisation pure. Ne jamais improviser une variante « plus propre » d'une fonction —
toujours copier le comportement exact du monolithe, quitte à dupliquer du code plutôt que
d'inventer un raccourci qui changerait un résultat, même subtilement.

Le monolithe de référence (`kanji.js`, la source de vérité) et `index.html` sont
fournis en pièces jointes du projet — s'y référer systématiquement avant de porter
une nouvelle section, ne jamais deviner une implémentation.

## Architecture cible

```
js/
├── app.js                    ✅ COMPLET (voir "Session [continuation 11]") — bootstrap
│                                init(), 90/92 fonctions onclick exposées sur window,
│                                initNavigation/initSwipeNavigation/initMicSearch/
│                                initPullToRefresh appelées au bootstrap
├── core/
│   ├── constants.js   ✅ complet
│   ├── state.js       ✅ à jour
│   ├── storage.js     ✅ à jour
│   ├── navigation.js  ✅ complet (très landmine-heavy PAR NÉCESSITÉ STRUCTURELLE)
│   └── data-loader.js ✅ à jour — findLessonByIdSync/findLessonByItemSync/
│                          kanaToRomajiPrecise/hasKanjiChar/getItemRomaji ajoutées cette
│                          session (voir "Session [continuation 7]")
├── learning/
│   ├── srs.js         ✅ complet
│   ├── weakness.js    ✅ COMPLET (renderWeaknessWidget/resolveWeaknessEntry/
│   │                      openWeaknessItem/trainWeaknessItems ajoutées cette session —
│   │                      résout la landmine renderWeaknessWidget() de ui/dashboard.js)
│   ├── exercises.js   ✅ COMPLET (voir "Session [continuation 10]") — onboarding, parcours
│   │                      de leçon, "Explorer les leçons", ET initSwipeNavigation()
│   │                      (jamais portée avant — le swipe ne fonctionnait nulle part en ESM)
│   └── learning-path.js ✅ COMPLET (voir "Session [continuation 9]") — parcours guidé par
│                            unités, moteur générique, concepts en micro-écrans, exercices mixtes
├── features/
│   ├── kanji.js       ✅ quasi complet
│   ├── vocabulary.js  ✅ COMPLET (voir "Session [continuation 6]") — liste, fiche détail,
│   │                      révision flashcard+QCM+trou à combler+SRS
│   ├── grammar.js     ✅ COMPLET (voir "Session [continuation 7]") — liste par unité, fiche
│   │                      détail, révision flashcard+trou à combler+SRS, renvoi entre leçons
│   ├── kana.js         ✅ COMPLET
│   ├── quiz.js         ✅ complet
│   ├── strokes.js      ✅ complet pour le tracé KANJI
│   ├── oral.js          🟡 normalisation micro faite + speakText ajoutée cette session ;
│                            startOralTest PAS FAIT
│   └── free-training.js ✅ COMPLET (voir "Session [continuation 8]") — config, session
│                            (flip-card+cloze+QCM), résultats, stats globales. Contient aussi (découvert
│                            lors du chantier dashboard) TRAINING_STATS_KEY/
│                            getTrainingStats/saveTrainingStats/recordTrainingSession,
│                            physiquement entremêlés avec le code dashboard dans le
│                            monolithe (même région) mais PAS portés ici — à porter avec
│                            ce fichier le moment venu.
└── ui/
    ├── dashboard.js   ✅ COMPLET dans son périmètre délimité — widget de faiblesse
    │                      résolu cette session (voir "Session [continuation 4]")
    ├── cards.js       ❌ stub non conforme, jamais touché
    ├── modals.js      ✅ COMPLET — recherche unifiée entière (voir "Session [continuation 5]")
    │                      — chantier découvert lors du portage de navigation.js, maintenant fait
    └── common.js      ✅ à jour — mdBold/autoWrapRuby/buildFicheDetailContent/
                           showFicheCorrectionModal/closeFicheCorrectionModal ajoutées
                           cette session (voir "Session [continuation 4]")
```

## Session [continuation 5] — ui/modals.js créé : recherche unifiée complète

Objectif : résoudre les landmines `resetSearchFilters`/`showSearchPanel`/`hideSearchPanel`
de `core/navigation.js::toggleSearch()`, découvertes lors du chantier précédent.

**Décision de placement** : le sous-système ENTIER de recherche (filtres, exécution,
rendu des résultats, hit-builders par type) a besoin d'importer `features/kanji.js`
(`getJLPTLevel`, `openDetail`) et `features/kana.js` (`openKanaDetail`) — impossible
depuis `core/navigation.js` (même mur structurel que d'habitude : ces deux fichiers
importent déjà `pushModalState` depuis `navigation.js`). Placé dans `ui/modals.js`
(stub vide jusqu'ici) — vérifié SANS cycle avant d'écrire. `toggleSearch()`/
`closeSearchOverlay()` restent dans `navigation.js` (légitime : coordination via
l'historique), mais leurs appels vers `resetSearchFilters()`/`showSearchPanel()`/
`hideSearchPanel()` restent des landmines même maintenant que ces fonctions existent
réellement — `navigation.js` ne peut toujours pas importer `ui/modals.js` en retour.
Commentaires mis à jour en conséquence dans les deux fichiers.

**Bug évité en écrivant le fichier** (pas découvert après coup) : le hit kanji du
monolithe fait `onclick="openDetail(kanjiDb[kanjiMap.get('${safeChar}')])"` —
fonctionne dans le monolithe car `kanjiDb`/`kanjiMap` sont des globales bare. Ici,
`state.data.kanjiDb`/`state.data.kanjiMap` sont des propriétés d'un import de module,
inaccessibles depuis un attribut `onclick` (contexte global). Créé
`openKanjiFromSearchHit(char)` (nouvelle fonction, exportée) qui lit `state.*` en
interne — même principe que `replayKanaTraceQuiz` (features/kana.js, session
précédente). Pas une improvisation : conséquence mécanique du passage à l'ESM.

**Découverte annexe, notée mais pas traitée (hors périmètre)** : `loadFolders()`
(porté dans `features/kanji.js`, appelle `getFoldersData()` de `core/storage.js`) ne
correspond à AUCUNE fonction du monolithe sous ce nom — le monolithe utilise
`localStorage` brut directement (`FOLDERS_KEY = 'kanji_folders_v1'`, ligne ~1806).
**Vérifié fonctionnellement équivalent** (même clé de stockage, même comportement de
lecture/écriture/défaut) — pas un bug, mais une déviation de nommage par rapport à la
règle "porter exactement" faite par une session antérieure à celle-ci. Laissé tel quel
(fonctionne correctement, corriger maintenant serait un remaniement hors sujet) mais à
garder en tête : `grep -n "^function nomDeFonction"` sur le monolithe ne trouvera PAS
`getFoldersData`, ce qui peut surprendre lors d'une future vérification croisée.

**Découverte annexe 2, notée pour un futur chantier** : `kanaToRomajiPrecise(str)`
(ligne ~1518 du monolithe, gère gémination/allongement/yōon — plus précise que
`kanaToRomaji`, utilisée pour l'item des fiches grammaire via `getItemRomaji`) n'a
JAMAIS été portée nulle part, alors qu'elle est utilisée par le Learning Path (feature
encore non portée, `learning/learning-path.js`). Ni bloquant ni urgent maintenant, mais
à porter avec `learning-path.js` — probablement vers `core/data-loader.js`, aux côtés
de `KANA_TO_ROMAJI`/`kanaToRomaji` dont elle dépend directement.


## Session [continuation 4] — learning/weakness.js complété, widget de faiblesse résolu

Objectif : résoudre la landmine `renderWeaknessWidget()` créée dans `ui/dashboard.js`
lors de la session précédente.

**Deux nouveaux cycles évités, vérifiés programmatiquement AVANT d'écrire le code** (pas
après, contrairement au cycle #8 de la session précédente — la leçon a été appliquée) :

9. **`learning/weakness.js` ne peut jamais importer `learning/srs.js` ni
   `features/kanji.js`** : `srs.js` importe déjà `weakness.js` (pour
   `updateWeaknessTracking`), et `kanji.js` importe `srs.js` — donc
   `weakness.js -> srs.js -> weakness.js` ET `weakness.js -> kanji.js -> srs.js ->
   weakness.js` cyclent tous les deux. Conséquence : `getRawItemsForTypeLevel`
   (srs.js, existe réellement) et `getJLPTLevel` (kanji.js, existe réellement) restent
   des landmines dans `resolveWeaknessEntry`/`buildFicheDetailContent` malgré leur
   existence réelle — **même situation structurelle que le cycle #8**, `weakness.js`
   est un "hub" pour la même raison que `navigation.js`.
10. **`ui/common.js` ne peut jamais importer `features/kanji.js`** : `kanji.js` importe
    déjà `ui/common.js` (pour `isBulkSelected`/`refreshMasteryUI`) — cycle direct sinon.
    Découvert en décidant où placer `buildFicheDetailContent` (dont la branche kanji a
    besoin de `getJLPTLevel`) — confirme que `getJLPTLevel` doit être une landmine peu
    importe où vit `buildFicheDetailContent`.

**Décisions de placement** :
- `mdBold`/`autoWrapRuby` (utilitaires de formatage texte, aucune dépendance) déplacées
  vers `ui/common.js` — même famille que `escapeHtml()` déjà présente, et transversales
  à de nombreuses features (vocab, grammaire, kanji, Learning Path).
- `buildFicheDetailContent`/`showFicheCorrectionModal`/`closeFicheCorrectionModal`
  également placées dans `ui/common.js` (pas dans `weakness.js`, qui n'est qu'UN des
  consommateurs) : générique "afficher n'importe quel type de fiche dans un modal", pas
  spécifique aux notions faibles. `learning/weakness.js::openWeaknessItem()` les importe
  depuis là, sans risque (vérifié).
- `resolveWeaknessEntry`/`openWeaknessItem`/`trainWeaknessItems`/`renderWeaknessWidget`
  restent dans `learning/weakness.js`, leur place naturelle.

**Landmines restantes dans ce chantier** (vraies fonctions existantes, cycle si
importées) : `getRawItemsForTypeLevel` (srs.js) dans `resolveWeaknessEntry` ; `getJLPTLevel`
(kanji.js) dans `buildFicheDetailContent` (branche kanji). Landmines pour modules pas
encore portés : `renderSectionBody`/`buildConfusionBoxHtml` (grammar.js, branche grammar
de `buildFicheDetailContent`) ; `launchFreeTraining` (free-training.js, dans
`trainWeaknessItems`).

La landmine `renderWeaknessWidget()` dans `ui/dashboard.js::showDashboard()` est
**résolue** : import réel ajouté (vérifié sans cycle), commentaires landmine retirés.


## Session [continuation 3] — ui/dashboard.js créé et complété

`ui/dashboard.js` n'existait pas du tout dans les fichiers livrés précédemment (ni
comme stub) — créé de zéro cette session. Contient : sous-système SÉRIE (streak),
sous-système OBJECTIF QUOTIDIEN + QUOTA CONFIGURABLE (daily goal/quota, entièrement
réel — utilise `buildReviewQueue`/`getStats` importées réellement de `learning/srs.js`,
aucune landmine sur cette partie), écran d'accueil (`showDashboard`, `navDashboard`,
`navKana`, `navNiveaux`), écran "Niveaux" (`showNiveauxScreen`), détail de progression
(`showProgressionDetail`, `renderDashboard`).

**Périmètre délimité consciemment** (méthode point 6, même logique que
`core/navigation.js`) : le widget de faiblesse (`renderWeaknessWidget` et son
sous-système) et les statistiques d'entraînement libre (`TRAINING_STATS_KEY` etc.),
bien que physiquement entremêlés avec ce code dans le monolithe (même région entre les
lignes ~8900-9025), n'appartiennent PAS logiquement à ce fichier — laissés comme
landmines/non portés plutôt que d'élargir ce chantier. `learning/weakness.js` reste donc
`🟡 partiel` (voir tableau ci-dessus).

### Découverte structurelle importante — vérifiée programmatiquement AVANT d'écrire le fichier

`ui/dashboard.js` importe `features/kanji.js` (pour `getKanjiMastery`), qui importe
`core/navigation.js` (pour `pushModalState`). **Conséquence testée par simulation avant
d'écrire le moindre code** : si `core/navigation.js` importait un jour quoi que ce soit
depuis `ui/dashboard.js` en retour — ce qui semblerait pourtant la résolution naturelle
de ses landmines `'dashboard'`/`'niveaux'`/`'progression'` du `SCREEN_REGISTRY` — ce
serait un cycle (`dashboard.js -> kanji.js -> navigation.js -> dashboard.js`, confirmé
par le script de détection). **Ces landmines précises de `navigation.js` resteront donc
structurellement irrésolvables par import direct, quelle que soit la façon dont
`ui/dashboard.js` évolue ensuite** — seule solution probable : résolution via `window.*`
exposé par `app.js`, comme les `onclick`. Documenté en en-tête de `ui/dashboard.js` ET
ici pour que ça ne surprenne personne au chantier `app.js`.

Par précaution/cohérence, `navKana()` (qui appellerait `loadKanas()` de `features/kana.js`)
a aussi été laissée en landmine bien que **vérifiée SANS risque de cycle dans l'état
actuel du graphe** — pour éviter d'ajouter un lien de plus vers `features/kana.js` qui
compliquerait une future analyse, alors qu'un seul lien (`kanji.js`) suffit déjà à
illustrer/documenter le problème structurel.



## NOUVEAU CHANTIER DÉCOUVERT — Recherche unifiée (pas dans le plan initial)

En portant `toggleSearch()` (prévue dans `core/navigation.js`), il s'est avéré qu'elle
dépend d'un sous-système entier PAS ANTICIPÉ dans le plan initial : `searchFilters`,
`renderSearchFilterPills`, `toggleSearchFilter`, `resetSearchFilters`,
`showSearchPanel`/`hideSearchPanel`, `SEARCH_TYPE_STYLE`, `SEARCH_RESULTS_CAP`, et
probablement la logique d'exécution de recherche elle-même (jamais encore lue dans le
monolithe — à localiser : chercher la suite du bloc à partir de la ligne ~1427 de
`kanji.js`, `toggleSearchFilter` et au-delà, pas encore exploré). Ce n'est PAS une
fonction de navigation mais une feature à part entière (résultats croisés vocab/
grammaire/kanji/kana avec filtres). `toggleSearch()`/`closeSearchOverlay()` elles-mêmes
SONT portées (coordination via l'historique, leur place légitime dans navigation.js),
mais leurs dépendances internes restent des landmines. **À ajouter aux "chantiers
restants" ci-dessous, probablement à traiter avec ou après `ui/dashboard.js`** (recherche
et dashboard sont tous deux des points de convergence cross-feature similaires).

## Fichiers livrés dans ce handoff

Tous les fichiers `core/`, `learning/srs.js`, `learning/weakness.js`, tous les
`features/` sauf `vocabulary.js`/`grammar.js`/`free-training.js` (stubs non touchés),
et `ui/common.js`. Chaque fichier a été vérifié avec `node --check` (syntaxe ESM valide).
`features/kana.js` et `core/navigation.js` sont maintenant **complets**.

## Graphe de dépendances actuel (DAG, aucun cycle — reconfirmé programmatiquement)

```
constants.js, state.js  (racines absolues, sans dépendance)
  ├─ storage.js (aucune dépendance)
  │     ├─ data-loader.js (storage)
  │     ├─ weakness.js (storage)
  │     └─ srs.js (storage, data-loader, weakness)          ← ne dépend plus de kana.js
  ├─ navigation.js (state, ui/common)                        ← AUCUNE dépendance vers kanji/
  │                                                             strokes/quiz/kana (cycle sinon,
  │                                                             voir ci-dessous)
  ├─ common.js (state, storage)
  ├─ strokes.js (state, kanji, srs)
  ├─ kana.js (state, storage, data-loader, navigation, srs, strokes, ui/common)
  └─ kanji.js (state, storage, data-loader, constants, navigation, srs, common)
        ├─ oral.js (kanji)
        └─ quiz.js (state, navigation, strokes, kanji, oral)
```

**Point structurel important pour la suite** : `core/navigation.js` ne peut JAMAIS
importer quoi que ce soit depuis `features/kanji.js`, `features/strokes.js`,
`features/quiz.js` ou `features/kana.js` (ni transitivement depuis un futur module qui
les importerait), car ces quatre fichiers importent déjà `pushModalState` depuis
`navigation.js`. Toute fonction de navigation dont l'implémentation a besoin d'un de ces
quatre modules doit rester une landmine (ou être déplacée dans le module concerné lui-même
plutôt que dans navigation.js) — ce n'est pas contournable par un réarrangement mineur, la
seule vraie issue serait de retirer l'import de `pushModalState` d'un de ces 4 fichiers,
ce qui n'est pas souhaitable (ils en ont réellement besoin).

## Cycles résolus / évités au cours du chantier (pour référence, méthode à reproduire)

Huit cycles ont été rencontrés et résolus/évités — sept par déplacement de la fonction
fautive, un (le 8e) par correction complète du plan d'imports avant même d'écrire le
fichier fautif (jamais en injectant des paramètres de contournement — approche essayée
une fois puis rejetée explicitement par l'utilisateur, voir plus bas) :

1. **`kanjiDataLoader`** : d'abord placée dans `strokes.js`, déplacée vers `kanji.js`.
2. **`stripRubyForSpeech`** : d'abord placée dans `oral.js`, déplacée vers `kanji.js`.
3. **`replayAnimation`/`launchDetailTrace`** : placées dans `strokes.js` (pas `kanji.js`).
4. **`startFolderQuiz`** : placée dans `quiz.js` (pas `kanji.js`).
5. **`getDetailTrackingId`/`refreshMasteryUI`/`toggleDetailMastery`** : déplacées vers
   `ui/common.js`.
6. **`kanaGroups`/`getKanaFlatList`** : déplacées de `features/kana.js` vers
   `core/data-loader.js`.
7. **`KANA_TO_ROMAJI`/`kanaToRomaji`** : déplacées pour la même raison, découvert en
   cours d'étape 0 (pas anticipé dans le plan initial).
8. **`core/navigation.js` vs kanji.js/strokes.js/quiz.js/kana.js** (NOUVEAU, cette
   session) : la première version écrite de `navigation.js` importait `closeDetail`,
   `loadCategory`, `loadSeriesPage`, `displayKanjiList` depuis `kanji.js` — cycle direct
   confirmé programmatiquement (`kanji.js -> navigation.js -> kanji.js`, kanji.js important
   déjà `pushModalState` depuis `navigation.js`). **Contrairement aux 7 cycles précédents,
   celui-ci ne peut PAS être résolu par un simple déplacement** : `pushModalState` est
   utilisée par littéralement 4 modules déjà portés (`kanji.js`, `strokes.js` via `kanji.js`,
   `quiz.js`, `kana.js`), donc `navigation.js` ne peut structurellement importer AUCUN
   d'eux en retour. Fix : tous les appels vers ces 4 modules dans `navigation.js` sont
   restés/redevenus des landmines volontaires (documentées individuellement), y compris
   pour des fonctions qui EXISTENT réellement (`closeDetail`, `closeStrokeQuiz`,
   `closeQuiz`, `loadCategory`, `loadSeriesPage`, `displayKanjiList`,
   `showRevisionKanaPicker`, `resetKanaReviewSession`) — la partie ÉTAT de
   `closeAllOverlaysAndSessions()` reste du vrai code fonctionnel (state.*), seuls ces 8
   appels précis restent des `ReferenceError` en puissance tant qu'ils ne sont pas résolus
   autrement (probablement via `window.*` exposé par `app.js`, comme les `onclick` — à
   confirmer lors du chantier `app.js`).

**Méthode systématique utilisée** : avant d'écrire une fonction qui a besoin d'un
import, toujours vérifier si le module cible importe déjà (directement ou
transitivement) le module courant — **et vérifier aussi l'inverse** (le cycle #8 est né
du fait que je vérifiais "est-ce que kanji.js importe déjà navigation.js" — non — sans
vérifier aussi "est-ce que navigation.js va importer quelque chose qui importe déjà
navigation.js" — oui). Un script Python de détection de cycle (DFS sur le graphe
d'imports extrait par regex) a de nouveau permis de confirmer le cycle #8 immédiatement
après l'avoir commis, avant de continuer à écrire le reste du fichier fautif sur cette
base erronée — recommandé de lancer ce script après CHAQUE ajout de bloc d'import, pas
seulement en fin de fichier.

## Erreur commise et corrigée — à ne JAMAIS reproduire

Dans une passe antérieure, `getBestReading(k)` et `getAllValidReadings(k)` ont été
réécrites avec des paramètres optionnels injectés pour contourner des dépendances pas
encore portées. **C'était une erreur** : un appelant qui ne pense pas à fournir ces
paramètres obtient un comportement dégradé et différent de l'original, en silence.
Corrigé : `quizOverrides` porté dans `kanji.js`, `kanaToRomaji`/`KANA_TO_ROMAJI` dans
`data-loader.js`, signatures d'origine retrouvées.

De même, `shuffleIndices` (mutation en place, kanji.js) et `shuffleArray` (copie,
srs.js) sont deux fonctions **distinctes dans le monolithe original** — ne jamais les
fusionner même si elles semblent redondantes.

## Session [continuation] — features/kana.js complété

(Voir version précédente de ce HANDOFF pour le détail complet : étape 0 exécutée, cycle
#7 découvert et corrigé, 17 fonctions de révision flashcard + tracé kana portées,
`kanaTraceState`/`kanaTraceWriter`/`kanaTraceTimerInterval` déplacées vers `state.*`,
`replayKanaTraceQuiz()` créée comme seule exception consciente à la règle "jamais
improviser" — conséquence mécanique du passage à l'ESM, pas un choix de style.)

## Session [continuation 2] — core/navigation.js complété

Chantier abordé comme "le candidat naturel suivant" per la précédente version de ce
HANDOFF. S'est avéré nettement plus massif que prévu pour deux raisons découvertes en
cours de route (voir sections dédiées ci-dessus) :
1. Le sous-système de recherche unifiée, pas anticipé.
2. Le cycle structurel #8 (pushModalState), qui a forcé une réécriture complète de
   l'approche initiale (imports réels remplacés par des landmines documentées).

**Décision de découpage pour rester dans une section bornée** (cf. méthode de travail,
point 6) : `core/navigation.js` est traité comme **complet** dans son périmètre
d'origine (registres, closeAllOverlaysAndSessions, onpopstate, pushModalState,
toggleSearch/closeSearchOverlay, bottomNavGo) même si la GRANDE majorité de son contenu
est constituée de landmines — c'est un résultat structurellement correct et attendu pour
ce fichier précis (point de convergence cross-feature par nature), pas un travail
inachevé. La "recherche unifiée" devient un chantier séparé (voir section dédiée
ci-dessus), pas un sous-morceau resté à faire dans navigation.js.

### state.js — nouveaux placeholders ajoutés

`closeAllOverlaysAndSessions()` doit nettoyer plusieurs sessions dont le module
propriétaire n'est pas encore porté (`reviewSession`, `grammarReviewSession`,
`mixedReviewSession`, `kanjiReviewSession`, `lessonSession`, `trainingSession`,
`trainingChronoInterval`, `activeSwipeContext`) — même situation que `kanaTraceState`
avant le portage de `kana.js`. Tous ajoutés à `state.js` comme placeholders `null`,
**avec la même règle qui s'appliquait à `kanaTraceState`** : quand `vocabulary.js`/
`grammar.js`/`free-training.js`/`ui/dashboard.js`/`learning-path.js` seront portés, ILS
DOIVENT lire/écrire ces champs `state.*` (pas recréer des variables locales à leur
module), sinon `closeAllOverlaysAndSessions()` nettoierait le mauvais état — point de
vigilance à rappeler explicitement au démarrage de CHACUN de ces futurs chantiers.

### features/kana.js — resetKanaReviewSession() ajoutée

`kanaReviewSession` reste un `let` local au module `kana.js` (comme
`currentKanaTabType`), mais `core/navigation.js::MODAL_EXIT_REGISTRY` et
`closeAllOverlaysAndSessions()` ont besoin de la remettre à `null` — exactement la
landmine anticipée dans la session précédente. Résolu en ajoutant une petite fonction
exportée `resetKanaReviewSession()` plutôt qu'en sortant la variable vers `state.*`
(elle n'est lue par AUCUN autre module, contrairement à `kanaTraceState`) — **mais cette
fonction reste elle-même une landmine dans `navigation.js`** à cause du cycle #8 (kana.js
importe déjà `pushModalState` depuis `navigation.js`). Import réel possible uniquement
depuis un futur module qui n'a pas ce problème (aucun candidat évident pour l'instant).

## "Landmines" — vrais appels JS vers des fonctions pas encore portées ou inaccessibles

**`core/navigation.js` contient désormais la grande majorité des landmines de tout le
projet** (voir le fichier lui-même, chaque cas est commenté `⚠️ ATTENTION`
individuellement avec sa raison précise — "pas encore porté" ou "cycle via
pushModalState"). Ne pas essayer de les résoudre une par une prématurément : la
plupart se résoudront naturellement au fur et à mesure que les modules correspondants
seront portés (features/vocabulary.js, features/grammar.js, features/free-training.js,
ui/dashboard.js), et les autres (celles qui existent déjà mais cyclent) devront être
résolues autrement — probablement via `window.*` exposé par `app.js`, à confirmer lors
de ce chantier précis.

Landmines restantes ailleurs (hors navigation.js), pour référence :
- `features/kanji.js :: displayKanjiListFromHome()` → `loadJLPTCategory()` (routeur
  cross-feature, hors périmètre de tout fichier actuel).
- `features/strokes.js :: renderStrokeQuizResults()` → `renderDashboard()` si
  `sourceType === 'single'` (`ui/dashboard.js`, pas encore porté).
- `features/strokes.js :: replayAnimation()`/`launchDetailTrace()` (branche kana) →
  `showKanaTraceModal()` — **toujours volontaire** même maintenant que `kana.js` est
  complet : l'importer créerait `strokes.js -> kana.js -> strokes.js`.

## Session [continuation 6] — features/vocabulary.js complété

Chantier le plus gros porté d'une traite jusqu'ici : liste vocabulaire par niveau
(`displayVocabList`), fiche détail (`showVocabDetail`), et le système de révision complet
(flashcard + QCM + trou à combler + SRS — `startVocabReview`, `renderReviewScreen` et ses
3 variantes d'exercice, `submitQuizAnswer`, `advanceReviewQueue`, `submitReviewGrade`,
`renderReviewSummary`, plus les générateurs `buildVocabWordCloze`/`buildClozeParticle`/
`buildMeaningQCM`).

**Nouvelles fonctions ajoutées à des fichiers déjà portés, avant d'écrire vocabulary.js
(dépendances manquantes découvertes en lisant le monolithe)** :
- `speakText(text, lang)` → `features/oral.js` (synthèse vocale, même famille que la
  reconnaissance vocale déjà là, aucune dépendance).
- `stripRtTags`/`extractReadingFromRawRt`/`buildCleanToRawIndexMap` → `ui/common.js`
  (même famille qu'`autoWrapRuby`/`mdBold`, utilitaires `<rt>` purs, nécessaires à
  `buildVocabWordCloze`).

**Bug évité en écrivant le fichier (pas découvert après coup)** : le monolithe fait
`onclick="showFicheCorrectionModal(reviewSession.queue[reviewSession.index]
.relatedGrammarEntry)"` — fonctionne car `reviewSession` y est une variable globale bare.
Ici `reviewSession` est un `let` local au module `vocabulary.js`, inaccessible depuis un
attribut onclick. Créé `openReviewRelatedGrammarFiche()` (nouvelle fonction, exportée) qui
lit `reviewSession` en interne — même principe que `replayKanaTraceQuiz`/
`openKanjiFromSearchHit` des sessions précédentes. Ce pattern revient systématiquement dès
qu'un état de session local à un module est référencé depuis un onclick — désormais
vérifié par réflexe à chaque fichier avec état de session.

**Landmine résolue** : `ui/modals.js::openVocabFromSearch()` importe maintenant
réellement `showVocabDetail` depuis `vocabulary.js` (vérifié sans cycle) — la recherche
peut désormais ouvrir une fiche vocab pour de vrai.

**Landmines confirmées irrésolvables** (vérifié, pas juste supposé) : `navigation.js`
ne pourra JAMAIS importer `vocabulary.js` en retour (`vocab-review`/`vocab-review-selector`/
`vocab-list`/`vocab-detail` du MODAL_EXIT_REGISTRY/SCREEN_REGISTRY) — `vocabulary.js`
importe déjà `navigation.js` (pour `pushModalState`), même mur structurel que pour
`kanji.js`/`strokes.js`/`quiz.js`/`kana.js`.

**Landmine restante dans vocabulary.js lui-même** : `showFreeTrainingConfig`
(`features/free-training.js`, pas encore porté) dans le bouton "Entraînement libre" de
`showVocabReviewModeSelector()`.


## Session [continuation 7] — features/grammar.js complété

Liste par unité (`showGrammarHome`), fiche détail (`showGrammarDetail`), révision
(flashcard + trou à combler + SRS), et le système de renvoi entre leçons (popup "Aperçu"
`showLessonReferencePopup` + comparatif ❌/✅ `buildParticleComparisonHtml`, utilisé par
la révision grammaire ET vocab).

**Code mort identifié et volontairement NON porté** (vérifié, pas supposé) :
`displayGrammarList(levelId, data, examples)` (monolithe ligne ~3727) et
`GRAMMAR_TYPE_MAP` — `grep -n "displayGrammarList("` confirme qu'elle n'est appelée NULLE
PART ailleurs dans les ~9975 lignes du monolithe. Utilise un schéma de données obsolète
(`pattern.pattern`/`pattern.meaning`/`examples.grammar[exId]` par index) qui ne correspond
plus au vrai `grammar.json` actuel, et contient un `console.log` de debug oublié.
`showGrammarHome()` est la vraie fonction active équivalente à `displayVocabList()`.
Documenté explicitement en en-tête de `grammar.js` pour que ça ne ressemble pas à un oubli.

**Nouvelles fonctions ajoutées à `core/data-loader.js` avant d'écrire grammar.js**
(dépendances manquantes découvertes en lisant le monolithe) :
- `findLessonByIdSync`/`findLessonByItemSync` — ont besoin d'un accès direct à
  `grammarDataCache` (const privée à data-loader.js, jamais exportée) — même raison de
  placement que `kanaGroups`/`getKanaFlatList`.
- `kanaToRomajiPrecise`/`hasKanjiChar`/`getItemRomaji` — la découverte annexe 2 de la
  session précédente ("à porter avec learning-path.js") s'est avérée fausse : grammar.js
  en a besoin MAINTENANT (`showLessonReferencePopup`/`showGrammarDetail` affichent la
  romaji de l'item). Placées aux côtés de `KANA_TO_ROMAJI`/`kanaToRomaji` dont elles
  dépendent directement.

**Cycle évité, vérifié AVANT d'écrire (pas après)** : `ui/common.js` ne peut PAS importer
`features/grammar.js` pour résoudre les landmines `renderSectionBody`/
`buildConfusionBoxHtml` de `buildFicheDetailContent()` — `grammar.js` importe
`core/navigation.js` (pushModalState), qui importe déjà `ui/common.js` :
`common.js -> grammar.js -> navigation.js -> common.js`. Ces 3 landmines (avec
`getJLPTLevel`, déjà connue) restent donc confirmées structurellement irrésolvables ici,
peu importe l'avancement futur du projet — commentaire mis à jour dans `ui/common.js`
pour refléter "confirmé" plutôt que "pas encore porté".

**Deux landmines résolues** : `ui/modals.js::openGrammarFromSearch()` importe maintenant
réellement `showGrammarDetail` (vérifié sûr — `ui/modals.js` n'importe jamais
`core/navigation.js` en boucle avec `grammar.js`, contrairement à `ui/common.js`).

**Landmine restante dans grammar.js lui-même** : `showFreeTrainingConfig`
(`features/free-training.js`, pas encore porté) et `startSpecificGrammarLesson`
(parcours "Commençons l'apprentissage" — `learning/exercises.js` ou
`learning/learning-path.js` selon le découpage final, pas encore tranché).
 Candidats suivants, par ordre de
priorité suggéré (aucun plan détaillé pré-validé — vérifier les cycles AVANT d'écrire,
méthode point 8) :

## Session [continuation 8] — features/free-training.js complété

Configuration (type/niveau/nombre/mode/ordre/filtres), session isolée du SRS
(flip-card + cloze + QCM), résultats, `retrainMistakes`, et les stats globales propres
à l'entraînement (`TRAINING_STATS_KEY`).

**3 fonctions exportées depuis vocabulary.js/grammar.js** (étaient privées) : `getPrimaryMeaning`
et `prepareSessionItem` (vocabulary.js), `prepareGrammarSessionItem` (grammar.js) —
free-training.js en a besoin pour générer la même variété d'exercices (cloze/QCM) qu'en
révision normale.

**`buildCardDisplay`/`getEntryLabel` placées ici** (pas encore ailleurs) bien qu'utilisées
aussi par `launchMixedReviewSession` (~ligne 6235 du monolithe, système de révision mixte
de l'onglet "Apprendre", pas encore porté, emplacement final pas tranché) — exportées pour
que ce futur chantier les importe d'ici plutôt que de les redéfinir.

**Bug évité en écrivant le fichier** : même pattern que d'habitude —
`onclick="showFicheCorrectionModal(trainingSession.queue[trainingSession.index])"` du
monolithe référence `trainingSession` en global, inaccessible ici (`state.trainingSession`).
Créé `openTrainingCurrentFiche()`.

**`state.trainingSession`/`state.trainingChronoInterval`** utilisées comme prévu (placeholders
déjà réservés depuis le portage de `navigation.js`, session #2) — jamais de variables locales.

**Cycle confirmé dans les DEUX sens** : `free-training.js` importe déjà `vocabulary.js`,
`grammar.js` et `core/navigation.js` — donc AUCUN des trois (ni `learning/weakness.js`, qui
importe `srs.js`, lui-même importé par `free-training.js`) ne peut importer
`free-training.js` en retour. Vérifié programmatiquement pour les 4 cas avant de conclure
(pas supposé) : les landmines `showFreeTrainingConfig` (vocabulary.js, grammar.js,
navigation.js) et `launchFreeTraining` (weakness.js) restent donc confirmées
structurellement irrésolvables, commentaires mis à jour dans les 4 fichiers en conséquence.

**Landmine restante dans free-training.js lui-même** : aucune identifiée — ce fichier est
fonctionnellement complet et autonome dans son périmètre.

## Session [continuation 9] — learning/learning-path.js complété

Le Learning Path (curriculum.json, moteur générique, concepts en micro-écrans, exercices
mixtes) avait été construit directement dans le monolithe lors d'une session ANTÉRIEURE à
ce chantier de modularisation (même conversation, avant le début du handoff) — cette
session l'a porté fidèlement vers l'architecture ESM, en relisant tout depuis le monolithe
comme d'habitude plutôt qu'en se fiant à la mémoire.

**Clarification de nommage importante** : `learning/exercises.js` (toujours un stub) N'EST
PAS le Learning Path — c'est le parcours de leçon grammaire "Commençons l'apprentissage"
(`buildLessonSteps`/`startGrammarLessonFlow`, monolithe ligne ~4444), un système SÉPARÉ et
plus ancien. Les deux se ressemblent (texte flottant, swipe) mais sont des systèmes
distincts avec leurs propres sessions (`lessonSession` vs `state.learningSession`).

**`getLevelConceptsData` déplacée vers `core/data-loader.js`** (n'existait qu'en tant que
fonction privée dans la zone Learning Path du monolithe) : même famille que
`getLevelVocabData`/`getLevelGrammarData`, tout le chargement JSON par niveau reste
centralisé au même endroit.

**3 fonctions exportées depuis vocabulary.js/grammar.js** (étaient privées) :
`buildMeaningQCM` (vocabulary.js), `buildGrammarCloze`/`getShortLessonExplanation`
(grammar.js) — le Learning Path réutilise EXCLUSIVEMENT ces générateurs existants, aucun
second moteur de quiz.

**Point d'architecture important** : `state.learningSession` (PAS une variable locale au
module, contrairement à `kanaReviewSession` dans `features/kana.js`) — parce que
`core/navigation.js::closeAllOverlaysAndSessions()` la lit et la nettoie déjà (placeholder
réservé depuis le portage de `navigation.js`, session #2). Si ce fichier avait utilisé une
variable locale à la place, le nettoyage de `navigation.js` aurait porté sur la mauvaise
référence — bug silencieux qui ne se serait manifesté qu'à l'usage.

**Bug évité en écrivant le fichier** (pas découvert après coup) : même pattern récurrent —
`onclick="startLearningPath(learningSession.levelId)"` du monolithe référence
`learningSession` en global. Créé `continueLearningPath()`. C'est maintenant le 4e cas de
ce pattern précis (`replayKanaTraceQuiz`, `openKanjiFromSearchHit`,
`openReviewRelatedGrammarFiche`, `openTrainingCurrentFiche`, et maintenant celui-ci) — la
vérification systématique de chaque `onclick` référençant un état de session a payé une
fois de plus.

**Erreur commise PUIS corrigée dans la même passe** (pas laissée pour plus tard) : un
commentaire ⚠️ ATTENTION a été écrit pour `kanaToRomajiPrecise` en la déclarant "pas
importée, cycle possible" — faux, vérifié après coup : `core/data-loader.js` était déjà
dans les imports de ce fichier (pour `getLevelVocabData` etc.), l'ajouter à la même ligne
d'import était donc totalement sûr. Corrigé avant validation finale : import réel ajouté,
commentaire erroné retiré. Sert de rappel que même les commentaires ⚠️ ATTENTION doivent
être vérifiés, pas juste écrits par réflexe de prudence.

**Aucune landmine identifiée dans ce fichier** — le Learning Path est fonctionnellement
complet et autonome dans son périmètre (curriculum.json + concepts.json + les données
vocab/grammaire/kanji déjà portées suffisent à le faire fonctionner de bout en bout).

## Session [continuation 10] — learning/exercises.js complété

Onboarding "Commençons l'apprentissage" (5 slides), parcours de leçon (texte flottant +
exercices + écran de fin), écran "Explorer les leçons", et **`initSwipeNavigation()`** —
jamais portée nulle part avant cette session, ce qui signifie que **le swipe/tap ne
fonctionnait dans AUCUN fichier ESM jusqu'ici**, malgré `state.activeSwipeContext` déjà
positionné correctement par `kana.js` et `learning-path.js`. Gap réel, pas anticipé.

**Décision de placement pour `initSwipeNavigation()`** : elle dispatche sur 3 contextes
('lesson', 'onboarding', 'learning-path'), dont 2 appartiennent à ce fichier et 1 à
`learning-path.js`. Placée ici (minimise les imports croisés) — **et vérifiée SANS cycle
pour importer `learning/learning-path.js` en plus** de `features/grammar.js`/
`vocabulary.js`/`kana.js`/`free-training.js` : contrairement à beaucoup de chantiers
précédents, le swipe est donc **entièrement fonctionnel** (aucune branche en landmine).

**3 découvertes de gaps réels, notées mais volontairement PAS comblées dans ce chantier**
(pour rester dans une section bornée) :
1. `showRevisionLevelPicker(category, isBack)`/`startRevisionFor(category, levelId)`
   (monolithe ligne ~5029) — écran "choisir catégorie → niveau → mode", cross-cutting
   (vocab+grammaire+kanji), jamais porté nulle part. Appelée par `startOnboardingChoice`
   (landmine ici).
2. `showKanjiReviewModeSelector` — déjà notée comme landmine dans `features/kanji.js` par
   une session antérieure à ce handoff, toujours pas portée. Probablement liée à la
   découverte 1 (même famille "choisir un mode de révision").
3. `showGrammarNiveauxScreen` (monolithe ligne ~4881, miroir grammaire de
   `ui/dashboard.js::showNiveauxScreen`) et vraisemblablement un équivalent kanji — pas lus
   en détail, pas portés. Appartiennent à la famille des écrans "niveaux" de dashboard.js,
   pas au parcours de leçon.
Ces 3 découvertes pointent vers un même chantier futur cohérent : un système de sélection
de révision par catégorie, probablement à construire en une fois plutôt que dispersé.

**3 fonctions exportées depuis grammar.js/vocabulary.js** (étaient privées) :
`buildConfusionBoxHtml` (grammar.js), `COMMON_PARTICLES` (vocabulary.js) — en plus de
`buildGrammarCloze`/`getShortLessonExplanation`/`buildMeaningQCM` déjà exportées lors du
chantier précédent.

**Adaptation consciente documentée** (pas une improvisation) : `applyLessonCompletion()`
lisait `grammarDataCache[s.level]` directement dans le monolithe (cache privé de
`core/data-loader.js`, inaccessible ici) — remplacé par `await getLevelGrammarData(s.level)`,
strictement équivalent puisque la fonction est déjà `async` et le niveau déjà en cache à ce
stade (résolution immédiate, pas de nouveau fetch réseau réel).

**Landmine résolue** : `features/grammar.js::showGrammarDetail()` → `startSpecificGrammarLesson`
existe maintenant réellement, mais reste une landmine **confirmée** (pas juste "pas encore
porté") : `exercises.js` importe déjà `grammar.js`, donc l'inverse cyclerait. Commentaire
mis à jour en conséquence.



## Session [continuation 11] — app.js complété : MODULARISATION FONCTIONNELLEMENT COMPLÈTE

Bootstrap `init()` (chargement kanji/mapping JLPT, construction categories/series, exemples
legacy, premier rendu dashboard), `initPullToRefresh()` (jamais portée avant, IIFE
autonome du monolithe convertie en fonction exportée), et surtout la résolution du risque
transversal `onclick`/`window.*` annoncé depuis le tout début de ce handoff.

**Extraction programmatique, pas manuelle** : script Python parcourant les 20 fichiers
déjà portés, extrayant tous les `on\w+="nomDeFonction("` — 92 noms uniques trouvés.
Croisés avec les exports réels de chaque fichier : **89 immédiatement résolus**, 3
introuvables. Sur ces 3 : 2 sont les landmines déjà connues (`showCategoryDirect`,
`showKanjiReviewModeSelector`, futur chantier "sélection de révision par catégorie") ; la
3e (`speakSentence`) était un genuine oubli — fonction jamais lue ni portée, découverte par
ce croisement, ajoutée à `features/oral.js` (aux côtés de `speakText`, jamais fusionnées
même si proches, cf. règle habituelle).

**Découverte importante sur la nature des landmines "confirmées irrésolvables"** : un
second script (recherche des appels de fonction NUS — pas dans une chaîne onclick — non
déclarés localement mais existant comme export ailleurs, approche proche d'un lint
`no-undef`) n'a trouvé que **2 vrais cas** (`resetSearchFilters` dans
`core/navigation.js::toggleSearch()`, `launchFreeTraining` dans
`learning/weakness.js::trainWeaknessItems()`) — ajoutés à l'exposition `window.*`. Tous
les AUTRES appels vers des landmines "confirmées irrésolvables par import direct" des
sessions précédentes (ex: `closeDetail`/`loadCategory` dans `navigation.js`,
`startSpecificGrammarLesson` dans `grammar.js`, `getJLPTLevel`/`renderSectionBody` dans
`ui/common.js`) se trouvaient en réalité DANS des chaînes `onclick="..."`, donc déjà
couverts par les 89 premières résolutions. **Conséquence concrète : la quasi-totalité des
landmines documentées à travers tout le projet sont maintenant résolues à l'exécution**,
exactement comme anticipé dès la toute première mention du "risque transversal" — pas
besoin de les corriger fichier par fichier, la passe finale a fait le travail d'un coup,
comme prévu.

**Adaptations conscientes documentées dans app.js** (pas des improvisations) :
`kanjiDb`/`kanjiMap`/`jlptMapping`/`exemplesDb` globaux du monolithe → `state.data.kanjiDb`/
`state.data.kanjiMap`/`state.jlptMapping`/`state.exemplesDb` partout dans `init()`.

## État du projet à la fin de cette session — roadmap initiale entièrement traitée

Les 7 chantiers de la roadmap posée en fin de session précédente sont TOUS faits :
navigation.js, kana.js, dashboard.js, weakness.js, modals.js (recherche), vocabulary.js,
grammar.js, free-training.js, learning-path.js, exercises.js, et maintenant app.js.
**21 fichiers, syntaxe validée, aucun cycle** (revérifié une dernière fois après ce
chantier).

**Ce qui reste, honnêtement** — un seul chantier substantiel, découvert en cours de route
(jamais dans le plan initial), pas encore comblé :
- **Système de sélection de révision par catégorie** (`showRevisionLevelPicker`/
  `startRevisionFor`/`showKanjiReviewModeSelector`/`showGrammarNiveauxScreen` et son
  équivalent kanji probable, monolithe ligne ~5029 et ~4881) — écran "choisir catégorie →
  niveau → mode", cross-cutting vocab+grammaire+kanji. Sans lui, les 2 landmines restantes
  (`showCategoryDirect`, `showKanjiReviewModeSelector`) resteront de vraies
  `ReferenceError` au clic.

Quelques notes mineures antérieures à ce handoff, jamais retouchées :
- `features/oral.js` : `startOralTest` (bouton fiche détail) pas fait.
- `features/kanji.js` : noté "quasi complet" par la session d'avant ce handoff, jamais
  entièrement revérifié ligne à ligne par cette suite de sessions (contrairement à tous
  les autres fichiers, lus intégralement avant portage).

## Session [continuation 12] — features/kanji.js revérifié intégralement

Demande explicite de l'utilisateur avant de considérer qu'on peut se passer du monolithe :
revérifier `kanji.js` (porté par une session antérieure au handoff écrit, jamais repassé au
crible comme tous les autres fichiers ensuite) avec la même rigueur que le reste.

**Méthode** : les 48 exports lus intégralement et comparés un par un contre le monolithe
(recherche exacte de chaque fonction par nom, lecture côte à côte). Deux tables de données
(`quizOverrides`, `CAT_DEFS`) comparées programmatiquement (diff d'ensembles) plutôt que
visuellement, pour une garantie plus forte sur des données volumineuses.

**Résultat : aucune divergence fonctionnelle trouvée.** Les 48 fonctions correspondent
exactement au monolithe, y compris les plus complexes (`openDetail`, `renderStrokeGuide`,
`renderExemples`, `renderLinkedVocab`, `getBestReading`). Seuls 3 commentaires ⚠️/RAPPEL
étaient périmés (ils disaient "pas encore porté" pour des fonctions — `strokes.js`,
`features/quiz.js`, `ui/dashboard.js` — qui le sont devenues au fil des sessions suivantes,
sans que ce fichier-ci soit jamais revisité pour mettre les commentaires à jour) — corrigés.

**Conclusion : `features/kanji.js` est maintenant validé au même niveau de confiance que
tous les autres fichiers de ce handoff.** Landmines réelles restantes (pas des bugs, des
dépendances vers le système "sélection de révision par catégorie" pas encore construit) :
`displayKanjiListFromHome()` → `loadJLPTCategory()`, et le bouton "Réviser" de
`displayKanjiList()` → `showKanjiReviewModeSelector()`.

## Session [continuation 13] — ui/cards.js créé + bug transversal onclick corrigé

**Système de sélection de révision par catégorie** (dernier chantier de fonctionnalité
identifié) : `ui/cards.js` créé — onglet "Réviser" (`showRevisionsScreen`), sélecteur de
niveau (`showRevisionLevelPicker`/`startRevisionFor`), session de révision flashcard kanji
complète (`showKanjiReviewModeSelector` et sa famille, utilisant `state.kanjiReviewSession`,
placeholder déjà réservé), écrans "Niveaux" grammaire/kanji (miroirs de
`ui/dashboard.js::showNiveauxScreen`). Placé dans `ui/cards.js` (stub vide jusqu'ici) car ce
système a besoin d'importer À LA FOIS `features/kanji.js` ET `features/strokes.js` —
impossible depuis l'un ou l'autre (strokes.js importe déjà kanji.js, cycle direct sinon).
Vérifié sans cycle avant d'écrire.

**Découverte majeure en écrivant ce fichier — bug transversal, pas un cas isolé** : plusieurs
`onclick="..."` dans `vocabulary.js`, `grammar.js`, `kanji.js` ET `kana.js` référençaient des
variables globales bare (`vocabHomeData`, `grammarHomeData`, `kanjiHomeData`,
`currentLevelId`, `currentKanaTabType`) copiées telles quelles du monolithe — où c'était
correct (vraies globales) — mais cassées en ESM (ce sont des propriétés de `state.*` ou des
`let` locaux à un module, inaccessibles depuis un attribut `onclick`, qui s'exécute en
portée globale). **13 occurrences corrigées** au total, avec des fonctions wrapper qui
relisent l'état correctement au moment du clic :
- `vocabulary.js` : `refreshVocabList(isBack)`, `openVocabDetailFromState(wordId)`,
  `startVocabFreeTrainingFromSelector()` (6 occurrences).
- `grammar.js` : `refreshGrammarHome(isBack)`, `startGrammarFreeTrainingFromSelector()`
  (3 occurrences).
- `kanji.js` : `refreshKanjiList()` (1 occurrence).
- `kana.js` : `refreshKanaScreen()` (1 occurrence, `currentKanaTabType`).
- `ui/cards.js` : `startKanjiFreeTrainingFromSelector()` (écrite directement correcte, pas
  un bug après coup).

**Méthode de détection** : recherche exhaustive de CHAQUE variable locale/`state.*` du
projet à l'intérieur de CHAQUE attribut `onclick="..."`, via script — pas une relecture
visuelle, qui aurait probablement raté certaines occurrences vu leur nombre et leur
dispersion. Confirmé qu'il n'en reste aucune après correction (nouvelle passe du même
script, zéro résultat).

**`app.js` mis à jour en conséquence** : nouvelle extraction exhaustive des fonctions
référencées en `onclick` — cette fois en gérant aussi les cas que la première passe avait
manqués (arguments nus comme `enterBulkSelectMode(refreshKanjiList)`, et attributs
conditionnels comme `onclick="${flipped ? '' : 'flipKanjiReviewCard()'}"`). 16 nouvelles
fonctions ajoutées à l'exposition `window.*`. Une vérifiée comme vrai import possible plutôt
que juste une exposition window : `closeSearchOverlay` ajoutée aux imports réels de
`ui/modals.js` (elle en a besoin pour son propre code interne) — mais reste AUSSI exposée
sur `window` séparément depuis `app.js`, car elle est référencée directement dans des
`onclick="..."` de `ui/modals.js`, qui s'exécutent en portée globale et ne bénéficient pas
de l'import du module (erreur de raisonnement initiale, corrigée avant validation finale).

**État final, vérifié par script exhaustif : 0 fonction onclick manquante** (hors les 2
landmines confirmées `showCategoryDirect`/`init` géré séparément). 22 fichiers, syntaxe
validée, aucun cycle.

**La modularisation JS est maintenant complète au sens plein** — plus aucun chantier de
fonctionnalité connu. Reste seulement la bascule finale de `index.html` (JS + CSS modulaires)
et un test réel en navigateur, jamais fait pendant tout ce handoff.

## Session [continuation 14] — index.html basculé vers ESM + CSS modulaire, DERNIÈRE ÉTAPE

**Scan exhaustif d'`index.html` lui-même** (jamais fait avant cette session — toutes les
vérifications précédentes ne portaient que sur les fichiers JS entre eux) : 30 noms de
fonctions référencées en `onclick`/`onkeydown`/`oninput` extraits. Résultat :
- 25 existaient déjà mais n'étaient pas encore dans la liste d'exposition `window.*` de
  `app.js` — ajoutées (`bottomNavGo`, `toggleSearch`, `closeQuiz`, `closeStrokeQuiz`
  [déjà là], `launchQuizMode`, `launchStrokeMode`, `launchKanaTraceMode`, etc.)
- 1 était privée (non exportée) : `debouncedDoSearch` (`ui/modals.js`) — export ajouté.
- 1 vrai gap comblé : **`startOralTest`** (`features/oral.js`) — jamais portée depuis le
  tout début de ce handoff (signalé "PAS FAIT" dès une session très antérieure, jamais
  traité depuis). Lue et portée intégralement depuis le monolithe (reconnaissance vocale
  du bouton 🎤 de la fiche détail kanji) ; toutes ses dépendances (`getBestReading`,
  `isResultCorrect`, `toHira`, `getAllValidReadings`) existaient déjà.
- 1 fonction (`toggleStrokePause`) n'existe NULLE PART, pas même dans le monolithe — bouton
  déjà inerte dans l'app ORIGINALE (pas un trou de portage, laissé tel quel).

**Nouvelle passe de scan exhaustif JS-vers-JS** (méthode affinée, gérant en plus les
arguments nus comme `enterBulkSelectMode(refreshKanjiList)` et les onclick conditionnels
`onclick="${flipped ? '' : 'flipKanjiReviewCard()'}"`, ratés par la première passe) : 17
fonctions supplémentaires trouvées et exposées, dont `closeKanaTablePopup`. **État final :
zéro fonction onclick manquante, vérifié par script sur l'ensemble JS + index.html.**

**Vérification croisée DOM** : les 97 `getElementById(...)` du JS comparés aux vrais
`id="..."` d'`index.html` — 19 "manquants" trouvés, tous vérifiés comme créés
dynamiquement par le JS lui-même via `innerHTML` (conteneurs de sous-écrans), pas de bug.

**Service worker (`sw.js`) vérifié — aucune modification nécessaire** : la stratégie de
cache est basée sur l'extension de fichier (`.js`/`.css`), jamais sur des noms de fichiers
en dur, et utilise network-first pour JS/CSS (toujours la version la plus fraîche en
priorité). Fonctionne tel quel avec la nouvelle structure multi-fichiers.

**`index.html` basculé** :
- Les 9 fichiers CSS modulaires copiés dans `css/` (`base.css` en premier pour les
  variables `:root`, puis `layout`/`components`, puis les fichiers par feature).
- `<script src="kanji.js?...">` remplacé par `<script type="module" src="js/app.js">`.
- `<script src="hanzi-writer.js">` (classique, dans `<head>`) laissé tel quel — s'exécute
  avant le module (les scripts `type="module"` sont toujours différés), donc
  `window.HanziWriter` est bien disponible au moment où `app.js` s'exécute.

**Fichiers monolithiques (`kanji.js`, `kanji.css`) volontairement NON supprimés** du
dépôt — `index.html` ne les charge plus, mais ils restent disponibles comme filet de
sécurité pour un rollback rapide (revert `index.html` seul) si la bascule pose un problème
en usage réel.

## ÉTAT FINAL DE CE HANDOFF

**Tout le JS et le CSS sont maintenant modularisés et branchés dans `index.html`.** Plus
aucun chantier de fonctionnalité connu. La seule chose qui n'a jamais été faite pendant
tout ce handoff : **un test réel dans un navigateur** — voir la checklist de test fournie
séparément à l'utilisateur pour la première vérification en conditions réelles.

## PROCHAINE ÉTAPE (à planifier au démarrage de la prochaine session)

La modularisation JS est complète — plus aucun chantier de fonctionnalité connu.
Reste :

1. **Bascule de `index.html`** vers les modules ESM (`<script type="module" src="js/app.js">`)
   ET les 9 fichiers CSS modulaires (jamais branchés, `index.html` charge toujours l'ancien
   `kanji.css` monolithique) — demandée explicitement par l'utilisateur.
2. **Test réel dans un navigateur** — jamais fait pendant tout ce handoff (seulement
   syntaxe + absence de cycle depuis cet environnement, aucune exécution).

## Autres chantiers restants (par ordre de dépendance croissante)

1. Bascule de `index.html` vers ESM + CSS modulaire (voir ci-dessus).
2. Test réel dans un navigateur (voir ci-dessus).

## Risque transversal à traiter en une passe finale (pas fichier par fichier)

Le monolithe original génère énormément de HTML avec des attributs
`onclick="maFonction(...)"`. En ESM, les fonctions importées ne sont **pas**
globales : ces attributs ne fonctionneront qu'une fois que `app.js` aura fait
explicitement `window.maFonction = maFonction;` pour chaque fonction encore
référencée depuis du HTML généré. Ne pas tenter de corriger ça fichier par fichier —
le faire en bloc dans `app.js` à la fin, en grep-ant tous les `onclick="..."` de
tous les fichiers portés. **Nouveau, cette session** : ce même mécanisme `window.*`
résoudra probablement AUSSI les landmines du cycle #8 dans `navigation.js` (closeDetail,
closeStrokeQuiz, closeQuiz, loadCategory, loadSeriesPage, displayKanjiList,
showRevisionKanaPicker, resetKanaReviewSession, etc.) — à vérifier lors du chantier
`app.js`, mais ce ne serait pas surprenant que le même geste de la passe finale règle les
deux catégories de landmines à la fois (celles des `onclick` ET celles du cycle
structurel de navigation.js).

## Méthode de travail à poursuivre

1. Toujours lire la vraie implémentation dans le monolithe `kanji.js` fourni en pièce
   jointe avant de porter quoi que ce soit — ne jamais deviner.
2. Avant d'écrire un import, vérifier s'il introduit un cycle **dans LES DEUX SENS**
   (voir cycle #8 : vérifier aussi si ce qu'on s'apprête à importer importe déjà,
   directement ou transitivement, le fichier qu'on est en train d'écrire). Un script de
   détection de cycle par DFS (voir "Méthode systématique utilisée" ci-dessus) est
   fortement recommandé après CHAQUE bloc d'import ajouté, pas seulement en fin de
   fichier — le cycle #8 a été commis en écrivant tout le fichier d'un coup avant de
   vérifier, ce qui a nécessité de tout redéfaire.
3. Après chaque fichier modifié : `node --input-type=module --check < fichier.js`
   pour valider la syntaxe (ne détecte PAS les cycles, juste la syntaxe).
4. Ne jamais fusionner deux fonctions qui semblent redondantes si le monolithe les
   garde séparées (cf. `shuffleIndices` vs `shuffleArray`).
5. Ne jamais injecter un paramètre à valeur par défaut pour contourner une dépendance
   pas encore portée — soit la porter réellement (en la déplaçant si besoin), soit
   laisser un vrai appel non importé et le signaler clairement (`⚠️ ATTENTION`) avec la
   RAISON PRÉCISE (pas encore porté ? cycle ? lequel ?) — pas juste "landmine" générique.
6. Découper le travail en sections bornées et cohérentes, jamais tenter de tout faire
   d'un coup. **Nouveau** : accepter qu'une section "complète" puisse légitimement être
   majoritairement composée de landmines si c'est un fichier structurellement
   cross-cutting (cf. navigation.js) — ce n'est pas un travail bâclé, c'est le reflet
   honnête de sa position dans le graphe de dépendances tant que ses voisins ne sont
   pas portés.
7. Un attribut `onclick="..."` généré en HTML s'exécute dans le contexte global
   (`window`), donc ne peut JAMAIS référencer directement une propriété d'un objet
   importé par un module ES (ex: `state.maPropriete`). Si un onclick du monolithe
   référence une telle variable, écrire une petite fonction exportée qui la lit en
   interne (voir `replayKanaTraceQuiz` dans `features/kana.js`).
8. **Nouveau** : avant de commencer un fichier `core/` ou tout fichier susceptible
   d'être importé par PLUSIEURS features déjà portées, vérifier d'abord CE QUE CES
   FEATURES IMPORTENT DÉJÀ DE CE FICHIER (grep `from '.*nom-du-fichier.js'` dans tout le
   projet) avant d'écrire le moindre import EN RETOUR — c'est exactement ce qui a
   causé le cycle #8.
