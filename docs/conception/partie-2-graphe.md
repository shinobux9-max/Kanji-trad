# Ocha — Moteur guidé v1

## Partie 2 · Le graphe pédagogique (`requires` / `teaches`)

**Statut** : 🔒 verrouillée (version 2), avec un addendum (2.10) qui n'en modifie aucune
décision. Les seuils chiffrés sont des paramètres de la v1 (voir 2.9).

**Objet** : définir comment les contenus d'Ocha sont reliés entre eux, pour que le moteur
sache ce qu'une activité exige, ce qu'elle enseigne, et ce qu'elle fait seulement
rencontrer. Cette partie ne décrit pas encore comment le moteur choisit (partie 4).

**S'appuie sur la partie 1** : éléments, activités, cinq états, cible pédagogique d'une
question.

**Sources vérifiées** : `grammar.json` (75 leçons, champs `unit`, `lesson_number`,
`examples`, `confusions`), `vocab.json` (`kanji_list`), `kanji.json` (liste de caractères par
niveau), `particles.json` (`grammar_id`), le curriculum actuel (`learning-path.js`, qui
référence déjà ses contenus sous la forme `{ type, id }`), et les nouveaux fichiers
`missions.json`, `lectures.json`, `expressions.json`.

---

## 2.1 Les trois relations

Une activité peut entretenir trois relations avec un élément :

| Relation | Sens | Écrite dans les données |
|---|---|---|
| `requires` | l'élément doit être **déjà connu** pour que l'activité soit accessible | oui |
| `teaches` | l'élément est un **objectif pédagogique** de l'activité : elle le présente ou le fait travailler explicitement | oui |
| `uses` | l'élément est **présent** dans l'activité, sans en être l'objectif ni un prérequis | non : déduit |

**`uses` n'est jamais écrit.** Il se calcule : ce sont tous les éléments référencés dans les
phrases d'une activité (`refs`), moins ceux de `requires` et de `teaches`. Le moteur s'en sert
pour la réutilisation (règle R5 : trouver une activité où un élément récemment découvert
réapparaît), jamais pour l'accessibilité ni pour faire évoluer un état.

**Ce qui distingue un vrai prérequis d'une simple présence** : sans lui, l'utilisateur ne
peut pas réaliser l'objectif de l'activité. Un mot glosé dans une lecture n'est pas un
prérequis : on peut comprendre le texte en touchant le mot. La particule qui structure toutes
les phrases de la lecture en est un.

---

## 2.2 Qui porte quelles relations

| Objet | Nature | `requires` | `teaches` | Remarque |
|---|---|---|---|---|
| Leçon de grammaire | élément + sa présentation | oui : grammaire uniquement | implicite : elle-même | voir ci-dessous |
| Mot de vocabulaire (JLPT ou hors JLPT) | élément | non | implicite : lui-même | |
| Kanji | élément | non | implicite : lui-même | |
| Kana | élément | non | implicite : lui-même | |
| Expression | élément | optionnel : grammaire | implicite : elle-même | |
| Mission | activité | oui | oui | |
| Lecture | activité | oui | optionnel | |
| Question d'exercice | partie d'une activité | non | non | porte une **cible** (`target`) |

**La leçon de grammaire est un cas particulier.** L'identifiant `n5_g_8` désigne à la fois
l'élément (la particule は) et la leçon qui le présente. La leçon enseigne implicitement son
propre élément : on n'écrit pas `teaches` sur une leçon. Son `requires` exprime les
**dépendances entre points de grammaire** (2.6).

**Vocabulaire, kanji et kana n'ont pas de prérequis en v1.** Un mot peut être appris avant
ses kanji (les furigana sont là pour ça). Le lien entre un mot et ses kanji existe déjà
(`kanji_list`) ; c'est une **relation dérivée** (2.5), pas un prérequis.

**Les questions n'ont ni `requires` ni `teaches`.** Elles ont une **cible** : l'élément ou les
éléments qu'elles vérifient (partie 1). Une question appartient à une activité et hérite de
son accessibilité.

**Les concepts du curriculum actuel** (micro-écrans d'explication chargés par
`getLevelConceptsData`) sont des contenus de présentation rattachés aux leçons. Ce ne sont
pas des éléments : ils n'ont pas d'état et ne figurent dans aucune relation.

