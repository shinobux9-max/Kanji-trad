# Ocha — Moteur guidé v1

## Partie 4 · Sélection et composition de la session guidée

**Statut** : 🔒 verrouillée (version 5 : arbitrages L1 à L3 de la partie 6 et O1 à O7 de la
partie 8 intégrés). Les valeurs chiffrées sont des
paramètres expérimentaux de la v1 (4.11), à éprouver par les sessions d'exemple (partie 8).

**Objet** : répondre à la question centrale d'Ocha, « qu'est-ce qui serait le plus utile de
faire maintenant ? ». Cette partie décrit comment le moteur construit une session, puis
l'adapte pendant qu'elle se déroule.

**Rôle** (partie 3) : le moteur **lit** l'état, le SRS, les faiblesses et le journal. Il ne
modifie jamais lui-même le suivi ; les activités qu'il enchaîne émettent leurs événements
comme partout ailleurs.

**S'appuie sur** : partie 1 (cinq états), partie 2 (accessibilité, ordre de référence, règle
de secours), partie 3 (événements, faiblesses actives et inactives, journal).

**Regroupe** ce que le découpage initial séparait en « règles du moteur » et « formats de
session » : les deux sont indissociables, la composition dépend du temps disponible.

---

## 4.1 Principe : un générateur de session sous contraintes

Le moteur ne suit pas une playlist. Il construit une session en quatre temps :

```
État de l'utilisateur
        ↓
1. Candidats      quelles activités existent ?
        ↓
2. Accessibilité  lesquelles peut-on proposer ? (partie 2)
        ↓
3. Priorité       lesquelles sont utiles maintenant ?
        ↓
4. Composition    lesquelles tiennent dans le temps disponible, dans quel ordre ?
        ↓
Plan de session → déroulement → adaptation (4.7)
```

**La session est planifiée, puis adaptée.** Le plan n'est pas sacré : une difficulté, une
étape passée ou un dépassement de temps le modifient en cours de route.

### Les sept règles de la v1

| Règle | Énoncé |
|---|---|
| R1 · Accessibilité | ne proposer que du contenu accessible selon `requires` (partie 2) |
| R2 · Continuité | privilégier ce qui prolonge le travail récent |
| R3 · Révision | intégrer les cartes dues, sans que la session devienne une séance de révision |
| R4 · Faiblesse | renforcer ce qui pose problème, dès qu'une difficulté apparaît |
| R5 · Réutilisation | après une nouveauté, la faire pratiquer ou la faire rencontrer en contexte |
| R6 · Variété | alterner les types d'effort, pas deux blocs de même nature d'affilée |
| R7 · Temps | viser la durée demandée, sans la remplir artificiellement |

---

## 4.2 Ce que le moteur lit

Au moment de composer, le moteur prend un instantané :

| Information | Source |
|---|---|
| État de chaque élément | calculé (partie 1) |
| Cartes dues, dont celles en retard | SRS |
| Faiblesses actives et leur priorité | `computeWeaknessPriority` (partie 3) |
| **Éléments récents** : introduits ou passés En cours depuis moins de 7 jours | suivi + journal |
| **Découverts en attente** : éléments Découverts jamais pratiqués | suivi |
| Nouveaux éléments déjà introduits aujourd'hui, tous écrans confondus | journal |
| Activités en cours ou terminées (leçons, missions, lectures) | avancement (partie 3) |
| Session guidée en cours, non terminée | état utilisateur |
| Point de départ du parcours (niveau déclaré ou testé) | déclarations |
| Format de session choisi | paramètres (Rythme) |

---

## 4.3 Les blocs

Une session est une suite de **blocs**. Chaque bloc réutilise un module existant ; le moteur
n'en crée aucun.

| Bloc | Contenu | Effort | Durée estimée |
|---|---|---|---|
| **Révision** | cartes SRS dues (flashcards) | rappel | ≈ 12 s par carte |
| **Notion** | leçon de grammaire : présentation, exemples, exercice | découverte | `estimated_minutes` de la leçon (4 min par défaut) |
| **Expressions** | expressions nouvelles : variantes, qui la dit, réponse, puis exercice de registre | découverte | ≈ 60 s par expression |
| **Mots** | lot de mots nouveaux : présentation puis QCM | découverte | ≈ 45 s par mot |
| **Kanji** | kanji nouveaux : présentation puis tracé | production | ≈ 90 s par kanji |
| **Kana** | kana non maîtrisés : tracé puis reconnaissance | production | ≈ 2 min |
| **Pratique** | exercices ciblant des éléments récents (QCM, texte à trous, naturel, registre) | pratique | ≈ 20 s par question |
| **Contexte** | mission ou lecture | compréhension | `estimated_minutes` de l'activité |
| **Renforcement** | explication courte + 2 questions sur un élément fragile | pratique | ≈ 90 s |

