# Ocha — Moteur guidé v1

## Partie 1 · Définitions fondamentales et échelle d'états

**Statut** : 🔒 verrouillée (version 3). Suppression du favori ; migration simplifiée (Ocha n'a pas encore
d'utilisateurs). Partie validée sur le fond ;
les seuils chiffrés sont des valeurs initiales à observer (voir 1.2).

**Objet** : définir ce qu'Ocha suit, dans quels états un élément peut se trouver, comment il
passe d'un état à l'autre, et ce que l'app actuelle fait aujourd'hui qu'il ne faut pas reproduire. Toutes
les parties suivantes (graphe, journal, moteur) s'appuient sur ces définitions.

**Sources vérifiées dans le code actuel** : `storage.js` (`trackItem`, clé
`kanji_trad_tracking`), `srs.js` (`gradeReview`, format `.srs`), `weakness.js`
(`updateWeaknessTracking`), `learning-path.js` (progression du parcours), `data-loader.js`
(identifiants des kana), et tous les appels à `trackItem(…, 'mastered')` (`common.js`,
`vocabulary.js`, `grammar.js`, `kanji.js`, `oral.js`).

---

## 1.1 Élément pédagogique

Un **élément** est une unité de connaissance qu'Ocha suit individuellement pour un
utilisateur. Chaque élément a un **identifiant stable**, qui sert à la fois dans les
données, le suivi, le SRS, les faiblesses, les dossiers et le journal d'événements.

| Type | Identifiant | Exemple | Existe aujourd'hui |
|---|---|---|---|
| Kana | `kana_` + caractère | `kana_あ` | oui |
| Kanji | le caractère lui-même | `水` | oui |
| Vocabulaire | `n5_v_…`, `n4_v_…` | `n5_v_117` | oui |
| Grammaire | `n5_g_…`, `n4_g_…` | `n5_g_8` | oui |
| Expression | `ex_…` | `ex_3` | nouveau |
| Mot hors JLPT | `hj_v_…` | `hj_v_1` | nouveau |

**Ne sont pas des éléments** : les missions, lectures, leçons en tant que parcours, sessions
et exercices. Ce sont des **activités**. Une activité n'a pas d'état pédagogique : elle a un
état d'**avancement** (non commencée, en cours, terminée), traité en partie 3. Une activité
fait évoluer l'état des éléments qu'elle enseigne ou fait pratiquer.

> Remarque : les kanji sont identifiés par leur caractère, pas par un identifiant de niveau.
> Le graphe (partie 2) devra en tenir compte : une référence à un kanji s'écrit `水`, pas
> `n5_k_…`.

---

## 1.2 Les cinq états

Chaque élément se trouve dans **exactement un** de ces cinq états, avec le même libellé
partout (document, données, interface) :

**Nouveau → Découvert → En cours → Acquis → Maîtrisé**

### Nouveau

- **Définition** : l'élément n'a jamais été présenté ni travaillé.
- **Entrée** : état par défaut de tout élément.
- **Sortie** : vers Découvert quand il est présenté ; directement vers En cours si
  l'utilisateur répond à une question dont il est la **cible** (par exemple dans un quiz
  libre, voir la définition ci-dessous) ; vers Acquis par déclaration ou test.
- **Moteur** : peut être proposé comme nouveauté si ses prérequis sont satisfaits (partie 4).

### Découvert

- **Définition** : l'élément a été présenté au moins une fois, mais jamais travaillé.
- **Entrée** : une activité l'a **enseigné** (il figure dans son `teaches`, partie 2), ou
  une étape de présentation l'a montré (étape « Mots » d'une mission, étape de découverte
  d'une leçon). Événement `CONTENT_INTRODUCED`.
- **Ce qui ne fait pas entrer dans cet état** : apparaître seulement dans une phrase
  (`uses`), ouvrir une fiche, apparaître dans une recherche.
- **Sortie** : vers En cours à la première **réponse évaluée ciblant** cet élément.
- **Moteur** : priorité de **réutilisation** (règle R5) : un élément découvert doit être
  pratiqué rapidement, sinon la présentation est perdue.

### En cours

- **Définition** : l'élément a été travaillé et son acquisition est en cours.
- **Entrée** : première réponse évaluée ciblant l'élément (question d'exercice ou note SRS) ;
  ou retour depuis Acquis / Maîtrisé après un échec.
- **Création de l'entrée SRS** : c'est à l'entrée en En cours que l'élément reçoit son entrée
  SRS (première échéance proche), quelle que soit l'activité qui l'a fait entrer.

