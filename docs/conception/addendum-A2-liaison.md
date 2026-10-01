# Ocha — Document de conception v1

## Addendum A2 · Liaison entre l'architecture sémantique A2 et la conception

**Statut** : 🔒 validé le 2026-10-01 (version 2).

**Objet** : articuler deux ensembles de références verrouillés, qui ont été conçus
séparément :

| Référence | Domaine |
|---|---|
| **Conception Ocha v1** (`docs/conception/`, parties 1 à 9, addendum A1) | ce qu'Ocha fait : progression, événements, moteur guidé, exercices, architecture |
| **Architecture sémantique A2** (`A2-GLOBAL-v1` et ses snapshots `A2-L3-v1`, `A2-ST-v1`, `A2-DIM-v1`, `A2-REL-v1.1`, `A2-LING-v1`) | comment le vocabulaire est représenté sémantiquement : `ENTRY → SENSE[]`, catégorie, type, dimensions, relations, fonctions linguistiques |

Ce document **formalise deux décisions** arrêtées le 2026-10-01 (unité d'apprentissage,
statut des tags) et **fixe les contraintes** que devront respecter les projets A2-01 (schéma),
A2-02 (registres), A2-03 (validateur) et A2-04 (migration N5). Il ne décide pas les détails
qui relèvent de ces projets : ils sont listés en section 8.

**Ne modifie aucun snapshot A2.** Les quelques précisions apportées aux parties verrouillées
de la conception sont listées en section 9.

---

## 1. Principe de coexistence

- **La conception décide du comportement** : ce qui est suivi, comment l'état évolue, ce que
  le moteur propose, comment un exercice est construit.
- **A2 décide de la représentation sémantique** du vocabulaire : domaines, nature des concepts,
  caractéristiques, relations, fonctions linguistiques.
- **Aucune des deux ne modifie l'autre implicitement.** Si un besoin de l'une contredit
  l'autre, il passe par un addendum (conception) ou une nouvelle version de snapshot (A2),
  selon la procédure propre à chaque référence.
- A2 pose que « les regroupements pédagogiques ou d'interface ne modifient pas l'ontologie »
  (`A2-GLOBAL-v1`, 4.3, règle 9). Réciproquement, la classification A2 ne modifie pas le
  modèle de progression d'Ocha.

### Périmètre de ce document

A2 définit l'`ENTRY` comme « l'entrée lexicale » (`A2-GLOBAL-v1`, 3), et a été audité sur le
corpus de vocabulaire JLPT N5 à N2 (environ 5 000 entrées). Ce document s'applique donc aux
**entrées du vocabulaire** : JLPT (`n5_v_…`) et hors JLPT (`hj_v_…`).

Les **kanji**, les **kana** et les **leçons de grammaire** sont d'autres types d'éléments de la
conception (partie 1, 1.1). Ils ne sont **pas concernés** par ce document, qui ne décide pas
s'ils seront un jour décrits par A2. Le cas des **expressions** est renvoyé à A2-01 (section 8).

---

## 2. Décision D1 · L'ENTRY est l'unité d'apprentissage

### Énoncé (arrêté le 2026-10-01)

> L'`ENTRY` est l'unique unité de progression pédagogique du vocabulaire dans Ocha v1.
>
> Les `SENSE` sont des unités de représentation sémantique. Ils peuvent être ciblés par
> l'affichage, les exemples, les sélections et les exercices, mais ne possèdent aucun état
> pédagogique autonome.
>
> Le SRS, les révisions, les faiblesses, l'historique et les autres états pédagogiques
> restent attachés à l'`ENTRY`.
>
> Une réponse ciblant un `SENSE` fait progresser l'`ENTRY` entière. Cette approximation est
> explicitement acceptée en v1.
>
> Les `SENSE` disposent d'identifiants stables. Lorsqu'un événement cible explicitement un
> sens, son identifiant peut être conservé comme information factuelle facultative, sans
> effet sur l'état, le SRS ou les faiblesses en v1.

### Correspondance avec la conception

| Notion de la conception | Équivalent A2 |
|---|---|
| Élément de type `vocab` (partie 1, 1.1) | **une ENTRY** |
| Identifiant d'élément `n5_v_117`, `hj_v_1` | **l'identifiant de l'ENTRY**, inchangé |
| État (Nouveau → Maîtrisé), entrée SRS, faiblesse (parties 1 et 3) | portés par l'ENTRY, **jamais** par un SENSE |
| Référence `{ type: "vocab", id }` dans `requires`, `teaches`, `refs`, `target` (partie 2) | désigne toujours une ENTRY |

