# Kanji-trad — Direction artistique : "Encre & Sceau"

Proposition de direction visuelle sur mesure, produite avec le skill `ui-ux-pro-max` (bases
`style`/`color`/`typography` réelles, recombinées — pas un style préfabriqué appliqué tel quel).
**Ceci est une proposition à discuter, aucun code n'est modifié.** Périmètre analysé : listes
Kanji/Vocabulaire/Grammaire, flashcards Entraînement libre, quiz à masquage de texte, modale
Objectifs.

---

## 1. Diagnostic rapide

**Densité d'information.** Les écrans de liste (grille kanji, catégories vocabulaire, unités
grammaire) empilent beaucoup d'unités identiques — depuis cette session, la hiérarchie a été
améliorée par la taille/position (Apprendre, Dossiers), mais le **fond visuel reste uniforme
partout** : un même double dégradé radial ("halo navy glow") sert de texture à *toutes* les
cartes de l'app, du dashboard aux quiz. Résultat : la densité est gérable, mais rien dans la
texture elle-même ne distingue "ceci est une catégorie", "ceci est un résultat", "ceci est une
action" — la hiérarchie repose sur la couleur de bordure et la taille, jamais sur la matière.

**Lisibilité des caractères.** Techniquement réglée cette session (séparation Inter/Noto Sans JP,
tailles dédiées aux gros caractères). Mais le traitement visuel du kanji lui-même reste neutre :
un glow cyan générique (`text-shadow` bleu), le même sur un kanji de 2 traits que sur un de 20.
Rien ne célèbre le fait que c'est un *caractère dessiné*, pas juste un mot.

**Hiérarchie des niveaux JLPT.** Un code couleur (vert/jaune/cyan/violet) déjà cohérent, mais
c'est un vocabulaire de badge SaaS générique (pastille arrondie + couleur) — il pourrait porter
plus de sens culturel sans perdre en clarté fonctionnelle.

**Verdict** : l'app est fonctionnellement saine (accessibilité, contraste, séparation
typographique déjà traités) mais visuellement **anonyme** — elle pourrait être n'importe quelle
app de flashcards. Rien dans sa peau ne dit spécifiquement "japonais".

---

## 2. Parti pris esthétique : "Encre & Sceau"

Une synthèse, pas un style catalogue : le mode sombre déjà validé (`dark-mode-oled`, justifié
pour les sessions longues) **reste la base**, mais réinterprété comme une **toile d'encre**
plutôt qu'un dashboard SaaS néon — et la hiérarchie des niveaux s'inspire du **sceau hanko** (le
tampon d'encre rouge utilisé pour authentifier un document japonais) plutôt que du badge web
générique.

**Palette** — un indigo profond en base (au lieu du bleu marine actuel, plus distinctif), un
**vermillon d'encre de sceau** comme accent principal (au lieu du cyan, qui devient un signal
secondaire "nouveau/frais" plutôt que l'accent unique de toute l'app) :

| Rôle | Avant | Après | Source |
|---|---|---|---|
| Fond | `#060B18` (marine) | `#0F0F1F` (indigo-encre) | base color, dataset "Night indigo" |
| Accent principal | `#00E5FF` (cyan) | `#F97316` (vermillon) | dataset "Podcast Platform : dark indigo + warm accent" |
| Accent secondaire | — | `#38BDF8` (cyan, démoté) | conservé, rôle réduit |
| Accent décoratif | `#7b61ff` | `#7C3AED` | dataset "Sleep Tracker : dream violet" |

**Typographie** — Inter reste la police d'interface (déjà tranché cette session, je ne reviens
pas dessus), Noto Sans/Serif JP reste la police japonaise. **Nouveauté** : une police d'affichage
distincte (serif à fort contraste, ex. Playfair Display) réservée aux très gros éléments
(streak du jour, score, titres de section) — pas pour remplacer Inter, pour créer un **contraste
de matière** entre "interface" et "moment marquant", comme un titre de calligraphie au milieu
d'un cahier.