Chaque bloc porte un **motif** (pourquoi il est là), utilisé pour « Pourquoi cette session ? »
(4.9).

Les durées sont des estimations de la v1, dans la configuration (4.11). Elles seront
recalées sur les durées réelles mesurées par `ACTIVITY_COMPLETED`.

---

## 4.4 Les formats de session

Le format vient du réglage **Rythme** des paramètres. L'accueil l'affiche (« ≈ 10 min ») et
permet d'en changer pour la session du jour, sans question systématique.

| Format | Cible | Nouveaux éléments | Cartes de révision | Contexte |
|---|---|---|---|---|
| 🌱 Courte | ≈ 5 min | 3 au plus | 5 au plus | non |
| 🍵 Normale | ≈ 10–15 min | 6 au plus | 10 au plus | si le temps le permet, lecture courte de préférence |
| 🌿 Longue | ≈ 20–30 min | 10 au plus | 20 au plus | oui : mission ou lecture |

Le nombre de nouveaux éléments est aussi borné par le **budget quotidien de nouveautés**.

### Budget quotidien de nouveautés

Deux limites distinctes :

- **par session** : le maximum du format (3, 6 ou 10) ;
- **par jour** : le budget quotidien, réglé dans les paramètres (Rythme). Son libellé devient
  **« Nouveautés par jour »** plutôt que « nouvelles cartes par jour », puisqu'une nouveauté
  peut être un mot, un kanji, une expression ou une leçon.

**Le budget ne limite que les propositions du mode guidé.** Dans la bibliothèque, Pratiquer ou
Explorer, l'utilisateur découvre autant d'éléments qu'il veut (rien n'est bloquant) : ces
nouveautés sont comptées, mais jamais refusées. Une fois le budget épuisé, les sessions
suivantes de la journée restent possibles : ce sont des sessions de consolidation.

**Ce qui consomme le budget** : un élément qui **quitte l'état Nouveau pour la première fois**,
vers Découvert (`CONTENT_INTRODUCED`) ou directement vers En cours (première
`QUESTION_ANSWERED`), **quel que soit l'écran**. Le budget se calcule à partir du journal
(partie 3). Si l'utilisateur a découvert 30 mots dans Pratiquer ce matin, le mode guidé le
sait et n'en ajoute pas.

**Les kana du bloc Kana ont leur propre limite** : 5 nouveaux kana par session au plus, **hors
budget de nouveautés**. Ils restent des éléments comme les autres (présentation, état, SRS,
faiblesses) ; ils ne consomment simplement pas le budget du contenu (grammaire, mots, kanji,
expressions). Sans cela, un débutant n'apprendrait aucun mot pendant tout l'apprentissage des
kana.

Les budgets sont des **plafonds, pas des objectifs** : qu'ils ne se bloquent plus l'un l'autre
ne signifie pas qu'il faut les remplir tous les deux.

**Le budget compte des éléments, pas des blocs** : une leçon de grammaire compte pour 1
(son élément grammatical), un bloc de trois mots pour 3, une expression pour 1. Une
déclaration de niveau ou un test ne consomment pas le budget.

---

## 4.5 La composition

La session est construite par **rôles**, remplis dans cet ordre. Un rôle sans candidat est
simplement omis : il n'y a jamais de bloc de remplissage.

### Rôle 1 · Ouverture (R3, R4)

- S'il y a des cartes dues : **bloc Révision**, avec les cartes les plus en retard d'abord
  (tri actuel de `computeQueuePriorityTier`), dans la limite du format (ou du temps, en
  rattrapage : 4.6). Puis, si une faiblesse active est **importante** (au moins 2 échecs
  consécutifs), un **bloc Renforcement** sur la plus prioritaire.
- Sinon, s'il y a une faiblesse active : **bloc Renforcement** sur la plus prioritaire.
- Sinon : pas d'ouverture.

