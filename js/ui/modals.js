/**
 * js/ui/modals.js
 * Recherche unifiée (vocab/grammaire/kanji/kana) — découverte comme chantier séparé lors du
 * portage de core/navigation.js::toggleSearch() (voir HANDOFF.md). toggleSearch()/
 * closeSearchOverlay() elles-mêmes restent dans core/navigation.js (coordination via
 * l'historique, leur place légitime) ; TOUT LE RESTE (filtres, exécution de la recherche,
 * rendu des résultats) vit ici, car ça a besoin d'importer features/kanji.js et
 * features/kana.js — impossible depuis navigation.js (kanji.js/kana.js importent déjà
 * pushModalState depuis navigation.js, cycle direct sinon, voir HANDOFF.md).
 *
 * Placement dans ui/modals.js (stub vide jusqu'ici) plutôt qu'un nouveau fichier : le
 * panneau de recherche est structurellement un overlay/modal (glisse par-dessus l'écran
 * courant, se ferme via history.back()), et l'arborescence cible ne prévoit pas de fichier
 * dédié à la recherche — vérifié programmatiquement SANS risque de cycle avant d'écrire.
 *
 * ⚠️ Les landmines resteront dans navigation.js::toggleSearch() (resetSearchFilters,
 * showSearchPanel) même après ce chantier : navigation.js ne peut toujours pas importer ce
 * fichier en retour (modals.js importe kanji.js -> navigation.js). Ce chantier rend la
 * RECHERCHE ELLE-MÊME fonctionnelle (résultats cliquables, etc.), mais déclencher la
 * recherche depuis toggleSearch() restera cassé tant qu'app.js n'aura pas résolu ces
 * landmines via window.* — cohérent avec le reste du projet, voir HANDOFF.md.
 */

import { state } from '../core/state.js';
import { ALL_JLPT_LEVELS } from '../core/constants.js';
import { kanaToRomaji, getKanaFlatList, getLevelVocabData, getLevelGrammarData } from '../core/data-loader.js';
import { getJLPTLevel, openDetail } from '../features/kanji.js';
import { openKanaDetail } from '../features/kana.js';
import { closeAllOverlaysAndSessions, closeSearchOverlay } from '../core/navigation.js';
import { showVocabDetail } from '../features/vocabulary.js';
import { showGrammarDetail } from '../features/grammar.js';

/* ══════════════════════════════════════════════════
   FILTRES — sélection multiple, un Set vide = "Tout"/"Tous" (aucune restriction)
══════════════════════════════════════════════════ */
let searchFilters = { types: new Set(), levels: new Set() };
let searchDebounceTimer = null;
const SEARCH_TYPE_STYLE = {
    vocab:   { label: 'Vocabulaire', color: '#FBBF24', char: '語' },
    grammar: { label: 'Grammaire',   color: '#4ADE80', char: '文' },
    kanji:   { label: 'Kanji',       color: '#00E5FF', char: '字' },
    kana:    { label: 'Kana',        color: '#9D6EFF', char: 'あ' }
};
const SEARCH_RESULTS_CAP = 25; // par section, pour rester lisible/rapide

export function resetSearchFilters() {
    searchFilters = { types: new Set(), levels: new Set() };
    renderSearchFilterPills();
}

export function renderSearchFilterPills() {
    const typeEl = document.getElementById('search-filter-type');
    const levelEl = document.getElementById('search-filter-level');
    if (typeEl) {
        const allActive = searchFilters.types.size === 0;
        let html = `<button class="search-filter-pill${allActive ? ' active' : ''}" onclick="toggleSearchFilter('type','all')">Tout</button>`;
        html += Object.entries(SEARCH_TYPE_STYLE).map(([id, s]) => {
            const active = searchFilters.types.has(id);
            return `<button class="search-filter-pill${active ? ' active' : ''}" style="${active ? `border-color:${s.color};color:${s.color}` : ''}" onclick="toggleSearchFilter('type','${id}')">${s.label}</button>`;
        }).join('');
        typeEl.innerHTML = html;
    }
    if (levelEl) {
        const allActive = searchFilters.levels.size === 0;
        const levels = state.jlptMapping
            ? Object.entries(state.jlptMapping.levels).sort((a, b) => a[1].order - b[1].order)
            : ALL_JLPT_LEVELS.map(id => [id, { label: id.toUpperCase() }]);
        let html = `<button class="search-filter-pill${allActive ? ' active' : ''}" onclick="toggleSearchFilter('level','all')">Tous</button>`;
        html += levels.map(([id, d]) => {
            const active = searchFilters.levels.has(id);
            return `<button class="search-filter-pill${active ? ' active' : ''}" style="${active && d.color ? `border-color:${d.color};color:${d.color}` : ''}" onclick="toggleSearchFilter('level','${id}')">${d.label}</button>`;
        }).join('');
        levelEl.innerHTML = html;
    }
}