**Texture/profondeur** — remplacer le double dégradé radial identique sur *toutes* les cartes
par un grain très subtil (`--grain-opacity: 0.035`, bruit léger, pas un motif) évoquant le papier,
+ un lavis d'encre directionnel (un seul dégradé doux, pas deux superposés) qui varie légèrement
selon le contexte (violet en dashboard, vermillon en session de révision) — la texture devient un
signal contextuel, pas un décor uniforme.

---

## 3. Réorganisation conceptuelle des layouts clés

### Dashboard — "le bureau d'étude"
La carte CTA "Aujourd'hui" devient la pièce maîtresse visuelle : le chiffre du jour en police
d'affichage serif (grand, encre vermillon), pas juste un bouton parmi d'autres. Les widgets
secondaires (série, faiblesses, progression) devinent des "papiers" plus petits, texture grain
plus marquée qu'eux — cohérent avec le travail déjà fait cette session sur la hiérarchie
Apprendre/Dossiers (tuiles de taille variable), poussé plus loin par la matière en plus de la
taille.

### Révision/flashcard immersive
Aujourd'hui : `.review-card` classique, chrome visible autour (barre de progression, header).
Proposition : en mode "carte retournée", **masquer temporairement la bottom-nav et les marges
latérales** — le caractère occupe l'essentiel de l'écran, lavis d'encre vermillon très doux
derrière lui (jamais un glow net), et le retournement de carte devient une transition d'opacité +
léger flou ("l'encre qui apparaît") plutôt qu'un flip 3D générique — respecte
`prefers-reduced-motion` comme le reste de l'app déjà.

### Écrans de liste (Kanji/Vocabulaire/Grammaire)
Le badge de niveau JLPT (`.niveaux-badge`, actuellement une pastille colorée) devient un
**sceau carré aux coins légèrement arrondis, encre vermillon sur fond texturé** — même
information (N5/N4/...), présentation qui évoque un tampon d'authentification plutôt qu'un badge
SaaS. Le fond des cartes garde le grain léger défini en §2, plus de double dégradé uniforme.

---

## 4. Déclinaison en tokens CSS (prête à intégrer dans `:root`, `css/base.css`)

```css
:root {
  /* Encre — base sombre, remplace --bg/--surface/--card actuels */
  --bg: #0F0F1F;
  --surface: #1B1B30;
  --card: #1B1B30;
  --text: #F0F6FC;              /* inchangé */
  --gray: #94A3B8;              /* légèrement plus lisible que l'actuel #8B949E */

  /* Sceau — accents, remplace --accent/--accent-muted/--accent2 actuels */
  --accent: #F97316;            /* vermillon, était #00E5FF */
  --accent-muted: #FB923C;
  --accent-cool: #38BDF8;       /* ex-accent principal, démoté en signal secondaire */
  --accent2: #7C3AED;
  --border: rgba(255,255,255,0.08);

  /* Texture — nouveau, remplace le double radial-gradient uniforme de base.css */
  --grain-opacity: 0.035;
  --wash-dashboard: radial-gradient(circle at 25% 15%, rgba(124,58,237,0.12), transparent 60%);
  --wash-review: radial-gradient(circle at 75% 85%, rgba(249,115,22,0.10), transparent 55%);

  /* Typographie d'affichage — nouveau, s'ajoute à --font-ui (Inter)/--font-jp (Noto) existants */
  --font-display: 'Playfair Display', 'Noto Serif JP', serif;
}
```

**Note d'implémentation** : `--accent` est utilisé dans énormément de fichiers CSS/JS (bordures,
glows, boutons de notation, badges). Le remplacer touche visuellement toute l'app d'un coup —
c'est délibéré (proposition "audacieuse" demandée), mais ça veut dire qu'une bascule réelle
mérite son propre `/plan` dédié avec vérification écran par écran, pas un simple changement de
variable en isolation.

---

**Prochaine étape possible, si cette direction te plaît** : je peux préparer un `/plan` de mise en
œuvre progressive (probablement en commençant par le Dashboard, l'écran le plus visible, avant de
propager aux listes et à la révision) — à toi de me dire si cette direction te convient avant
qu'on parle d'exécution.
