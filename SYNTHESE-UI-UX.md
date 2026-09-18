# Kanji-trad — Meilleures pratiques UI/UX

Synthèse produite avec le skill `ui-ux-pro-max` (base de connaissances locale : styles, palettes,
associations de polices, guidelines UX). Document de référence design pour les futures
implémentations — pas un audit du code existant, pas un chantier appliqué.

---

## 0. Note méthodologique

Les recherches `--design-system` agrégées (query "education japanese learning app", puis
"flashcard spaced repetition study productivity tool minimal") ont renvoyé à deux reprises un
profil **Claymorphism ludique** ("Best For: Children's apps"), avec l'indication explicite
**"Avoid: Dark modes"** au premier essai. Le dataset `products.csv` classe en effet "Language
Learning App" par défaut dans un bucket ludique/enfantin (Claymorphism + Vibrant, couleurs
"playful", drapeaux de pays).

**Ce résultat n'a pas été retenu.** Kanji-trad a déjà une identité visuelle établie — interface
sombre, accent cyan, présentation sérieuse orientée étude (badges de niveau JLPT, barres de
progression, pas de mascotte ni de ton enfantin) — incompatible avec ce profil générique. C'est un
écart assumé par rapport au classement automatique du dataset, pas une erreur de recherche. La
suite de ce document s'appuie sur des recherches `--domain` ciblées (style, typography,
google-fonts, ux, product), plus fiables pour des règles concrètes indépendantes du "mood" produit.

---

## 1. Stratégie de thème Clair/Sombre

### Recommandation : sombre par défaut, clair en option

Le style `dark-mode-oled` de la base est explicitement qualifié pour l'usage recherché :
*"Best For: Night-mode apps, coding platforms, entertainment, **eye-strain prevention**, OLED
devices, low-light"*. C'est directement le cas d'usage d'une session de révision longue.

**Palette de référence (dataset) :**
- Fond profond : `#000000` (noir pur, écrans OLED) ou `#121212` (gris très sombre, mieux pour LCD)
- Accent : `midnight blue #0A0E27` en base, un seul accent vif superposé (Kanji-trad utilise déjà
  un cyan `--accent` — cohérent avec cette approche, à conserver comme unique accent dominant)
- Effets : glow minimal (`text-shadow: 0 0 10px`) utilisé avec parcimonie, jamais sur de grandes
  surfaces de texte — un glow permanent sur du texte de lecture prolongée fatigue l'œil au lieu de
  le reposer

### Règles de contraste (à ne jamais déroger)

- **Texte normal : minimum 4.5:1** (WCAG AA), viser **7:1** en mode sombre spécifiquement
  (le dataset associe ce style à un contraste texte 7:1+, plus exigeant que le minimum AA)
- **Ne jamais inverser brutalement** clair↔sombre : `color-dark-mode` (guideline UX) — le mode
  sombre doit utiliser des variantes **désaturées ou plus claires** des couleurs de marque, pas
  une simple inversion. Les deux thèmes se testent et se valident séparément, un ne garantit pas
  l'autre.
- Bordures/séparateurs : visibles dans les deux thèmes indépendamment — un `border` discret en
  clair peut devenir invisible en sombre si sa luminosité n'est pas recalculée pour ce thème.
- États d'interaction (pressed/focus/disabled) : parité de lisibilité entre les deux thèmes, pas
  seulement testés en clair puis supposés fonctionner en sombre.

### Cas spécifique : lisibilité des caractères japonais

Un kanji complexe (15-20 traits) sur fond sombre perd en lisibilité plus vite qu'un texte latin
si le contraste est insuffisant — les traits fins deviennent illisibles avant que le texte latin
équivalent ne le devienne. Conséquences pratiques :
- Contraste du caractère principal (fiche détail, flashcard) à traiter comme du **texte large**
  au minimum (3:1), mais viser le même 7:1 que le reste du texte sombre — un kanji n'est pas
  décoratif, c'est le contenu principal de l'écran.
