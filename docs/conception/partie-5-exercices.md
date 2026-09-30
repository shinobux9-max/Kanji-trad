# Ocha — Moteur guidé v1

## Partie 5 · Génération et adaptation pédagogique des exercices

**Statut** : 🔒 verrouillée (version 3 : arbitrage O7 de la partie 8 intégré ; addendum A1 :
champ `construction`, voir `addendum-A1-construction.md`). Les valeurs chiffrées sont des
paramètres expérimentaux de la v1 (5.6).

**Objet** : transformer une intention pédagogique en exercice adapté à l'utilisateur.

| Partie | Question |
|---|---|
| 3 | Que signifie ce que l'utilisateur vient de faire ? |
| 4 | Que faut-il travailler maintenant ? (« pratiquer 〜ました avec du vocabulaire récent ») |
| **5** | **Comment le faire travailler ?** (sous quelle écriture, avec quels mots, sous quelle forme) |

**Principe** : les exercices servent à vérifier ce que l'utilisateur connaît par rapport à ce
qu'il est censé avoir acquis. Ocha **combine** son contenu (une leçon × les verbes connus)
plutôt que d'écrire des centaines d'exercices à la main.

**S'appuie sur** : partie 1 (états, cible), partie 2 et son addendum (`forms`, `group`,
support), partie 3 (identifiants de questions générées, `QUESTION_ANSWERED`), partie 4 (blocs).

Exemple complet du chemin :

```
PARTIE 4   pratiquer n5_g_6 (〜ました) avec du vocabulaire récent
             ↓
PARTIE 5   support choisi : 食べる (connu)
           représentation : kana lisibles, kanji 食 pas encore Acquis → たべる
           forme générée  : たべる → たべました
           exercice       : きのう、パンを ______。  →  たべました
             ↓
PARTIE 3   QUESTION_ANSWERED · questionId gen:form:n5_g_6:n5_v_117 · target n5_g_6
```

---

## 5.1 Représentation adaptative

### Deux couches d'affichage

| Où | Qui décide |
|---|---|
| **Affichage normal** : fiches, bibliothèque, lectures libres, missions hors exercices | les **réglages** de l'utilisateur (furigana, romaji, traduction) |
| **Affichage d'un exercice** | l'**objectif pédagogique**, puis ce que l'utilisateur **sait lire**, puis ses réglages quand ils sont compatibles |

Les réglages ne peuvent pas gouverner les exercices : avec « toujours afficher les
furigana », Ocha ne pourrait jamais vérifier qu'un kanji est su.

### Ordre de décision dans un exercice

1. **L'objectif** : ne jamais afficher ce qui donne la réponse. Si l'exercice vérifie la
   lecture d'un mot, pas de furigana ni de romaji sur ce mot.
2. **La capacité de lecture** : ne jamais afficher une écriture que l'utilisateur ne sait
   pas lire, sauf si c'est justement ce qui est vérifié.
3. **Les réglages** : pour tout le reste. Un utilisateur qui a coupé le romaji ne le voit pas
   là où il n'est pas nécessaire.

### Ce que l'utilisateur sait lire

Évalué **mot par mot**, à partir des états individuels des kana, des kanji et du mot (partie 1),
jamais de l'état du mot seul : un mot passe En cours dès sa première réponse, même fausse.

**Un kana est lisible** s'il est **au moins En cours et sans faiblesse active**. On n'attend pas
qu'il soit Acquis : ce serait maintenir le romaji bien après que l'utilisateur sait lire ses
kana. La condition « sans faiblesse active » écarte le kana qu'on vient de rater. C'est **la
même définition** partout, y compris pour le « monde lisible » des exercices de kana (5.3).

| Situation | Représentation de 食べる |
|---|---|
| un des kana du mot n'est pas lisible | **romaji** : taberu |
| kana lisibles, un des kanji pas encore Acquis | **kana** : たべる |
| kanji Acquis, mais le mot pas encore Acquis | **kanji avec furigana** : 食(た)べる |
| kanji Acquis **et** mot Acquis | **kanji** : 食べる |

**Pourquoi le mot doit aussi être Acquis** : un kanji a plusieurs lectures. 食 se lit た dans
食べる et しょく dans 食事. Connaître 食 ne suffit pas à lire tous les mots qui le contiennent.
Les seuils sont plus stricts pour les kanji que pour les kana : un kana a une seule lecture,
un kanji en a plusieurs.

**Si la lecture est ce que vérifie l'exercice**, ces règles ne s'appliquent pas au mot ciblé :
c'est l'exercice qui décide (règle 1 : ne pas donner la réponse).

### Représentation d'une phrase

Chaque mot reçoit sa représentation, puis la phrase est harmonisée :

- **Kana, kanji et furigana cohabitent normalement** : c'est l'écriture japonaise ordinaire.
  わたしは 毎(まい)日(にち) パンを たべます est une phrase correcte.
