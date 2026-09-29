# Ocha — Moteur guidé v1

## Partie 8 · Cinq sessions d'exemple

**Statut** : 🔒 verrouillée (version 2 : arbitrages O1 à O7 intégrés, sessions A, C et D
rejouées, aucune nouvelle contradiction ni lacune).

**Objet** : faire tourner à la main toutes les règles verrouillées (parties 1 à 7) sur cinq
profils choisis pour **mettre le moteur sous pression**, pas pour montrer que tout marche.

Pour chaque session : état initial → instantané → candidats et écartés → composition →
déroulement → événements → état final → critères de la partie 7 → constats.

**Règle de cette partie** : quand une décision n'est pas dictée par les règles, on ne l'invente
pas. On la note comme **constat**, avec une proposition à arbitrer (8.7).

**Paramètres utilisés** : ceux de `GUIDED_CONFIG` (parties 1 à 5). Budget quotidien réglé
à 10 nouveautés dans les cinq profils.

**Données** : identifiants réels d'Ocha (`grammar.json`, `vocab.json`) et fichiers d'exemple
(`missions.json`, `lectures.json`, `expressions.json`).

---

## 8.1 Session A · Débutant complet, première session

### Profil et état initial

Premier lancement, choix « Je débute », format normal (12 min). Aucun historique.
Tous les éléments sont Nouveaux. Aucun kana lisible.

### Instantané (4.2)

| Donnée | Valeur |
|---|---|
| Cartes dues | 0 |
| Faiblesses actives | 0 |
| Découverts en attente | 0 |
| Nouveautés déjà prises aujourd'hui | 0 / 10 |
| Kana lisibles | aucun |

### Candidats et écartés

| Rôle | Résultat | Raison |
|---|---|---|
| Ouverture | ❌ omis | rien de dû, aucune faiblesse |
| Bloc Kana | ✅ | profil « Je débute », kana pas Acquis (4.5) |
| Nouveauté · continuité | ❌ | rien de commencé |
| Nouveauté · déblocage | ❌ | `n5_m_1` requiert です **et** か : aucune leçon n'est la seule raison |
| Nouveauté · rotation | ✅ grammaire | égalité des quatre types → départage L1 → prochaine leçon accessible : `n5_g_1` です (sans prérequis) |
| Appui | ❌ | budget de session consommé (voir déroulement) |
| Pratique | ✅ | です et les kana du jour |
| Contexte | ❌ | aucune mission ni lecture accessible |
| Clôture | ❌ | rien de dû |

### Composition

| # | Bloc | Contenu | Durée estimée | Motif |
|---|---|---|---|---|
| 1 | Kana | あ い う え お : découverte, reconnaissance, tracé | 2 min | kana |
| 2 | Notion | `n5_g_1` です | 4 min | rotation (départage L1) |
| 3 | Pratique | 6 questions : です, lecture des kana | 2 min | réutilisation |

**Durée estimée : ≈ 8 min**, pour une cible de 12. Rien n'est ajouté (R7).

**Budget** : le bloc Kana introduit 5 kana, qui quittent l'état Nouveau et **consomment 5
nouveautés**. です en consomme 1. Total : 6, soit le maximum de la session normale. Il ne reste
rien pour l'Appui (aucun mot). → **Constat O1.**

### Déroulement

- Bloc Kana : les 5 kana sont présentés, reconnus, tracés. Erreur répétée sur え.
- Notion です : présentation, exemples en **romaji** (aucun kana lisible au moment de la
  composition, 5.1).
- Pratique : 4 questions sur です (2 justes, 2 fausses), 2 questions de lecture de kana dans le
  « monde lisible » (5.3) : いえ (`n5_v_33`, support), あお (`n5_v_487`, support).

### Événements émis (extrait)

```
SESSION_STARTED        normal, 12 min prévus
ACTIVITY_STARTED       kana
CONTENT_INTRODUCED     ×5  kana_あ … kana_お
QUESTION_ANSWERED      ×5  cibles kana (え : faux ×2)
ACTIVITY_COMPLETED     kana
CONTENT_INTRODUCED     n5_g_1
QUESTION_ANSWERED      ×4  cible n5_g_1 (2 faux)
QUESTION_ANSWERED      ×2  cibles kana, supports n5_v_33 / n5_v_487
SESSION_COMPLETED      8 min
```

Deux erreurs sur です : un **renforcement** est déclenché (4.7). Il n'y a plus de bloc de nature
différente après la Pratique : il est placé juste après (+ 1,5 min).

