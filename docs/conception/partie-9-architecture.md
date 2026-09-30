# Ocha — Moteur guidé v1

## Partie 9 · Architecture et persistance

**Statut** : 🔒 verrouillée (version 2).

**Objet** : les parties 1 à 8 disent **ce qu'Ocha doit faire**. Cette partie dit **comment le
construire sans affaiblir ces garanties** : découpage en modules, frontières entre couches,
stockage, atomicité, pannes, reprise, ordre de reconstruction et tests.

**Point de départ** : la stratégie de reconstruction (nouvelle base de code, JSON conservés et
enrichis, logique éprouvée reprise module par module, app actuelle intacte pendant la
construction).

**Contraintes techniques inchangées** : PWA, HTML/CSS/JavaScript vanilla en modules ESM,
aucun framework, aucune dépendance lourde, fonctionnement entièrement côté client.

---

## 9.1 Les couches

```
┌──────────────────────────────────────────────────────────────┐
│ UI            écrans, composants, navigation, paramètres      │
└───────▲──────────────────────────────┬───────────────────────┘
        │ lit (instantanés)            │ appelle
┌───────┴──────────┐  ┌────────────────▼─────────┐  ┌──────────────────┐
│ ENGINE           │  │ EXERCISES                │  │ LEARNING         │
│ moteur guidé     │  │ générateurs, morphologie,│  │ recordLearningEvent│
│ composition,     │  │ représentation           │  │ état calculé, SRS,│
│ adaptation       │  │ (partie 5)               │  │ faiblesses, budget│
│ (partie 4)       │  │                          │  │ journal (parties 1, 3)│
└───────▲──────────┘  └────────────▲─────────────┘  └───▲──────────┬───┘
        │ lit                      │ lit                │ lit      │ écrit
┌───────┴──────────────────────────┴─────────────────────┴───┐  ┌───▼──────────┐
│ CONTENT   données JSON en lecture seule, graphe (partie 2) │  │ STORE        │
└────────────────────────────────────────────────────────────┘  │ persistance  │
                                                                 └──────────────┘
```

### Règles de dépendance

1. **CONTENT** est en lecture seule : il charge les JSON, les normalise en `{ type, id }` et
   construit le graphe (index `requires`, `teaches`, `uses`, relations dérivées).
2. **LEARNING** est la **seule** couche qui écrit dans STORE. Tout passe par
   `recordLearningEvent` (partie 3).
3. **ENGINE** et **EXERCISES** ne font que **lire** : un instantané de LEARNING et le graphe de
   CONTENT. Quand ils doivent signaler quelque chose (session commencée, renforcement), ils
   émettent un événement via LEARNING.
4. **UI** ne touche jamais STORE ni les données brutes : elle appelle ENGINE, EXERCISES et
   LEARNING.
5. **LEARNING, ENGINE, EXERCISES et CONTENT sont écrits en fonctions pures** autant que
   possible : même entrée, même sortie, sans accès au DOM ni au stockage. C'est ce qui les
   rend testables sans navigateur (9.8).

### Arborescence proposée

```
ocha/
├── index.html                coquille (métadonnées, manifeste, service worker)
├── sw.js
├── data/                     JSON (conservés, enrichis)
├── src/
│   ├── content/              chargement, normalisation, graphe
│   ├── store/                interface de stockage + implémentations
│   ├── learning/             événements, état, srs, faiblesses, budget, journal
│   ├── exercises/            représentation, morphologie, générateurs
│   ├── engine/               composition, adaptation, motifs
│   ├── ui/                   écrans, composants, navigation, paramètres
│   ├── config.js             GUIDED_CONFIG (paramètres des parties 1 à 5)
│   └── app.js                démarrage
├── css/                      design system (d'après la maquette v4)
├── tools/validate-data.mjs   script de validation (partie 2)
└── tests/                    tests automatiques (9.8)
```

---

## 9.2 Stockage

### Pourquoi pas seulement `localStorage`

`localStorage` n'écrit qu'une clé à la fois, de façon synchrone, dans environ 5 Mo pour tout le
site. Or la partie 3 exige qu'un événement et ses effets (suivi, faiblesses, avancement,
session) soient enregistrés **ensemble ou pas du tout**. Avec plusieurs clés `localStorage`,
une coupure entre deux écritures laisse un état incohérent.

### Choix

| Donnée | Stockage | Raison |
|---|---|---|
| Suivi des éléments, faiblesses, journal, résumés quotidiens, avancement, sessions, déclarations, dossiers | **IndexedDB**, base `ocha` | transactions sur plusieurs magasins à la fois ; quota bien plus large |
| Paramètres (thème, affichage, audio, rythme) | `localStorage`, clé `ocha_settings` | lecture **synchrone** au démarrage, pour appliquer le thème avant le premier affichage |

