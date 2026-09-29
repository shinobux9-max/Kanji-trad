# Ocha — Moteur guidé v1

## Partie 7 · Critères de réussite

**Statut** : 🔒 verrouillée (version 3 : arbitrages O2 et O7 de la partie 8 intégrés).

**Objet** : dire à quoi on reconnaît que le moteur v1 fonctionne. Chaque critère est
**observable** : on peut le vérifier sur une session simulée (partie 8), puis par un test
automatique lors de l'intégration.

Les critères ne sont pas de nouvelles règles : ce sont les règles des parties 1 à 5,
formulées comme des vérifications.

**Deux niveaux** :

- **Bloquant** : un critère non respecté est un défaut à corriger avant d'intégrer.
- **Qualité** : un critère non respecté signale un réglage à ajuster (paramètres de
  `GUIDED_CONFIG`), pas une erreur de conception.

---

## 7.1 Sûreté · critères bloquants

Ce que le moteur ne doit **jamais** faire.

| # | Critère | Vérification | Réf. |
|---|---|---|---|
| S1 | Ne jamais proposer une activité dont les prérequis ne sont pas satisfaits | pour chaque bloc d'une session, recalculer l'accessibilité | 2.4 |
| S2 | Ne jamais produire une session vide | composer une session pour un utilisateur sans historique, et pour un utilisateur qui a tout acquis | 2.7, 4.10 |
| S3 | Ne jamais afficher ce qui donne la réponse d'un exercice | pour chaque question générée, vérifier que la réponse n'apparaît ni en furigana, ni en romaji, ni en traduction | 5.1 |
| S4 | Ne jamais afficher une écriture que l'utilisateur ne sait pas lire, sauf si c'est ce qui est vérifié | comparer la représentation de chaque mot à l'état de ses kana, kanji et du mot | 5.1 |
| S5 | Ne jamais mélanger romaji et japonais sur une même ligne | inspecter chaque phrase d'exercice | 5.1 |
| S6 | Ne jamais modifier un intervalle SRS hors `REVIEW_GRADED` (sauf création et vérification de déclaration) | rejouer un journal et comparer les intervalles | 3.4 |
| S7 | Ne jamais faire reculer un élément autrement que par « Oublié » | rejouer un journal contenant déclarations, tests, erreurs de pratique | 1.8 |
| S8 | Ne jamais changer l'état d'un support | vérifier l'état du mot support avant et après une question de forme | 5.2 |
| S9 | Ne jamais injecter un mot dans une phrase sans exemple transformable ou gabarit compatible | pour chaque question de forme, retrouver la source de la phrase | 5.2 |
| S10 | Ne jamais dépasser le budget quotidien de nouveautés dans les propositions du mode guidé | compter les éléments quittant Nouveau sur une journée, tous écrans confondus, en vérifiant **à la composition, à la reprise et avant chaque bloc de nouveauté** (cas : nouveautés prises dans Pratiquer pendant une session interrompue) | 4.4, 4.7 |
| S11 | Ne jamais poser une question de lecture sur un mot dont un kanji est encore Nouveau | pour chaque question de lecture, vérifier l'état des kanji du mot | 5.3 |

---

## 7.2 Cohérence · critères bloquants

Ce qui doit être **toujours vrai** entre les parties du système.

| # | Critère | Vérification | Réf. |
|---|---|---|---|
| C1 | Un même événement produit le même effet quel que soit l'écran | émettre la même réponse depuis le mode guidé, Pratiquer et un dossier ; comparer les effets | 3.1 |
| C2 | Toute modification du suivi passe par `recordLearningEvent` | recherche dans le code : aucun appel direct à `gradeReview`, au suivi ou aux faiblesses hors du traitement central | 3.10 |
| C3 | L'état recalculé depuis les faits persistés est identique à celui affiché | recalculer l'état de tous les éléments et comparer | 1.4 |
| C4 | Une interaction de révision SRS ne produit qu'un seul événement | compter les événements d'une carte révisée | 3.4 |
| C5 | Purger le journal ne change aucun état | comparer tous les états avant et après compaction | 3.8 |
| C6 | Une session reprise dans les 12 heures conserve les blocs déjà réalisés, reprend au prochain bloc non réalisé, puis réévalue le reste du plan selon les seules règles d'adaptation autorisées | interrompre et reprendre à chaque bloc ; vérifier qu'aucun bloc fait n'est rejoué ni perdu | 4.8 |

---

## 7.3 Qualité pédagogique · critères de qualité