### État final

| Élément | État | SRS | Faiblesse |
|---|---|---|---|
| あ い う お | En cours | vérification à J+1 | — |
| え | En cours | vérification à J+1 | active (2 échecs) |
| `n5_g_1` です | En cours | vérification à J+1 | active, en baisse après le renforcement |
| いえ, あお (supports) | Nouveau | — | — (invariant : un support ne change pas) |

Durée réelle : ≈ 9,5 min. Nouveautés du jour : 6 / 10.

### Critères testés

| Critère | Résultat |
|---|---|
| S2 · session non vide | ✅ |
| S4 · écriture lisible | ✅ romaji partout, sauf les kana en exercice de lecture |
| S8 · support inchangé | ✅ いえ et あお restent Nouveaux |
| S10 · budget | ✅ 6 / 10 |
| Q3 · durée proche de la cible | ⚠️ 9,5 min pour 12 → 79 %, mais l'accueil annonçait ≈ 8 min → **Constat O2** |
| Q4 · erreurs traitées | ✅ renforcement sur です |

---

## 8.2 Session B · Utilisateur intermédiaire, déblocage

### Profil et état initial

Trois semaines d'usage, format normal. Kana tous lisibles. Leçons `n5_g_1` à `n5_g_12` au
moins En cours ; `n5_g_17` (か) Nouvelle. 120 mots au moins En cours. Dernières nouveautés
principales : grammaire (hier), vocabulaire (J-2), kanji (J-3), expressions (J-4).

### Instantané

| Donnée | Valeur |
|---|---|
| Cartes dues | 8 (zone normale) |
| Faiblesses actives | 0 |
| Découverts en attente | 3 |
| Nouveautés déjà prises aujourd'hui | 0 / 10 |

### Candidats et écartés

| Rôle | Résultat | Raison |
|---|---|---|
| Ouverture | ✅ Révision, 8 cartes | 8 ≤ quota de 10 |
| Nouveauté · continuité | ❌ | rien de commencé |
| Nouveauté · déblocage | ✅ `n5_g_17` か | `n5_m_1` requiert `n5_g_1` (✅) et `n5_g_17` (❌) : か est **la seule raison** du blocage |
| Nouveauté · rotation | non consultée | le déblocage passe avant ; la rotation aurait choisi les expressions (J-4) |
| Appui | ✅ Mots | grammaire → mots des exemples de la leçon et de la mission débloquée |
| Pratique | ✅ | か, mots du jour, 3 Découverts en attente |
| Contexte | ❌ | `n5_m_1` n'est accessible qu'une fois か En cours ; de plus, le temps est déjà atteint |

### Composition

| # | Bloc | Contenu | Durée | Motif |
|---|---|---|---|---|
| 1 | Révision | 8 cartes | 1,6 min | révision due |
| 2 | Notion | `n5_g_17` か | 4 min | **déblocage** |
| 3 | Mots | お弁当 (`n5_v_84`), レジ袋 (`hj_v_1`), ポイントカード (`hj_v_2`), 会社, 元気 | 3,75 min | appui |
| 4 | Pratique | 10 questions | 3,3 min | réutilisation |

Durée estimée : ≈ 12,7 min, dans la tolérance (≤ 14,4 min). Nouveautés : 6 (1 + 5).

**Représentation** (5.1) : l'utilisateur lit les kana mais pas le kanji 弁 : お弁当 est
affiché **べんとう** en kana. 元気 (kanji Acquis, mot Nouveau) : **元気 avec furigana**.

### Déroulement

- Révision : 7 « Bien », 1 « Oublié » (la carte revient dans le bloc).
- Notion か, puis les 5 mots.
- Pratique : deux erreurs sur か → renforcement, placé après un bloc de nature différente…
  mais la Pratique est le dernier bloc : il est placé juste après.

### Événements émis (extrait)

```
REVIEW_GRADED          ×9 (dont 1 Oublié, puis Bien au réessai)
CONTENT_INTRODUCED     n5_g_17, n5_v_84, hj_v_1, hj_v_2, …
QUESTION_ANSWERED      ×10 (か : 2 faux)
REINFORCEMENT_TRIGGERED  n5_g_17, raison error
QUESTION_ANSWERED      ×2  cible n5_g_17 (justes)
SESSION_COMPLETED      14 min
```

### État final

か En cours ; la mission `n5_m_1` est **désormais accessible** : elle sera candidate au rôle
Contexte de la prochaine session. Nouveautés du jour : 6 / 10.