- **Le romaji ne se mélange jamais au japonais sur une même ligne.** Pour les mots qui
  demandent du romaji :
  - s'ils sont **peu nombreux** (30 % des mots de la phrase au plus), la phrase reste en
    japonais, et ces mots reçoivent leur romaji **au-dessus, à la place des furigana**. La ligne
    reste japonaise, l'aide est placée comme une lecture ;
  - s'ils sont **plus nombreux**, toute la phrase passe en romaji.

Ainsi, un seul mot difficile n'efface pas toute la lecture en japonais d'une phrase par
ailleurs lisible.

### La version en kana se déduit des furigana

Aucune donnée nouvelle n'est nécessaire : dans `<ruby>食<rt>た</rt></ruby>べます`, remplacer le
kanji par sa lecture donne たべます. Le romaji existe déjà dans les exemples.

---

## 5.2 Formes et constructions grammaticales

### Deux niveaux à ne pas confondre

| Niveau | Définition | Exemple |
|---|---|---|
| **Forme** | transformation d'un mot | 食べる → 食べて, 食べた, 食べない, 食べます |
| **Construction** | une forme + des éléments fixes, qui produit un sens | 食べて + ください ; 食べ(radical) + たい ; 食べて + いる |

La leçon 〜てください n'enseigne pas seulement à produire la forme en て : elle enseigne une
**construction** qui l'utilise. Le générateur doit connaître la différence, sinon un exercice
sur 〜てください vérifierait seulement la forme en て.

### Les formes (module morphologique)

La donnée canonique reste la forme du dictionnaire et son `group` (食べる, `ru`). Les formes
sont **générées**, jamais stockées ; seules les exceptions ont des données.

| Catégorie | Formes de la v1 |
|---|---|
| Verbes | dictionnaire, radical (〜ます sans ます), poli présent, poli négatif, poli passé, poli passé négatif, forme en て, en た, en ない, en なくて, en なければ, en たら, en たり |
| Adjectifs en い | présent, négatif (〜くない), passé (〜かった), passé négatif (〜くなかった), en て (〜くて) |
| Adjectifs en な | avec です, négatif, passé, passé négatif, en で |
| Noms | avec です, ではありません / じゃないです, でした, ではありませんでした |

Le module produit **à la fois** la forme en kanji, ses furigana, sa version en kana et son
romaji. C'est indispensable pour 来る, dont les furigana changent selon la forme.

### Les constructions

Une construction est décrite par la forme qu'elle utilise et ce qu'elle y ajoute. Elle est
déclarée par la leçon, en remplacement ou en complément de `forms` (addendum de la partie 2) :

```json
{ "id": "n5_g_35", "item": "〜てください",
  "construction": { "form": "verb_te", "suffix": "ください" } }
{ "id": "n5_g_34", "item": "〜たい",
  "construction": { "form": "verb_stem", "suffix": "たい" } }
{ "id": "n5_g_41", "item": "〜なければならない",
  "construction": { "form": "verb_nakereba", "suffix": "ならない" } }
```

- Une leçon qui enseigne **une forme** (〜ました) déclare `forms`.
- Une leçon qui enseigne **une construction** (〜てください) déclare `construction`. Sa cible est la
  construction ; produire la forme n'en est qu'une étape.
- Les constructions plus complexes (〜たり〜たりする, 〜てあげる / 〜てくれる / 〜てもらう)
  ne sont pas générées en v1 : leurs exercices restent rédigés.

### Exceptions

Peu nombreuses, décrites dans un petit fichier de données :

| Mot | Exception |
|---|---|
| する | irrégulier : します, して, した, しない |
| 来る | irrégulier, **la lecture du kanji change** : 来(き)ます, 来(こ)ない, 来(き)て |
| 行く | forme en て et en た : 行って, 行った |
| ある | forme en ない : ない |
| 良い / いい | se conjugue sur よ : よくない, よかった |
| nom + する | se conjugue comme する, le nom est inchangé |

### Choix du support

Pour pratiquer une forme ou une construction, le générateur choisit un mot :

1. d'une **catégorie compatible** (`group`) ;
2. **au moins En cours**, de préférence Acquis : on vérifie la forme, pas le mot ;
3. de préférence **récent** (règle R5 de la partie 4).

Le mot est un **support** : il n'est pas la cible et son état ne change pas.

### La phrase de l'exercice : jamais de génération aveugle

On n'injecte jamais un mot dans n'importe quelle phrase : « きのう、あります » ou
« きのう、なければならない » n'ont pas de sens. Par ordre de préférence :

1. **Un exemple existant du mot, transformable** : le mot y est le prédicat final, et la phrase
   ne contient pas de marqueur de temps incompatible avec la forme visée (明日 avec le passé,
   昨日 avec le présent…). Une petite liste de marqueurs de temps suffit en v1.