export function toggleSearchFilter(kind, value) {
    const key = kind === 'type' ? 'types' : 'levels';
    if (value === 'all') {
        searchFilters[key].clear();
    } else if (searchFilters[key].has(value)) {
        searchFilters[key].delete(value);
    } else {
        searchFilters[key].add(value);
    }
    renderSearchFilterPills();
    const q = document.getElementById('search-input')?.value || '';
    if (q.trim()) debouncedDoSearch(q); else clearSearch();
}

export function debouncedDoSearch(query) {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => doSearch(query), 150);
}

export function clearSearch() {
    document.getElementById('search-input').value = '';
    document.getElementById('search-clear').classList.remove('show');
    document.getElementById('search-results').innerHTML =
        '<div class="search-empty"><div class="big">🔎</div>Cherchez un mot, une leçon, un kanji ou un kana</div>';
    showSearchPanel();
}

export function showSearchPanel() {
    document.getElementById('search-results').classList.add('open', 'with-bar');
}
export function hideSearchPanel() {
    document.getElementById('search-results').classList.remove('open', 'with-bar');
}

/* ══════════════════════════════════════════════════
   RECHERCHE PAR TYPE — chacune retourne un tableau d'items bruts, pas encore rendus
══════════════════════════════════════════════════ */
function searchKanjiItems(q, levels) {
    return state.data.kanjiDb.filter(k => {
        if (!levels.includes(`n${getJLPTLevel(k.grade)}`)) return false;
        if (k.char === q) return true;
        if (k.meanings.some(m => m.toLowerCase().includes(q))) return true;
        if (k.on.some(r => r.toLowerCase().includes(q))) return true;
        if (k.kun.some(r => r.replace(/[.\-].*/g, '').toLowerCase().includes(q))) return true;
        if (k.on.some(r => kanaToRomaji(r.toLowerCase()).includes(q))) return true;
        if (k.kun.some(r => kanaToRomaji(r.replace(/[.\-].*/g, '')).includes(q))) return true;
        if (k.romaji && k.romaji.toLowerCase().includes(q)) return true;
        return false;
    }).slice(0, SEARCH_RESULTS_CAP);
}

// Cherche uniquement dans : word, reading, romaji, meanings (primary/secondary) — jamais dans
// les exemples de phrases, qui ne font pas partie du champ de recherche voulu.
function searchVocabItems(items, q) {
    return items.filter(w => {
        if (w.word && w.word.includes(q)) return true;
        if (w.reading && w.reading.includes(q)) return true;
        if (w.romaji && w.romaji.toLowerCase().includes(q)) return true;
        const m = w.meanings;
        if (m) {
            if (typeof m === 'string' && m.toLowerCase().includes(q)) return true;
            if (m.primary && m.primary.toLowerCase().includes(q)) return true;
            if (Array.isArray(m.secondary) && m.secondary.some(s => s.toLowerCase().includes(q))) return true;
        }
        return false;
    }).slice(0, SEARCH_RESULTS_CAP);
}

// Cherche uniquement dans : item, item_romaji, pattern, title, unit_title, badge — jamais dans
// le contenu des sections (explications) ni dans les exemples de phrases.
function searchGrammarItems(items, q) {
    return items.filter(l => {
        if (l.item && l.item.toLowerCase().includes(q)) return true;
        if (l.item_romaji && l.item_romaji.toLowerCase().includes(q)) return true;
        if (l.pattern && l.pattern.toLowerCase().includes(q)) return true;
        if (l.title && l.title.toLowerCase().includes(q)) return true;
        if (l.unit_title && l.unit_title.toLowerCase().includes(q)) return true;
        if (l.badge && l.badge.toLowerCase().includes(q)) return true;
        return false;
    }).slice(0, SEARCH_RESULTS_CAP);
}

function searchKanaItems(q) {
    const all = [...getKanaFlatList('hira'), ...getKanaFlatList('kata')];
    return all.filter(k =>
        k.char === q || (k.romaji && k.romaji.toLowerCase().includes(q))
    ).slice(0, SEARCH_RESULTS_CAP);
}

