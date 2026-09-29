# Ocha v2 — Règles de construction

**Statut** : 🔒 verrouillé (version 2).

**S'applique à** : la branche `ocha-v2` uniquement. La branche `main` (Ocha actuel) garde son
propre `REGLES-CONSTRUCTION.md`, qui ne s'applique **pas** ici.

**Rôle de ce fichier** : transformer le document de conception (`docs/conception/`) en
consignes opérationnelles pour quiconque modifie le dépôt, humain ou agent. En cas de doute,
**le document de conception fait référence**, et ce fichier dit comment le respecter.

---

## 1. Avant toute tâche

1. Lire `docs/conception/00-sommaire.md`, puis les parties concernées par la tâche.
2. Lire `ETAT-ACTUEL.md` : étape de reconstruction en cours, ce qui est fait, ce qui reste.
3. Vérifier qu'on est sur la branche `ocha-v2` :
   ```
   git branch --show-current
   ```
4. Ne jamais demander l'envoi d'un fichier déjà présent dans le dépôt ou le Project.

---

## 2. Ne jamais improviser

- **Si le cahier des charges ne dit pas quoi faire** : s'arrêter et poser la question. Ne pas
  inventer un comportement, même raisonnable.
- **Si deux règles semblent se contredire** : le signaler, avec les références (partie,
  section), sans trancher seul.
- **Les parties de conception sont verrouillées.** Elles ne se modifient pas en passant. Toute
  évolution passe par un **addendum** explicite, validé avant d'être codé, comme l'addendum 2.10.
- **Les paramètres chiffrés** (seuils, durées, quotas) ne se choisissent pas : ils viennent de
  `src/config.js` (`GUIDED_CONFIG`), qui reprend les valeurs des parties 1 à 5.

---

## 3. Ordre de travail

La reconstruction suit les étapes 0 à 7 de la partie 9 (9.9).

- **On ne commence pas une étape tant que les tests de la précédente ne sont pas verts.**
- **On ne travaille pas sur l'interface avant l'étape 5**, même pour « voir le rendu ».
- **La maquette v4 est une référence visuelle**, jamais une base de code à copier.
- Après chaque tâche, **mettre à jour `ETAT-ACTUEL.md`** : étape, fait, reste, points ouverts.

---

## 4. Les couches

```
src/content/     données en lecture seule, graphe
src/store/       persistance : IndexedDB (apprentissage) ; store/settings.js (paramètres, localStorage)
src/learning/    recordLearningEvent, état, SRS, faiblesses, budget, journal
src/exercises/   représentation, morphologie, générateurs
src/engine/      moteur guidé
src/ui/          écrans, composants, navigation
```

### Qui peut importer quoi

| Couche | Peut importer |
|---|---|
| `content` | `config` uniquement |
| `store` | `config` uniquement |
| `learning` | `content`, `store`, `config` |
| `exercises` | `content`, `learning` (lecture seule), `config` |
| `engine` | `content`, `learning` (lecture seule), `exercises`, `config` |
| `ui` | `engine`, `exercises`, `learning`, `content`, `config`, et **`store/settings.js` seulement** — jamais le reste de `store` |

### Deux circuits d'écriture

```
État pédagogique                       Paramètres de l'utilisateur
UI / ENGINE / EXERCISES                UI (panneau Paramètres)
        ↓ recordLearningEvent                  ↓
     LEARNING                          store/settings.js
        ↓                                      ↓
  store (IndexedDB)                      localStorage (ocha_settings)
```

Les deux circuits ne se croisent pas : les paramètres ne contiennent **aucun** état
pédagogique, et l'état pédagogique ne passe **jamais** par `localStorage` (partie 9, 9.2).

### Règles absolues

1. **Seule `learning` peut demander une écriture de l'état pédagogique dans `store`.** Toute
   modification de progression passe par `recordLearningEvent` (partie 3). Aucun autre
   fichier n'appelle IndexedDB.
   **Exception indépendante** : les paramètres sont lus et écrits par `store/settings.js`, seul
   fichier à utiliser `localStorage`, appelé uniquement par l'interface.
   `engine` et `exercises` n'importent pas les paramètres : ils reçoivent les valeurs utiles
   (format de session, budget, furigana, romaji…) **en argument**, ce qui les garde testables
   sans navigateur.