**Conséquence directe : les parties 1, 2, 4 et 5 ne changent pas.** Le moteur, le graphe et les
états continuent de manipuler des éléments `vocab` identifiés par leur ENTRY.

### Ce que l'approximation implique

Réussir une question sur 高い « haut » fait progresser 高い, y compris pour « cher ». Deux
mécanismes existants limitent cette approximation, sans règle nouvelle :

- les générateurs peuvent **varier le sens présenté** d'une question à l'autre (partie 5) ;
- une erreur sur un sens crée une **faiblesse sur l'ENTRY** (partie 3), qui sera renforcée.

### Contraintes pour le schéma A2-01

- Chaque SENSE a un **identifiant stable**, unique, rattaché à une seule ENTRY, jamais réutilisé
  pour un autre sens, même après suppression.
- L'identifiant d'une ENTRY existante (`n5_v_…`, `hj_v_…`) **ne change pas** avec la migration :
  il reste la clé de progression.

Le nombre minimal de SENSE par ENTRY n'est fixé ni par A2 ni par les décisions D1 et D2 : il
relève d'A2-01 (section 8).

### Précision apportée à la partie 3

`QUESTION_ANSWERED` peut porter un champ facultatif identifiant le sens visé (nom exact fixé
par A2-01). Ce champ :

- est **factuel** : il est journalisé, conformément au principe « événement ≠ état » (3.1) ;
- n'a **aucun effet** sur l'état, le SRS ou les faiblesses (3.4 inchangée) ;
- ne remplace pas la cible : `target` désigne toujours l'ENTRY.

`REVIEW_GRADED` porte sur l'ENTRY, comme aujourd'hui.

---

## 3. Décision D2 · Statut des tags

### Énoncé (arrêté le 2026-10-01)

> Les `tags` deviennent une composante officielle des données Ocha v1, mais ne constituent pas
> une nouvelle couche sémantique A2. Ils représentent des appartenances transversales utiles
> à Ocha et servent comme données de sélection et filtres.

### Ce qu'un tag ne peut pas faire

Un tag ne duplique jamais une information déjà portée par un champ dédié :

| Déjà représenté par | Exemple de tag interdit |
|---|---|
| `category`, `semantic_type`, `dimensions`, `relations`, `linguistic` (A2) | « nourriture », « verbe », « politesse » |
| `level` | « N5 » |
| `place` (activités) et `places` (expressions) | voir ci-dessous pour les expressions |
| le registre des phrases et expressions (`registres.json`) | « poli », « familier » |
| les dossiers de l'utilisateur | « à revoir », « favoris » |
| tout autre champ dédié existant | — |

Un tag ne sert jamais à contourner `category: null`, ni à ranger les cas difficiles à classer.

### Forme

- **Plats** en v1 : pas de hiérarchie, pour ne pas recréer une seconde `category`.
- **Contrôlés** : chaque tag provient d'un **registre** officiel (projet A2-02), qui contient au
  minimum pour chaque tag : un identifiant stable, un libellé, une description, et le registre
  contient les critères de création d'un nouveau tag, fondés sur le principe
  anti-prolifération d'A2 (`A2-GLOBAL-v1`, 12).
- Jamais de texte libre.

### Porteurs autorisés en v1

| Porteur | Tags |
|---|---|
| ENTRY | oui : le tag vaut pour **tous** ses SENSE |
| SENSE | oui : le tag ne vaut que pour ce sens |
| Expression (`ex_…`) | oui |
| Grammaire, activités (missions, lectures), kanji, kana | **non** |

**Règle de non-répétition** : un tag porté par une ENTRY ne doit pas être répété sur l'un de ses
SENSE.

### Sélection par tag

- Sélectionner par un tag porté par une ENTRY sélectionne cette ENTRY.
- Sélectionner par un tag porté par un SENSE **sélectionne pédagogiquement l'ENTRY** (D1), mais
  le contenu affiché ou l'exercice généré **cible ce SENSE**. L'identifiant du sens peut alors
  être journalisé comme information facultative (section 2).

### Usage en v1