---

## 2.3 Format des références

### Dans `requires` et `teaches` : groupées par type

```json
"requires": {
  "grammar": ["n5_g_1", "n5_g_17"],
  "vocab": ["n5_v_84"]
},
"teaches": {
  "vocab": ["hj_v_1", "hj_v_2"],
  "expression": ["ex_3"]
}
```

Clés autorisées : `grammar`, `vocab`, `kanji`, `kana`, `expression`. Les mots hors JLPT
(`hj_v_…`) vont dans `vocab`. Les kanji s'écrivent avec leur caractère (`"水"`), les kana
avec leur identifiant (`"kana_あ"`). Une clé absente équivaut à une liste vide.

**Pourquoi groupées par type** : c'est plus court à écrire pour l'auteur, et le type est
explicite. On ne dépend plus de la forme de l'identifiant pour le deviner, ce qui ne
fonctionnait pas pour les kanji (un caractère) ni pour les nouveaux préfixes `ex_` et `hj_v_`.

### Dans le moteur : une forme normalisée unique

Au chargement, chaque référence est convertie en `{ type, id }`, la forme que le curriculum
actuel utilise déjà. Le moteur ne manipule que cette forme.

### Questions : identifiant et cible

```json
{
  "id": "n5_m_1_q2",
  "type": "choice",
  "skill": "naturel",
  "target": { "expression": ["ex_2"] },
  "...": "…"
}
```

- **Questions rédigées** (missions, lectures) : identifiant écrit dans les données, préfixé par
  l'identifiant de l'activité (`n5_m_1_q2`, `n5_l_5_q1`).
- **Questions générées** (QCM de sens, textes à trous des leçons, quiz rapides) : pas
  d'identifiant écrit. Le générateur en construit un stable à partir de ce qui la définit :
  `gen:<générateur>:<cible>:<variante>`, par exemple `gen:cloze:n5_g_8:ex2` pour le texte à
  trous tiré du 2e exemple de la leçon は. La même question reçoit toujours le même
  identifiant, ce qui permet au journal (partie 3) de suivre les échecs répétés.

**Nom canonique : `vocab`.** Le curriculum actuel, qui utilise `vocabulary`, sera adapté lors
de l'intégration. En interne, le moteur ne manipule que la forme `{ type, id }`.

---

## 2.4 `requires`

**Définition** : les éléments que l'utilisateur doit déjà connaître pour que l'activité lui
soit proposée par le moteur guidé.

### Quand un prérequis est-il satisfait ?

Un élément satisfait un prérequis s'il est **au moins En cours** (partie 1). Découvert ne
suffit pas : l'élément a été montré mais jamais pratiqué.

**L'état SRS n'intervient pas.** Un élément Acquis à revoir aujourd'hui reste connu pour
l'accessibilité. « Puis-je accéder à ce contenu ? » dépend de l'état pédagogique ; « Dois-je
le revoir maintenant ? » dépend du SRS (partie 4).

### Quand une activité est-elle accessible ?

| Type de prérequis | Règle |
|---|---|
| Grammaire | **tous** satisfaits |
| Vocabulaire, kanji, expressions | **au moins 75 %** satisfaits |

La grammaire structure les phrases : il en manque une, l'activité est incompréhensible. Un
mot inconnu, lui, se consulte d'un toucher. Le taux calculé alimente aussi le message
« Tu connais déjà une bonne partie de ce texte ».

Acquis et Maîtrisé satisfont évidemment aussi un prérequis. Le seuil de 75 % est un
paramètre de la v1 (2.9).

### Ce que `requires` n'est pas