### Critères testés

| Critère | Résultat |
|---|---|
| S1 · accessibilité | ✅ la mission n'est pas proposée tant que か est Nouveau |
| Q5 · part de révision ≤ 35 % | ✅ 1,6 / 14 min |
| Q9 · déblocage efficace | ✅ か En cours → `n5_m_1` accessible |
| U1 · « Pourquoi cette session ? » | ⚠️ le motif **déblocage** n'a pas de formulation en 4.9 → **Constat O3** |

### Constat de données

L'exemple 3 de la leçon か a un romaji erroné : « Ashita **gaisha** e ikimasu ka » pour
会社 (かいしゃ, *kaisha*). À ajouter aux corrections de données.

---

## 8.3 Session C · Faiblesses et Découverts accumulés

### Profil et état initial

Format court (5 min). L'utilisateur a beaucoup exploré la bibliothèque sans pratiquer :
**11 Découverts en attente**. Faiblesses actives fortes sur に (`n5_g_11`) et sur le kanji 食.
4 cartes dues.

### Candidats et écartés

| Rôle | Résultat | Raison |
|---|---|---|
| Ouverture | ✅ Révision, 4 cartes | des cartes sont dues |
| Nouveauté | ❌ | **frein** : 11 Découverts ≥ 10 → session de consolidation |
| Pratique ×2 | ✅ | consolidation : plusieurs blocs de Pratique, types différents |
| Faiblesses に et 食 | ❌ **aucun rôle ne les prend** | voir ci-dessous |

Le renforcement d'une faiblesse n'intervient que **en ouverture quand rien n'est dû**, ou
**après des erreurs pendant la session** (4.5, 4.7). Ici, des cartes sont dues : l'ouverture
est une Révision. Et la Pratique cible les éléments introduits dans la session, les
Découverts en attente et les récents En cours, **pas les faiblesses actives**. → **Constat O4.**

### Composition

| # | Bloc | Contenu | Durée | Motif |
|---|---|---|---|---|
| 1 | Révision | 4 cartes | 0,8 min | révision due |
| 2 | Pratique | QCM de sens sur 8 Découverts | 2,7 min | réutilisation |
| 3 | Pratique | tracé de 2 kanji des Découverts | 3 min | réutilisation |

Durée estimée : 6,5 min > 6 min (5 min + 20 %). Ajustement (4.5) : on retire une partie de
l'Appui ou de l'Ouverture… mais il n'y en a pas d'autre ; les blocs de Pratique ne sont pas
dans la liste des blocs retirables. **La règle de réduction ne couvre pas une session de
consolidation.** Le bloc 3 est réduit à 1 kanji, par analogie : ≈ 5 min. → **Constat O5.**

### État final

8 Découverts passent En cours : il en reste 3, le frein est levé pour la prochaine session
(Q6 ✅). Les faiblesses sur に et 食 sont **inchangées** : pas travaillées.

### Critères testés

| Critère | Résultat |
|---|---|
| Q6 · les Découverts ne s'accumulent pas | ✅ 11 → 3 |
| Q2 · variété en consolidation | ✅ QCM puis tracé |
| R4 · renforcer ce qui pose problème | ⚠️ faiblesses actives ignorées → O4 |
| Q3 · durée | ⚠️ réduction non prévue par les règles → O5 |

---

## 8.4 Session D · Retour après deux mois

### Profil et état initial

Format normal. Deux mois d'absence : **300 cartes dues**, dont beaucoup d'éléments Acquis
depuis longtemps.

### Candidats et écartés

| Rôle | Résultat | Raison |
|---|---|---|
| Zone de rattrapage | **massive** | 300 > 3 × 10 |
| Ouverture | ✅ Révision | cartes dues |
| Nouveauté | ❌ | zone massive |
| Renforcement | selon les faiblesses | — |

### Le problème du quota

Combien de cartes dans la Révision ?

- Le format normal fixe **10 cartes au plus** (`maxReviews`).
- La zone massive dit « session de révision et de renforcement », et la zone importante
  autorise **jusqu'à 60 % du temps** en révision.

10 cartes durent 2 minutes, soit 17 % du temps : **le quota de cartes empêche d'atteindre la
part de temps prévue par les zones de rattrapage.** Appliquées ensemble, les deux règles
produisent une session de rattrapage de 3 à 4 minutes, et un rattrapage de 30 jours par le
seul mode guidé. → **Constat O6 · 🔴 contradiction.**