2. **`content`, `learning`, `exercises` et `engine` n'accèdent jamais au DOM** : pas de
   `document`, `window`, `navigator`, `localStorage`, `indexedDB`. Ils doivent tourner dans
   Node pour les tests.
3. **Les écrans ne recalculent jamais un état** : ils demandent un instantané à `learning`.
4. **Aucun champ « état » n'est stocké** (Nouveau, Acquis…) : l'état est toujours calculé
   (partie 1).

### Vérification

Le script `tools/check-layers.mjs` (étape 0) vérifie automatiquement :

- les **déclarations `import`** de chaque fichier, analysées comme telles (pas une simple
  recherche de texte), contre le tableau ci-dessus ;
- les **accès aux API du navigateur** (`document.…`, `window.…`, `navigator.…`,
  `localStorage.…`, `indexedDB.…`) hors de `src/ui/` et `src/store/`. Le script vise les
  accès réels, pas la présence du mot : `reviewWindowDays`, un commentaire ou une chaîne de
  caractères ne sont pas des violations ;
- l'absence d'accès à IndexedDB hors de `src/store/`, et à `localStorage` hors de
  `src/store/settings.js`.

Un garde-fou qui produit de fausses alertes finit contourné : le script doit rester précis.

Il est lancé avant chaque commit, avec les tests.

---

## 5. Identifiants et données

- **Les références suivent la forme `{ type, id }`** en interne (partie 2). Dans les données,
  les clés sont `grammar`, `vocab`, `kanji`, `kana`, `expression`.
- **Ne jamais inventer un identifiant** de contenu (`n5_v_…`, `n5_g_…`, `ex_…`, `hj_v_…`). Un
  contenu manquant se signale, il ne se crée pas au passage.
- **Les identifiants de questions générées** suivent `gen:<générateur>:<cible>:<variante>` et
  doivent être stables : la même question produit toujours le même identifiant.
- **Toute modification de données** passe le validateur avant commit :
  ```
  node tools/validate-data.mjs
  ```
  Aucune erreur n'est acceptée ; les avertissements sont lus et justifiés.
- **Le nouveau contenu** (lectures, missions, expressions, gabarits) suit
  `GUIDE-CONTENU.md` : romaji sans macron (`gakkou`), furigana hors okurigana, japonais naturel.
- Les clés de stockage utilisent le préfixe `ocha_` ; la base IndexedDB s'appelle `ocha`.

---

## 6. Interface

- **Événements par délégation** : les éléments cliquables portent `data-action="…"`, et un
  écouteur unique par écran les traite. **Interdit** : `onclick`, `onsubmit` ou tout autre
  gestionnaire écrit dans le HTML généré, et toute fonction exposée sur `window` pour
  l'interface.
- **Retour** : toujours `history.back()`, jamais l'appel direct à l'écran parent.
  **Exception** : ⌂ et les onglets de la barre du bas **remplacent** la pile au lieu d'empiler.
- **Les sessions survivent à la navigation** : aucun nettoyage global de session lors d'un
  changement d'écran. Une session ne se termine que par sa fin, son abandon (12 h) ou une
  action explicite (partie 4).
- **Paramètres** : panneau par-dessus l'écran courant, sans navigation.
- **Japonais** : tout **contenu japonais pédagogique issu des données** passe par le système
  commun de représentation (partie 5). Aucun écran ni générateur ne fabrique ses propres
  furigana, son propre romaji ou ses propres règles d'adaptation. Un titre statique, un badge
  ou un élément décoratif en japonais n'est pas concerné.
- **Attendre l'enregistrement** : un événement pédagogique est **attendu** (`await`) avant
  toute transition d'interface qui dépend de son succès. Une réponse n'est jamais présentée
  comme enregistrée, et la question suivante n'est jamais affichée, avant la confirmation de
  `recordLearningEvent` (partie 9, 9.3 et 9.4).
- **CSS** : uniquement les jetons du design system (couleurs, espacements, rayons). Aucune
  couleur en dur. Le flou glassy s'applique aux grands conteneurs, jamais à chaque ligne d'une
  liste. Respect de « réduire les animations ».
- **Textes** : tutoiement, aucun terme technique visible (SRS, prérequis, état, score…).

---