- **Un blocage pour l'utilisateur.** `requires` ne concerne que les propositions du moteur
  guidé. En navigation libre, tout reste accessible (principe « rien n'est bloquant »).
  Une activité non accessible peut au plus afficher un avertissement discret.
- **Un lien entre activités.** `requires` ne pointe **que vers des éléments**, jamais vers une
  mission ou une lecture. Deux activités sont liées par les éléments qu'elles partagent, ou
  par leur lieu (`place`).
- **Un moyen d'exiger les kana.** Les kana ne figurent jamais dans un `requires` : ils sont
  recommandés, jamais obligatoires.

On n'ajoute pas de relation `recommended` en v1. Si le besoin apparaît à l'usage, il sera
spécifié à ce moment-là.

---

## 2.5 `teaches`

**Définition** : les éléments qui sont un objectif pédagogique explicite de l'activité. Elle
les présente, les explique ou les fait travailler de façon ciblée.

**Effet sur l'état** : quand l'activité présente un élément de son `teaches` (étape « Mots »
d'une mission, glose d'un mot nouveau dans une lecture), l'événement `CONTENT_INTRODUCED`
est émis : Nouveau passe à Découvert. **Rien de plus.** La suite dépend des réponses
évaluées (partie 1). `teaches` ne signifie jamais « maîtrisé ».

**Règles d'écriture** :

- Un élément ne peut pas figurer à la fois dans `requires` et `teaches` de la même activité.
- `teaches` reste court : **8 éléments au plus** par mission ou lecture. Au-delà, l'activité
  enseigne trop pour être assimilée ; tout le reste relève de `uses`.
- Les questions d'une activité ne ciblent que des éléments de son `teaches` ou de son
  `requires`. Une question ne vérifie jamais un élément que l'activité n'a ni enseigné ni
  supposé connu.

La limite de 8 éléments est un paramètre de la v1 (2.9). Un dépassement produit un
avertissement, pas une erreur.

### Relations dérivées

Certaines relations ne sont pas écrites mais calculées à partir des données existantes :

| Relation | Source | Usage par le moteur |
|---|---|---|
| mot → ses kanji | `kanji_list` de `vocab.json` | proposer à l'écriture des kanji présents dans des mots déjà connus |
| particule → sa leçon | `grammar_id` de `particles.json` | rattacher les exercices de particules à leur point de grammaire |
| activité → `uses` | `refs` des phrases | réutilisation (R5) |
| mission ↔ lecture | même `place` | proposer la suite logique |

---

## 2.6 Dépendances de grammaire

### Aujourd'hui

L'ordre des 75 leçons tient uniquement à `unit` et `lesson_number`. Le moteur ne peut pas
savoir si la leçon 20 suppose vraiment la leçon 19, ou si elle pourrait être abordée plus tôt.

### Demain

Chaque leçon déclare les points de grammaire qu'elle suppose connus :

```json
{ "id": "n5_g_7", "item": "〜ませんでした", "requires": { "grammar": ["n5_g_5", "n5_g_6"] } }
{ "id": "n5_g_9", "item": "が",           "requires": { "grammar": ["n5_g_8"] } }
```

Les dépendances forment un **graphe**, pas une chaîne : une leçon peut dépendre de plusieurs
autres, et plusieurs leçons peuvent dépendre de la même. Deux leçons sans dépendance
commune peuvent être proposées dans n'importe quel ordre.

### L'ordre de référence

L'ordre actuel (`unit`, puis `lesson_number`) devient l'**ordre de référence**. Il sert :

- à départager deux leçons également accessibles ;
- de **solution de secours** quand le graphe est incomplet ou ne rend aucune leçon
  accessible (2.7).

Une leçon **sans** champ `requires` n'a aucun prérequis, mais reste placée par l'ordre de
référence. Le graphe peut donc être rempli progressivement, sans que le moteur casse.

**Travail de contenu** : les dépendances des 75 leçons N5 seront à écrire. C'est un choix
pédagogique de l'auteur, pas une déduction automatique.

---

## 2.7 Validation du graphe

Un script de validation, lancé avant chaque intégration de contenu, vérifie les données et
produit un rapport. Les **erreurs** empêchent de livrer le contenu ; les **avertissements**
sont signalés sans bloquer.

| Contrôle | Gravité |
|---|---|
| Référence vers un identifiant inexistant | erreur |
| Cycle dans les dépendances de grammaire (A suppose B qui suppose A) | erreur |
| Élément présent à la fois dans `requires` et `teaches` d'une activité | erreur |
| Question dont la cible n'est ni dans `teaches` ni dans `requires` de son activité | erreur |
| Question rédigée sans identifiant, ou identifiant en double | erreur |
| Kana dans un `requires` | erreur |
| Leçon qui se déclare elle-même comme prérequis | erreur |
| `teaches` de plus de 8 éléments | avertissement |
| Activité d'un niveau dont `requires` contient de la grammaire d'un niveau supérieur | avertissement |
| Activité sans `requires` ni `teaches` | avertissement |
| Leçon de grammaire sans `requires` (graphe incomplet) | avertissement |
| Élément enseigné par aucune activité ni leçon | avertissement |

**Pas de prérequis inatteignable** : comme chaque élément peut être présenté par sa propre
fiche ou sa propre leçon, tout prérequis est atteignable dès lors qu'il existe et qu'il n'y a
pas de cycle. Les deux premières erreurs couvrent donc ce risque.

### Règle de secours du moteur

Si aucune activité n'est accessible, le moteur ne produit jamais une session vide : il
propose le **prochain élément non connu dans l'ordre de référence** (en pratique, la leçon
de grammaire suivante), avec de quoi la pratiquer. Un débutant complet obtient donc
toujours une session.