- Éviter tout glow/ombre portée sur le caractère lui-même : ça brouille les traits fins, contraire
  à l'effet recherché (lisibilité, pas décoration).
- Le mode clair reste nécessaire pour l'usage en pleine lumière (extérieur, transports) — les
  deux thèmes doivent être conçus ensemble (`dark-mode-pairing`), pas l'un comme simple variante
  automatique de l'autre.

---

## 2. Typographie : séparer police d'interface et police d'affichage japonais

### Principe

Une police latine généraliste ne couvre jamais bien les kanji (glyphes absents, épaisseur des
traits mal proportionnée, ou rendu en police de secours du système incohérente d'un appareil à
l'autre). Il faut deux familles distinctes, choisies indépendamment, jamais une police unique
"qui fait un peu tout".

### Police d'interface (labels, boutons, textes UI latins)

Association trouvée dans le dataset (`typography.csv`, profil "Modern Professional") :
**Poppins** (titres/labels) + **Open Sans** (corps de texte UI) — *"modern, professional, clean,
corporate, friendly"*, catégorie SaaS/business apps. Toute police sans-serif neutre et très
lisible à petite taille conviendrait de façon équivalente (Inter est une alternative courante
pour ce même usage, non issue de cette recherche mais largement reconnue) — le point important
n'est pas la police exacte mais qu'elle reste **strictement réservée à l'UI**, jamais utilisée
pour afficher un kanji ou un mot japonais.

### Police d'affichage japonais (kanji, kana, exemples de phrases)

Association dédiée trouvée (`typography.csv`, "Japanese Elegant") : **Noto Serif JP** (empattée,
pour la mise en avant — fiche détail, grand caractère central) + **Noto Sans JP** (pour le texte
courant — listes, lectures, exemples). Notes du dataset : *"Noto fonts excellent Japanese
support. Traditional + modern feel."* — c'est la valeur sûre, support de couverture de caractères
le plus complet.

Pour les écrans où le kanji est la vedette visuelle (fiche détail, carte de révision) et où un peu
plus de caractère est souhaitable que le style très neutre de Noto, alternatives réelles trouvées
dans `google-fonts.csv` (subset `japanese` confirmé) :

| Police | Style | Cas d'usage suggéré |
|---|---|---|
| Shippori Mincho B1 | Serif, plusieurs graisses (400-800) | Titre de fiche détail, mise en avant élégante |
| Shippori Antique | Sans serif | Alternative moderne à Noto Sans JP pour le corps |
| Aoboshi One | Serif | Accent visuel sur un kanji isolé (grande taille) |
| Yusei Magic | Sans serif | Labels/tags japonais courts, ambiance plus douce |

**Recommandation pratique** : Noto Sans/Serif JP en base sur tout le texte japonais courant
(couverture garantie, cohérence), et réserver une police plus caractérielle (Shippori Mincho B1
par exemple) au **seul caractère central agrandi** des fiches/flashcards — jamais à un bloc de
texte japonais entier, pour ne pas fatiguer la lecture.

### Échelle et hiérarchie

- Échelle typographique UI et échelle d'affichage kanji **doivent rester séparées** : le kanji
  central d'une flashcard (`font-size: 3.5rem` déjà utilisé dans le code actuel) n'appartient pas
  à la même progression que les tailles de texte d'interface (12/14/16/18/24/32 recommandé par le
  dataset pour l'UI) — les mélanger produit une hiérarchie visuelle incohérente.
- `font-display: swap` sur les polices japonaises (poids lourds en Ko) pour éviter le texte
  invisible (FOIT) le temps du chargement — particulièrement sensible ici vu le nombre de
  caractères CJK à charger.

---

## 3. Cartes et tableaux de bord : éviter l'effet "mur de blocs"

### Le problème identifié

Une grille de cartes toutes identiques en taille (grille de niveaux JLPT, grille de kanji, grille
de dossiers) produit un "mur" où rien ne guide l'œil — chaque carte a le même poids visuel, donc
aucune n'en a. C'est le symptôme typique d'une hiérarchie qui repose uniquement sur la couleur
(bordures colorées par catégorie, déjà utilisées dans Kanji-trad) sans varier taille/espacement/
contraste.

### Pattern recommandé : Bento Grid plutôt que grille uniforme

Style trouvé (`styles.csv`, `bento-box-grid`) : *"Modular cards, asymmetric grid, varied sizes,
Apple-style, dashboard tiles, negative space, clean hierarchy"* — explicitement qualifié pour les
dashboards. Principe : **les tuiles varient de taille selon leur importance réelle**, pas selon
une grille rigide 3×3/4×4. Concrètement pour un écran comme l'Accueil ou "Apprendre" de
Kanji-trad :
- La carte "Reprendre" / progression du jour mérite une tuile plus large (elle concentre l'action
  principale) — déjà en partie le cas avec `free-training-card` qui se distingue visuellement,
  logique à généraliser plutôt qu'à traiter comme une exception isolée.
- Les cartes secondaires (Grammaire/Vocabulaire/Kanji/Kana) peuvent rester une grille régulière
  **entre elles**, tant qu'elles ne sont pas au même niveau visuel que la carte principale.
- Espacement variable délibéré (`gap` plus large autour de la tuile principale) plutôt qu'un
  `gap` uniforme partout.

### Style de fond : Minimalism / Swiss plutôt que décoratif

Style trouvé (`styles.csv`, `minimalism-and-swiss-style`) : *"Best For: Enterprise apps,
**dashboards**, documentation sites, SaaS platforms, professional tools"*, mode sombre supporté,
**un seul accent principal** (`--accent-color: single primary only`), pas de gradient/ombre
superflue. C'est cohérent avec l'identité déjà établie de Kanji-trad (accent cyan unique,
`--surface`/`--border` neutres) — pas un changement de direction, une confirmation qu'il faut
rester strict sur ce point plutôt que multiplier les couleurs par catégorie.

### Règles concrètes anti-mur-de-blocs

1. **Hiérarchie par taille/espacement, jamais par la couleur seule** (`visual-hierarchy`) — une
   bordure colorée différente par catégorie (déjà en place : vert grammaire, jaune vocabulaire,
   cyan kanji, violet kana) reste un signal secondaire, pas le seul niveau de hiérarchie de
   l'écran.
2. **Espace blanc intentionnel** (`whitespace-balance`) — grouper les cartes liées avec un `gap`
   resserré, séparer les sections avec un espace nettement plus large qu'entre deux cartes de la
   même section. Un espacement uniforme partout est ce qui crée l'effet mur.
3. **Densité adaptative selon l'écran** (dial `--density` du skill) : une grille de révision
   (beaucoup d'items à scanner vite, ex. grille kanji par niveau) peut se permettre une échelle
   d'espacement dense (8-32px) ; un écran d'accueil ou "Apprendre" (peu d'entrées, décision
   consciente de l'utilisateur) doit rester spacieux (24-96px) pour ne pas donner une impression
   de surcharge dès l'arrivée sur l'app.
4. **Une seule action principale par écran** (`primary-action`, guideline UX) — sur "Apprendre",
   la carte "Reprendre"/"Introduction" doit rester la seule à porter un traitement visuel de CTA
   fort ; les cartes Grammaire/Vocabulaire/Kanji/Kana/Dossiers sont des raccourcis de navigation,
   pas des CTA au même niveau.

---

## Sources

Toutes les données ci-dessus proviennent de recherches réelles dans la base locale du skill
`ui-ux-pro-max` (`.claude/skills/ui-ux-pro-max/scripts/search.py`), domaines `style`,
`typography`, `google-fonts`, `ux`, `product` — pas de contenu inventé. Les résultats écartés
(profil Claymorphism/ludique) sont documentés en §0 plutôt que silencieusement ignorés.
