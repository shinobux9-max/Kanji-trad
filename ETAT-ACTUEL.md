# Ocha v2 — État actuel

**S'applique à** : la branche `ocha-v2` uniquement.

Ce fichier dit **où en est la reconstruction**. Il évolue à chaque tâche. Ce que Ocha doit
devenir est décrit dans `docs/conception/` (verrouillé) ; comment travailler, dans
`REGLES-CONSTRUCTION.md`.

---

## Étape en cours

**Étape 0 · Préparation** (partie 9, 9.9)

| Tâche | Contenu | État |
|---|---|---|
| 1 | Branche `ocha-v2`, arborescence, `.gitignore` | ✅ fait (commit `c1a0f7b`) |
| 2 | Gouvernance et documentation | ✅ fait |
| 3 | `src/config.js` avec `GUIDED_CONFIG` | ⏳ |
| 4 | `tools/check-layers.mjs` | ⏳ |
| 5 | `tools/validate-data.mjs` | ⏳ |
| 6 | Nettoyage des données, validation sans erreur | ⏳ |

---

## Contenu de la branche

- **Nouvelle base** : `src/`, `tools/`, `tests/` (vides pour l'instant), `docs/conception/`.
- **Ancienne app** (`js/`, `css/`, `index.html`, `sw.js`…) : conservée **comme référence**
  pour reprendre la logique des modules listés dans la stratégie de reconstruction. Elle
  n'est pas modifiée. Son sort (déplacement ou suppression) sera décidé à l'étape 5, quand la
  nouvelle interface arrivera.
- **Anciens documents de l'app** : déplacés dans `docs/legacy/`, pour référence uniquement.
  Ils ne s'appliquent pas à la v2.
- **Données** (`data/`) : conservées, enrichies des nouveaux fichiers (registres, expressions,
  mots hors JLPT, lieux, missions, lectures). Nettoyage prévu à la tâche 6.

## Autres branches

- `Modularisation` : app actuelle, avec le travail de style le plus récent. Non touchée.
- `UI-sans-refonte` : point de départ de `ocha-v2`. Non touchée.

---

## Points ouverts

*Aucun pour l'instant.*

---

## Journal des tâches

| Date | Étape · tâche | Résumé | Commit |
|---|---|---|---|
| 2026-09-29 | 0 · 1 | Branche `ocha-v2` créée depuis `UI-sans-refonte`, arborescence, `.gitignore` | `c1a0f7b` |
| 2026-09-29 | 0 · 2 | Documents de conception, nouvelles règles et état ; anciens documents rangés dans `docs/legacy/` | — |