Un renforcement d'ouverture **compte dans le plafond global** de 2 renforcements par session
(4.7) : la session ne doit pas devenir centrée sur les difficultés.

### Rôle 2 · Nouveauté principale (R1, R2)

Une seule **nouveauté principale** par session. Elle peut être de **n'importe quel type** :
grammaire (bloc Notion), vocabulaire (bloc Mots), kanji (bloc Kanji) ou expressions (bloc
Expressions). Ocha n'est pas un cours de grammaire avec du vocabulaire autour.

**Choix de la nouveauté principale**, par ordre de préférence :

1. **Continuité d'un travail commencé** : une leçon de grammaire Découverte jamais pratiquée ;
   ou les éléments encore Nouveaux du `teaches` d'une mission ou d'une lecture commencée.
2. **Déblocage** : une leçon de grammaire dont l'absence est **la seule raison** pour laquelle
   des missions ou lectures ne sont pas accessibles. L'apprendre ouvre du contenu : c'est
   la nouveauté la plus utile.
3. **Rotation des types** : parmi les types qui ont un candidat accessible, le moteur choisit
   celui qui a été **proposé comme nouveauté principale le moins récemment** (d'après le
   journal). Une nouveauté proposée puis passée compte comme proposée (voir 4.7). **En cas
   d'égalité**, notamment à la toute première session, départage dans l'ordre :
   **grammaire, vocabulaire, expressions, kanji**. Ce n'est qu'une règle de départage, pas
   l'ordre normal du parcours : dès qu'il existe un historique, la rotation s'applique. Pour le
   type retenu :
   - **grammaire** : la prochaine leçon accessible, de la même unité que la dernière étudiée
     si possible, sinon dans l'ordre de référence ;
   - **vocabulaire** : les mots nouveaux qui recoupent le plus les missions et lectures
     accessibles, puis la catégorie en cours ;
   - **kanji** : les kanji nouveaux présents dans des mots au moins En cours
     (`kanji_list`), dans l'ordre de niveau ;
   - **expressions** : celles des lieux des missions accessibles.

La rotation garantit que la grammaire revient régulièrement, sans jamais monopoliser les
sessions ; la continuité et le déblocage passent avant elle, parce qu'ils prolongent ce que
l'utilisateur est en train de construire.

**Frein à la nouveauté** : pas de nouveauté du tout si l'une de ces conditions est vraie :

- le budget quotidien de nouveautés est épuisé ;
- il y a **10 Découverts en attente** ou plus (l'utilisateur a vu beaucoup de choses sans les
  pratiquer : on consolide d'abord) ;
- le rattrapage est en zone massive (4.6).

La session devient alors une **session de consolidation** (voir plus bas). Le rôle Pratique
cible les Découverts en attente : ils passent En cours, et le frein se libère de lui-même.

### Rôle 3 · Appui (R2, R5)

Des éléments d'**un autre type**, liés à la nouveauté principale :

- nouveauté **grammaire** → mots nouveaux utilisés dans les exemples de la leçon, puis dans
  les missions et lectures accessibles qui partagent sa grammaire ;
- nouveauté **vocabulaire** → kanji nouveaux de ces mots (`kanji_list`), expressions du même
  lieu ;
- nouveauté **kanji** → **d'abord les mots déjà Découverts, En cours ou Acquis** qui le
  contiennent : le kanji vient enrichir un mot que l'utilisateur connaît (たべる devient
  食べる) ; seulement à défaut, de nouveaux mots pertinents ;
- nouveauté **expressions** → mots nouveaux de la mission du même lieu ;
- dans la limite de nouveaux éléments du format.

### Rôle 4 · Pratique (R5)

Un **bloc Pratique** qui cible, dans l'ordre :

1. les éléments introduits dans cette session ;
2. les Découverts en attente ;
3. les éléments récents En cours.

C'est ce rôle qui fait passer les éléments de Découvert à En cours.

### Rôle 5 · Contexte (R5, R2)

Une mission ou une lecture accessible, non terminée, qui **tient dans le temps restant**.
Parmi les candidates, le moteur choisit celle qui recoupe le plus les **éléments récents**
(dans son `teaches` ou ses `uses`). À égalité :

- la suite d'une activité du même lieu (une lecture après la mission du même `place`) ;
- puis l'ordre de référence (`order`).

### Rôle 6 · Clôture (R3)