Ce qui distingue une **bonne** session d'une session seulement correcte. Mesurés sur les
sessions d'exemple, puis sur l'usage réel.

| # | Critère | Mesure attendue | Réf. |
|---|---|---|---|
| Q1 | Une nouveauté est **réutilisée** : pratiquée dans la même session, ou rencontrée en contexte dans les suivantes | chaque élément introduit est soit ciblé par au moins une réponse évaluée dans la session, soit réutilisé comme support ou dans un contenu en contexte (R5) ; ceux qui ne l'ont pas été restent prioritaires pour les sessions suivantes | 4.5, R5 |
| Q2 | Les sessions **varient** : pas deux blocs de même effort d'affilée (hors exceptions prévues) | aucune violation sur les sessions d'exemple | 4.5, R6 |
| Q3 | La **durée réelle** reste proche de la **durée annoncée** sur l'accueil | entre 70 % et 120 % de la durée annoncée dans la majorité des sessions. La cible du format n'est pas une promesse : c'est un objectif de composition (R7). Elle reste une **métrique d'observation** : si les sessions longues durent presque toujours bien moins que 25 min, le format Long n'apporte pas ce qu'il annonce | 4.5, R7 |
| Q4 | Les **erreurs sont traitées** dans la session | après 2 erreurs sur un élément, un renforcement a lieu avant la fin de la session (dans la limite de 2) | 4.7 |
| Q5 | La **révision n'envahit pas** la session en zone normale | part de la révision ≤ 35 % du temps en zone normale | 4.6 |
| Q6 | Les **Découverts ne s'accumulent pas** | le nombre de Découverts en attente redescend sous le seuil après une ou deux sessions de consolidation | 4.5 |
| Q7 | Les **types de nouveauté tournent** | sur 10 sessions sans continuité ni déblocage, chaque type disponible est nouveauté principale au moins une fois | 4.5 |
| Q8 | Le **romaji disparaît** au fil de l'apprentissage des kana | la part de phrases d'exercice en romaji baisse à mesure que les kana deviennent lisibles | 5.1 |
| Q9 | Le **déblocage** ouvre effectivement du contenu | une fois la nouveauté choisie pour déblocage suffisamment travaillée (au moins En cours), l'activité qui motivait ce choix devient accessible | 4.5 |

---

## 7.4 Clarté pour l'utilisateur · critères de qualité

| # | Critère | Mesure attendue | Réf. |
|---|---|---|---|
| U1 | « Pourquoi cette session ? » affiche 3 motifs au plus, sans terme technique | aucun mot parmi : SRS, prérequis, taux, état, faiblesse, score | 4.9 |
| U2 | La durée annoncée est arrondie et compréhensible | « ≈ 10 min », jamais « 11 min 37 » | 4.4 |
| U3 | Le retard de révision n'est jamais annoncé par un chiffre culpabilisant | message de rattrapage conforme | 4.6 |
| U4 | Les quatre notes SRS n'apparaissent que dans une vraie révision | inspection des écrans de pratique libre | 3.6 |

---

## 7.5 Robustesse · critères bloquants

| # | Critère | Vérification | Réf. |
|---|---|---|---|
| R1 | Le moteur fonctionne avec un graphe de grammaire incomplet | vider les `requires` de toutes les leçons : les sessions suivent l'ordre de référence | 2.6 |
| R2 | Le moteur fonctionne pour un niveau sans contenu | déclarer N4 : sessions composées avec le contenu restant, puis message de fin de contenu | 6, cas 2 |
| R3 | Un générateur sans candidat est omis sans erreur | forme sans support, « Retrouver le mot » sans distracteurs | 6, cas 5 et 6 |
| R4 | Les données invalides sont signalées avant d'être utilisées | lancer le script de validation sur des données contenant chaque type d'erreur de 2.7 | 2.7 |

---

## 7.6 Utilisation

- **Partie 8** : chaque session d'exemple indique les critères qu'elle met à l'épreuve et le
  résultat obtenu. Un critère bloquant non respecté révèle une erreur à corriger dans les
  parties 1 à 5 ; un critère de qualité non respecté conduit à ajuster un paramètre.
- **Intégration** : les critères bloquants deviennent des tests automatiques, à écrire en même
  temps que le noyau (stratégie de reconstruction).
- **Lacunes de la partie 6** : les arbitrages L1 à L3 sont intégrés à la partie 4 ; les critères
  S2, S10 et C6 en tiennent compte. L4 (stockage) sera couverte par des critères de la
  partie 9.