### Déroulement (avec la lecture la plus favorable : quota levé en zone massive)

Révision de 40 cartes (8 min) : 12 « Oublié ». Les 12 éléments redescendent En cours
(partie 1), leurs faiblesses augmentent. Renforcement sur la plus prioritaire (1,5 min).
« Pourquoi cette session ? » : « Aujourd'hui, on consolide. » L'accueil propose Réviser pour
le reste.

### Critères testés

| Critère | Résultat |
|---|---|
| S7 · recul seulement par « Oublié » | ✅ |
| U3 · pas de chiffre culpabilisant | ✅ |
| 4.6 · zones de rattrapage | 🔴 contradiction quota / part de temps → O6 |

---

## 8.5 Session E · Utilisateur avancé, peu de contenu nouveau

### Profil et état initial

Déclaré N4 il y a trois mois, usage régulier. Format long (25 min). Tout le N5 et le N4
existants sont Acquis ou Maîtrisés. Restent Nouvelles : 3 expressions. Toutes les missions
sont faites ; la lecture `n5_l_5` ne l'est pas. 6 cartes dues. Phase du naturel : 3.

### Candidats et écartés

| Rôle | Résultat | Raison |
|---|---|---|
| Ouverture | ✅ Révision, 6 cartes | |
| Nouveauté · rotation | ✅ Expressions | seul type avec des candidats |
| Appui | ❌ | aucun mot nouveau dans les missions du même lieu |
| Pratique | ✅ | expressions du jour : « Adapter le registre », « Naturel ou scolaire ? » (phase 3) |
| Contexte | ✅ `n5_l_5` | accessible, non faite, 2 min |

### Composition

| # | Bloc | Durée | Motif |
|---|---|---|---|
| 1 | Révision, 6 cartes | 1,2 min | révision due |
| 2 | Expressions, 3 | 3 min | rotation |
| 3 | Pratique, 5 questions | 1,7 min | réutilisation |
| 4 | Contexte : `n5_l_5` | 2 min | réutilisation |

**Durée estimée : ≈ 8 min**, pour une cible de 25 : rien n'est ajouté (R7). Le lendemain, plus
aucune nouveauté : message « Tu as fait le tour du contenu disponible » (4.10).

### Le cas 13 mis à l'épreuve

Pour tester le cas 13 de la partie 6, on reprend un profil comme celui de la session B :
食べる (`n5_v_117`) est **En cours** (appris en kana, たべる), mais le kanji 食 est **Nouveau**.

- La partie 4 place 食べる parmi les cibles de la Pratique (récent En cours).
- La partie 5 peut choisir le générateur **Lecture** pour ce mot.
- La règle « c'est ce qui est vérifié » autorise l'affichage de 食べる **sans furigana**.

Résultat : Ocha demande « Comment se lit 食べる ? » à quelqu'un à qui 食 n'a **jamais été
présenté**. La question est impossible. **Le risque signalé en partie 6 est réel.**
→ **Constat O7.**

### Critères testés

| Critère | Résultat |
|---|---|
| S2 · jamais de session vide ; message de fin de contenu | ✅ |
| R2 · niveau sans contenu | ✅ |
| Q3 · durée | ⚠️ 8 min pour 25 : c'est R7 qui s'applique ; voir O2 |
| S3 / S4 · affichage | ⚠️ permis par les règles, mais question impossible → O7 |

---

## 8.6 Bilan

| Session | Profil | Fonctionne | Constats |
|---|---|---|---|
| A | débutant complet | ✅ | O1, O2 |
| B | intermédiaire, déblocage | ✅ | O3 (+ donnée) |
| C | faiblesses, Découverts | ⚠️ | O4, O5 |
| D | gros retard | 🔴 | O6 |
| E | avancé, peu de contenu | ✅ | O2, O7 |

**Ce qui marche sans retouche** : le déblocage (B), le frein à la nouveauté et la
consolidation (C), la descente d'Acquis à En cours après une longue absence (D), la règle de
secours et la fin de contenu (E), l'invariant support (A), l'affichage adaptatif selon les
kana et les kanji (A, B).

**Ce que les sessions révèlent** : une contradiction (O6), quatre lacunes (O1, O4, O5, O7) et
deux imprécisions documentaires (O2, O3).

---

## 8.7 Constats à arbitrer

### O1 · Le bloc Kana consomme tout le budget du débutant

5 kana + 1 notion = 6 nouveautés : le débutant n'apprend **aucun mot** pendant les 18 sessions
environ que prennent les hiragana puis les katakana.