> **Réponse évaluée ciblant un élément** : une réponse à une question dont l'élément est la
> **cible pédagogique**, c'est-à-dire ce que la question vérifie (le sens de ce mot, la
> lecture de ce kanji, le choix de cette particule). La cible est déclarée dans les données
> de la question (identifiant de question et cible, partie 2). Un élément qui apparaît
> seulement dans l'énoncé, dans une phrase, une lecture ou une mission n'est pas ciblé : sa
> présence ne change pas son état.
- **Sortie** : vers Acquis quand l'intervalle SRS atteint le seuil d'acquisition.
- **Moteur** : révisions selon le SRS ; cible privilégiée du renforcement en cas d'erreur.

### Acquis

- **Définition** : l'élément peut être considéré comme connu à moyen terme.
- **Entrée** : intervalle SRS **≥ 21 jours** (origine `appris`) ; ou déclaration de niveau,
  test de positionnement, marquage manuel (origines `déclaré`, `testé`, voir 1.3).
- **Sortie** : vers Maîtrisé quand l'intervalle atteint le seuil de maîtrise ; vers En cours
  à la première note « Oublié ».
- **Moteur** : compte comme « connu » pour l'éligibilité (partie 4). Révisé par le SRS,
  rarement.

### Maîtrisé

- **Définition** : l'élément est stable et réutilisable.
- **Entrée** : intervalle SRS **≥ 60 jours**.
- **Sortie** : vers En cours à la première note « Oublié ».
- **Moteur** : compte comme « connu ». Réactivé seulement à ses échéances SRS, ou quand une
  activité l'utilise.

### Seuils

| Passage | Seuil | Repère (avec « Bien » à chaque fois) |
|---|---|---|
| En cours → Acquis | intervalle ≥ 21 jours | vers la 5e révision réussie |
| Acquis → Maîtrisé | intervalle ≥ 60 jours | vers la 6e révision réussie |

Avec le calcul actuel de `gradeReview` (« Bien » : 1, 3, puis intervalle × facilité, facilité
de départ 2,5), les intervalles successifs sont environ 1, 3, 8, 20, 50, 125 jours.

**Valeurs initiales de la v1.** Les seuils de 21 et 60 jours sont des choix pédagogiques
d'Ocha, retenus parce qu'ils donnent au moteur une définition immédiatement exploitable. Ils
seront ajustés après observation du comportement réel. Comme l'état est calculé (1.4), les
modifier ne demandera aucune migration.

### Les quatre notes SRS

Les notes de révision s'affichent avec ces libellés, du plus faible au plus fort :

| Qualité (code) | Libellé | Sens pour l'utilisateur |
|---|---|---|
| 0 | **Oublié** | Je ne m'en souvenais plus |
| 1 | **Difficile** | J'ai retrouvé la réponse avec beaucoup d'effort |
| 2 | **Bien** | Je m'en suis souvenu correctement |
| 3 | **Facile** | La réponse m'est venue immédiatement |

« Oublié » remplace l'ancien « Encore », peu clair pour un utilisateur qui ne connaît pas
les SRS. Ces quatre boutons n'apparaissent **que dans une vraie révision SRS** ; la pratique
libre utilise « Je savais / Je ne savais pas » (partie 3).

### Retours en arrière

Une note « Oublié » (qualité 0) ramène **toujours** un élément Acquis ou Maîtrisé à
**En cours**. C'est cohérent avec `gradeReview`, qui remet déjà l'intervalle à 1 jour et les
répétitions à 0 dans ce cas. Aucune autre note ne fait reculer un élément.

---

## 1.3 L'origine

Un élément Acquis ou Maîtrisé garde **d'où vient** cet état :

| Origine | Signification |
|---|---|
| `appris` | atteint en travaillant dans Ocha |
| `déclaré` | l'utilisateur a indiqué connaître l'élément (choix de niveau, marquage manuel) |
| `testé` | déduit du test de positionnement |

**L'origine n'influence que le SRS**, jusqu'à la première révision :

- Un élément `déclaré` ou `testé` reçoit une **vérification** : une première échéance SRS
  comprise entre 21 et 45 jours après la déclaration. La répartition dans cette fenêtre est
  **déterministe** : elle est calculée à partir de la date de déclaration et d'une empreinte
  stable de l'identifiant de l'élément. On évite ainsi un pic de centaines d'éléments dus le
  même jour, tout en gardant un comportement reproductible (un même élément tombe toujours
  à la même échéance pour une même déclaration), sans rien stocker de plus.
