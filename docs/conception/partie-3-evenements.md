# Ocha — Moteur guidé v1

## Partie 3 · Journal d'événements et état utilisateur

**Statut** : 🔒 verrouillée (version 2). Les valeurs chiffrées sont des
paramètres de la v1 (3.11).

**Objet** : définir comment Ocha enregistre ce que fait l'utilisateur, et comment ces
enregistrements font évoluer son état (partie 1), son SRS et ses faiblesses.

**Partage des rôles avec la partie 4** :

- **Partie 3** : « Que signifie ce que vient de faire l'utilisateur ? » Elle fixe **toutes**
  les conséquences pédagogiques d'une action, pour tous les écrans : mode guidé, Pratiquer,
  Réviser, dossiers, missions, lectures.
- **Partie 4** : « Compte tenu de ce qu'on sait de lui, que lui proposer maintenant ? » Le
  moteur guidé **lit** l'état, le SRS, les faiblesses et le journal ; il ne décide jamais,
  après coup, de la valeur d'une réponse.

**S'appuie sur** : partie 1 (éléments, cinq états, cible, origine), partie 2 (références
`{ type, id }`, identifiants de questions).

**Sources vérifiées** : `srs.js` (`gradeReview`, `recordReviewEvent`, statistiques
`kanji_trad_stats`), `weakness.js` (`updateWeaknessTracking`, `computeWeaknessPriority`),
`storage.js` (clés de stockage).

---

## 3.1 Principes

1. **Un seul point d'entrée.** Toute activité signale ce qui s'est passé par une fonction
   unique, `recordLearningEvent(event)`. Aucun écran, aucun module n'écrit directement dans
   le suivi, le SRS ou les faiblesses.
2. **Aucun mode n'a sa propre progression.** Le mode guidé, Pratiquer, Réviser, les
   dossiers, les missions et les lectures produisent les mêmes types d'événements. C'est le
   **contexte** de l'événement qui change, et c'est le traitement central qui l'interprète.
3. **Événement ≠ état.** L'événement dit **ce qui s'est passé**. Son traitement met à jour les
   **faits persistés** (suivi, SRS, faiblesses) ; l'état pédagogique en est **déduit**
   (partie 1). Le journal garde l'historique ; il n'est pas la source de l'état.
4. **Un journal d'apprentissage, pas de navigation.** On n'enregistre ni les clics, ni les
   ouvertures d'écran, ni la consultation d'une fiche.
5. **Une performance n'est pas une notation.** `QUESTION_ANSWERED` enregistre une réponse à
   une question. `REVIEW_GRADED` enregistre une notation SRS explicite. **Une réponse
   incorrecte ne vaut jamais, à elle seule, une note « Oublié ».**

---

## 3.2 Format commun d'un événement

```js
{
  id: "evt_…",                 // identifiant unique
  type: "QUESTION_ANSWERED",   // voir 3.3
  at: "2026-09-28T18:42:10Z",  // horodatage
  sessionId: "ses_…",          // si l'événement a lieu dans une session guidée
  context: {
    mode: "free",              // comment l'utilisateur est arrivé là
    source: "explore",         // depuis quel endroit de l'app
    activityType: "mission",   // ce qu'il est en train de faire
    activityId: "n5_m_1",      // optionnel
    folderId: "fld_…",         // optionnel
    exerciseType: "qcm"        // optionnel
  },
  payload: { … }               // propre à chaque type
}
```

Le contexte sépare trois informations distinctes, pour qu'un même champ ne veuille pas dire
tantôt « comment je suis arrivé ici », tantôt « ce que je fais » :

| Champ | Sens | Valeurs |
|---|---|---|
| `mode` | comment l'activité a été lancée | `guided` (session du mode guidé), `free` (choisie par l'utilisateur) |
| `source` | d'où | `home`, `learn`, `library`, `explore`, `read`, `practice`, `review`, `folder`, `fiche`, `onboarding`, `settings` |
| `activityType` | ce que fait l'utilisateur | `lesson`, `mission`, `reading`, `quiz`, `writing`, `speaking`, `srs_review`, `placement`, `declaration` |

Une même mission peut ainsi être `mode: guided` (dans une session guidée) ou `mode: free`
(lancée depuis Explorer), avec le même `activityType: mission`.