**Proposition** : les kana appris dans le **bloc Kana** ont leur propre limite (5 par session) et
**ne consomment pas** le budget de nouveautés. Le budget reste celui du contenu (grammaire,
mots, kanji, expressions).

*Parties concernées : 4.4, 4.5.*

### O2 · Durée : comparer à l'annonce, pas à la cible

R7 interdit de remplir une session ; le critère Q3 mesure pourtant l'écart à la **cible** du
format. Une session de 8 minutes pour 12 est conforme à R7 mais « échoue » à Q3.

**Proposition** : Q3 compare la durée réelle à la **durée annoncée** (l'estimation affichée sur
l'accueil), pas à la cible. *Correction documentaire de la partie 7.*

### O3 · Motifs manquants dans « Pourquoi cette session ? »

4.9 ne donne pas de formulation pour le **déblocage** ni la **rotation**.

**Proposition** : déblocage → « Tu apprends か : il ouvre la mission *Un bento, sans sac* » ;
rotation → « Aujourd'hui, place aux expressions ». *Correction documentaire de la partie 4.*

### O4 · Les faiblesses actives ne sont pas travaillées quand des cartes sont dues

R4 veut renforcer ce qui pose problème, mais la composition ne prend une faiblesse qu'en
ouverture **quand rien n'est dû**, ou après des erreurs **pendant** la session. Un utilisateur qui
a toujours quelques cartes dues ne voit jamais ses faiblesses traitées.

**Proposition** : si une faiblesse active dépasse un seuil de priorité, un **bloc Renforcement**
suit la Révision d'ouverture (un seul par session à ce titre, en plus des deux renforcements
d'adaptation).

*Partie concernée : 4.5, rôle 1.*

### O5 · Réduction d'une session de consolidation

La règle d'ajustement au temps (4.5) retire Clôture, Contexte, Appui puis Ouverture, mais pas
les blocs de Pratique. Une session de consolidation trop longue ne peut pas être réduite.

**Proposition** : en consolidation, les blocs de Pratique au-delà du premier sont retirables,
en commençant par le dernier.

*Partie concernée : 4.5, ajustement au temps.*

### O6 · 🔴 Quota de cartes et zones de rattrapage se contredisent

Le quota `maxReviews` (10 en format normal) empêche d'atteindre la part de temps prévue par
les zones importante (60 %) et massive.

**Proposition** : `maxReviews` ne s'applique qu'en **zone normale**. En zones importante et
massive, c'est la **part de temps** qui fixe le nombre de cartes : 60 % en zone importante, 85 %
en zone massive (le reste pour un renforcement).

*Partie concernée : 4.6.*

### O7 · Question de lecture sur une écriture jamais présentée (cas 13 confirmé)

**Proposition** : le générateur **Lecture** ne cible un mot en kanji que si **tous ses kanji
sont au moins Découverts**. Sinon, pour ce mot, le générateur choisit la lecture en kana ou le
sens. La règle « ne pas donner la réponse » reste inchangée.

*Partie concernée : 5.3.*

---

## 8.8 Arbitrages

| Constat | Décision | Intégré dans |
|---|---|---|
| O1 · Kana hors budget | ✅ plafond propre de 5 par session | partie 4 (4.4, config) |
| O2 · Durée réelle / annoncée | ✅ ; la cible reste une métrique d'observation | partie 7 (Q3) |
| O3 · Motifs déblocage et rotation | ✅ | partie 4 (4.9) |
| O4 · Faiblesse après la Révision | ✅ dans le plafond global de 2 renforcements | partie 4 (rôle 1, 4.7) |
| O5 · Réduction en consolidation | ✅ Pratiques supplémentaires retirées d'abord | partie 4 (ajustement au temps) |
| O6 · Quota et rattrapage | ✅ quota en zone normale seulement ; budget de temps 60 % / 85 % | partie 4 (4.6), 85 % expérimental |
| O7 · Lecture de kanji | ✅ tous les kanji au moins Découverts | partie 5 (5.3), partie 7 (S11) |

La donnée erronée de la leçon か est ajoutée aux corrections de données (stratégie de
reconstruction).

---

## 8.9 Sessions rejouées avec les règles corrigées

### Session A · Débutant complet (rejouée)

| # | Bloc | Contenu | Durée | Budget |
|---|---|---|---|---|
| 1 | Kana | あ い う え お | 2 min | hors budget (5 / 5 kana) |
| 2 | Notion | `n5_g_1` です | 4 min | 1 |
| 3 | Mots (appui) | mots des exemples de です : 学生, 日本人, 高い, 好き, 先生 | 3,75 min | 5 |
| 4 | Pratique | です, mots du jour, lecture de kana | 3,3 min | — |

Durée estimée : ≈ 13 min, dans la tolérance (≤ 14,4 min). Budget de contenu : 6 / 10.
Mots affichés en **romaji** (kana du mot pas encore lisibles), sauf いえ, あお dans les
exercices de lecture de kana.

**Résultat** : O1 résolu, le débutant apprend ses premiers mots dès la première session.

**Observation, sans nouvelle règle** : c'est **11 nouveaux éléments** (5 kana + です + 5 mots)
dès la première session. Rien n'est contradictoire : les budgets sont des plafonds, et le rôle
Appui les remplit quand il a des candidats. Mais c'est beaucoup pour une toute première
expérience. **À observer lors des premiers tests réels** : si c'est trop, le levier existe déjà
(format de session, budget quotidien réglable), sans règle supplémentaire.

Critères : S2 ✅, S4 ✅, S8 ✅, S10 ✅, Q3 ✅ (réel ≈ annoncé), Q4 ✅.

### Session C · Faiblesses et Découverts (rejouée)

Format court (5 min), 4 cartes dues, 11 Découverts en attente, faiblesses sur に (3 échecs
consécutifs) et 食 (2).

| # | Bloc | Contenu | Durée | Motif |
|---|---|---|---|---|
| 1 | Révision | 4 cartes | 0,8 min | révision due |
| 2 | Renforcement | に, faiblesse la plus prioritaire (O4) | 1,5 min | faiblesse |
| 3 | Pratique | QCM de sens sur 8 Découverts | 2,7 min | réutilisation |
| ~~4~~ | ~~Pratique~~ | ~~tracé de 2 kanji~~ | — | retiré (O5) |

Durée estimée avant ajustement : 8 min > 6 min. Réduction de consolidation (O5) : pas de
Clôture ni de Contexte, **la Pratique supplémentaire est retirée** → ≈ 5 min. Le premier bloc
de Pratique est conservé.

- Renforcements : 1 / 2 utilisé à l'ouverture ; il en reste un pour une erreur pendant la
  session.
- 食 n'est pas renforcé cette fois : un seul renforcement d'ouverture. Il le sera à la
  prochaine session s'il reste la faiblesse la plus prioritaire.
- Variété : Renforcement puis Pratique, deux blocs de pratique d'affilée, admis en
  consolidation parce que les types d'exercice diffèrent (explication + questions ciblées,
  puis QCM).

