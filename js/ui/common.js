/**
 * js/ui/common.js
 * Composants UI génériques et utilitaires de rendu DOM
 */

import { state } from '../core/state.js';
import { getItemStatus, trackItem } from '../core/storage.js';

/* ══════════════════════════════════════════════════
   SÉLECTION EN MASSE — validation rapide de maîtrise
   ─────────────────────────────────────────────────
   Mode "tap pour basculer" : dans une des listes (vocab, grammaire, kanji, kana), taper une
   fiche bascule IMMÉDIATEMENT son statut maîtrisé. Système transversal, utilisé par plusieurs
   features (kanji, vocab, grammar, kana) — d'où sa place ici plutôt que dans une feature
   précise. Équivalent EXACT de la section "SÉLECTION EN MASSE" du monolithe.
══════════════════════════════════════════════════ */

// Conservée pour compatibilité de lecture visuelle : en pratique le badge ✔ (mastered-check)
// déjà présent sur chaque carte suffit à montrer l'état, donc cette fonction ne sert plus
// qu'à un éventuel style additionnel si besoin plus tard. RETOURNE TOUJOURS FALSE — c'est le
// comportement réel du monolithe, pas un oubli : ne pas "corriger" ce no-op.
export function isBulkSelected(id) {
    return false;
}

// À appeler dans le onclick de chaque carte, à la place de l'ouverture directe de la fiche
export function handleListItemClick(el, id, openFn) {
    if (state.bulkSelectMode) {
        toggleItemMasteryLive(id);
        // Mise à jour directe de la carte tapée plutôt qu'un rafraîchissement complet de
        // l'écran (bulkSelectRerender) : celui-ci reconstruit tout le HTML et referme donc
        // les catégories/unités actuellement dépliées — gênant si on valide plusieurs fiches
        // d'affilée dans la même catégorie.
        updateMasteryBadgeInPlace(el, id);
    } else {
        openFn();
    }
}

// Ajoute ou retire le badge ✔ sur la carte tapée, sans reconstruire tout l'écran
export function updateMasteryBadgeInPlace(el, id) {
    if (!el) return;
    const isMastered = getItemStatus(id) === 'mastered';
    let badge = el.querySelector('.mastered-check');
    if (isMastered) {
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'mastered-check';
            badge.textContent = '✔';
            el.prepend(badge);
        }
    } else if (badge) {
        badge.remove();
    }
}

// Bascule immédiate de la maîtrise d'un seul item
export function toggleItemMasteryLive(id) {
    const isMastered = getItemStatus(id) === 'mastered';
    trackItem(id, isMastered ? 'null' : 'mastered');
}

// Bascule un groupe entier via sa case à cocher : si elle vient d'être cochée, tout le groupe
// est marqué maîtrisé ; si elle vient d'être décochée, tout le groupe perd sa maîtrise.
export function toggleCategoryMasteryLive(checkboxEl, ids) {
    const status = checkboxEl.checked ? 'mastered' : 'null';
    ids.forEach(id => trackItem(id, status));
    if (state.bulkSelectRerender) state.bulkSelectRerender();
}

export function enterBulkSelectMode(rerenderFn) {
    state.bulkSelectMode     = true;
    state.bulkSelectRerender = rerenderFn;
    rerenderFn();
    updateBulkActionBar();
}

export function exitBulkSelectMode() {
    state.bulkSelectMode     = false;
    const fn = state.bulkSelectRerender;
    state.bulkSelectRerender = null;
    if (fn) fn();
    updateBulkActionBar();
}

export function updateBulkActionBar() {
    const bar = document.getElementById('bulk-action-bar');
    if (!bar) return;
    bar.style.display = state.bulkSelectMode ? 'flex' : 'none';
}

/* ══════════════════════════════════════════════════
   FICHE DÉTAIL — MAÎTRISE (partagé kanji/kana, même #detail-view)
   ─────────────────────────────────────────────────
   Déplacées ici depuis features/kanji.js pour éviter un cycle d'import : features/kana.js
   (openKanaDetail) en a besoin, mais ne peut pas importer depuis kanji.js (kanji.js importe
   déjà kanaToRomaji depuis kana.js). Équivalent EXACT de getDetailTrackingId()/
   refreshMasteryUI()/toggleDetailMastery() du monolithe.
══════════════════════════════════════════════════ */