## 7. Tests

- **Outil** : l'exécuteur intégré de Node, sans dépendance :
  ```
  node --test tests/
  ```
- **Tout module arrive avec ses tests**, dans le même commit.
- **Les critères bloquants de la partie 7** (S, C, R) sont des tests automatiques, écrits avec
  le module qu'ils couvrent. Chaque test indique en commentaire le critère qu'il vérifie
  (`// Partie 7 · S6`).
- **Les cinq sessions de la partie 8** deviennent des scénarios automatiques à l'étape 4.
- **Les modules repris de l'ancienne app** ont un test de non-régression tiré de leur liste
  de contrôle (stratégie de reconstruction).
- **Interdit** : désactiver, sauter ou affaiblir un test pour faire passer une modification. Un
  test qui échoue révèle soit une erreur de code, soit une contradiction à signaler (§2).
- Les tests de `learning`, `engine`, `exercises` et `content` utilisent le **stockage en
  mémoire**, jamais IndexedDB.

---

## 8. Modifier les fichiers

- **Fichier nouveau, en construction initiale** : il peut être écrit en entier.
- **Fichier existant et déjà commité** : modification **ciblée** (`str_replace`), jamais de
  réécriture complète sans raison explicite, annoncée avant.
- **Après chaque fichier JavaScript modifié** :
  ```
  node --check chemin/du/fichier.js
  ```
- **Un module est repris de l'ancienne app** (liste de la stratégie de reconstruction) : on
  reprend sa **logique**, adaptée aux nouvelles interfaces, avec sa liste de contrôle. On ne
  copie pas le fichier tel quel, et on ne reproduit pas les comportements listés comme à
  éviter (maîtrise automatique après une seule réussite, clés `mastered_…`, favori et maîtrise
  dans le même champ, nettoyage global des sessions…).

---

## 9. Git

- **Messages de commit sur une seule ligne** : l'utilisateur travaille sous PowerShell, où un
  message sur plusieurs lignes casse la commande.
  ```
  git commit -m "Etape 1: recordLearningEvent et transaction IndexedDB"
  ```
- **Un commit par unité cohérente** (un module et ses tests), préfixé par l'étape.
- **Ne jamais commiter** : `__pycache__/`, fichiers de référence temporaires (comme
  `glassy-box.html`), fichiers générés. Ils sont listés dans `.gitignore`.
- **Ne jamais toucher à `main`** depuis ce chantier. La bascule a lieu à l'étape 7 seulement.

---

## 10. Liste de contrôle avant de livrer une tâche

- [ ] Branche `ocha-v2`.
- [ ] Le comportement vient du cahier des charges, ou la question a été posée.
- [ ] `node --check` sur chaque fichier JS modifié.
- [ ] `node --test tests/` : tous les tests passent.
- [ ] `node tools/check-layers.mjs` : aucune violation de couche.
- [ ] `node tools/validate-data.mjs` si des données ont changé.
- [ ] Aucun paramètre chiffré en dur hors de `src/config.js`.
- [ ] Aucun `onclick` ni fonction exposée sur `window` pour l'interface.
- [ ] Chaque événement pédagogique est attendu avant la transition d'interface qui en dépend.
- [ ] `ETAT-ACTUEL.md` mis à jour.
- [ ] Aucun fichier de conception verrouillé n'a été modifié, sauf addendum explicitement
      demandé.
- [ ] Commit sur une seule ligne.

---

## 11. Étape 0 · ce qu'elle doit produire

Pour mémoire, l'étape 0 met en place ce que ce fichier suppose. Elle se fait **une tâche à la
fois**, dans cet ordre, chacune livrée et commitée avant la suivante :

1. la branche `ocha-v2`, l'arborescence (partie 9, 9.1), `.gitignore` à jour ;
2. les fichiers de gouvernance : ce fichier, un `ETAT-ACTUEL.md` propre à la v2, et
   `docs/conception/` avec tout le document de conception, `GUIDE-CONTENU.md` et le README
   des données ;
3. `src/config.js` avec `GUIDED_CONFIG` ;
4. `tools/check-layers.mjs` ;
5. `tools/validate-data.mjs` ;
6. le nettoyage des données listé dans la stratégie de reconstruction (§6), jusqu'à une
   validation sans erreur.
