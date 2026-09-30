# Ocha — Document de conception v1

## Addendum A1 · Champ `construction`

**Statut** : 🔒 validé le 2026-09-29.

**Modifie** : partie 2 (addendum 2.10), partie 5 (5.2), et leurs mentions dans la partie 9 et
le sommaire. Aucune règle ne change : seul le **nom d'un champ** change.

---

## Le problème

Les leçons de grammaire ont **déjà** un champ `pattern`, qui sert à l'**affichage** du motif
pédagogique :

```json
{ "id": "n5_g_1", "item": "です", "pattern": "[Nom / Adjectif] + です" }
```

Les parties 2 (addendum 2.10) et 5 (5.2) avaient défini un **second** champ `pattern`, avec un
autre sens : l'instruction structurée qui permet au générateur de produire une construction.

```json
{ "id": "n5_g_35", "item": "〜てください", "pattern": { "form": "verb_te", "suffix": "ください" } }
```

Un même nom pour deux usages aurait conduit soit à écraser le motif d'affichage, soit à
casser le générateur. Le conflit a été découvert en examinant les données réelles, pendant
l'étape 0 de la reconstruction.

## La décision

- `pattern` **garde son sens actuel** : le motif affiché, en texte. Il n'est pas modifié.
- Le champ du générateur s'appelle **`construction`** :

```json
{ "id": "n5_g_35", "item": "〜てください",
  "pattern": "[Verbe forme て] + ください",
  "construction": { "form": "verb_te", "suffix": "ください" } }
```

Toutes les règles des parties 2 et 5 concernant ce champ s'appliquent à `construction` à
l'identique : une leçon qui enseigne une construction déclare `construction`, sa cible est la
construction et non la forme qu'elle utilise, et une leçon sans `forms` ni `construction`
n'est pas utilisable par le générateur.

## Textes mis à jour

| Document | Mention remplacée |
|---|---|
| Partie 2, addendum 2.10 | `pattern` → `construction` (2 mentions) |
| Partie 5, 5.2 et tableaux | `pattern` → `construction` (6 mentions) |
| Partie 9, 9.9 | `forms` / `pattern` → `forms` / `construction` |
| Sommaire | idem, et ligne de cet addendum |