// Identifiant de suivi pour la fiche détail actuellement ouverte (kanji ou kana)
export function getDetailTrackingId() {
    if (state.currentType === 'kana') return 'kana_' + state.currentChar;
    return state.currentChar;
}

// Met à jour le badge + le bouton de maîtrise de la fiche détail actuellement affichée
export function refreshMasteryUI() {
    const itemId = getDetailTrackingId();
    const status = getItemStatus(itemId);
    const mastered = status === 'mastered';

    const badge = document.getElementById('d-mastery-badge');
    if (badge) {
        badge.textContent = mastered ? '✔ Maîtrisé' : 'Non maîtrisé';
        badge.classList.toggle('mastered', mastered);
    }
    const btn = document.getElementById('detail-master-btn');
    if (btn) {
        btn.textContent = mastered ? '✓ Maîtrisé' : '✓ Marquer comme maîtrisé';
        btn.classList.toggle('active', mastered);
    }
}

// Bascule la maîtrise de l'élément actuellement affiché dans la fiche détail (kanji ou kana)
export function toggleDetailMastery() {
    const itemId = getDetailTrackingId();
    const isMastered = getItemStatus(itemId) === 'mastered';
    trackItem(itemId, isMastered ? 'null' : 'mastered');
    refreshMasteryUI();
}

export function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
/**
 * Équivalent EXACT de mdBold(text) du monolithe. Gras (**texte**) et italique (*texte*)
 * façon markdown, plus auto-enveloppement des <rt> orphelins en <ruby> (autoWrapRuby).
 * Ajoutée ici (pas dans un module feature) lors du chantier learning/weakness.js : utilisée
 * par buildFicheDetailContent() ci-dessous mais aussi par de nombreuses autres features
 * (vocab, grammaire, kanji, et le Learning Path) — utilitaire de formatage texte vraiment
 * transversal, même famille qu'escapeHtml() déjà présente dans ce fichier.
 */
function autoWrapRuby(str) {
    if (!str || !str.includes('<rt>')) return str || '';
    return str.replace(/([\u4e00-\u9faf]+)(<rt>.*?<\/rt>)/g, '<ruby>$1$2</ruby>');
}

export function mdBold(text) {
    if (!text) return text || '';
    // Gras : **texte** — traité en premier pour ne pas être cassé par la règle italique
    let result = text.replace(/\*\*(.+?)\*\*/g, '<span class="md-bold">$1</span>');
    // Italique : *texte* (astérisque simple, convention markdown standard)
    result = result.replace(/\*(.+?)\*/g, '<em class="md-italic">$1</em>');
    // Furigana : <rt> orphelins auto-enveloppés en <ruby>
    result = autoWrapRuby(result);
    return result;
}

/**
 * Équivalent EXACT de buildFicheDetailContent(entry) du monolithe. entry : { type: 'vocab'|
 * 'grammar'|'kanji'|'kana', item, level? }. Retourne { title, body } (HTML).
 * ⚠️ ATTENTION : la branche 'kanji' appelle getJLPTLevel() et lit state.data.kanjiDb ; la
 * branche 'grammar' appelle renderSectionBody()/buildConfusionBoxHtml() — AUCUNE de ces 3
 * fonctions n'est importable ici : getJLPTLevel cycle via kanji.js -> ui/common.js (kanji.js
 * importe déjà ce fichier). renderSectionBody/buildConfusionBoxHtml (features/grammar.js,
 * maintenant PORTÉ) cyclent pour une raison différente, vérifiée précisément : grammar.js
 * importe core/navigation.js (pushModalState), qui importe déjà ui/common.js — donc
 * common.js -> grammar.js -> navigation.js -> common.js. Confirmées structurellement
 * irrésolvables ici, pas juste "pas encore portées" — ces 3 restent des landmines
 * volontaires quel que soit l'avancement du reste du projet.
 */