**`exerciseType`** : `flashcard`, `self_report` (« Je savais / Je ne savais pas »), `qcm`,
`cloze` (texte à trous), `writing`, `speaking`, `comprehension`, `naturalness`, `register`.
Il est enregistré pour les statistiques et les évolutions futures. **Il ne change pas les
conséquences d'une réponse** : une question qui cible un élément et dont la réponse est
évaluée a les mêmes effets, qu'il s'agisse d'un QCM, d'un tracé ou d'une prononciation.

Les éléments sont toujours référencés sous la forme `{ type, id }` (partie 2).

## 3.3 Les types d'événements de la v1

| Type | Émis quand | `payload` |
|---|---|---|
| `SESSION_STARTED` | une session guidée commence | `sessionType` (courte, normale, longue), `plannedMinutes`, `plan` (activités prévues) |
| `SESSION_COMPLETED` | elle se termine | `actualMinutes`, `completedActivities` |
| `SESSION_ABANDONED` | elle n'est pas reprise dans un délai donné (partie 4) | `lastActivity`, `actualMinutes` |
| `ACTIVITY_STARTED` | une activité commence | `activityId`, `activityType` |
| `ACTIVITY_COMPLETED` | elle se termine | `activityId`, `activityType`, `durationSeconds`, `score` éventuel |
| `ACTIVITY_SKIPPED` | l'utilisateur passe une étape du mode guidé | `activityId`, `activityType` |
| `CONTENT_INTRODUCED` | un élément du `teaches` d'une activité est présenté | `element` |
| `QUESTION_ANSWERED` | une question est répondue | `questionId`, `target` (éléments), `correct`, `answer` |
| `REVIEW_GRADED` | une révision SRS est notée | `element`, `quality` (0 à 3) |
| `REINFORCEMENT_TRIGGERED` | le moteur insère un renforcement | `element`, `reason` (`error`, `weakness`, `forgotten`), `sourceActivity` |
| `KNOWLEDGE_DECLARED` | choix de niveau, test validé, « Je le connais déjà » | `elements` ou `scope` (niveau, kana), `origin` (`declared`, `tested`), `declarationId` |
| `KNOWLEDGE_DECLARATION_UNDONE` | l'utilisateur annule une déclaration | `declarationId` |

Rien d'autre n'est journalisé en v1.

---

## 3.4 Effets de chaque événement

Le traitement central applique ces effets, **quel que soit le mode**, sauf mention contraire.

### `CONTENT_INTRODUCED`

- Si l'élément n'a pas de date d'introduction : on l'enregistre. Nouveau → **Découvert**.
- Aucun effet sur le SRS ni les faiblesses.

### `QUESTION_ANSWERED`

Pour **chaque élément de la cible** :

1. **Première évaluation** (élément Nouveau ou Découvert) : l'élément reçoit sa date
   d'introduction s'il n'en a pas, et une **entrée SRS initiale**, avec une **première
   vérification à J+1** (valeur de la v1, 3.11). Il passe **En cours**. C'est vrai que la
   réponse soit juste ou fausse, et quel que soit le type d'exercice (partie 1).
2. **Faiblesse** : réponse fausse → la faiblesse augmente ; réponse juste → elle diminue
   (3.5).
3. **SRS** : **aucun effet** au-delà de la création initiale. Une réponse à une question,
   juste ou fausse, ne modifie jamais un intervalle.

**Exception : le test de positionnement** (`activityType: placement`). Les réponses sont
journalisées mais n'ont **aucun effet** sur l'état, le SRS ou les faiblesses : un débutant qui
rate une question du test ne doit pas se retrouver avec un mot « En cours ». Le résultat du
test est appliqué d'un bloc par `KNOWLEDGE_DECLARED` (origine `tested`).

### `REVIEW_GRADED`

Émis **uniquement** dans une vraie révision SRS (`activityType: srs_review`) : l'onglet
Réviser, et les étapes de révision du mode guidé. Ailleurs, les écrans n'affichent pas les
quatre notes (3.6).

**Une interaction de révision SRS ne produit que `REVIEW_GRADED`**, jamais en plus un
`QUESTION_ANSWERED`. Sans cette règle, une même carte ratée alimenterait deux fois les
faiblesses. En v1, les révisions SRS sont des flashcards auto-évaluées. Si un jour une
révision utilise un exercice corrigé automatiquement, sa correction sera convertie en note,
et seul `REVIEW_GRADED` sera émis.