- **Données et filtres uniquement** : bibliothèque, Explorer.
- **Le moteur guidé ne lit pas les tags** (partie 4 inchangée).
- Tout usage pédagogique supplémentaire, notamment les **sessions ciblées**, sera introduit par
  un addendum explicite.

### Cas d'usage immédiat : Explorer

Aujourd'hui, `lieux.json` relie chaque lieu au vocabulaire par d'anciennes catégories
(`vocab_categories`), appelées à disparaître. La classification A2 ne peut pas les remplacer :
par la règle « concept ≠ contexte d'usage » (`A2-GLOBAL-v1`, 4.3), les mots utiles au konbini
relèvent de domaines différents. Ce lien devient donc une appartenance par **tag** (par
exemple « utile au konbini »).

**Frontière avec `places`** : pour les **expressions**, le lien à un lieu est déjà porté par le
champ `places`. Une expression ne reçoit donc pas de tag de lieu : elle utilise `places`. Les
tags de lieu ne concernent que les ENTRY et SENSE, qui n'ont pas de champ `places`.

La manière dont un lieu désigne ses tags est fixée par A2-01, avec une contrainte : **le lien
est déclaré explicitement**, jamais déduit d'une convention de nom.

---

## 4. Frontières entre A2 et les données existantes d'Ocha

### Registres de langue

| | Porté par | Niveau |
|---|---|---|
| **Registre Ocha** (`registres.json` : familier, poli, respectueux, humble, écrit) | phrases, répliques, variantes d'expressions | énoncé |
| **Fonction `politesse`** (A2-LING-v1) | fonction linguistique d'un SENSE | mot |

Les deux coexistent sans correspondance en v1 : l'un qualifie ce qui est **dit**, l'autre la
fonction d'un **mot**. A2-LING-v1 précise d'ailleurs qu'il ne crée pas encore de taxonomie des
registres : celle d'Ocha ne la contredit pas, elle opère à un autre niveau.

### Anciennes catégories thématiques

Les champs `category` et `subcategory` actuels du vocabulaire sont **remplacés** par la
catégorie A2 (au niveau du SENSE) lors de la migration A2-04, et, quand il s'agit d'un
regroupement de contexte, par des tags. Ils ne sont plus corrigés d'ici là (décision de la
tâche 6 de l'étape 0).

### Propriétés grammaticales

`type` et `group` du vocabulaire décrivent la forme lexicale : ils relèvent des
**propriétés linguistiques de l'ENTRY** (A2-LING-v1). Le champ `group` reste indispensable au
générateur de formes (partie 5, addendum 2.10) : sa correspondance exacte avec les propriétés
A2 est fixée par A2-01, **sans perte** des valeurs utilisées par la conjugaison.

---

## 5. Contraintes pour la migration N5 (A2-04)

| Donnée actuelle | Contrainte |
|---|---|
| `id` | devient l'identifiant de l'ENTRY, **inchangé** |
| `word`, `word_furigana`, `reading`, `romaji`, `kanji_list` | restent attachés à l'ENTRY |
| `type`, `group` | propriétés linguistiques de l'ENTRY ; `group` conservé pour la morphologie |
| `meanings.primary`, `meanings.secondary` | base des SENSE ; **le découpage en sens se décide entrée par entrée**, pas mécaniquement : des traductions voisines d'un même sens ne sont pas plusieurs SENSE |
| `category`, `subcategory` | remplacés par la catégorie A2 du SENSE, ou par des tags quand il s'agit d'un contexte |
| `example`, `nuance`, `particles` | rattachement à l'ENTRY ou au SENSE décidé par A2-01 |

Les cas ambigus sont **documentés**, pas tranchés silencieusement (`A2-GLOBAL-v1`, 11).

---

## 6. Contraintes pour le validateur A2 (A2-03)

Le validateur A2 **étend** `tools/validate-data.mjs`, sans en affaiblir les contrôles actuels.
En plus des contrôles A2 eux-mêmes (projet A2-03), il vérifie au minimum :

- l'identifiant d'ENTRY inchangé et unique (contrôles actuels) ;
- l'unicité et la stabilité des identifiants de SENSE ;
- le nombre minimal de SENSE par ENTRY, tel que fixé par A2-01 ;
- chaque tag présent dans le registre des tags ;
- aucun tag sur un porteur non autorisé (grammaire, activité, kanji, kana) ;
- aucun tag répété à la fois sur une ENTRY et l'un de ses SENSE ;
- aucun tag de lieu sur une expression (elle utilise `places`) ;
- les liens des lieux vers les tags déclarés explicitement et existants.

