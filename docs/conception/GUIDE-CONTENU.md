# Kanji-trad — Guide de rédaction du contenu

Ce guide explique comment écrire du nouveau contenu pour les fichiers de données de
Kanji-trad, une application d'apprentissage du japonais pour francophones (niveaux JLPT
N5 à N1). Il est destiné à la personne ou à l'IA qui rédige ce contenu.

**Objectif de l'application : apprendre un japonais naturel**, celui qu'on entend
vraiment, pas un japonais de manuel. Chaque phrase doit sonner juste pour la personne
qui parle, à qui elle parle et dans quelle situation.

---

## 1. Règles absolues

1. **Répondre uniquement avec du JSON valide**, sans commentaire à l'intérieur, sans texte
   autour. Guillemets doubles, pas de virgule après le dernier élément.
2. **Ne jamais inventer un identifiant de vocabulaire ou de grammaire.** Les identifiants
   (`n5_v_117`, `n5_g_8`…) viennent des fichiers `vocab.json` et `grammar.json` fournis
   avec ce guide. Si un mot nécessaire n'y figure pas, ne pas créer de référence :
   le signaler dans la liste « À AJOUTER » (voir section 10).
3. **Chaque texte de `refs` doit apparaître exactement dans la phrase**, hors balises
   `<ruby>`. Exemple : si la phrase contient `起きます`, la référence est
   `{ "text": "起きます", "vocab": "n5_v_577" }`, pas `起きる`.
4. **Chaque phrase japonaise a son `romaji`, son `french` et son `register`.**
5. **Respecter le niveau** : une lecture ou une mission N5 utilise la grammaire N5.
   Quelques mots d'un niveau supérieur sont acceptés dans une situation réelle
   (ex. 袋 au konbini), mais ils doivent être référencés ou signalés.
6. **Numéroter les nouveaux identifiants à la suite** du dernier identifiant existant,
   qui sera indiqué dans la demande.

---

## 2. Conventions d'écriture

### Furigana : balises `<ruby>`

- Une balise par mot en kanji, sur le mot entier : `<ruby>日曜日<rt>にちようび</rt></ruby>`.
- Les okurigana (kana après le kanji) restent **hors** de la balise :
  `<ruby>食<rt>た</rt></ruby>べます`, jamais `<ruby>食べ<rt>たべ</rt></ruby>ます`.
- Pas de balise sur les mots entièrement en kana.
- Les nombres suivis d'un compteur ont une balise sur l'ensemble :
  `<ruby>五百八十円<rt>ごひゃくはちじゅうえん</rt></ruby>`.
- Dans les champs `sounds_textbook`, `natural`, `why`, `prompt` et `explanation`,
  le japonais s'écrit **sans** balises.

### Romaji (convention obligatoire)

- Voyelles longues écrites en double, **jamais de macron** : `arigatou`, `gakkou`,
  `daijoubu`, `kaado`, `onee-san`. Jamais `arigatō`.
- Particules écrites comme elles se prononcent : は → `wa`, を → `o`, へ → `e`.
- Minuscules, sauf noms propres (`Yuki-san`). Mots séparés par des espaces.
  Ponctuation reprise de la phrase japonaise (`.`, `?`, `!`).

### Français

- Traduire le sens, pas mot à mot : `映画、見に行かない？` → « On va voir un film ? »,
  pas « Film, ne pas aller voir ? ».
- Le registre se retrouve dans la traduction : tutoiement pour le familier, vouvoiement
  pour le poli et le keigo quand c'est naturel en français.
- Le gras `**…**` sert uniquement dans le champ `french` des exemples de vocabulaire,
  pour mettre en valeur le mot étudié.

---

## 3. Où ranger un élément

