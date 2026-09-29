# Ocha — Moteur guidé v1

## Partie 6 · Cas limites

**Statut** : 🔒 verrouillée (version 3). Arbitrages L1 à L3 validés et intégrés à la partie 4 ;
L4 renvoyée à la partie 9.

**Objet** : éprouver les parties 1 à 5 sur des situations inhabituelles. **Cette partie
n'ajoute pas de règle** : pour chaque cas, elle vérifie ce que les règles existantes
produisent.

Chaque cas reçoit un verdict :

| Verdict | Sens |
|---|---|
| ✅ Couvert | les règles existantes donnent un comportement correct |
| 🟡 Lacune | les règles ne disent pas quoi faire : le moteur devrait décider arbitrairement |
| 🔴 Contradiction | deux règles existantes se contredisent |

Les lacunes et contradictions sont rassemblées en fin de document (6.7), avec une
proposition de résolution **à arbitrer**. Aucune n'est intégrée aux parties verrouillées
sans décision.

---

## 6.1 Démarrage

### Cas 1 · Débutant complet, première session

Aucun historique, aucun kana connu, choix « Je débute ».

- **Ouverture** : rien de dû, aucune faiblesse → pas d'ouverture (4.5).
- **Bloc Kana** : oui, l'utilisateur a choisi « Je débute » (4.5).
- **Nouveauté principale** : pas de continuité ; pas de déblocage (la mission `n5_m_1`
  requiert です **et** か : aucune leçon n'est « la seule raison ») ; rotation des types :
  **aucun type n'a jamais été nouveauté principale**. Les quatre types sont à égalité.
- **Représentation** : aucun kana lisible → romaji (5.1).

**Verdict initial : 🟡 lacune L1.** La rotation n'avait pas de règle de départage quand plusieurs
types sont à égalité, ce qui est toujours le cas à la première session.
**Résolution : ✅ couvert** par l'arbitrage L1, intégré en 4.5 (départage grammaire,
vocabulaire, expressions, kanji). Le débutant commence par です.

### Cas 2 · Niveau déclaré N4, sans contenu au-delà

L'utilisateur choisit « Ce que je connais déjà : N4 ». N5 et N4 passent Acquis (déclaré), le
parcours doit démarrer au N3, qui n'a pas de contenu.

- Les vérifications tombent entre 21 et 45 jours : **rien n'est dû pendant trois semaines**.
- Grammaire, vocabulaire et kanji N5/N4 sont Acquis : pas de nouveauté de ces types.
- Restent Nouveaux : les **expressions** et les **mots hors JLPT**, qui n'appartiennent à aucun
  niveau. Missions et lectures sont accessibles (leurs prérequis sont Acquis), non terminées.

Le moteur compose donc : nouveauté Expressions, appui en mots hors JLPT, pratique, contexte
(missions et lectures). Quand tout est épuisé, la règle de 4.10 s'applique (« Tu as fait le
tour du contenu disponible »).

**Verdict : ✅ couvert.** À noter : pendant trois semaines, ces sessions reposeront sur peu de
contenu. C'est une conséquence du manque de contenu N3, pas du modèle.

### Cas 3 · Test de positionnement entièrement réussi

Le test s'arrête faute de données au-delà du N4 et indique « N4 ou plus » (comportement
prévu par la maquette v4). Ses réponses n'ont pas d'effet direct ; le résultat est appliqué
par une déclaration d'origine `tested` (partie 3).

**Verdict : ✅ couvert.** Même situation que le cas 2 ensuite.

---

## 6.2 Données incomplètes

### Cas 4 · Leçons de grammaire sans `requires`

Le graphe n'est rempli que pour une partie des 75 leçons.

Une leçon sans `requires` n'a pas de prérequis mais reste placée par l'ordre de référence
(2.6). Le moteur fonctionne ; il suit l'ordre actuel là où le graphe manque.

**Verdict : ✅ couvert.**

### Cas 5 · Une forme sans support possible

On veut pratiquer 〜ました, mais aucun verbe n'est au moins En cours (l'utilisateur n'a appris
que des noms).

Le générateur de formes ne trouve aucun support (5.2) : il ne produit pas de question. Le
bloc Pratique utilise les autres exercices de la leçon (exercices rédigés, texte à trous).
C'est l'application du principe « un rôle ou un générateur sans candidat est omis ».

**Verdict : ✅ couvert**, par le principe général. Une phrase le rendant explicite en 5.2
serait utile à l'implémentation, sans changer la règle.

### Cas 6 · « Retrouver le mot » sans distracteurs connus

Un débutant ne connaît que deux mots : impossible de proposer trois distracteurs connus
(5.3).