IndexedDB est natif dans tous les navigateurs : aucune dépendance. Une petite couche maison
(quelques dizaines de lignes) en simplifie l'usage.



### Schéma (magasins de la base `ocha`)

| Magasin | Clé | Contenu |
|---|---|---|
| `elements` | identifiant d'élément | date d'introduction, origine, vérifié, entrée SRS (partie 1) |
| `weaknesses` | identifiant d'élément | échecs consécutifs et totaux, série de réussites, dernier échec, résolution (partie 3) |
| `events` | identifiant d'événement ; index sur la date | journal détaillé (partie 3) |
| `daily` | date (AAAA-MM-JJ) | résumé quotidien (partie 3) |
| `activities` | identifiant d'activité | avancement : non commencée, en cours (étape), terminée |
| `sessions` | `current` | session guidée en cours ; mission en cours |
| `declarations` | identifiant de déclaration | niveau déclaré, faits précédents pour l'annulation |
| `folders` | identifiant de dossier | contenu, dossier « À revoir » |
| `meta` | clé | version du schéma, dernière compaction, identifiant d'installation |

### Versionnage

Le schéma porte un **numéro de version dès la v1**, même sans utilisateur à migrer. Toute
évolution future du schéma passe par une fonction de migration numérotée, exécutée à
l'ouverture de la base (`upgradeneeded`). Aujourd'hui, la seule « migration » est la
création initiale ; l'ancien format `kanji_trad_*` n'est pas repris (aucune donnée à
conserver).

---

## 9.3 Atomicité de `recordLearningEvent`

```
recordLearningEvent(event)
  1. valider           type connu, éléments existants, cible présente
  2. calculer          effets sur une COPIE de l'état en mémoire (fonctions pures)
  3. persister         UNE transaction IndexedDB : événement + éléments + faiblesses
                       + avancement + session, tous ensemble
  4. si réussite       la copie devient l'état en mémoire ; notification des écrans
     si échec          l'état en mémoire est inchangé ; voir 9.4
```

- **Tout ou rien** : si la transaction échoue, rien n'est écrit, et l'état en mémoire n'a pas
  bougé. La partie 3 est respectée par construction.
- **Idempotence** : dans la transaction, on vérifie que l'identifiant de l'événement n'existe
  pas déjà. Un événement envoyé deux fois (double clic, nouvelle tentative) n'a d'effet qu'une
  fois.
- **Asynchrone** : l'écriture IndexedDB est asynchrone. L'écran attend la confirmation avant
  d'afficher le résultat qui en dépend (retour de réponse, passage à la question suivante).
  L'attente est de l'ordre de la milliseconde ; elle n'est pas perceptible.
- **Ordre** : les événements sont traités **un par un**, dans l'ordre d'émission (file
  interne), pour qu'aucun effet n'en écrase un autre.

---

## 9.4 Échec d'écriture (lacune L4)

Principe verrouillé en partie 6 : **ne jamais perdre silencieusement un événement ; l'échec
doit être détecté et rendu visible.**

| Étape | Comportement |
|---|---|
| 1. Échec détecté | quota dépassé, transaction annulée, stockage indisponible |
| 2. Tentative de récupération | compaction immédiate du journal (partie 3 : détail résumé en quotidien), puis **une** nouvelle tentative |
| 3. Si ça réussit | la session continue normalement, rien n'est montré |
| 4. Si ça échoue encore | l'événement reste dans une **file d'attente volatile, en mémoire**, tant que l'app reste ouverte ; les exercices évalués sont **immédiatement mis en pause** ; un bandeau s'affiche : « Ta dernière réponse n'a pas pu être enregistrée. » avec **Réessayer** et **Exporter mes données** |
| 5. Pendant l'échec | l'utilisateur ne continue pas à répondre à des questions dont le résultat serait perdu. La consultation (fiches, lectures libres) reste possible. L'interface indique en permanence que la dernière réponse n'est pas encore enregistrée |
| 6. « Réessayer » réussit | la file est enregistrée dans l'ordre (l'idempotence évite les doublons), le bandeau disparaît, la session reprend |

**La file ne survit pas à un redémarrage.** Si l'app est fermée ou plante avant le retour du
stockage, les événements encore dans la file sont perdus. On ne les sauvegarde pas ailleurs :
si IndexedDB vient d'échouer, écrire dans un second stockage créerait une deuxième source de
vérité et compromettrait l'atomicité. Comme la session ne continue jamais dans cet état, la
perte est limitée aux réponses **déjà signalées** comme non enregistrées.