| Élément | Fichier | Identifiant |
|---|---|---|
| Mot présent dans une liste JLPT | `data/n5/vocab.json` (ou n4…) | `n5_v_…` |
| Mot absent des listes JLPT (レジ袋, ポイントカード) | `data/vocab-hors-jlpt.json` | `hj_v_…` |
| Formule toute faite (merci, bienvenue, pardon…) | `data/expressions.json` | `ex_…` |
| Lieu d'Explorer | `data/lieux.json` | nom court (`konbini`) |
| Mission | `data/n5/missions.json` (ou n4…) | `n5_m_…` |
| Lecture | `data/n5/lectures.json` (ou n4…) | `n5_l_…` |

Une **expression** est une formule qu'on apprend en bloc et dont l'usage dépend de la
situation (qui la dit, à qui, ce qu'on répond). Un **mot** est un élément qu'on combine
librement dans une phrase.

---

## 4. Les registres

Chaque phrase a un champ `register` qui vaut l'un de ces identifiants :

| Identifiant | Nom | Quand l'utiliser |
|---|---|---|
| `familier` | タメ口 | Entre amis, en famille, avec plus jeune que soi |
| `poli` | 丁寧語 | Par défaut avec les inconnus, collègues, commerçants (です/ます) |
| `respectueux` | 尊敬語 | Pour parler de ce que fait l'autre (client, supérieur) : いらっしゃる, ご利用 |
| `humble` | 謙譲語 | Pour parler de ce qu'on fait soi-même envers quelqu'un de respecté : 参る, 申し訳ございません |
| `ecrit` | 常体 | Écrit neutre en forme simple : journal intime, récit, article |

**Points importants :**

- `respectueux` et `humble` ne sont pas « plus poli » l'un que l'autre. On les emploie
  ensemble : le vendeur élève le client (respectueux) et abaisse ses propres actions
  (humble).
- `ecrit` n'est pas du familier. Un journal intime en forme simple n'est pas une
  conversation entre amis.
- Le registre dépend de **la relation entre les personnages**, pas de la gentillesse :
  deux amis polis l'un avec l'autre parlent quand même en `familier`.

---

## 5. Format commun d'une phrase

Toutes les phrases (répliques, lignes de lecture, exemples, réponses) suivent ce format :

```json
{
  "speaker": "ken",
  "japanese": "<ruby>映画<rt>えいが</rt></ruby>、<ruby>見<rt>み</rt></ruby>に<ruby>行<rt>い</rt></ruby>かない？",
  "romaji": "eiga, mi ni ikanai?",
  "french": "On va voir un film ?",
  "register": "familier",
  "refs": [
    { "text": "映画", "vocab": "n5_v_196" },
    { "text": "行かない", "vocab": "n5_v_156" }
  ],
  "grammar": [],
  "sounds_textbook": [
    {
      "japanese": "日曜日に一緒に映画を見に行きませんか。",
      "romaji": "nichiyoubi ni issho ni eiga o mi ni ikimasen ka.",
      "why": "Correct, mais bien trop poli entre amis. À l'oral familier, on laisse aussi tomber を.",
      "natural": "映画、見に行かない？",
      "natural_romaji": "eiga, mi ni ikanai?"
    }
  ]
}
```

| Champ | Obligatoire | Rôle |
|---|---|---|
| `speaker` | dans les dialogues | Identifiant d'un personnage de la liste `characters` |
| `japanese` | oui | Phrase avec balises `<ruby>` |
| `romaji` | oui | Selon la convention de la section 2 |
| `french` | oui | Traduction naturelle |
| `register` | oui | Voir section 4 |
| `refs` | oui (liste vide possible) | Mots et expressions cliquables. Une référence pointe soit vers `"vocab"`, soit vers `"expression"` |
| `grammar` | oui (liste vide possible) | Identifiants des points de grammaire utilisés |
| `sounds_textbook` | non | Version scolaire à éviter (voir section 6) |

---

## 6. Écrire un japonais naturel

Défauts typiques des méthodes classiques, à éviter :

- **Répéter le sujet.** Une fois qu'on sait de qui on parle, 私は, あなたは ou le nom
  disparaissent. あなた est rare et peut sembler impoli quand on connaît le nom.
- **Utiliser です/ます entre amis.**
- **Oublier les particules de fin de phrase** ね, よ, かな à l'oral.
- **Oublier les contractions du familier** : 〜てる (〜ている), 〜ちゃう (〜てしまう),
  じゃない, って, 〜とく (〜ておく).
- **Oublier les réactions et hésitations** : うん, そうなんだ, へえ, えっと, あの.
- **Garder toutes les particules à l'oral familier** : を et は tombent souvent
  (`映画、見に行かない？`).
- **Calquer le français** : `あなたの名前は何ですか` au lieu de `お名前は？`.
- **Refuser sèchement** : `いりません` au lieu de `大丈夫です` ou `結構です`.

**Quand ajouter `sounds_textbook` :** chaque fois qu'un apprenant aurait tendance à dire
une version correcte mais peu naturelle. Le champ `why` explique en une phrase pourquoi
elle sonne scolaire. Le champ `natural` reprend la phrase naturelle, sans balises, et
`natural_romaji` donne son romaji (obligatoire, même si la phrase naturelle est déjà
ailleurs dans le fichier).

Dans une même scène, chaque personnage garde son registre : les amis en familier, le
personnel en keigo, l'utilisateur en poli face à un commerçant.

---

## 7. Fichier `expressions.json`

Une expression regroupe **toutes les variantes d'un même sens**, du familier au keigo.

```json
{
  "id": "ex_1",
  "level": "N5",
  "meaning_fr": "Merci",
  "situation": "remercier",
  "category": "politesse",
  "variants": [
    { "register": "familier", "japanese": "ありがとう", "romaji": "arigatou", "audience": "amis, famille" },
    { "register": "poli", "japanese": "ありがとうございます", "romaji": "arigatou gozaimasu", "audience": "tout le monde, par défaut" }
  ],
  "said_by": "tous",
  "user_says": true,
  "responses": [
    { "japanese": "いいえ", "romaji": "iie", "french": "Mais non, de rien", "register": "poli" }
  ],
  "note": "",
  "sounds_textbook": [],
  "places": [],
  "refs": { "vocab": [], "grammar": [] },
  "related": [],
  "examples": []
}
```

| Champ | Rôle |
|---|---|
| `level` | `N5`… `N1` ou `hors_jlpt` |
| `variants[].level` | Optionnel : niveau propre d'une variante s'il diffère |
| `variants[].audience` | À qui on la dit, en quelques mots |
| `variants[].note` | Optionnel : nuance d'usage |
| `said_by` | `tous`, `personnel`, `client`… |
| `user_says` | `false` si l'apprenant ne doit jamais la dire (ex. いらっしゃいませ) |
| `responses` | Ce qu'on répond, au format phrase. Liste vide si on ne répond rien, avec explication dans `note` |
| `places` | Identifiants de lieux d'Explorer où on l'entend |
| `related` | Identifiants d'autres expressions liées |

---

## 8. Fichier `lectures.json`

Quatre types : `histoire`, `dialogue`, `carnet`, `lettre`.

```json
{
  "id": "n5_l_1",
  "type": "histoire",
  "level": "N5",
  "order": 1,
  "title": "Le matin de Yuki",
  "title_ja": "ゆきさんの<ruby>朝<rt>あさ</rt></ruby>",
  "summary": "La routine matinale d'une étudiante.",
  "estimated_minutes": 3,
  "theme": "quotidien",
  "place": null,
  "requires": { "grammar": ["n5_g_8"], "vocab": ["n5_v_333"] },
  "teaches": { "vocab": ["n5_v_45"] },
  "characters": [{ "id": "yuki", "name": "Yuki", "name_ja": "ゆき", "relation": "narration" }],
  "blocks": [],
  "questions": []
}
```

**Les blocs (`blocks`) selon le type :**

| `kind` | Utilisé dans | Contenu |
|---|---|---|
| `paragraph` | histoire, lettre | `"lines": [phrase, phrase…]` |
| `line` | dialogue | Une réplique : les champs d'une phrase directement dans le bloc, avec `speaker` |
| `entry` | carnet | `"date"`, `"date_romaji"`, `"date_fr"`, `"lines": [...]` |
| `header` | lettre | Formule d'ouverture (`マリーさんへ`), champs d'une phrase directement dans le bloc |
| `closing` | lettre | Signature (`はなより`), champs d'une phrase directement dans le bloc |

**Registre attendu par type :** histoire en `poli` au N5 (en `ecrit` à partir du N4),
dialogue selon la relation des personnages, carnet en `ecrit`, lettre en `poli` ou
`familier` selon le destinataire.

**`requires`** liste la grammaire et le vocabulaire nécessaires pour comprendre le texte.
L'application s'en sert pour proposer une lecture adaptée à ce que l'utilisateur connaît.

**`teaches`** (optionnel) liste les éléments que la lecture présente comme nouveaux, par
exemple un mot glosé. Un élément ne peut pas être à la fois dans `requires` et `teaches`,
et `teaches` contient 8 éléments au plus (partie 2 du document de conception).

**`place`** : identifiant d'un lieu d'Explorer si la lecture s'y passe, sinon `null`.

**Questions de compréhension :**

```json
{
  "id": "n5_l_1_q1",
  "target": { "vocab": ["n5_v_97"] },
  "prompt": "Que mange Yuki le matin ?",
  "choices": ["Du riz", "Du pain", "Rien"],
  "answer": 1,
  "explanation": "朝ご飯は、いつもパンです。",
  "line_ref": [0, 1]
}
```

`id` est l'identifiant de la question : identifiant de la lecture, puis `_q` et un numéro.
`target` est ce que la question vérifie, groupé par type comme `requires` ; ce doit être un
élément de `requires` ou de `teaches` de la lecture.
`answer` est l'indice de la bonne réponse (0 = première). `line_ref` indique où se
trouve la réponse : `[bloc, ligne]` pour un paragraphe, `[bloc]` pour une réplique.
Une à trois questions par lecture ; les mauvaises réponses doivent être plausibles.

---

## 9. Fichiers `lieux.json` et `missions.json`

**Lieu :**

```json
{
  "id": "konbini", "name": "Konbini", "name_ja": "コンビニ", "romaji": "konbini",
  "emoji": "🏪", "description": "Payer, faire réchauffer un plat, refuser un sac.",
  "vocab_categories": ["nourriture_boissons", "achats_argent"],
  "background": "konbini", "order": 1
}
```

`vocab_categories` reprend les catégories existantes de `vocab.json`.

**Mission :**

| Champ | Rôle |
|---|---|
| `id`, `place`, `level`, `order` | Identification et rattachement au lieu |
| `title`, `situation`, `goals` | Ce que l'utilisateur doit accomplir, en français |
| `estimated_minutes` | Durée estimée |
| `characters` | Avec `relation` (`client`, `personnel`…) ; l'utilisateur a `"is_user": true` |
| `requires` | Éléments que l'utilisateur doit déjà connaître, groupés par type (`grammar`, `vocab`, `kanji`, `expression`) ; jamais de kana |
| `teaches` | Éléments que la mission enseigne (8 au plus), jamais aussi dans `requires` |
| `dialogue` | Liste de phrases avec `speaker` |
| `exercises` | Voir ci-dessous |

**Exercices de mission :**

```json
{
  "id": "n5_m_1_q1",
  "target": { "expression": ["ex_5"] },
  "type": "choice",
  "skill": "naturel",
  "prompt": "Le caissier demande 「レジ袋はご利用ですか」. Tu n'en veux pas. Quelle réponse sonne la plus naturelle ?",
  "choices": [
    { "japanese": "いえ、<ruby>大丈夫<rt>だいじょうぶ</rt></ruby>です。", "romaji": "ie, daijoubu desu.", "french": "Non, ça ira." },
    { "japanese": "いいえ、いりません。", "romaji": "iie, irimasen.", "french": "Non, je n'en veux pas." }
  ],
  "answer": 0,
  "explanation": "Les deux sont correctes, mais いりません est sec.",
  "dialogue_ref": 4
}
```

```json
{
  "id": "n5_m_1_q3",
  "target": { "expression": ["ex_6"] },
  "type": "fill",
  "skill": "vocabulaire",
  "prompt": "Complète la réponse pour accepter.",
  "sentence": "はい、お___いします。",
  "answer": "願",
  "romaji": "hai, onegai shimasu.",
  "french": "Oui, s'il vous plaît.",
  "distractors": ["休", "待"],
  "explanation": "お願いします = s'il vous plaît."
}
```

- `id` : identifiant de la mission, puis `_q` et un numéro (`n5_m_1_q1`).
- `target` : ce que l'exercice vérifie, groupé par type ; doit figurer dans `requires` ou
  `teaches` de la mission.
- `type` : `choice` (QCM) ou `fill` (texte à trous), seulement ces deux-là.
- `skill` : `naturel` (choisir la phrase naturelle), `registre` (qui dit quoi, à qui),
  `vocabulaire`, `comprehension`.
- Pour une question entièrement en français, laisser `japanese` et `romaji` vides (`""`).
- Viser 2 à 4 exercices par mission, dont au moins un `naturel` ou `registre`.

---

## 10. Mots et expressions manquants

Si un mot ou une expression nécessaire n'existe pas encore dans les fichiers fournis,
ne pas inventer d'identifiant. Écrire la phrase normalement, sans référence pour ce mot,
puis ajouter **après le JSON** une liste séparée :

```
À AJOUTER
- 袋 (ふくろ, fukuro) — sac — niveau probable N4 — utilisé dans n5_m_1
- ありがとうございます — expression, niveau N5 — utilisée dans n5_m_1
```

C'est la seule exception à la règle « uniquement du JSON ».

---

## 11. Vérification finale

Avant de rendre le contenu, vérifier :

- [ ] Le JSON est valide.
- [ ] Aucun identifiant de vocabulaire ou de grammaire n'a été inventé.
- [ ] Chaque texte de `refs` apparaît tel quel dans sa phrase.
- [ ] Chaque phrase a `japanese`, `romaji`, `french` et `register`.
- [ ] Le romaji n'a aucun macron (`ou`, pas `ō`).
- [ ] Les okurigana sont hors des balises `<ruby>`.
- [ ] Chaque personnage garde un registre cohérent avec sa relation.
- [ ] Aucune phrase ne répète inutilement le sujet ni n'utilise あなた sans raison.
- [ ] Les dialogues familiers contiennent au moins quelques marqueurs naturels
      (ね, よ, contractions, réactions).
- [ ] Au moins un `sounds_textbook` quand une tournure scolaire est tentante, avec son
      `natural_romaji`.
- [ ] Chaque question a un `id` et une `target`, et sa cible figure dans `requires` ou
      `teaches` de l'activité.
- [ ] Aucun élément n'est à la fois dans `requires` et `teaches`.
- [ ] `node tools/validate-data.mjs` ne signale aucune erreur.
- [ ] Le contenu respecte le niveau demandé.
- [ ] Les mots manquants sont listés dans « À AJOUTER ».

---

## 12. Comment formuler une demande

Joindre à la demande ce guide, les fichiers `vocab.json` et `grammar.json` du niveau
visé, et un fichier d'exemple du même type. Puis préciser :

> Écris [nombre] [type de contenu] de niveau [N5…] pour le fichier [nom du fichier].
> Thème ou lieu : [thème]. Dernier identifiant existant : [ex. n5_l_4].
> Respecte strictement GUIDE-CONTENU.md.
