# Kanji-trad — nouveaux fichiers de données (exemples)

Fichiers d'exemple pour tester la v4. Les identifiants de vocabulaire et de grammaire
utilisés (`n5_v_…`, `n5_g_…`) sont les vrais identifiants de `vocab.json` et `grammar.json`.

## Emplacement proposé

| Fichier | Emplacement | Contenu |
|---|---|---|
| `registres.json` | `data/` | Les 5 registres, définis une seule fois |
| `expressions.json` | `data/` | Formules toutes faites, tous niveaux (champ `level`) |
| `vocab-hors-jlpt.json` | `data/` | Mots hors listes JLPT, même format que `vocab.json` |
| `lieux.json` | `data/` | Lieux d'Explorer, communs à tous les niveaux |
| `missions.json` | `data/n5/`, `data/n4/`… | Missions d'un niveau |
| `lectures.json` | `data/n5/`, `data/n4/`… | Histoires, dialogues, carnets, lettres d'un niveau |

## Où ranger un élément

- Mot du JLPT → vocabulaire de son niveau.
- Mot hors JLPT → `vocab-hors-jlpt.json` (`hj_v_…`).
- Formule toute faite (merci, bienvenue…) → `expressions.json` (`ex_…`), avec son niveau dedans.

## Format commun d'une phrase

Toutes les phrases (répliques, lignes de lecture, exemples, variantes) partagent ce format,
pour qu'un seul rendu applique partout les réglages furigana / romaji / traduction :

```json
{
  "speaker": "ken",                      // optionnel : id d'un personnage
  "japanese": "<ruby>映画<rt>えいが</rt></ruby>、…",
  "romaji": "eiga, mi ni ikanai?",
  "french": "On va voir un film ?",
  "register": "familier",                // id de registres.json
  "refs": [{ "text": "映画", "vocab": "n5_v_196" },
           { "text": "いらっしゃいませ", "expression": "ex_3" }],
  "grammar": ["n5_g_18"],
  "sounds_textbook": [{                  // optionnel
    "japanese": "…", "romaji": "…",
    "why": "Pourquoi ça sonne scolaire",
    "natural": "La version naturelle",
    "natural_romaji": "Son romaji"
  }]
}
```

- `refs[].text` doit apparaître tel quel dans la phrase (hors balises `<ruby>`) : c'est ce
  qui rend le mot cliquable.
- `register` : `familier`, `poli`, `respectueux`, `humble`, `ecrit`.
  Attention, `respectueux` et `humble` ne sont pas « plus poli » l'un que l'autre
  (champ `axis` dans `registres.json`).

## Personnages

`{ "id", "name", "name_ja", "relation", "is_user" }` — `relation` : `ami`, `client`,
`personnel`, `superieur`, `narration`… Sert à savoir à qui on parle.

## Lectures

`type` : `histoire`, `dialogue`, `carnet`, `lettre`. Le contenu est une liste de `blocks` :
`paragraph` (avec `lines`), `line` (une réplique), `entry` (entrée datée d'un carnet),
`header` et `closing` (lettre). `requires` liste la grammaire et le vocabulaire
nécessaires : c'est ce qui permettra au mode guidé de choisir une lecture adaptée.
`teaches` (optionnel) liste les éléments que la lecture enseigne. Chaque question a un `id`
et une `target`.

## Missions

Situation, objectifs, personnages, `requires` et `teaches` (partie 2 du document de
conception), dialogue, puis `exercises` de type `choice` (QCM) ou `fill` (texte à trous),
chacun avec un `id` et une `target`. Le champ `skill` précise ce qui est travaillé :
`naturel` (naturel ou scolaire ?), `registre`, `vocabulaire`.

## Expressions

`variants` regroupe les formes d'un même sens par registre, chacune avec son public
(`audience`) et, si besoin, son propre `level`. `said_by` / `user_says` indiquent qui la
prononce, `responses` ce qu'on répond, `places` les lieux où on la rencontre.

## À savoir pour l'intégration

Les identifiants `ex_…` et `hj_v_…` sont nouveaux : le SRS, le suivi de progression,
la recherche et les dossiers devront les accepter. C'est une modification fonctionnelle.