async function performUnifiedSearch(q, filters) {
    const results = { kanji: [], vocab: [], grammar: [], kana: [] };
    const activeTypes = filters.types.size ? filters.types : new Set(['vocab', 'grammar', 'kanji', 'kana']);
    const levels = filters.levels.size ? [...filters.levels] : ALL_JLPT_LEVELS;

    if (activeTypes.has('kanji')) {
        results.kanji = searchKanjiItems(q, levels);
    }
    if (activeTypes.has('kana')) {
        results.kana = searchKanaItems(q);
    }
    if (activeTypes.has('vocab')) {
        for (const level of levels) {
            const vd = await getLevelVocabData(level);
            if (vd && vd.data) results.vocab.push(...searchVocabItems(vd.data, q).map(w => ({ ...w, _level: level })));
        }
        results.vocab = results.vocab.slice(0, SEARCH_RESULTS_CAP);
    }
    if (activeTypes.has('grammar')) {
        for (const level of levels) {
            const gd = await getLevelGrammarData(level);
            if (gd && gd.data) results.grammar.push(...searchGrammarItems(gd.data, q).map(l => ({ ...l, _level: level })));
        }
        results.grammar = results.grammar.slice(0, SEARCH_RESULTS_CAP);
    }
    return results;
}

function buildSearchSection(type, itemsHtml) {
    if (!itemsHtml.length) return '';
    const s = SEARCH_TYPE_STYLE[type];
    return `<div class="search-section">
        <div class="search-section-title">
            <span class="search-section-icon" style="background:${s.color}22;color:${s.color}">${s.char}</span>
            ${s.label} <span class="search-section-count">${itemsHtml.length}</span>
        </div>
        ${itemsHtml.join('')}
    </div>`;
}

function renderSearchResults(results, query) {
    const el = document.getElementById('search-results');
    const total = results.kanji.length + results.vocab.length + results.grammar.length + results.kana.length;

    if (total === 0) {
        el.innerHTML = `<div class="search-empty"><div class="big">🙅</div>Aucun résultat pour « ${query} »</div>`;
        return;
    }

    let html = '';
    html += buildSearchSection('vocab', results.vocab.map(buildVocabHitHtml));
    html += buildSearchSection('grammar', results.grammar.map(buildGrammarHitHtml));
    html += buildSearchSection('kanji', results.kanji.map(buildKanjiHitHtml));
    html += buildSearchSection('kana', results.kana.map(buildKanaHitHtml));
    el.innerHTML = html;
}

function buildVocabHitHtml(w) {
    const meaning = (w.meanings && (w.meanings.primary || w.meanings)) || '';
    const typeColor = SEARCH_TYPE_STYLE.vocab.color;
    const levelColor = (state.jlptMapping && state.jlptMapping.levels[w._level]) ? state.jlptMapping.levels[w._level].color : typeColor;
    return `<div class="search-hit" onclick="openVocabFromSearch('${w.id}','${w._level}')">
        <div class="search-hit-char-word" style="color:${typeColor};background:${typeColor}18;border:1px solid ${typeColor}40">${w.word || ''}</div>
        <div class="search-hit-info">
            <div class="search-hit-meaning">${meaning}</div>
            <div class="search-hit-readings">${w.reading || ''}${w.romaji ? ' · ' + w.romaji : ''}</div>
        </div>
        <span class="search-hit-badge" style="background:${levelColor}22;color:${levelColor};border:1px solid ${levelColor}44">${w._level.toUpperCase()}</span>
    </div>`;
}

function buildGrammarHitHtml(l) {
    const typeColor = SEARCH_TYPE_STYLE.grammar.color;
    const levelColor = (state.jlptMapping && state.jlptMapping.levels[l._level]) ? state.jlptMapping.levels[l._level].color : typeColor;
    return `<div class="search-hit" onclick="openGrammarFromSearch('${l.id}','${l._level}')">
        <div class="search-hit-char-word" style="color:${typeColor};background:${typeColor}18;border:1px solid ${typeColor}40">${l.item || l.pattern || ''}</div>
        <div class="search-hit-info">
            <div class="search-hit-meaning">${l.title || ''}</div>
            <div class="search-hit-readings">${l.pattern && l.pattern !== l.item ? l.pattern : ''}</div>
        </div>
        <span class="search-hit-badge" style="background:${levelColor}22;color:${levelColor};border:1px solid ${levelColor}44">${l._level.toUpperCase()}</span>
    </div>`;
}