- **Vérification réussie** : l'élément suit ensuite le calcul normal ; il est traité
  exactement comme un élément `appris`. L'origine reste enregistrée pour les statistiques.
- **Vérification échouée** (« Oublié ») : retour en En cours, comme tout élément.

L'origine n'est jamais montrée comme un état distinct : l'utilisateur voit « Acquis ».

---

## 1.4 État pédagogique et SRS

**L'état pédagogique** dit **où en est** l'utilisateur avec un élément.
**Le SRS** dit **quand** le réactiver.

Ils sont liés mais pas interchangeables :

- Un élément peut être Acquis et à revoir demain, ou Maîtrisé et à revoir dans 125 jours.
- **L'état pédagogique est une vue calculée à partir des faits persistés** : date
  d'introduction, origine, données SRS, et les événements nécessaires à leur
  interprétation. Nouveau et Découvert dépendent de la date d'introduction ; En cours,
  Acquis et Maîtrisé dépendent des données SRS et de l'origine.
- **Aucun champ « état » n'est persisté comme vérité indépendante.** Il n'existe donc pas
  de deuxième système de progression à maintenir en cohérence avec le SRS.
- Un élément Découvert n'a pas encore d'entrée SRS ; il la reçoit en passant En cours.

**Ce qui est stocké par élément** (en plus des données SRS existantes) :

| Donnée | Rôle |
|---|---|
| date d'introduction | distingue Nouveau de Découvert |
| origine | `appris`, `déclaré` ou `testé` |
| vérification faite | oui / non, pour les origines `déclaré` et `testé` |

Conformément au principe « événement ≠ état », on stocke les faits et on déduit l'état.
Changer un seuil (1.2) ne demandera aucune migration.

**Ce qui n'est pas un état** :

- **La faiblesse** (`weakness.js`) : un signal attaché à un élément, indépendant de son état.
  Un élément peut être En cours et faible. En pratique, un élément Acquis ou Maîtrisé qui
  échoue redescend en En cours.
- **L'appartenance à un dossier** : sans effet sur l'état.

Le **favori est supprimé** d'Ocha : il faisait doublon avec les dossiers. Pour garder la
rapidité d'un marquage en un toucher, un dossier par défaut (« À revoir ») existe dès le
départ, et les fiches ont un bouton qui y ajoute l'élément directement.

---

## 1.5 Connaissance initiale

Au premier lancement, ou plus tard depuis les paramètres :

- **« Je débute »** : aucun changement, tout reste Nouveau.
- **« Ce que je connais déjà : Kana · N5 · … »** : tous les éléments du niveau choisi et des
  niveaux inférieurs, kana compris, passent en **Acquis, origine `déclaré`**.
- **Test de positionnement** : les éléments des niveaux validés passent en **Acquis,
  origine `testé`**. Les kana ratés au test ne changent pas d'état et réactivent le rappel
  kana.

Règles :

- Une déclaration ou un test **ne fait jamais reculer** un élément : un élément déjà
  Maîtrisé le reste.