Le générateur ne produit pas de question ; un autre générateur est utilisé.

**Verdict : ✅ couvert**, même principe.

### Cas 7 · Mot de vocabulaire mal classé

結婚 est classé `verbe` / `suru` alors que c'est un nom. Le générateur de formes produirait
« 結婚ました ».

Le script de validation (2.7, addendum 2.10) signale les valeurs de `group` incohérentes, et
le nettoyage est prévu avant usage.

**Verdict : ✅ couvert**, à condition que le nettoyage soit fait avant l'intégration du
générateur de formes.

---

## 6.3 Sessions

### Cas 8 · Session interrompue, reprise tardive

L'utilisateur commence à 10 h, s'arrête après 2 minutes, revient à 23 h.

Plus de 12 heures depuis la dernière activité : la session est close (`SESSION_ABANDONED`),
une nouvelle est composée avec l'état du moment. Les effets des blocs faits sont acquis
(4.8).

**Verdict : ✅ couvert.**

### Cas 9 · Nouveautés prises ailleurs pendant une session en cours

L'utilisateur commence une session guidée (nouveauté : 6 mots), s'interrompt, découvre
30 mots dans Pratiquer, puis reprend la session.

Le budget quotidien est vérifié **à la composition** (4.4). À la reprise, le plan contient
encore des nouveautés alors que le budget est épuisé. L'adaptation en cours de session (4.7)
réexamine le plan après chaque bloc, mais seulement pour le renforcement, le temps et les
étapes passées : **pas pour le budget**.

**Verdict initial : 🟡 lacune L2.**
**Résolution : ✅ couvert** par l'arbitrage L2, intégré en 4.7 et 4.8 (budget revérifié à la
reprise et avant chaque bloc de nouveauté).

### Cas 10 · Nouveauté passée à chaque session

L'utilisateur passe systématiquement la nouveauté principale (« Passer cette étape »).

L'élément passé reste Nouveau. À la session suivante, la rotation des types choisit le type
« nouveauté principale le moins récemment ». **Rien ne dit si une nouveauté passée compte
comme ayant été nouveauté principale.** Si elle ne compte pas, le moteur repropose
indéfiniment le même type, souvent le même élément.

**Verdict initial : 🟡 lacune L3.**
**Résolution : ✅ couvert** par l'arbitrage L3, intégré en 4.5 et 4.7 (une nouveauté passée
compte pour la rotation, reste Nouvelle et ne consomme aucun budget).

### Cas 11 · Retour après deux mois d'absence

300 cartes dues, format normal (quota de 10 cartes).

Zone massive (dues > 3 × le quota) : pas de nouveauté, sessions de révision et de
renforcement, l'accueil propose l'onglet Réviser pour le reste (4.6). Au rythme d'une session
guidée par jour, le rattrapage par le seul mode guidé prendrait un mois.

**Verdict : ✅ couvert.** Le renvoi vers Réviser est le bon comportement ; la durée du
rattrapage sera à observer (partie 8).

### Cas 12 · Toutes les cartes de l'ouverture sont oubliées

Plusieurs éléments Acquis reçoivent « Oublié » : ils redescendent En cours (partie 1), leurs
faiblesses augmentent (partie 3), ils réapparaissent dans le même bloc (`scheduleRelearning`).
Pas de renforcement déclenché par une carte oubliée (4.7). À la session suivante, s'il n'y a
rien de dû, l'ouverture prend un renforcement sur la faiblesse la plus prioritaire.

**Verdict : ✅ couvert.**

---

## 6.4 Affichage

### Cas 13 · L'exercice vérifie la lecture d'un mot illisible pour l'utilisateur

« Comment se lit 食べる ? » pour un utilisateur qui ne lit pas encore 食.

La règle 1 de 5.1 (ne pas donner la réponse) prime : le mot est affiché en kanji, sans
furigana ; c'est précisément ce qui est vérifié. Les choix sont en kana, s'ils sont lisibles.

**Verdict : ✅ couvert** pour la **représentation** : afficher 食 sans aide est permis, puisque
c'est ce qui est vérifié.

Mais cela ne dit pas si la **cible** est raisonnable : a-t-on une raison de demander la lecture
d'une écriture jamais introduite ? Ocha ne doit pas exploiter l'exception « c'est ce qui est
vérifié » pour fabriquer des questions impossibles. **Ce cas est ajouté au crash-test de la
partie 8**, sans rouvrir la partie 5.

### Cas 14 · Un kana devient faible en pleine session

L'utilisateur rate plusieurs fois か. か n'est plus lisible (faiblesse active) : les mots qui le
contiennent repassent en romaji dans les exercices suivants.