**Résultat** : O4 et O5 résolus. Critères : R4 ✅, Q2 ✅, Q3 ✅, Q6 ✅ (11 → 3 Découverts).

### Session D · Retour après deux mois (rejouée)

Format normal (12 min), 300 cartes dues : zone massive.

| # | Bloc | Contenu | Durée |
|---|---|---|---|
| 1 | Révision | **budget de temps de 85 %** : ≈ 10 min, environ 50 passages (dont les cartes oubliées qui repassent) | 10,2 min |
| 2 | Renforcement | faiblesse la plus prioritaire (O4) | 1,5 min |

Durée : ≈ 11,7 min. Pas de nouveauté. « Aujourd'hui, on consolide. » L'accueil propose Réviser
pour le reste.

Environ 40 cartes uniques révisées par session : le rattrapage par le seul mode guidé prend
une semaine environ au lieu d'un mois, et l'onglet Réviser permet d'aller plus vite.

**Résultat** : O6 résolu, plus de contradiction. Critères : S7 ✅, U3 ✅, Q3 ✅, zones de
rattrapage ✅.

### Bilan du replay

| Session | Résultat |
|---|---|
| A | ✅ O1 résolu ; une observation à suivre en test réel (11 nouveautés dès la première session) |
| C | ✅ O4 et O5 résolus |
| D | ✅ O6 résolu |

**Aucune nouvelle contradiction ni lacune.** Les sessions B et E n'étaient concernées que par
des corrections documentaires (O2, O3) et par O7, déjà vérifié par le critère S11.

---

## 8.10 Suite

Partie 8 verrouillée. Prochaine étape : **partie 9 · Architecture et
persistance**, avec L4 (échec d'écriture du stockage) comme premier cas technique à
résoudre, et la stratégie de reconstruction comme point de départ.