export function buildFicheDetailContent(entry) {
    let title = '', body = '';

    if (entry.type === 'vocab') {
        const w = entry.item;
        title = '';
        const m = w.meanings;
        const meaningsArr = Array.isArray(m) ? m : (m && typeof m === 'object' ? [m.primary, ...(m.secondary || [])].filter(Boolean) : [m].filter(Boolean));
        body = `
            <div class="fiche-title-card">
                <div class="fiche-title-main">${w.word || ''}</div>
                ${(w.reading || w.romaji) ? `<div class="fiche-title-reading">${w.reading || ''}${w.romaji ? ' · ' + w.romaji : ''}</div>` : ''}
                <div class="fiche-title-meaning">${mdBold(meaningsArr.join(' · ') || '–')}</div>
            </div>
            ${w.nuance ? `<div class="vocab-nuance-box" style="margin-top:10px">💡 ${mdBold(w.nuance)}</div>` : ''}
            ${w.example && w.example.japanese ? `
                <div class="vocab-example-box" style="margin-top:10px">
                    <div class="example-jp">${mdBold(w.example.japanese)}</div>
                    ${w.example.romaji ? `<div class="example-ro">${w.example.romaji}</div>` : ''}
                    <div class="example-fr">${mdBold(w.example.french || '')}</div>
                </div>` : ''}
        `;
    } else if (entry.type === 'grammar') {
        const l = entry.item;
        title = '';
        // ⚠️ ATTENTION : renderSectionBody/buildConfusionBoxHtml existent réellement dans
        // features/grammar.js mais cyclent si importées ici (voir docblock ci-dessus).
        const sectionsHtml = Array.isArray(l.sections) ? l.sections.map(sec => `
            ${sec.label ? `<div class="section-sub-title">${sec.label}</div>` : ''}
            ${renderSectionBody(sec)}
        `).join('') : '';
        const examplesHtml = Array.isArray(l.examples) && l.examples.length ? `
            <div class="section-sub-title">Exemples</div>
            ${l.examples.slice(0, 2).map(ex => `
                <div class="vocab-example-box" style="margin-bottom:8px">
                    <div class="example-jp">${mdBold(ex.japanese || '')}</div>
                    <div class="example-fr">${mdBold(ex.french || '')}</div>
                </div>
            `).join('')}
        ` : '';
        const confusionsHtml = Array.isArray(l.confusions) && l.confusions.length
            ? l.confusions.map(c => buildConfusionBoxHtml(c)).join('')
            : '';
        body = `
            <div class="fiche-title-card">
                <div class="fiche-title-main">${l.item || l.pattern || ''}</div>
                ${(l.title || l.meaning) ? `<div class="fiche-title-meaning">${l.title || l.meaning || ''}</div>` : ''}
            </div>
            ${sectionsHtml}
            ${examplesHtml}
            ${confusionsHtml}
        `;
    } else if (entry.type === 'kanji') {
        const char = entry.item.char;
        const k = state.data.kanjiDb.find(x => x.char === char);
        title = '';
        // ⚠️ ATTENTION : getJLPTLevel (features/kanji.js) — cycle si importée ici (voir
        // en-tête de fonction). Vrai appel JS non importé.
        const level = k ? getJLPTLevel(k.grade) : null;
        const onTags = (k?.on || []).map(r => `<span class="tag tag-on">${r}</span>`).join('');
        const kunTags = (k?.kun || []).map(r => `<span class="tag tag-kun">${r}</span>`).join('');
        const meanings = (k?.meanings || []).filter(m => !m.toLowerCase().includes('radical'));
        const primaryMeaning = meanings[0] || '';

        body = `
            <div class="kfiche-card">
                <div class="kfiche-center">
                    <div class="kfiche-char">${char}</div>
                    ${primaryMeaning ? `<div class="kfiche-subtext">${primaryMeaning}</div>` : ''}
                    ${meanings.length > 1 ? `<div class="kfiche-subtext kfiche-subtext-secondary">${meanings.slice(1).join(', ')}</div>` : ''}
                </div>
                <div class="kfiche-badges">
                    ${level ? `<span class="kfiche-badge-level">N${level} Niveau</span>` : ''}
                    ${k?.strokes ? `<span class="kfiche-badge-strokes">${k.strokes} Traits</span>` : ''}
                </div>
            </div>
            <div class="kfiche-readings-card">
                ${onTags ? `<div class="kfiche-reading-section"><div class="kfiche-reading-label">ON'YOMI</div><div class="tag-container">${onTags}</div></div>` : ''}
                ${kunTags ? `<div class="kfiche-reading-section"><div class="kfiche-reading-label">KUN'YOMI</div><div class="tag-container">${kunTags}</div></div>` : ''}
                ${(k?.romaji && k.romaji !== '–') ? `<div class="kfiche-reading-section"><div class="kfiche-reading-label">RÔMAJI</div><div class="kfiche-romaji-text">${k.romaji}</div></div>` : ''}
            </div>
        `;
    } else if (entry.type === 'kana') {
        const k = entry.item;
        title = k.char || k.c || '';
        body = `<div class="fiche-sub">${k.romaji || k.r || ''}</div>`;
    }

    return { title, body };
}

/**
 * Équivalent EXACT de showFicheCorrectionModal(entry) du monolithe.
 */
export function showFicheCorrectionModal(entry) {
    if (!entry) return;
    const typeLabels = {
        vocab: '📚 Vocabulaire', grammar: '📝 Grammaire', kanji: 'Détail du Kanji',
        kana: (entry.level === 'kata') ? 'ア Katakana' : 'あ Hiragana'
    };
    const { title, body } = buildFicheDetailContent(entry);
    const content = document.getElementById('fiche-correction-content');
    if (!content) return;

    content.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;position:relative;margin-bottom:16px">
            <div class="mode-title" style="margin-bottom:0">${typeLabels[entry.type] || ''}</div>
            <button onclick="closeFicheCorrectionModal()" style="position:absolute;right:0;background:none;border:none;color:var(--gray);font-size:22px;cursor:pointer;padding:4px;line-height:1">✕</button>
        </div>
        <div style="text-align:center;padding:8px 0 4px">
            ${title ? `<div style="font-size:2.25rem;font-weight:bold;color:#fff;margin-bottom:8px">${title}</div>` : ''}
            <div style="text-align:left">${body}</div>
        </div>
        <button class="quiz-action-btn primary" style="width:100%;margin-top:18px" onclick="closeFicheCorrectionModal()">Compris ✓</button>
    `;

    const m = document.getElementById('fiche-correction-modal');
    if (!m) return;
    m.classList.add('open');
    m.style.display = 'flex';
}

export function closeFicheCorrectionModal() {
    const m = document.getElementById('fiche-correction-modal');
    if (!m) return;
    m.classList.remove('open');
    m.style.display = 'none';
}

/**
 * Retire les balises <rt>...</rt> pour obtenir le texte visible "propre" (sans lecture),
 * utilisé pour retrouver la position d'un mot cible même quand des <rt> sont insérés au
 * milieu de lui. Ajoutée ici (même famille qu'autoWrapRuby/mdBold ci-dessus) lors du
 * chantier features/vocabulary.js, qui en a besoin pour buildVocabWordCloze().
 */
export function stripRtTags(str) {
    return (str || '').replace(/<rt>.*?<\/rt>/g, '');
}

// Extrait la lecture complète d'un fragment brut (avec <rt>) : chaque "kanji<rt>lecture</rt>"
// devient juste "lecture", le reste (kana déjà présents, espaces, ponctuation) reste tel quel.
export function extractReadingFromRawRt(str) {
    return (str || '').replace(/[\u4e00-\u9faf]+<rt>(.*?)<\/rt>/g, '$1');
}

// Construit la correspondance "position dans le texte propre" -> "position dans le texte brut
// d'origine", pour pouvoir découper avant/cible/après un mot sans jamais couper une balise <rt>
// en deux, même quand elle est insérée au milieu du mot ciblé (ex: 会<rt>あ</rt>い).
export function buildCleanToRawIndexMap(raw) {
    const map = [];
    let ri = 0;
    while (ri < raw.length) {
        const m = raw.slice(ri).match(/^<rt>.*?<\/rt>/);
        if (m) { ri += m[0].length; continue; }
        map.push(ri);
        ri++;
    }
    return map;
}

/**
 * Construit le HTML d'un exemple de phrase cliquable, dans le style visuel de la fiche
 * kanji (fond translucide, bordure gauche colorée, icône 🔊 en haut à droite) — ajoutée pour
 * harmoniser le design des exemples entre kanji/vocabulaire/grammaire (demande explicite,
 * les 3 fiches utilisaient chacune leur propre style avant ça).
 *
 * @param {string} japaneseHtml - HTML déjà prêt (peut contenir des <ruby>/<rt> ou un
 *   surlignage <span class="highlight-grammar">, selon l'appelant)
 * @param {string} romaji - optionnel, affiché sous le japonais si fourni
 * @param {string} french - traduction
 * @param {string} speakArg - texte déjà nettoyé/échappé à passer tel quel à speakText(...)
 *   dans l'attribut onclick (l'appelant gère l'échappement, cf. les 3 usages différents
 *   d'origine : simple quote replace, stripRubyForSpeech, etc.)
 */
export function buildSpeakableExampleHtml(japaneseHtml, romaji, french, speakArg) {
    const romajiLine = romaji
        ? `<div style="font-size:0.78rem;color:var(--accent);margin-bottom:4px;font-family:monospace;opacity:0.8">${romaji}</div>`
        : '';
    return `<div onclick="speakText('${speakArg}')"
        style="position:relative;background:rgba(255,255,255,0.03);padding:14px 40px 14px 14px;border-radius:10px;margin-bottom:10px;cursor:pointer;border-left:3px solid var(--accent);transition:background 0.15s"
        onmouseenter="this.style.background='rgba(255,255,255,0.06)'"
        onmouseleave="this.style.background='rgba(255,255,255,0.03)'">
        <span style="position:absolute;top:12px;right:12px;font-size:1rem;opacity:0.7">🔊</span>
        <div style="font-size:1.1rem;color:#fff;margin-bottom:5px;line-height:1.4">${japaneseHtml}</div>
        ${romajiLine}
        <div style="font-size:0.88rem;color:#a0a0b0;line-height:1.4">${french}</div>
    </div>`;
}

/**
 * Bouton "Continuer" en FAB (bouton flottant, position fixe) — remplace le bouton inline
 * classique après une réponse à un exercice (trou à combler / QCM), pour qu'il reste
 * toujours visible et atteignable sans avoir à faire défiler, quelle que soit la longueur du
 * contenu de correction au-dessus. Même famille visuelle que le FAB retour du Learning Path
 * (position fixe, ombre portée), mais en bas de l'écran et en couleur accent (action
 * principale) plutôt qu'en haut en couleur neutre (navigation secondaire).
 */
export function continueFAB(onclickFn, label = 'Continuer →') {
    return `<button onclick="${onclickFn}"
        style="position:fixed;bottom:90px;left:50%;transform:translateX(-50%);z-index:960;
        padding:14px 32px;border-radius:999px;background:var(--accent);border:none;
        color:#000;font-size:0.9375rem;font-weight:bold;
        box-shadow:0 4px 16px rgba(0,229,255,0.35);cursor:pointer;white-space:nowrap;">
        ${label}
    </button>`;
}

/**
 * Bouton retour/fermer en FAB (bouton flottant, position fixe, haut-gauche) — remplace les
 * boutons retour inline dans tout le reste de l'app (chantier "point 9" demandé
 * explicitement). Même famille visuelle que continueFAB() ci-dessus et l'ancien
 * learningPathFAB() (learning/learning-path.js, qui devient un simple appel à celle-ci avec
 * sa propre cible).
 * @param {string} onclickFn - expression JS à exécuter au clic (ex: "history.back()")
 * @param {string} icon - '←' (retour) ou '✕' (fermer une session active), selon le contexte
 */
export function backFAB(onclickFn = 'history.back()', icon = '←') {
    return `<button onclick="${onclickFn}"
        style="position:fixed;top:10px;left:10px;z-index:600;width:38px;height:38px;border-radius:50%;
        background:var(--surface);border:1px solid var(--border);color:var(--text);font-size:1.1rem;
        box-shadow:0 4px 12px rgba(0,0,0,0.4);cursor:pointer;">${icon}</button>`;
}

/**
 * Affiche/masque la barre de navigation du bas — visible UNIQUEMENT sur les 3 écrans
 * principaux (Accueil/Apprendre/Réviser), masquée dès qu'on descend dans un sous-écran
 * (choix de niveau, liste, fiche, sélecteur de mode, session de révision...), demandé
 * explicitement. showDashboard()/showApprendreScreen()/showRevisionsScreen() appellent
 * showBottomNav() ; tous les autres écrans appellent hideBottomNav().
 */
export function showBottomNav() {
    const nav = document.getElementById('bottom-nav');
    if (nav) nav.style.display = '';
}
export function hideBottomNav() {
    const nav = document.getElementById('bottom-nav');
    if (nav) nav.style.display = 'none';
}

/**
 * Bloc de correction ❌/✅ unifié pour tous les exercices à choix (trou à combler, QCM) —
 * remplace les multiples présentations différentes qui existaient avant (coloré seul sans
 * texte pour vocab/entraînement libre/leçon, modal séparée pour le quiz kanji, une quasi-copie
 * dans learning-path.js). Référence : le système déjà utilisé pour la grammaire.
 *
 * Structure :
 *   ❌ Tu as répondu (mot) [👁️ badge cliquable si onClick fourni]  [: explication si fournie]
 *   ✅ La bonne réponse était (mot) [👁️ badge si onClick fourni]  [: explication si fournie]
 *   ⚠️ Nuance : texte   ← uniquement si nuance fournie (vocabulaire), jamais pour la grammaire
 *      (qui a déjà sa nuance collée à la ligne ✅ via correctExplanation)
 *
 * @param {object} p
 * @param {string} p.wrongText - texte de la mauvaise réponse choisie
 * @param {string} [p.wrongOnClick] - JS à exécuter au clic sur le badge (ex: "showLessonReferencePopup('...')") — omis = pas de badge, texte en gras simple
 * @param {string} [p.wrongExplanation] - explication collée à la ligne ❌ (grammaire uniquement)
 * @param {string} p.correctText - texte de la bonne réponse
 * @param {string} [p.correctOnClick] - même principe que wrongOnClick
 * @param {string} [p.correctExplanation] - explication collée à la ligne ✅ (grammaire uniquement)
 * @param {string} [p.nuance] - bloc ⚠️ séparé en bas (vocabulaire uniquement)
 */
export function buildAnswerFeedbackHtml({ wrongText, wrongOnClick, wrongExplanation, correctText, correctOnClick, correctExplanation, nuance }) {
    const span = (text, onClick) => onClick
        ? `<span class="eye-badge" onclick="${onClick}">👁️ ${text}</span>`
        : `<strong>${text}</strong>`;

    return `
        <div class="particle-compare-box">
            <div class="particle-compare-row wrong">
                <span class="particle-compare-icon">❌</span>
                <div class="particle-compare-text">Tu as répondu ${span(wrongText, wrongOnClick)}${wrongExplanation ? ` : ${mdBold(wrongExplanation)}` : ''}</div>
            </div>
            <div class="particle-compare-row correct">
                <span class="particle-compare-icon">✅</span>
                <div class="particle-compare-text">La bonne réponse était ${span(correctText, correctOnClick)}${correctExplanation ? ` : ${mdBold(correctExplanation)}` : ''}</div>
            </div>
        </div>
        ${nuance ? `<div class="vocab-nuance-box" style="margin-top:10px;text-align:left">⚠️ ${mdBold(nuance)}</div>` : ''}
    `;
}