S'il reste des cartes dues et du temps : un **second bloc Révision** court. Sinon, la session
se termine sur le bilan.

### Kana

Pour un utilisateur qui a choisi **« Je débute »**, un **bloc Kana** court est placé juste après
l'ouverture, **tant que les kana ne sont pas Acquis** : d'abord les hiragana, puis les
katakana. Pas jusqu'à Maîtrisé : un utilisateur qui lit déjà ses kana ne doit pas recevoir ce
bloc pendant deux mois, en attendant que l'intervalle SRS atteigne 60 jours.

Une fois les kana Acquis, ils suivent le circuit normal : révisions SRS, et renforcement en cas
de faiblesse. Les autres utilisateurs n'ont pas de bloc Kana ; la box « Kana du jour » de
l'accueil reste leur rappel. Le bloc reste passable (rien n'est bloquant).

### Session de consolidation

Sans nouveauté principale, la session contient révision, pratique et contexte. **Plusieurs
blocs de Pratique sont alors autorisés**, à condition que leurs types d'exercice ou d'effort
diffèrent (R6). Par exemple :

> Révision → QCM de vocabulaire → tracé de kanji → lecture courte → texte à trous de grammaire

### Contraintes d'ordre (R6)

- Jamais deux blocs de même effort d'affilée, sauf Révision en ouverture suivie d'un
  Renforcement, et sauf en session de consolidation si les types d'exercice diffèrent.
- La Pratique vient toujours **après** la nouveauté principale et l'Appui qu'elle fait travailler.
- Le Contexte vient **après** la Pratique.

### Ajustement au temps (R7)

Après composition, si la durée estimée dépasse la cible de plus de 20 %, le moteur retire
dans cet ordre :

| Session avec nouveauté | Session de consolidation |
|---|---|
| 1. Clôture | 1. Clôture |
| 2. Contexte | 2. Contexte |
| 3. une partie de l'Appui | 3. les blocs de Pratique supplémentaires, du dernier au premier |
| 4. une partie de l'Ouverture | 4. une partie du premier bloc de Pratique, s'il est divisible |
| | 5. une partie de l'Ouverture |

Il ne retire jamais la nouveauté principale ni la Pratique qui la suit ; en consolidation, le
premier bloc de Pratique, cœur de la session, est conservé. Si la durée est inférieure à la
cible, il n'ajoute rien : une session courte et utile vaut mieux qu'une session remplie.

---

## 4.6 Le rattrapage des révisions

Le SRS ne doit ni être ignoré, ni monopoliser la session. Trois zones, selon le nombre de
cartes dues comparé au quota de révision du format :

| Zone | Condition | Taille du bloc Révision | Comportement |
|---|---|---|---|
| Normale | dues ≤ quota | le **quota de cartes** du format (`maxReviews`), dans la limite de **35 %** du temps | composition normale |
| Importante | dues jusqu'à 3 × le quota | **60 %** du temps de la session | une seule nouveauté, sans Appui |
| Massive | dues > 3 × le quota | **85 %** du temps de la session | **pas de nouveauté** ; le reste pour un renforcement ; l'accueil signale le retard et propose l'onglet Réviser pour le reste |

**Le quota de cartes ne s'applique qu'en zone normale.** En zones importante et massive, le
bloc Révision reçoit un **budget de temps**, pas un nombre de cartes : il s'arrête quand son
temps est consommé. Il ne promet pas un nombre de cartes uniques, puisque les cartes oubliées
repassent dans le bloc (`scheduleRelearning`). Sans cette règle, le quota de 10 cartes
empêchait d'atteindre la part de temps prévue, et un rattrapage prenait un mois.

Le message reste simple : « Tu as pris un peu de retard dans tes révisions : aujourd'hui, on
consolide. » Jamais de chiffre culpabilisant.

---

## 4.7 L'adaptation en cours de session

Après chaque bloc, le moteur réexamine la suite du plan.

### Renforcement (R4)

Un **bloc Renforcement** est déclenché si, pendant la session :

- un même élément a reçu **2 réponses fausses** ; ou
- un bloc de Pratique a un taux d'erreur de **50 %** ou plus sur les éléments de la nouveauté
  principale.

Il devient **prioritaire dans la suite immédiate** de la session, sans être forcément le bloc
suivant : il est placé **après un bloc de nature différente** quand il en reste un, sinon
juste après. Revenir sur l'élément après une courte activité différente évite l'acharnement,
et vérifie mieux que l'utilisateur s'en souvient.