1. **SRS** : calcul de `gradeReview`, inchangé (qualité 0 Oublié, 1 Difficile, 2 Bien,
   3 Facile). L'état est recalculé : une note « Oublié » ramène un élément Acquis ou Maîtrisé
   à En cours (partie 1).
2. **Vérification** : si l'élément a l'origine `declared` ou `tested` et n'a pas encore été
   vérifié, il est marqué **vérifié**, quelle que soit la note.
3. **Faiblesse** : Oublié → augmente ; Bien ou Facile → diminue ; Difficile → inchangée.

### `KNOWLEDGE_DECLARED`

Pour chaque élément concerné **qui n'est pas déjà Acquis ou Maîtrisé** :

- date d'introduction si absente ;
- origine `declared` ou `tested`, non vérifié ;
- entrée SRS de vérification : échéance entre 21 et 45 jours, répartie de façon
  déterministe (partie 1), avec un nombre de répétitions qui place l'élément en **Acquis**.

Un élément déjà Acquis ou Maîtrisé n'est **pas touché** : une déclaration ne fait jamais
reculer. Les faits précédents des éléments modifiés sont conservés avec la déclaration, pour
permettre l'annulation.

### `KNOWLEDGE_DECLARATION_UNDONE`

Les éléments modifiés par la déclaration retrouvent leurs faits précédents, **sauf ceux qui
ont été révisés depuis** : leurs révisions réelles priment.

### `SESSION_…`, `ACTIVITY_…`, `REINFORCEMENT_TRIGGERED`

Aucun effet sur l'état, le SRS ou les faiblesses. Ils mettent à jour l'**avancement** des
activités (3.7) et nourrissent l'historique dont le moteur se sert (partie 4).

### Synthèse

| Situation | État | SRS | Faiblesse |
|---|---|---|---|
| Présentation d'un élément enseigné | Nouveau → Découvert | — | — |
| Première évaluation, juste | → En cours | création, vérification à J+1 | diminue (si existante) |
| Première évaluation, fausse | → En cours | création, vérification à J+1 | augmente |
| Réponse juste, hors révision SRS | inchangé | inchangé | diminue |
| Réponse fausse, hors révision SRS | inchangé | inchangé | augmente |
| Révision SRS, Bien ou Facile | recalculé | `gradeReview` | diminue |
| Révision SRS, Difficile | recalculé | `gradeReview` | inchangée |
| Révision SRS, Oublié | → En cours si Acquis ou Maîtrisé | `gradeReview` | augmente |
| Réponse au test de positionnement | — | — | — |
| Déclaration ou test validé | → Acquis (sauf déjà Acquis ou Maîtrisé) | vérification à 21–45 jours | — |

---

## 3.5 Faiblesses

### Aujourd'hui

`updateWeaknessTracking` enregistre `consecutiveFails`, `totalFails`, `lastFailDate`, et
**supprime l'entrée à la première réussite**. Un élément raté trois fois puis réussi une
fois cesse d'être considéré comme fragile.

### Demain

La faiblesse **diminue progressivement**, et une faiblesse résolue devient **inactive** au lieu
d'être supprimée :

| Événement | Effet |
|---|---|
| Échec | `consecutiveFails` + 1, `totalFails` + 1, `lastFailDate` mise à jour, `successStreak` remis à 0 ; une faiblesse inactive est **réactivée** |
| Réussite | `consecutiveFails` − 1 (minimum 0), `successStreak` + 1 |
| Résolution | quand `consecutiveFails` vaut 0 **et** `successStreak` atteint 3 : la faiblesse devient **inactive** (`resolvedAt` renseignée) |

**Pourquoi inactive plutôt que supprimée** : un élément raté trois fois puis réussi trois fois
et un élément raté une seule fois ne sont pas équivalents. Garder l'entrée conserve
`totalFails` et les dates. La partie 4 pourra en tenir compte (par exemple, surveiller un
élément qui a déjà été fragile), sans qu'il figure parmi les faiblesses actives.

`computeWeaknessPriority` est conservée pour les faiblesses **actives** : elle combine déjà
échecs consécutifs (poids fort), échecs totaux (poids faible) et récence. La baisse de
`consecutiveFails` fait donc baisser la priorité progressivement. Les faiblesses inactives
n'apparaissent ni dans le tableau des faiblesses ni dans les renforcements.