function buildKanjiHitHtml(k) {
    const safeChar = k.char.replace(/'/g, "\\'");
    const level = getJLPTLevel(k.grade);
    const typeColor = SEARCH_TYPE_STYLE.kanji.color;
    const levelColor = (state.jlptMapping && state.jlptMapping.levels['n' + level]) ? state.jlptMapping.levels['n' + level].color : typeColor;
    return `<div class="search-hit" onclick="openKanjiFromSearchHit('${safeChar}');closeSearchOverlay();">
        <div class="search-hit-char" style="color:${typeColor};background:${typeColor}18;border:1px solid ${typeColor}40">${k.char}</div>
        <div class="search-hit-info">
            <div class="search-hit-meaning">${k.meanings[0]}${k.meanings[1] ? ' · ' + k.meanings[1] : ''}</div>
            <div class="search-hit-readings">${[...k.on.slice(0, 3), ...k.kun.slice(0, 2)].join('  ')}</div>
        </div>
        <span class="search-hit-badge" style="background:${levelColor}22;color:${levelColor};border:1px solid ${levelColor}44">N${level}</span>
    </div>`;
}

// Équivalent du onclick="openDetail(kanjiDb[kanjiMap.get('${safeChar}')])" du monolithe —
// adapté car state.data.kanjiDb/kanjiMap sont des propriétés d'un import de module,
// inaccessibles depuis un attribut onclick (contexte global). Même principe que
// replayKanaTraceQuiz dans features/kana.js.
export function openKanjiFromSearchHit(char) {
    const idx = state.data.kanjiMap.get(char);
    if (idx === undefined) return;
    openDetail(state.data.kanjiDb[idx]);
}

function buildKanaHitHtml(k) {
    const typeColor = SEARCH_TYPE_STYLE.kana.color;
    return `<div class="search-hit" onclick='openKanaDetail(${JSON.stringify(k)});closeSearchOverlay();'>
        <div class="search-hit-char" style="color:${typeColor};background:${typeColor}18;border:1px solid ${typeColor}40">${k.char}</div>
        <div class="search-hit-info">
            <div class="search-hit-meaning">${k.romaji || ''}</div>
        </div>
    </div>`;
}

/**
 * Ouvre une fiche vocab "à froid" (sans être passé par la liste de son niveau au préalable).
 */
export async function openVocabFromSearch(wordId, level) {
    const vd = await getLevelVocabData(level);
    if (!vd || !vd.data) return;
    state.vocabHomeData = { levelId: level, data: vd.data, examples: vd.examples };
    closeAllOverlaysAndSessions();
    document.getElementById('main-content').innerHTML = `<div id="category-content" style="padding:16px"></div>`;
    showVocabDetail(wordId, vd.data);
}

/**
 * Ouvre une fiche grammaire "à froid" (sans être passé par la liste de son niveau).
 */
export async function openGrammarFromSearch(lessonId, level) {
    const gd = await getLevelGrammarData(level);
    if (!gd || !gd.data) return;
    state.grammarHomeData = { levelId: level, data: gd.data };
    closeAllOverlaysAndSessions();
    document.getElementById('main-content').innerHTML = `<div id="category-content" style="padding:16px"></div>`;
    showGrammarDetail(lessonId);
}

export async function doSearch(query) {
    const q = query.trim().toLowerCase();
    document.getElementById('search-clear').classList.toggle('show', q.length > 0);
    if (!q) { clearSearch(); return; }
    showSearchPanel();

    const results = await performUnifiedSearch(q, searchFilters);
    // Si l'utilisateur a continué à taper pendant le fetch, on ignore ce résultat périmé
    if (document.getElementById('search-input').value.trim().toLowerCase() !== q) return;
    renderSearchResults(results, query);
}

/* ══════════════════════════════════════════════════
   MICRO RECHERCHE — supporte japonais et français
   ─────────────────────────────────────────────────
   Dans le monolithe, initMicSearch() s'auto-exécute via setTimeout(initMicSearch, 300) au
   chargement du script. En ESM, exportée pour être appelée explicitement par app.js lors du
   bootstrap (même traitement que window.onpopstate -> initNavigation() dans
   core/navigation.js) — pas d'effet de bord au chargement du module.
══════════════════════════════════════════════════ */
export function initMicSearch() {
    const micBtn = document.getElementById('mic-search-trigger');
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!micBtn || !SR) {
        if (micBtn) { micBtn.style.opacity = '0.3'; micBtn.title = 'Reconnaissance vocale non supportée'; }
        return;
    }
    let isListening = false;
    micBtn.onclick = (e) => {
        e.stopPropagation();
        if (isListening) return;
        isListening = true;
        micBtn.classList.add('listening');
        const inputVal = document.getElementById('search-input').value;
        const isLatin = /^[a-zA-ZÀ-ÿ\s]*$/.test(inputVal.trim());
        const langOrder = isLatin ? ['fr-FR', 'ja-JP'] : ['ja-JP', 'fr-FR'];
        const rec = new SR();
        rec.continuous = false;
        rec.interimResults = false;
        rec.maxAlternatives = 3;
        rec.lang = langOrder[0];
        rec.start();
        rec.onresult = (ev) => {
            let best = '';
            for (let i = 0; i < ev.results[0].length; i++) {
                const t = ev.results[0][i].transcript.trim();
                if (t.length > best.length) best = t;
            }
            if (best) {
                document.getElementById('search-input').value = best;
                document.getElementById('search-clear').classList.add('show');
                doSearch(best);
            }
        };
        rec.onerror = (ev) => { console.warn('Mic error:', ev.error); };
        rec.onend = () => { micBtn.classList.remove('listening'); isListening = false; };
    };
}