2. **Un gabarit rédigé, avec ses contraintes** : les gabarits sont du **contenu écrit et
   relu**, pas du texte inventé par le code. Chacun déclare les formes et les mots auxquels il
   s'applique :

   ```json
   { "id": "tpl_past_1", "text": "きのう、{verb}。",
     "forms": ["verb_polite_past"],
     "compatible": { "vocab": ["n5_v_117", "n5_v_66", "n5_v_187"] } }
   ```

3. **Un autre support**, si aucun des deux ne convient pour ce mot.

Les gabarits vivent dans un fichier de données dédié, rédigé selon `GUIDE-CONTENU.md`.

---

## 5.3 Les générateurs d'exercices

Chaque générateur produit des questions avec une **cible**, éventuellement des **supports**,
un identifiant stable (`gen:<générateur>:<cible>:<variante>`, partie 2) et une
représentation choisie selon 5.1.

| Générateur | Cible | Principe | Masqué pendant la question |
|---|---|---|---|
| **Sens** | un mot | QCM : que signifie ce mot ? | la traduction |
| **Lecture** | un mot ou un kanji | QCM : comment se lit-il ? | furigana et romaji |
| **Forme** | une forme ou une construction | 食べる → ? dans une phrase (5.2) | la forme attendue ; le support reste lisible |
| **Particule** | une particule | texte à trous (`particles.json`) | le romaji de la phrase |
| **Retrouver le mot** | un mot | une phrase, un sens en français : quel mot de la phrase y correspond ? Ou l'inverse : un mot mis en évidence, quel est son sens ? | la traduction de la phrase |
| **Lecture de kana** | des kana | lire un mot ou une courte phrase écrits uniquement avec des kana connus | le romaji |
| **Tracé** | un kana ou un kanji | HanziWriter, indice disponible | — |
| **Oral** | un mot | prononcer ; reconnaissance vocale | — |
| **Compréhension** | éléments du `teaches` / `requires` | questions rédigées des lectures | selon la question |
| **Naturel ou scolaire ?** | une expression ou une tournure | choisir la phrase naturelle | les traductions |
| **Adapter le registre** | une expression | choisir la variante adaptée à la situation | les traductions |

**Tout redevient visible après la réponse** : furigana, romaji, traduction, forme.

### Éligibilité du générateur Lecture

Le générateur **Lecture** ne pose une question sur un mot écrit en kanji que si **tous ses
kanji sont au moins Découverts** : on ne demande pas la lecture d'une écriture jamais
présentée. Sinon, pour ce mot, un autre générateur est choisi (lecture en kana, sens).

Ce sont deux décisions distinctes :

| Question | Règle |
|---|---|
| Peut-on poser une question de lecture sur ce mot ? | tous ses kanji au moins Découverts |
| Comment l'afficher pendant la question ? | sans furigana ni romaji sur le mot, puisque sa lecture est la cible (5.1) |

### « Retrouver le mot »

Construit à partir des exemples du vocabulaire, dont le champ `highlight` indique déjà où se
trouve le mot. Les distracteurs sont choisis, par ordre d'importance :

1. **connus** de l'utilisateur (au moins En cours) ;
2. affichés dans la **même représentation** que la phrase ;
3. de **sens nettement distinct** du mot cherché, pour qu'il n'y ait qu'une bonne réponse ;
4. de la même catégorie grammaticale, seulement quand ça rend le choix plus pertinent.

### La progression des kana

Le bloc Kana (partie 4) enchaîne des étapes de plus en plus riches :

```
Découverte      あ
Reconnaissance  あ → a
Tracé           あ
Combinaison     あ + お → あお
Mot             あか (rouge)
Mot utile       おはよう
Mini-expression おはよう！
```

**Le « monde lisible »** : le générateur de lecture de kana ne propose que des mots et
expressions **écrits uniquement avec des kana connus**. Quelqu'un qui connaît あいうえお et
かきくけこ peut lire あか, いく, かお ; à chaque nouveau kana, le nombre de mots lisibles grandit.
Les salutations et formules de politesse viennent de `expressions.json` dès que leurs kana
sont connus.

« Connu » signifie ici **lisible**, au sens de 5.1 : au moins En cours et sans faiblesse
active. Pendant l'apprentissage des kana, on lit avec ceux qu'on est en train d'apprendre. La
définition est la même que pour l'affichage adaptatif.

---

## 5.4 Naturel et registre

### Trois phases

Le signalement « Sonne scolaire » est introduit progressivement, pour ne pas donner
l'impression que tout ce qu'on apprend est faux :