- Une déclaration concerne des éléments **qui existent dans les données**. Un niveau sans
  contenu (N3 à N1 aujourd'hui) n'a aucun effet sur les éléments, mais le niveau choisi est
  enregistré pour le point de départ du parcours.
- L'écriture est groupée (une seule écriture pour tout un niveau), et une trace de la
  déclaration est conservée pour pouvoir l'annuler.

### Marquage manuel

Le bouton « Maîtrisé » des fiches et du mode sélection devient **« Je le connais déjà »**.
Marquer un élément soi-même est une déclaration : il passe en Acquis, origine `déclaré`,
avec vérification. Le libellé de l'interface correspond ainsi à l'état produit.
L'annulation (« Je ne le connais pas encore ») rétablit l'état précédent.

---

## 1.6 Correspondance avec l'interface

| État | Libellé | Remarque |
|---|---|---|
| Nouveau | Nouveau | |
| Découvert | Découvert | |
| En cours | En cours | |
| Acquis | Acquis | aucune mention de l'origine |
| Maîtrisé | Maîtrisé | |

Ce sont les libellés de l'échelle à 5 crans de la maquette (couleur + chiffre). Aucun autre
terme n'est utilisé pour désigner un état. Le mot « connu » peut apparaître dans des phrases
(« Tu connais déjà une bonne partie de ce texte »), jamais comme nom d'état. Côté code, on
utilise des identifiants neutres (`new`, `discovered`, `learning`, `acquired`, `mastered`).

---

## 1.7 Données existantes

**Ocha n'a pas encore d'utilisateurs** : l'app n'est utilisée que par son auteur, pour des
tests. Il n'y a donc **aucune progression à préserver ni à convertir**. Les données de test
peuvent être réinitialisées au passage au nouveau modèle.

Ce que l'analyse du code a révélé reste utile, car ce sont des comportements à **ne pas
reproduire** dans le nouveau modèle :

- **Favori et maîtrise partageaient le même champ `status`** : mettre un mot en favori
  effaçait son marquage « maîtrisé », et inversement. Le favori est supprimé (1.4), et
  l'état n'est plus un champ saisi (1.4), donc le conflit disparaît.
- **`oral.js` marquait un kanji « maîtrisé » après une seule prononciation reconnue
  correcte**, et écrivait en plus une clé séparée `mastered_<kanji>` que rien n'utilisait.
  Dans le nouveau modèle, une prononciation réussie est une réponse évaluée comme une autre
  (partie 3), pas une maîtrise.
- **Le marquage manuel « Marquer comme maîtrisé »** (fiches, sélection, cases de catégorie)
  devient « Je le connais déjà » (1.5).

Structure cible d'une entrée de suivi :

```js
tracking[id] = {
  introducedAt: "…",   // date d'introduction
  origin: "declared",  // appris | déclaré | testé
  verified: false,     // vérification faite (déclaré / testé)
  srs: { … }           // format actuel conservé
}
```

La même logique vaut pour les autres données locales (dossiers, progression du parcours) :
leurs nouveaux formats remplacent les anciens **sans migration**. Si Ocha a des
utilisateurs avant une future évolution de format, une migration sera alors spécifiée.

## 1.8 Invariants

Règles qu'aucune partie du système ne doit violer :

1. Tout élément a **exactement un** état parmi les cinq.
2. Tout élément En cours, Acquis ou Maîtrisé possède **toujours** une entrée SRS (l'entrée
   en En cours et la déclaration en créent une).
3. Un élément Découvert ou au-delà a **toujours** une date d'introduction.
4. Une note « Oublié » ramène **toujours** un élément Acquis ou Maîtrisé à En cours.
5. Aucune autre action ne fait **reculer** un élément : ni déclaration, ni test.
6. Les dossiers, la faiblesse, l'ouverture d'une fiche et la recherche **ne modifient
   jamais** l'état.
7. Les **activités** (missions, lectures, sessions) n'ont pas d'état pédagogique ; seuls les
   éléments en ont.
8. L'état est **calculé** à partir des faits persistés ; aucun champ « état » n'est
   enregistré comme vérité indépendante.
9. Aucun état n'est attribué au-dessus de ce que les faits prouvent, hors déclaration
   explicite de l'utilisateur.
10. Les kana suivent la **même échelle** que les autres éléments, même s'ils sont hors des
    niveaux JLPT.
11. Une activité ne fait évoluer l'état d'un élément **que par un événement pédagogique
    explicite** (présentation d'un élément enseigné, réponse évaluée le ciblant, note SRS,
    déclaration). Aucun effet de bord : ouvrir une fiche ou lire un texte ne rend pas un
    élément Découvert ni En cours.

---

## Décisions de cette partie

| Point | Décision |
|---|---|
| Échelle à 5 états et libellés | validé |
| Découvert distinct d'En cours | validé |
| Origine `appris` / `déclaré` / `testé` | validé |
| État calculé, jamais stocké | validé |
| SRS distinct de l'état | validé |
| Bouton « Je le connais déjà » | validé |
| Favori | supprimé, remplacé par un dossier par défaut « À revoir » |
| Données existantes | aucune migration (pas d'utilisateurs) ; données de test réinitialisées |
| Vérification entre 21 et 45 jours, répartition déterministe | validé |
| Seuils 21 / 60 jours | valeurs initiales de la v1, à observer |

## Conséquences à reporter dans les parties suivantes

- **Partie 2** : chaque question porte un identifiant et sa cible pédagogique ; les
  références aux kanji utilisent le caractère.
- **Partie 3** : les exercices hors révision doivent pouvoir créer l'entrée SRS d'un élément
  qui passe En cours (aujourd'hui, seule `gradeReview` en crée) ; la prononciation
  reconnue devient une réponse évaluée.