---

## 2.8 Exemples sur le contenu actuel d'Ocha

### Grammaire : la négation passée

```json
{ "id": "n5_g_7", "item": "〜ませんでした",
  "requires": { "grammar": ["n5_g_5", "n5_g_6"] } }
```

〜ませんでした combine la négation (〜ません, `n5_g_5`) et le passé (〜ました, `n5_g_6`). La
leçon n'est proposée qu'une fois ces deux points au moins En cours. Ses exercices générés
ciblent `n5_g_7` (`gen:cloze:n5_g_7:ex1`…). Les mots de ses exemples sont en `uses`.

### Mission : « Un bento, sans sac » (`n5_m_1`)

```json
{
  "id": "n5_m_1",
  "requires": { "grammar": ["n5_g_1", "n5_g_17"] },
  "teaches": {
    "vocab": ["n5_v_84", "hj_v_1", "hj_v_2"],
    "expression": ["ex_3", "ex_1"]
  }
}
```

- Prérequis : です (`n5_g_1`) et か (`n5_g_17`), sans lesquels ni les questions du caissier ni
  les réponses ne se comprennent.
- Enseigné : お弁当, レジ袋, ポイントカード, いらっしゃいませ, ありがとうございます.
- Rencontré seulement (`uses`, déduit) : はい (`n5_v_344`), et la particule は dans
  « レジ袋はご利用ですか ».
- La question « Naturel ou scolaire ? » cible le refus poli 大丈夫です, à rattacher à une
  expression (`ex_2`, Pardon/Excusez-moi, ou une future expression « Non merci, ça ira »).

Ce changement remplace les champs actuels `vocab`, `expressions` et `grammar` des missions,
qui ne distinguaient pas ce qui est exigé de ce qui est enseigné.

### Lecture : « Midi au konbini » (`n5_l_5`)

```json
{
  "id": "n5_l_5",
  "requires": {
    "grammar": ["n5_g_11", "n5_g_12", "n5_g_18"],
    "vocab": ["n5_v_105", "n5_v_187", "n5_v_401", "n5_v_85", "n5_v_97", "n5_v_185"]
  },
  "teaches": { "vocab": ["n5_v_45"] }
}
```

- Grammaire exigée : に, で, ね. Si l'une n'est pas au moins En cours, la lecture n'est pas
  proposée par le moteur.
- Vocabulaire exigé : 6 mots. Si l'utilisateur en connaît 5 (83 %), la lecture est
  accessible, et l'écran affiche « Tu connais déjà une bonne partie de ce texte ».
- Enseigné : お腹 (`n5_v_45`), présenté comme mot nouveau de la lecture.
- La mission `n5_m_1` et cette lecture partagent le lieu `konbini` : le moteur peut proposer
  l'une après l'autre.

---

## 2.9 Paramètres de la v1

Les seuils chiffrés ne sont pas des vérités pédagogiques : ils seront ajustés après quelques
semaines d'usage. Ils sont donc regroupés dans **une configuration unique**, jamais écrits en
dur dans le code du moteur :

```js
const GUIDED_CONFIG = {
  prerequisiteThresholds: {
    grammar: 1.0,
    vocab: 0.75,
    kanji: 0.75,
    expression: 0.75
  },
  maxTaughtElements: 8
};
```

