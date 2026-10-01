# Ocha — Document de conception v1

**Statut** : 🔒 complet. Toutes les parties sont verrouillées.

Ce dossier est le **cahier des charges** de la reconstruction d'Ocha (ex-Kanji-trad). Il fait
référence : un comportement qui s'en écarte doit être signalé, jamais improvisé.

## Ordre de lecture

| # | Fichier | Contenu |
|---|---|---|
| — | `strategie-reconstruction.md` | ce qui est repris, réécrit ou conservé de l'app actuelle ; comportements à ne pas reproduire ; corrections de données |
| 1 | `partie-1-definitions.md` | éléments, cinq états (Nouveau → Découvert → En cours → Acquis → Maîtrisé), origine, état calculé, notes SRS |
| 2 | `partie-2-graphe.md` | `requires`, `teaches`, `uses` ; références `{ type, id }` ; validation ; addendum `forms` / `construction` |
| 3 | `partie-3-evenements.md` | `recordLearningEvent`, types d'événements, effets, faiblesses, journal |
| 4 | `partie-4-moteur.md` | sélection et composition des sessions guidées, rattrapage, adaptation, reprise |
| 5 | `partie-5-exercices.md` | représentation adaptative, formes et constructions, générateurs, naturel et registre |
| 6 | `partie-6-cas-limites.md` | 19 cas limites et leurs résolutions |
| 7 | `partie-7-criteres.md` | critères de réussite (bloquants et de qualité) |
| 8 | `partie-8-sessions.md` | cinq sessions d'exemple, arbitrages, replay |
| 9 | `partie-9-architecture.md` | couches, stockage IndexedDB, atomicité, pannes, tests, ordre de reconstruction |
| A1 | `addendum-A1-construction.md` | champ `construction` (au lieu de `pattern`) pour les constructions générées |
| A2 | `addendum-A2-liaison.md` | liaison avec l'architecture sémantique A2 : l'ENTRY est l'unité d'apprentissage, statut des tags |
| — | `../../REGLES-CONSTRUCTION.md` | règles opérationnelles de la branche `ocha-v2` (à la racine du dépôt) |
| — | `GUIDE-CONTENU.md`, `README.md` | rédaction du contenu et structure des fichiers de données |

## Paramètres

Tous les paramètres chiffrés des parties 1 à 5 sont regroupés dans une configuration unique
(`GUIDED_CONFIG`, `src/config.js`). Ce sont des valeurs de départ, à ajuster après usage réel.

## Prochaine étape

**Étape 0 de la reconstruction** (partie 9, 9.9) : créer la branche `ocha-v2`, poser
l'arborescence, rédiger les règles de construction de la nouvelle base (9.10), nettoyer et
valider les données.