**La garantie d'Ocha** : tout ce qu'Ocha confirme comme enregistré survit ; ce qui n'a pas pu
l'être est explicitement signalé, et bloque la suite.

**Pourquoi mettre en pause plutôt que continuer** : continuer une session dont rien ne peut
être enregistré ferait perdre tout le travail au prochain lancement, sans que l'utilisateur
le sache (partie 6).

### Éviction du stockage

Sur iPhone, Safari peut effacer les données d'un site **non installé** après quelques jours
sans visite. Deux mesures :

- demander au navigateur la **persistance du stockage** (`navigator.storage.persist()`) après
  la première session, et en afficher l'état dans les paramètres : « Protection du stockage :
  activée / non garantie ». C'est une demande au navigateur, pas une sauvegarde : elle réduit
  le risque d'effacement sans l'exclure ;
- **export / import** des données dans Paramètres › Données (fichier JSON). C'est la seule
  vraie protection indépendante du stockage local : une sauvegarde que l'utilisateur garde.

---

## 9.5 Démarrage, rechargement, plantage

### Au démarrage

1. Lecture synchrone de `ocha_settings` → thème et affichage appliqués immédiatement.
2. Chargement des données JSON (réseau d'abord, cache du service worker ensuite) et
   construction du graphe.
3. Ouverture de la base `ocha` (migrations éventuelles), chargement de l'état en mémoire.
4. Calcul de l'instantané, composition ou reprise de la session du jour, affichage de
   l'accueil.

### Après un plantage ou une fermeture brutale

Chaque événement est persisté au moment où il se produit (9.3) : au pire, on perd la
**dernière réponse** en cours de traitement. Rien d'autre à restaurer : l'état se recalcule à
partir des faits persistés (partie 1).

### Persistance des sessions

La session guidée en cours et la mission en cours sont écrites dans le magasin `sessions`
**dans la même transaction** que l'événement qui les fait avancer (`ACTIVITY_COMPLETED`,
réponse à une question). La reprise (partie 4, 4.8) repart donc toujours d'un état cohérent
avec le suivi.

---

## 9.6 Navigation et interface

- **Un routeur neuf**, fondé sur l'historique du navigateur. Le retour appelle toujours
  `history.back()` ; ⌂ et les onglets de la barre du bas **remplacent** la pile au lieu
  d'empiler (règle inchangée).
- **Les sessions survivent à la navigation** : le nettoyage global de l'ancienne app
  (`closeAllOverlaysAndSessions`) disparaît. Une session n'est close que par sa fin, son
  abandon (12 h) ou une action explicite.
- **Paramètres en panneau** par-dessus l'écran courant, sans navigation (maquette v4).
- **Événements d'interface par délégation** : les éléments portent un attribut
  (`data-action="…"`) et un écouteur unique par écran les traite. Plus de fonctions exposées
  sur `window` ni de `onclick` dans le HTML généré. Le « piège n°1 » de l'ancienne app
  (`ReferenceError` silencieuse au clic) disparaît par construction.



---

## 9.7 Service worker et contenu hors ligne

Stratégie reprise de l'app actuelle (stratégie de reconstruction) :