Les seuils d'état de la partie 1 (21 et 60 jours) rejoignent la même configuration.

## 2.10 Addendum · Formes grammaticales et vocabulaire

Ajouté après verrouillage : ne modifie aucune décision précédente, ajoute une relation dérivée.

### Une leçon peut enseigner une forme

Certaines leçons de grammaire enseignent une **forme** qu'on peut appliquer à des mots du
vocabulaire (〜ました : 食べる → 食べました). Elles le déclarent :

```json
{ "id": "n5_g_6", "item": "〜ました", "forms": ["verb_polite_past"] }
```

- `forms` : identifiants de formes, définies en partie 5 (`verb_polite_past`,
  `iadj_negative`, `noun_copula_past`…).
- Chaque forme indique les **catégories de mots** auxquelles elle s'applique (verbes,
  adjectifs en い, adjectifs en な, noms).
- Une leçon qui enseigne une **construction** (une forme + des éléments fixes, comme
  〜てください) déclare plutôt `pattern`. La distinction entre forme et construction est
  définie en partie 5.
- Une leçon sans `forms` ni `pattern` n'est simplement pas utilisable par le générateur.

### Le vocabulaire fournit la catégorie

Le champ `group` du vocabulaire, qui existe déjà, dit à quelles formes un mot se prête :

| `group` | Catégorie |
|---|---|
| `ru` | verbe ichidan |
| `u` | verbe godan |
| `irrégulier` | する, 来る |
| `suru` | nom + する |
| `i` | adjectif en い |
| `na` | adjectif en な |
| `nom`, `nom_commun` | nom (avec です) |

**Nettoyage nécessaire** avant usage : valeurs à harmoniser (`な - na` → `na`, `nom_commun` →
`nom`), mots mal classés (結婚 et 練習 sont des noms, le verbe est 結婚する), une entrée sans
`type`. Le script de validation (2.7) signalera toute valeur de `group` inconnue.

### Relation dérivée

| Relation | Source | Usage |
|---|---|---|
| forme → mots compatibles | `forms` de la leçon × `group` du vocabulaire | générer des exercices sur une forme avec des mots que l'utilisateur connaît |

Les formes conjuguées ne sont **jamais stockées** dans le vocabulaire : elles sont générées
(partie 5). Seules les exceptions ont des données.

### Cible et support

Dans un exercice généré « 食べる → 食べました », la **cible** est la forme grammaticale
(`n5_g_6`). Le mot 食べる est un **support** : choisi volontairement parce que l'utilisateur le
connaît, mais pas vérifié. Le support est une notion **interne au générateur** : il n'a pas de
champ dans les données, et n'a aucun effet sur l'état du mot (partie 1, invariant 11).

## Décisions de cette partie

| Point | Décision |
|---|---|
| Trois relations `requires`, `teaches`, `uses` (déduit) | validé |
| Nom canonique `vocab`, forme interne `{ type, id }` | validé |
| Prérequis satisfait à partir de En cours ; SRS sans effet | validé |
| Accessibilité : grammaire 100 %, vocabulaire, kanji et expressions 75 % | validé, paramètre v1 |
| Kana jamais dans `requires` | validé |
| `requires` ne pointe que vers des éléments, et ne bloque jamais l'utilisateur | validé |
| `teaches` limité à 8 éléments (avertissement) | validé, paramètre v1 |
| Identifiants de questions rédigées et générées | validé |
| Validation du graphe et règle de secours | validé |
| Addendum : `forms` des leçons, `group` du vocabulaire, notion de support | ajouté après verrouillage |

## Conséquences pour la suite

- **Données** : ajouter `requires` aux 75 leçons de grammaire (travail de l'auteur) ; ajouter
  `requires`, `teaches` et des identifiants de questions dans `missions.json` et
  `lectures.json` ; mettre à jour `GUIDE-CONTENU.md` et le README en conséquence.
- **Outil** : écrire le script de validation (2.7).
- **Partie 3** : les événements référencent les éléments sous la forme `{ type, id }`, et les
  questions par leur identifiant, rédigé ou généré.
- **Partie 4** : règles de priorité et de composition à partir de l'accessibilité définie ici.
