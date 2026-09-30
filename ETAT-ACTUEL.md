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
| 2 | Gouvernance et documentation | ✅ fait (commit `a7b701a`) |
| 3 | `src/config.js` avec `GUIDED_CONFIG` | ✅ fait |
| 4 | `tools/check-layers.mjs` | ✅ fait |
| 5 | `tools/validate-data.mjs` | ⏳ |
| 6 | Nettoyage des données, validation sans erreur | ⏳ |

Sous PowerShell, lancer les tests avec `npm.cmd test` (la stratégie d'exécution de Windows
bloque `npm test`).

---

## Contenu de la branche

- **Nouvelle base** : `src/config.js`, `tools/check-layers.mjs`, `tests/tools/`,
  `docs/conception/`, `package.json` (modules ESM). Les autres dossiers de `src/` sont vides
  pour l'instant.
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

Le dépôt s'appelle désormais `Ocha` (https://github.com/shinobux9-max/Ocha).

---

## Décisions complémentaires

Décisions prises pendant la reconstruction, qui complètent le document de conception sans
modifier ses parties verrouillées.

| Date | Décision | Où |
|---|---|---|
| 2026-09-29 | Réglages initiaux : 10 nouveautés par jour (contenu seulement, kana exclus), format de session normal | `src/config.js`, `DEFAULT_USER_SETTINGS` |
| 2026-09-29 | Commande de test : `npm test` (`node --test "tests/**/*.test.js"`), `node --test tests/` ne fonctionnant pas avec Node 22+ | `package.json`, `REGLES-CONSTRUCTION.md` v2.2 |
| 2026-09-29 | `src/app.js` (démarrage) a les mêmes droits que l'interface : imports, accès au navigateur, `store/settings.js` seulement | `tools/check-layers.mjs`, `REGLES-CONSTRUCTION.md` v2.2 |
| 2026-09-30 | Addendum A1 : le champ des constructions générées s'appelle `construction` (`pattern` reste le motif d'affichage) | `docs/conception/addendum-A1-construction.md` |
| 2026-09-30 | `particles.json` déplacé dans `data/n5/` ; `concepts`, `curriculum` et `mapping` restent en place jusqu'à l'étape 5, car l'ancienne app les charge | `data/` |

---

## Points ouverts

 - Le N4 est dans l'ancien format de données (identifiants, `group`, exemples, romaji). À migrer au format v2 avant son intégration au moteur guidé. Le validateur ne couvre que le N5 d'ici là.
 - À l'étape 5 : déplacer `concepts/n5.json` vers `data/n5/concepts.json`, et `curriculum/n5.json` et `mapping.json` vers `data/legacy/`.

---

## Journal des tâches

| Date | Étape · tâche | Résumé | Commit |
|---|---|---|---|
| 2026-09-29 | 0 · 1 | Branche `ocha-v2` créée depuis `UI-sans-refonte`, arborescence, `.gitignore` | `c1a0f7b` |
| 2026-09-29 | 0 · 2 | Documents de conception, nouvelles règles et état ; anciens documents rangés dans `docs/legacy/` | `a7b701a` |
| 2026-09-29 | 0 · 3 | `src/config.js` : GUIDED_CONFIG (parties 1 à 5), réglages initiaux de l'utilisateur ; `package.json` en ESM | — |
| 2026-09-29 | 0 · 4 | `tools/check-layers.mjs` et ses 19 tests, commande `npm test`, droits de `src/app.js` | — |