Limites : **2 renforcements au plus** par session, **y compris celui d'ouverture** (4.5), jamais
deux fois le même élément.
Événement `REINFORCEMENT_TRIGGERED` (raison `error`).

Une carte « Oublié » dans un bloc Révision ne déclenche pas de renforcement : elle réapparaît
plus loin dans le même bloc, comme aujourd'hui (`scheduleRelearning`).

### Temps

Si le temps réel dépasse la cible de plus de 20 %, les blocs restants optionnels sont retirés
(Clôture, puis Contexte). La session se termine proprement, avec son bilan.

### Étape passée

« Passer cette étape » retire le bloc (`ACTIVITY_SKIPPED`). Si c'est la nouveauté principale, l'Appui et la
Pratique qui en dépendent sont retirés aussi ; le moteur ne la remplace pas par une autre
nouveauté dans la même session.

Une nouveauté principale passée :

- **compte pour la rotation** : son type est considéré comme proposé récemment, et le type
  suivant sera proposé à la session d'après ;
- **ne compte pas comme introduite** : l'élément reste Nouveau, et **aucun budget n'est
  consommé**. Il redeviendra candidat plus tard, par la rotation normale.

### Budget

Le budget quotidien est **revérifié à la reprise d'une session et avant chaque bloc de
nouveauté** : l'utilisateur a pu découvrir des éléments ailleurs entre-temps. S'il est
épuisé, les blocs de nouveauté **non commencés** sont retirés du plan ; un bloc commencé est
terminé. La session continue avec pratique, contexte et révision.

---

## 4.8 Reprise et abandon

- La session en cours est **persistée** : plan, position, blocs faits (partie 3). L'accueil
  affiche « Reprendre · ≈ 6 min restantes ».
- À la reprise, les blocs déjà faits sont conservés, la session repart du **prochain bloc non
  réalisé**, puis le reste du plan est réévalué selon les règles d'adaptation (4.7), dont la
  revérification du budget.
- Une session non terminée reste reprenable pendant **12 heures** après sa dernière
  activité (délai glissant, paramètre de la v1). Passé ce délai, elle est close
  (`SESSION_ABANDONED`) et une nouvelle session est composée avec l'état du moment. Un délai
  glissant évite la frontière arbitraire de minuit : une session commencée à 23 h 50 reste
  reprenable à 0 h 05.
- Les effets des blocs déjà faits sont acquis : ils ont été enregistrés au fil de l'eau.
- Une fois la session du jour terminée, l'accueil propose de continuer : une nouvelle session
  est composée avec l'état mis à jour (le frein à la nouveauté s'applique alors pleinement).

---

## 4.9 « Pourquoi cette session ? »

Chaque bloc porte un motif. L'accueil et l'écran de session en affichent **trois au plus**, en
langage simple :

| Motif | Formulation |
|---|---|
| révision due | « 8 cartes à revoir aujourd'hui » |
| continuité | « Tu continues l'unité *Les particules fondamentales* » |
| faiblesse | « Tu avais eu du mal avec に : on le revoit » |
| réutilisation | « Cette lecture reprend 3 mots découverts hier » |
| rattrapage | « Aujourd'hui, on consolide » |
| secours | « On reprend le parcours là où il en est » |
| déblocage | « Tu apprends か : il ouvre la mission *Un bento, sans sac* » |
| rotation | « Aujourd'hui, place aux expressions » |

Aucun terme technique : pas de « SRS », « prérequis », « taux », « état ».

---

## 4.10 Règle de secours