| Phase | Ce qu'Ocha montre |
|---|---|
| 1 · Débutant | **uniquement la forme naturelle**. Aucun bloc « Sonne scolaire ». |
| 2 · Intermédiaire | le bloc « Sonne scolaire » apparaît, replié, sous les phrases concernées : « On dit plus naturellement… », avec le pourquoi |
| 3 · Avancé | les exercices « Naturel ou scolaire ? » et « Adapter le registre » entrent dans les sessions |

### Déclenchement en v1

Pas le seul niveau JLPT : un utilisateur peut avoir déclaré N5 sans l'avoir pratiqué. Règle
simple de la v1, fondée sur la part des leçons de grammaire N5 **au moins En cours** :

| Part des leçons N5 au moins En cours | Phase |
|---|---|
| moins de 25 % | 1 |
| de 25 à 60 % | 2 |
| plus de 60 % | 3 |

Les badges de registre (familier, poli…) et la relation des personnages restent visibles dès
la phase 1 : ils décrivent, ils ne corrigent pas.

### Ne pas corriger sur tout

`sounds_textbook` n'est affiché que là où il est écrit dans les données, c'est-à-dire là où
l'auteur a jugé la distinction utile. Le moteur ne génère jamais de « version scolaire »
lui-même.

Les seuils de 25 % et 60 % sont des paramètres expérimentaux de la v1 (5.6), à éprouver par
les sessions d'exemple (partie 8).

---

## 5.5 Invariants de cette partie

1. Un exercice n'affiche jamais ce qui donne sa réponse.
2. Un exercice n'affiche jamais une écriture que l'utilisateur ne sait pas lire, sauf si c'est
   ce qui est vérifié.
3. Les réglages de l'utilisateur gouvernent tout l'affichage hors exercices.
4. Un support n'est jamais une cible : son état ne change pas.
5. Les formes conjuguées ne sont jamais stockées ; seules les exceptions ont des données.
6. Le moteur ne fabrique jamais de « version scolaire » : il n'affiche que celles des données.
7. Les choix d'un QCM sont toujours dans la même représentation que la question.
8. Le romaji ne se mélange jamais au japonais sur une même ligne : il est soit en lecture
   au-dessus d'un mot, soit l'écriture de toute la phrase.
9. Forme et construction sont distinguées : une construction a pour cible la construction,
   pas la forme qu'elle utilise.
10. Aucun mot n'est injecté dans une phrase sans exemple transformable ou gabarit compatible.
11. Aucune question de lecture ne porte sur un mot dont un kanji est encore Nouveau.

---

## 5.6 Paramètres de la v1

```js
const GUIDED_CONFIG = {
  // … paramètres des parties 1 à 4
  representation: {
    kanaReadable: "learning_no_weakness",  // kana au moins En cours, sans faiblesse active
    kanjiWithoutFurigana: "acquired",      // kanji ET mot au moins Acquis
    romajiRubyMaxShare: 0.30               // au-delà, toute la phrase passe en romaji
  },
  naturalnessPhases: { phase2: 0.25, phase3: 0.60 }  // part des leçons N5 au moins En cours
};
```

---

## Décisions de cette partie

| Point | Décision |
|---|---|
| Partie 3 interprète, partie 4 choisit, partie 5 génère et adapte | validé |
| Affichage adaptatif réservé aux exercices, réglages ailleurs | validé |
| Kana lisible : au moins En cours, sans faiblesse active (définition unique) | validé |
| Furigana retirés quand kanji et mot sont Acquis | validé |
| Phrase : romaji en lecture au-dessus des mots si ≤ 30 %, sinon phrase en romaji | validé, paramètre v1 |
| Forme ≠ construction (`forms` / `construction`) | validé |
| Formes générées, exceptions seules stockées | validé |
| Phrase d'exercice : exemple transformable, puis gabarit rédigé, puis autre support | validé |
| Distracteurs de « Retrouver le mot » : connus, même représentation, sens distinct | validé |
| Progression des kana et monde lisible | validé |
| O7 · Lecture en kanji seulement si tous les kanji sont au moins Découverts | validé (partie 8) |
| Trois phases du naturel à 25 % / 60 % ; `sounds_textbook` éditorial | validé, paramètre expérimental |

## Conséquences pour la suite

- **Données** : champs `forms` ou `construction` sur les leçons concernées ; petit fichier
  d'exceptions de conjugaison ; fichier de gabarits rédigés ; nettoyage de `group` (addendum
  de la partie 2) ; `GUIDE-CONTENU.md` à compléter pour les gabarits.
- **Code** : module morphologique (formes, furigana, kana, romaji) ; fonction de
  représentation par mot ; générateurs listés en 5.3, qui réutilisent `buildMeaningQCM`,
  `buildGrammarCloze`, HanziWriter, le tracé des kana et l'oral existants.
- **Partie 6 · Cas limites** : notamment un mot sans exemple exploitable, une forme sans
  support connu, un utilisateur qui ne lit aucun kana.