**Verdict : ✅ couvert.** C'est l'effet voulu de la condition « sans faiblesse active ».

### Cas 15 · Réglage « romaji désactivé » pour un débutant

L'utilisateur a coupé le romaji, mais ne lit encore aucun kana.

Dans les exercices, la capacité de lecture passe avant les réglages (5.1) : le romaji est
affiché. Hors exercices, le réglage s'applique : les fiches sont en japonais sans romaji.

**Verdict : ✅ couvert.** Comportement assumé : hors exercices, c'est le choix de
l'utilisateur.

---

## 6.5 Événements et état

### Cas 16 · Annulation d'une déclaration après des révisions

L'utilisateur déclare N5, révise quelques éléments pendant un mois, puis annule.

Les éléments retrouvent leur état antérieur, sauf ceux révisés depuis : leurs révisions réelles
priment (partie 3).

**Verdict : ✅ couvert.**

### Cas 17 · Révision d'un dossier sur une carte due

Une carte due est vue dans la révision libre d'un dossier (« Je savais »).

`QUESTION_ANSWERED` sans effet sur le SRS (partie 3) : la carte reste due et réapparaît dans
Réviser.

**Verdict : ✅ couvert.** Comportement assumé : seule une vraie révision fait avancer le SRS.

### Cas 18 · Déclaration de niveau et phases du naturel

Un utilisateur déclare N4. Ses leçons N5 sont Acquis, donc plus de 60 % sont « au moins En
cours » : il est directement en **phase 3** du naturel (5.4).

**Verdict : ✅ couvert.** Cohérent : il a déclaré connaître ce niveau.

### Cas 19 · Stockage plein

`localStorage` refuse une écriture (quota atteint, navigation privée restrictive).

La partie 3 impose que journal et effets réussissent ou échouent **ensemble** (3.9), mais ne
dit pas ce que voit l'utilisateur ni comment Ocha réagit : l'événement est-il perdu,
réessayé, l'utilisateur prévenu ?

**Verdict : 🟡 lacune L4, reportée** à l'architecture technique (partie 9) : elle ne relève pas
du modèle pédagogique.

---

## 6.6 Bilan

| Résultat | Nombre |
|---|---|
| ✅ Couverts dès les règles initiales | 15 |
| 🟡 → ✅ Lacunes identifiées puis résolues (L1, L2, L3) | 3 |
| 🟡 Lacune reportée à l'architecture (L4) | 1 |
| 🔴 Contradiction | 0 |

Aucune contradiction : les règles des parties 1 à 5 ne se contredisent pas sur ces cas.
Les lacunes étaient des décisions manquantes, pas des erreurs de conception.

---

## 6.7 Lacunes à arbitrer

### L1 · Départage de la rotation des types (cas 1) · ✅ validée

Quand plusieurs types sont à égalité (toujours le cas à la première session), lequel choisir ?

**Proposition** : départager dans l'ordre **grammaire, vocabulaire, expressions, kanji**. La
grammaire en premier donne au débutant la structure de base (です) ; les kanji en dernier,
parce qu'ils s'appuient de préférence sur des mots déjà connus (partie 4).

*Intégrée à la partie 4 (4.5, rôle 2), comme simple règle de départage.*

### L2 · Budget quotidien à la reprise d'une session (cas 9) · ✅ validée

**Proposition** : à la reprise d'une session, et avant chaque bloc de nouveauté, le moteur
revérifie le budget. S'il est épuisé, les blocs de nouveauté **non commencés** sont retirés du
plan ; un bloc commencé est terminé. La session continue avec pratique, contexte et révision.

*Intégrée à la partie 4 (4.7 et 4.8).*

### L3 · Nouveauté passée et rotation (cas 10) · ✅ validée

**Décision** : une nouveauté principale passée **compte pour la rotation** (la rotation
mémorise le dernier type *proposé*, pas le dernier type appris), mais **l'élément reste
Nouveau et ne consomme aucun budget**. Le type suivant est proposé à la session d'après ;
l'élément passé redeviendra candidat plus tard.

*Intégrée à la partie 4 (4.5, rôle 2, et 4.7).*

### L4 · Échec d'écriture du stockage (cas 19) · ➡️ partie 9

**Principe minimal** : ne jamais perdre silencieusement un événement ; l'échec de
persistance doit être **détecté et rendu visible**. La stratégie de reprise, les nouvelles
tentatives et un éventuel blocage de la session sont définis en partie 9 : continuer une
session dont la progression ne peut plus être enregistrée ferait perdre tout le travail au
prochain lancement.

*Partie concernée : 9 (architecture).*
