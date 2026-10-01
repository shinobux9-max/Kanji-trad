# Étape 0 · Tâche 6 — Nettoyage structurel des données

**Date** : 2026-10-01  
**Résultat** : `node tools/validate-data.mjs` → **0 erreur**, 8 avertissements.

## Périmètre

Corrections **structurelles** uniquement, valables quel que soit le futur modèle lexical (A2).
Les anciennes catégories thématiques ne sont **pas** retouchées : elles seront remplacées par
la migration A2 (étape 2).

## Corrections appliquées

| Fichier | Correction |
|---|---|
| `data/n5/vocab.json` | n5_v_201 : seconde copie supprimée (lecture « naku », catégorie « loisirs ») |
| `data/n5/vocab.json` | n5_v_599 : lecture « demo » → « でも » |
| `data/n5/vocab.json` | n5_v_600 : lecture « douzo » → « どうぞ » |
| `data/n5/vocab.json` | n5_v_4 : type ajouté : « adjectif en i » (valeur la plus utilisée pour group i) |
| `data/n5/vocab.json` | n5_v_208 : kanji_list ["風呂"] → ["風", "呂"] |
| `data/n5/vocab.json` | n5_v_569 : type « verbe » → « nom » (décision : garder le nom) |
| `data/n5/vocab.json` | n5_v_569 : group « suru » → « nom » |
| `data/n5/vocab.json` | n5_v_570 : type « verbe » → « nom » (décision : garder le nom) |
| `data/n5/vocab.json` | n5_v_570 : group « suru » → « nom » |
| `data/n5/vocab.json` | group "nom_commun" → "nom" (136 mots) |
| `data/n5/vocab.json` | group "な - na" → "na" (1 mots) |
| `data/n5/vocab.json` | group "intérrogatif" → "interrogatif" (4 mots) |
| `data/n5/grammar.json` | n5_g_17 (grammaire) : romaji « gaisha » → « kaisha » |
| `data/vocab-hors-jlpt.json` | group « nom » ajouté à hj_v_1 et hj_v_2 |
| `data/expressions.json` | ex_5 (« Non merci, ça ira ») et ex_6 (« S'il vous plaît ») ajoutées, cibles des exercices de la mission konbini |
| `data/n5/missions.json` | n5_m_1 : requires / teaches (partie 2) à la place de vocab / expressions / grammar, identifiants et cibles des 3 exercices |
| `data/n5/lectures.json` | identifiants et cibles des 6 questions ; n5_l_5 : お腹 (n5_v_45) passe de requires à teaches (exemple de la partie 2) |

Décision du 2026-10-01 : 結婚 et 練習 restent des **noms**, dans leur sens actuel
(« mariage », « entraînement ») ; ils ne sont pas transformés en verbes en する.

## Avertissements conservés volontairement

| Avertissement | Raison |
|---|---|
| `kanji-inconnu` (鞄, 鹸, 醤) | kanji hors jōyō, normaux dans ces mots |
| `lecon-sans-requires` (75 leçons) | dépendances entre leçons : travail pédagogique à faire plus tard ; l'ordre de référence s'applique |
| `categorie-isolee`, `categorie-doublon` | anciennes catégories, remplacées par la migration A2 |

## Constat hors périmètre : `data/n5/exemples.json`

Ce fichier n'est pas validé structurellement (seule sa syntaxe JSON l'est), et l'examen montre
qu'il est **largement inutilisable en l'état** :

- section par kanji : 694 exemples, dont **436 sans aucun hiragana** (particules et terminaisons
  absentes, ex. `一 買。` pour « 一つ買います »), avec des lectures fausses (行 lu ぎょう, 買 lu ばい) ;
- les 2 152 exemples de la section vocabulaire et les 15 de la section grammaire sont découpés
  en mots séparés par des espaces (`これ は 私 の 本 です 。`), format différent du format commun
  des phrases (GUIDE-CONTENU, §5).

Les exemples propres de l'app sont ceux de `vocab.json` (champ `example`) et de `grammar.json`.
La reconstruction de `exemples.json` est notée comme point ouvert, à traiter avec la migration A2.