Le seuil de 3 réussites est un paramètre **expérimental** de la v1 (3.11).

## 3.6 Ce que ça change à l'interface

- **Réviser** et les étapes de révision du mode guidé : « Comment t'en es-tu souvenu ? »
  **[Oublié] [Difficile] [Bien] [Facile]** → `REVIEW_GRADED`.
- **Pratique libre** (Pratiquer, dossiers, fiches) en flashcards : « Comment ça s'est passé ? »
  **[Je savais] [Je ne savais pas]** → `QUESTION_ANSWERED`, type `self_report`.
- Les quatre notes SRS n'apparaissent **jamais** hors d'une vraie révision SRS, pour ne pas
  laisser croire à l'utilisateur qu'il modifie sa planification.

### Écrans et événements

| Écran | Événements |
|---|---|
| Réviser | `REVIEW_GRADED` |
| Pratiquer (quiz, écriture, oral, naturel, registre) | `QUESTION_ANSWERED` |
| Dossier : quiz ou révision | `QUESTION_ANSWERED` (`source: folder`) |
| Leçon de grammaire | `CONTENT_INTRODUCED` à la présentation, `QUESTION_ANSWERED` aux exercices |
| Mission | `ACTIVITY_…`, `CONTENT_INTRODUCED` à l'étape Mots et Expressions, `QUESTION_ANSWERED` aux exercices |
| Lecture | `ACTIVITY_…`, `CONTENT_INTRODUCED` pour les mots du `teaches`, `QUESTION_ANSWERED` aux questions de compréhension |
| Mode guidé | `SESSION_…`, `ACTIVITY_…`, `ACTIVITY_SKIPPED`, `REINFORCEMENT_TRIGGERED`, et ceux des activités qu'il enchaîne |
| Test de positionnement | `QUESTION_ANSWERED` (sans effet), puis `KNOWLEDGE_DECLARED` |
| Premier lancement, paramètres, fiche (« Je le connais déjà ») | `KNOWLEDGE_DECLARED`, `KNOWLEDGE_DECLARATION_UNDONE` |
| Fiche, recherche, bibliothèque (consultation) | aucun |

**Deux comportements actuels disparaissent** : la maîtrise automatique après une
prononciation réussie (`oral.js`) ou un tracé propre (`markMastered`). Ce sont désormais des
`QUESTION_ANSWERED` de type `speaking` et `writing`, comme les autres.

---

## 3.7 L'état utilisateur : ce qui est persisté

| Donnée | Contenu | Mis à jour par |
|---|---|---|
| Suivi des éléments | par élément : date d'introduction, origine, vérifié, entrée SRS | traitement des événements |
| Faiblesses | par élément : échecs consécutifs et totaux, série de réussites, dernier échec, date de résolution | traitement des événements |
| Avancement des activités | missions, lectures, leçons : non commencée, en cours (étape atteinte), terminée (date) | `ACTIVITY_…` |
| Session guidée en cours | plan, position, activités faites, contexte (pour « Reprendre ») | moteur guidé |
| Mission en cours | étape atteinte, répliques affichées, exercice en cours | écran de mission |
| Déclarations | niveau déclaré, trace des déclarations pour l'annulation | `KNOWLEDGE_DECLARED` |
| Paramètres | affichage, apparence, rythme, audio | écran Paramètres |
| Dossiers | contenus, dossier « À revoir » | écran Dossiers |
| Journal | événements récents et résumés (3.8) | `recordLearningEvent` |

**Ce qui n'est pas persisté, mais calculé** : l'état pédagogique, les taux de couverture des
prérequis, les éléments dus, la priorité des faiblesses, la régularité.

Les clés de stockage prennent le préfixe `ocha_` (aucune donnée ancienne à conserver).

---

## 3.8 Le journal : taille et conservation

`localStorage` est limité à environ 5 Mo pour tout le site. Un événement pèse de l'ordre de
200 à 300 octets ; un utilisateur actif en produit plusieurs centaines par jour.

**Deux niveaux de conservation** :

1. **Détail complet** des événements des **30 derniers jours**, avec un plafond de
   **5 000 événements** (environ 1,5 Mo au maximum). Au-delà, les plus anciens sont résumés.
2. **Résumé quotidien** au-delà : par jour, nombre de réponses justes et fausses par mode et
   par type d'exercice, activités terminées, minutes d'apprentissage. Environ 100 octets
   par jour, soit moins de 40 Ko par an.