- HTML et JSON : **réseau d'abord**, cache en secours ;
- scripts, CSS, polices, images : **cache d'abord** ;
- musique : mise en cache **par la page**, morceau par morceau, à la première écoute (pas par
  le service worker, que Safari gère mal pour l'audio).

L'état d'apprentissage vivant dans IndexedDB, Ocha fonctionne entièrement hors ligne une
fois les données en cache.

---

## 9.8 Tests

### Outils

- `node --check` sur chaque fichier (règle conservée).
- **Tests automatiques avec l'exécuteur intégré de Node** (`node --test`) : aucune dépendance.
- Le stockage est abstrait derrière une **interface** avec deux implémentations : IndexedDB
  pour l'app, **en mémoire** pour les tests. Les couches LEARNING, ENGINE, EXERCISES et CONTENT
  se testent donc entièrement dans Node.
- `tools/validate-data.mjs` : le script de validation du graphe (partie 2), lancé avant
  chaque commit de données.

### Ce qui est testé

| Source | Devient |
|---|---|
| Critères bloquants de la partie 7 (S1 à S11, C1 à C6, R1 à R4) | tests automatiques, écrits **avec** le module qu'ils couvrent |
| Les cinq sessions de la partie 8 | **scénarios automatiques** : profil initial en données, composition attendue, événements attendus, état final attendu |
| Liste de contrôle de chaque module repris (stratégie de reconstruction) | tests de non-régression (ex. intervalles de `gradeReview` pour chaque note) |
| Échec d'écriture (9.4) | test avec une implémentation de stockage qui échoue à la demande |

Les critères de **qualité** (Q, U) se vérifient sur les scénarios et lors des tests réels ; ils
ne bloquent pas un commit.

---

## 9.9 Ordre de reconstruction

Chaque étape se termine par ses tests verts avant la suivante.

| Étape | Contenu | Tests |
|---|---|---|
| 0 · Préparation | branche `ocha-v2`, arborescence, nouvelles règles de construction (9.10), nettoyage des données (stratégie §6), script de validation | validation des données sans erreur |
| 1 · Stockage et apprentissage | interface de stockage (IndexedDB + mémoire), `recordLearningEvent`, état calculé, SRS et faiblesses repris, budget, journal et compaction, échec d'écriture | S6, S7, C1 à C5, 9.4 |
| 2 · Contenu et graphe | chargement, normalisation `{ type, id }`, graphe, relations dérivées, `forms` / `construction` | R1, R4, S1 |
| 3 · Exercices | représentation, morphologie et exceptions, générateurs | S3, S4, S5, S8, S9, S11, R3 |
| 4 · Moteur guidé | composition par rôles, zones de rattrapage, adaptation, reprise, motifs | S2, S10, C6, **scénarios A à E** |
| 5 · Interface | design system, navigation, header et barre du bas, panneau de paramètres ; écrans dans l'ordre : accueil et session guidée, Réviser, Apprendre et bibliothèque, Pratiquer, Explorer, Lire, recherche, dossiers, premier lancement | parcours manuels ; critères U |
| 6 · PWA et finitions | service worker, musique, voix, stockage persistant, export / import | tests hors ligne, éviction |
| 7 · Bascule | la branche `ocha-v2` remplace l'app actuelle | tous les tests, puis tests réels |

L'app actuelle reste utilisable pendant les étapes 0 à 6.

La branche `main` reste l'Ocha actuel, fonctionnel ; la branche `ocha-v2` porte la
reconstruction ; la bascule n'a lieu qu'à l'étape 7, tests verts.

---

## 9.10 Règles de construction de la nouvelle base

`REGLES-CONSTRUCTION.md` décrit l'ancienne base. La nouvelle base aura son propre fichier,
pour qu'aucun agent n'applique les anciennes règles par erreur.

**Conservées** : `node --check` sur chaque fichier JS ; retour par `history.back()` ; messages de
commit sur une seule ligne (PowerShell) ; ne jamais demander un fichier déjà présent ; ne jamais
improviser un comportement non spécifié.

**Nouvelles** :

- toute écriture d'état passe par `recordLearningEvent` ; aucune autre couche n'écrit dans le
  stockage ;
- LEARNING, ENGINE, EXERCISES et CONTENT restent sans accès au DOM ;
- tout nouveau module arrive avec ses tests ; un critère bloquant de la partie 7 ne peut pas
  être désactivé pour faire passer un test ;
- les paramètres chiffrés vivent dans `config.js`, jamais en dur dans le code ;
- toute donnée modifiée passe le script de validation avant commit ;
- tant qu'un fichier est en construction initiale, il peut être écrit en entier ; ensuite, la
  règle « patcher par `str_replace` ciblé » s'applique à nouveau ;
- le document de conception (parties 1 à 9) fait référence : un comportement qui s'en écarte
  est signalé, pas improvisé.

---

## Décisions de cette partie

| Point | Décision |
|---|---|
| Couches CONTENT, STORE, LEARNING, EXERCISES, ENGINE, UI ; seule LEARNING écrit | validé |
| IndexedDB pour l'état d'apprentissage, `localStorage` pour les seuls paramètres | validé |
| Une transaction par événement, idempotence, traitement un par un | validé |
| Échec persistant : file volatile, pause des exercices évalués, pas de seconde persistance | validé |
| Persistance du stockage demandée, présentée comme non garantie ; export / import | validé |
| Routeur neuf, sessions qui survivent, délégation d'événements (`data-action`) | validé |
| Tests : `node --test`, stockage en mémoire, critères bloquants et scénarios de la partie 8 | validé |
| Branche `ocha-v2`, reconstruction en 8 étapes | validé |

## Conséquences

- Le document de conception est **complet** : il sert de cahier des charges à l'agent qui
  construira Ocha v2. Aucune partie supplémentaire n'est prévue : la suite est l'étape 0 de la
  reconstruction.
- Le fichier de règles de la nouvelle base (9.10) est à rédiger à l'étape 0, à partir de cette
  section.