Si la composition ne produit aucun bloc (rien de dû, rien d'accessible, pas de faiblesse),
le moteur applique la règle de la partie 2 : **le prochain élément non connu dans l'ordre de
référence**, avec un bloc de Pratique. Un débutant complet obtient ainsi toujours une
session : sa première notion (です), quelques mots de ses exemples, un exercice.

Si **tout** le contenu disponible est Acquis ou Maîtrisé et que rien n'est dû, l'accueil le
dit simplement (« Tu as fait le tour du contenu disponible pour l'instant ») et propose
Pratiquer, Lire ou Explorer.

---

## 4.11 Paramètres de la v1

```js
const GUIDED_CONFIG = {
  // … paramètres des parties 1 à 3
  sessionFormats: {
    short:  { targetMinutes: 5,  maxNew: 3,  maxReviews: 5,  context: false },
    normal: { targetMinutes: 12, maxNew: 6,  maxReviews: 10, context: "short" },
    long:   { targetMinutes: 25, maxNew: 10, maxReviews: 20, context: true }
  },
  recentWindowDays: 7,             // éléments « récents »
  pendingDiscoveredLimit: 10,      // frein à la nouveauté
  reviewShare: { normal: 0.35, important: 0.60, massive: 0.85 },  // expérimental
  backlogMassiveFactor: 3,         // dues > 3 × quota = zone massive
  timeOverrunTolerance: 0.20,
  reinforcement: { errorsOnSameElement: 2, blockErrorRate: 0.5, maxPerSession: 2 },
  sessionResumeHours: 12,          // délai glissant de reprise
  kanaBlockUntil: "acquired",      // bloc Kana des débutants jusqu'à Acquis
  kanaNewPerSession: 5,            // hors budget de nouveautés
  openingReinforcementMinFails: 2, // faiblesse importante : renforcement après la Révision
  blockDurations: {                // secondes, recalées ensuite sur les durées réelles
    reviewCard: 12, newWord: 45, newKanji: 90, kanaBlock: 120,
    practiceQuestion: 20, reinforcement: 90, newExpression: 60, lessonDefaultMinutes: 4
  }
};
```

---

## Décisions de cette partie

| Point | Décision |
|---|---|
| Pipeline candidats → accessibilité → priorité → composition → adaptation | validé |
| Règles R1 à R7 | validé, structurel |
| Composition par rôles, rôle sans candidat omis | validé |
| Une nouveauté principale par session, de n'importe quel type | validé |
| Choix : continuité, puis déblocage, puis rotation des types | validé |
| Formats 5 / 12 / 25 min ; quotas = maximums, pas objectifs | validé, paramètre v1 |
| Frein à 10 Découverts en attente, session de consolidation | validé, paramètre expérimental |
| Rattrapage 35 % / 60 % / × 3 | validé, paramètre expérimental |
| Renforcement : 2 erreurs ou 50 %, 2 au plus, après un bloc différent | validé, paramètre expérimental |
| Bloc Kana des débutants jusqu'à Acquis | validé |
| Reprise pendant 12 h (délai glissant) | validé, paramètre v1 |
| « Pourquoi cette session ? » : 3 motifs au plus, sans terme technique | validé |
| Appui d'un kanji : d'abord les mots déjà rencontrés qui le contiennent | validé |
| Budget quotidien : éléments qui quittent Nouveau, tous écrans confondus | validé |
| Le budget ne limite que le mode guidé ; sessions supplémentaires en consolidation | précision |
| L1 · Départage de la rotation : grammaire, vocabulaire, expressions, kanji | validé (partie 6) |
| L2 · Budget revérifié à la reprise et avant chaque bloc de nouveauté | validé (partie 6) |
| L3 · Nouveauté passée : compte pour la rotation, reste Nouveau, sans budget | validé (partie 6) |
| O1 · Kana du bloc Kana hors budget, 5 par session au plus | validé (partie 8) |
| O3 · Motifs déblocage et rotation | validé (partie 8) |
| O4 · Renforcement après la Révision si faiblesse importante, dans le plafond de 2 | validé (partie 8) |
| O5 · Ordre de réduction d'une session de consolidation | validé (partie 8) |
| O6 · Quota de cartes en zone normale seulement ; budget de temps en rattrapage (60 % / 85 %) | validé (partie 8), 85 % expérimental |

## Conséquences pour la suite

- **Données** : `estimated_minutes` à ajouter aux leçons de grammaire (4 minutes par défaut en
  attendant).
- **Partie 5 · Génération et adaptation pédagogique des exercices** : la partie 4 décide
  **quoi** travailler (« pratiquer 〜ました avec du vocabulaire récent ») ; la partie 5 décide
  **comment** en faire un exercice adapté à l'utilisateur (représentation, formes générées,
  naturel et registre).
- **Partie 6 · Cas limites**, **partie 7 · Critères de réussite**, **partie 8 · Cinq
  sessions d'exemple** : ce sont elles qui éprouveront ces règles. Les chiffres de cette
  partie seront probablement ajustés après les sessions d'exemple.