Le résumé quotidien fournit aussi l'historique de **régularité** de l'accueil, qui n'existe
pas aujourd'hui (les statistiques actuelles ne comptent que des totaux et le mois en cours).

**L'état ne dépend jamais du journal** : les faits (suivi, SRS, faiblesses) sont mis à jour au
moment de l'événement et conservés à part. Résumer ou purger le journal ne fait rien perdre
à l'état. Le journal sert au moteur (éléments récemment introduits, erreurs récentes,
sessions abandonnées) et aux statistiques.

Les valeurs de 30 jours et 5 000 événements sont des paramètres de la v1 (3.11).

---

## 3.9 Le traitement central

```
Écran ou module
      │  recordLearningEvent(event)
      ▼
 1. validation      (type connu, éléments existants, cible présente)
 2. journal         (ajout au détail, résumé si nécessaire)
 3. effets          (suivi, SRS, faiblesses, avancement : 3.4 et 3.5)
 4. notification    (moteur guidé, accueil, écrans concernés)
```

- Les étapes 2 et 3 réussissent ou échouent **ensemble** : un événement n'est jamais
  journalisé sans ses effets, ni l'inverse.
- `gradeReview` et `updateWeaknessTracking` ne sont plus appelées par les écrans : elles
  deviennent des fonctions internes de l'étape 3.
- Un événement invalide est rejeté et signalé en console, sans casser l'écran qui l'a émis.

---

## 3.10 Invariants de cette partie

1. Toute modification du suivi, du SRS ou des faiblesses passe par `recordLearningEvent`.
2. Seul `REVIEW_GRADED` modifie un intervalle SRS, en dehors de la création initiale et de la
   vérification d'une déclaration.
3. `REVIEW_GRADED` n'est émis que dans une vraie révision SRS.
4. Une réponse incorrecte n'équivaut jamais à une note « Oublié ».
5. Les réponses au test de positionnement n'ont aucun effet direct.
6. Un même événement a le même effet quel que soit l'écran qui l'émet ; seul son contexte,
   explicitement prévu en 3.4, peut changer son effet.
7. Purger ou résumer le journal ne modifie jamais l'état.
8. La consultation (fiche, recherche, bibliothèque) ne produit aucun événement.
9. Une interaction de révision SRS ne produit que `REVIEW_GRADED` : ses effets sur les
   faiblesses ne sont jamais comptés deux fois.
10. Le type d'exercice ne change pas les conséquences d'une réponse évaluée ; le moteur guidé
    ne réinterprète jamais la valeur d'une réponse.

---

## 3.11 Paramètres de la v1

Ils rejoignent la configuration unique définie en partie 2 :

```js
const GUIDED_CONFIG = {
  // … paramètres des parties 1 et 2
  firstCheckDelayDays: 1,          // première vérification après une première évaluation
  weaknessResolveStreak: 3,        // réussites d'affilée pour rendre une faiblesse inactive
  journal: {
    detailDays: 30,                // détail complet conservé
    maxDetailedEvents: 5000        // plafond du détail
  }
};
```

## Décisions de cette partie

| Point | Décision |
|---|---|
| Un seul point d'entrée, aucun mode n'a sa propre progression | validé |
| Partie 3 interprète, partie 4 choisit | validé |
| `QUESTION_ANSWERED` ≠ `REVIEW_GRADED` ; une erreur ne vaut jamais « Oublié » | validé |
| Une révision SRS ne produit que `REVIEW_GRADED` | validé |
| Contexte séparé en `mode`, `source`, `activityType` | validé |
| Première vérification à J+1 | validé, paramètre v1 |
| Faiblesse progressive, inactive après 3 réussites | validé, paramètre expérimental v1 |
| Test de positionnement sans effet direct | validé |
| Journal : 30 jours / 5 000 événements, résumé quotidien | validé, paramètre v1 |

## Conséquences pour la suite

- **Partie 4** : délai au-delà duquel une session est considérée comme abandonnée ; usage
  des faiblesses (actives et inactives), des éléments récemment introduits et des sessions
  abandonnées dans les choix du moteur.
- **Intégration** : les écrans actuels qui appellent `gradeReview`, `trackItem` ou
  `updateWeaknessTracking` directement devront passer par `recordLearningEvent`.