La non-duplication des tags avec les autres champs (section 3) n'est vérifiable
automatiquement qu'en partie : elle relève aussi des critères de création du registre.

Les avertissements actuels sur les anciennes catégories (`categorie-isolee`,
`categorie-doublon`) disparaissent avec la migration, puisque ces catégories sont remplacées.

---

## 7. Place des projets A2 dans la reconstruction

Rappel de l'arbitrage du 2026-09-30, qui n'est pas modifié ici :

- la numérotation des étapes de la partie 9 (9.9) est conservée ;
- les projets **A2-01 à A2-05** (schéma, registres, validateur, migration N5, audit) prennent
  place dans l'**étape 2 · Contenu et graphe**.

Conséquence de D1 : l'**étape 1 · Stockage et apprentissage** ne dépend pas d'A2, puisqu'elle ne
manipule que des ENTRY. Elle peut avancer en parallèle de A2-01 et A2-02.

Ce document ne tranche pas la place des projets **A2-06 à A2-09** de la feuille de route A2
(moteur de sélection, sessions, interface, tests) : c'est une décision de feuille de route,
qui fera l'objet d'un arbitrage séparé (section 8).

---

## 8. Ce que ce document ne décide pas

Relève des projets suivants :

| Question | Projet |
|---|---|
| Format exact des identifiants de SENSE | A2-01 |
| Nom du champ facultatif de sens dans les événements et, s'il y a lieu, dans `refs` et `target` | A2-01 |
| Structure JSON d'une ENTRY et de ses SENSE, et emplacement des fichiers | A2-01 |
| Rattachement de `example`, `nuance`, `particles` à l'ENTRY ou au SENSE | A2-01 |
| Correspondance précise entre `type` / `group` et les propriétés linguistiques A2 | A2-01 |
| Forme du lien entre un lieu et ses tags | A2-01 |
| **Classification A2 des expressions** (`ex_…`) : décrites par A2 ou non | A2-01, à arbitrer |
| Nombre minimal de SENSE par ENTRY | A2-01 |
| Format des registres A2 et du registre des tags, premiers tags | A2-02 |
| Qui peut créer un tag, et selon quelle procédure | A2-02 |
| Règles et messages du validateur A2 | A2-03 |
| Découpage des sens de chaque entrée N5 | A2-04 |
| Reconstruction de `exemples.json` (point ouvert de l'étape 0) | A2-04 ou projet dédié |
| Place des projets A2-06 à A2-09 par rapport aux étapes 3 à 7 de la partie 9 | arbitrage séparé de feuille de route |

---

## 9. Précisions apportées aux parties verrouillées

Aucune règle n'est modifiée. Une fois ce document validé, chaque partie concernée reçoit une
mention dans son statut, comme pour l'addendum A1 :

| Partie | Précision |
|---|---|
| 1 (1.1) | un élément de type `vocab` est une ENTRY A2 ; ses SENSE ne sont pas des éléments |
| 2 (2.3) | une référence `vocab` désigne toujours une ENTRY |
| 3 (3.3) | `QUESTION_ANSWERED` peut porter un identifiant de sens facultatif, sans effet |
| `lieux.json`, `GUIDE-CONTENU.md`, README des données | `vocab_categories` remplacé par des tags, au moment de la migration |

`ETAT-ACTUEL.md` présente déjà « l'unité d'apprentissage reste le mot » comme une décision
prise. Ce document en donne le contrat précis ; la mention y renverra.

---

## Décisions de ce document

| Point | Décision |
|---|---|
| D1 · L'ENTRY est l'unique unité de progression du vocabulaire en v1 | arrêtée le 2026-10-01 |
| D1 · SENSE : représentation, identifiants stables, information facultative dans les événements | arrêtée le 2026-10-01 |
| D2 · Tags : composante officielle, non sémantique, plats, contrôlés, sur ENTRY, SENSE et expressions | arrêtée le 2026-10-01 |
| D2 · Tags de lieu : sur ENTRY et SENSE uniquement ; les expressions utilisent `places` | conséquence de D2 |
