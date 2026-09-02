/* ══════════════════════════════════════════════════
   kanji.js — Logique principale
   Charger APRÈS hanzi-writer.js dans index.html :
     <script src="hanzi-writer.js"></script>
     <script src="kanji.js"></script>
══════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════
   QUIZ OVERRIDES — Lectures prioritaires
   Consultés en premier par getBestReading() avant
   d'utiliser les données de kanji_jouyou_fr.json.
   Couvrent les kanji courants mal interprétés.
══════════════════════════════════════════════════ */
const quizOverrides = {
    // --- CHIFFRES & COMPTAGE (Déjà faits, je complète) ---
    "一":"いち","二":"に","三":"さん","四":"よん","五":"ご",
    "六":"ろく","七":"なな","八":"はち","九":"きゅう","十":"じゅう",
    "百":"ひゃく","千":"せん","万":"まん","円":"えん",

    // --- TEMPS & NATURE (Lectures les plus usuelles) ---
    "日":"にち","月":"がつ","年":"ねん","時":"じ","分":"ふん","週":"しゅう","今":"いま",
    "火":"ひ","水":"みず","木":"き","金":"かね","土":"つち",
    "天":"てん","気":"き","雨":"あめ","雪":"ゆき","風":"かぜ","空":"そら",

    // --- HUMAINS & CORPS ---
    "人":"ひと","子":"こ","女":"おんな","男":"おとこ","父":"ちち","母":"はは",
    "私":"わたし","友":"とも","体":"からだ","目":"め","耳":"みみ","口":"くち",
    "手":"て","足":"あし","心":"こころ","力":"ちから",

    // --- DIRECTIONS & POSITIONS ---
    "上":"うえ","下":"した","左":"ひだり","右":"みぎ","中":"なか","外":"そと",
    "北":"きた","南":"みなみ","東":"ひがし","西":"にし","前":"まえ","後":"うしろ",
    "間":"あいだ","近":"ちかい","遠":"とおい",

    // --- VERBES (Forme dictionnaire complète) ---
    "食":"たべる","飲":"のむ","行":"いく","来":"くる","見":"みる","聞":"きく",
    "書":"かく","言":"いう","話":"はなす","読":"よむ","買":"かう","売":"うる",
    "立":"たつ","歩":"あるく","走":"はしる","持":"もつ","待":"まつ","作":"つくる",
    "休":"やすむ","会":"あう","知":"しる","思":"おもう","切":"きる",

    // --- ADJECTIFS ---
    "大":"おおきい","小":"ちいさい","高":"たかい","長":"ながい","白":"しろい",
    "赤":"あかい","青":"あおい","黒":"くろい","安":"やすい","新":"あたらしい",
    "古":"ふるい","多":"おおい","少":"すくない","早":"はやい",

    // --- ÉDUCATION & SOCIÉTÉ ---
    "学":"まなぶ", "校":"こう", "先":"さき", "生":"せい", "文":"ぶん",
    "字":"じ", "本":"ほん", "名":"なまえ", "正":"ただしい", "立":"たつ",
    "社":"しゃ", "員":"いん", "工":"こう", "場":"ばしょ", "国":"くに",

    // --- NATURE & ÉLÉMENTS AVANCÉS ---
    "海":"うみ", "地":"ち", "野":"の", "山":"やま", "川":"かわ",
    "石":"いし", "花":"はな", "竹":"たけ", "草":"くさ", "虫":"むし",
    "鳥":"とり", "魚":"さかな", "肉":"にく", "茶":"ちゃ", "米":"こめ",

    // --- VIE QUOTIDIENNE ---
    "家":"いえ", "族":"ぞく", "兄":"あに", "姉":"あね", "弟":"おとうと",
    "妹":"いもうと", "自":"みずから", "店":"みせ", "色":"いろ", "物":"もの",
    "服":"ふく", "犬":"いぬ", "猫":"ねこ", "牛":"うし", "馬":"うま",

    // --- MOUVEMENT & ÉTAT ---
    "入":"はいる", "出":"でる", "開":"あける", "閉":"しめる", "始":"はじまる",
    "終":"おわる", "使":"つかう", "動":"うごく", "止":"とまる", "考":"かんがえる",
    "急":"いそぐ", "決":"きめる", "送":"おくる", "待":"まつ", "借":"かりる",

    // --- QUALITÉS & SENS ---
    "好":"すき", "嫌":"きらい", "楽":"たのしい", "苦":"くるしい", "暗":"くらい",
    "明":"あかるい", "重":"おもい", "軽":"かるい", "広":"ひろい", "早":"はやい",
    "遅":"おそい", "強":"つよい", "弱":"よわい", "寒":"さむい", "暑":"あつい",

    // --- VILLE & VOYAGE ---
    "町":"まち", "村":"むら", "京":"きょう", "都":"と", "道":"みち",
    "駅":"えき", "車":"くるま", "自":"じ", "転":"てん", "船":"ふね",
    "旅":"たび", "荷":"に", "図":"ず", "書":"しょ", "館":"かん"
};

/* ══════════════════════════════════════════════════
   QUIZ VOCAL — NORMALISATION DU RÉSULTAT MICRO
   Gère : chiffres arabes, kanji+okurigana, katakana
══════════════════════════════════════════════════ */

// Table inverse : chiffre arabe → hiragana
const arabicToHira = {
    '0':'ぜろ','1':'いち','2':'に','3':'さん','4':'よん','5':'ご',
    '6':'ろく','7':'なな','8':'はち','9':'きゅう','10':'じゅう',
    '11':'じゅういち','12':'じゅうに','20':'にじゅう',
    '100':'ひゃく','1000':'せん','10000':'まん'
};

// Katakana → hiragana
const toHira = s => s.replace(/[\u30a1-\u30f6]/g,
    c => String.fromCharCode(c.charCodeAt(0) - 0x60));

// Hiragana → Katakana (inverse de toHira) — pour l'affichage On'yomi
const toKata = s => s.replace(/[\u3041-\u3096]/g,
    c => String.fromCharCode(c.charCodeAt(0) + 0x60));

// Nettoie et normalise ce que le micro a capté
function normalizeOralResult(raw) {
    let s = raw.replace(/[。\.、，？！!\?\s「」『』]/g, '').trim();

    // 1. Chiffre arabe → hiragana (le moteur retourne "8" pour "はち")
    if (arabicToHira[s]) return arabicToHira[s];

    // 2. Katakana → hiragana
    s = toHira(s);

    // 3. Si le résultat contient encore des kanji, remplacer chaque kanji
    //    par sa lecture via quizOverrides (sans okurigana ni point)
    if (/[\u4e00-\u9fff]/.test(s)) {
        s = s.replace(/[\u4e00-\u9fff]/g, kanji => {
            const ov = quizOverrides[kanji];
            if (ov) return toHira(ov.replace(/[.\-][^\s]*$/, '')); // stem seulement
            return kanji; // garde le kanji si pas de mapping connu
        });
        s = toHira(s);
    }

    return s;
}

// Vérifie si le résultat brut du micro correspond à une lecture valide du kanji
function isResultCorrect(rawResult, kanjiChar, kanjiData) {
    const s = normalizeOralResult(rawResult);

    // --- Cas 1 : résultat = kanji cible seul ou kanji + okurigana ---
    // ex. "入る" quand on attendait "はいる"
    const kanjiRegex = new RegExp('^' + kanjiChar + '(.*)$');
    const kanjiMatch = rawResult.match(kanjiRegex);
    if (kanjiMatch) {
        const okuInResult = toHira(kanjiMatch[1]); // la partie kana après le kanji
        // Chercher un KUN reading dont l'okurigana correspond
        return (kanjiData.kun || []).some(kun => {
            const dotIdx = kun.indexOf('.');
            if (dotIdx === -1) {
                // Pas d'okurigana attendue : résultat doit être juste le kanji
                return okuInResult === '';
            }
            const expectedOku = toHira(kun.slice(dotIdx + 1).split('/')[0]);
            return okuInResult === '' || okuInResult === expectedOku;
        }) || (kanjiData.on || []).length > 0 && okuInResult === '';
    }

    // --- Cas 2 : comparaison sur toutes les lectures valides ---
    const allReadings = getAllValidReadings(kanjiData);
    return allReadings.some(r => {
        // Normalise la lecture attendue (retire okurigana, point, tiret)
        const clean = toHira(r.replace(/[.\-].*/, '').replace(/[/\s].*/, '').trim());
        return s === clean;
    });
}

/* ── QUIZ VOCAL ── */
function startOralTest(kanjiChar) {
    const kanjiData = kanjiDb.find(k => k.char === kanjiChar);
    if (!kanjiData) return;

    const bestRead = getBestReading(kanjiData);

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const fb  = document.getElementById('voice-feedback');
    const btn = document.getElementById('btn-oral-test');

    if (!SpeechRecognition) {
        if (fb) { fb.style.color = '#e55'; fb.textContent = 'Micro non supporté sur ce navigateur'; }
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'ja-JP';
    recognition.interimResults = false;
    recognition.maxAlternatives = 3; // plus d'alternatives pour augmenter les chances

    if (btn) btn.classList.add('listening');
    if (fb)  { fb.style.color = 'var(--gray)'; fb.textContent = '🎤 En écoute…'; }
    recognition.start();

    recognition.onresult = (event) => {
        if (btn) btn.classList.remove('listening');

        // Essayer toutes les alternatives retournées par le moteur
        const alternatives = Array.from({ length: event.results[0].length },
            (_, i) => event.results[0][i].transcript.trim());

        const isCorrect = alternatives.some(alt => isResultCorrect(alt, kanjiChar, kanjiData));
        const displayed = alternatives[0]; // pour l'affichage

        if (isCorrect) {
            if (fb) { fb.style.color = 'var(--accent)'; fb.textContent = `✔ Correct ! « ${displayed} »`; }
            localStorage.setItem('mastered_' + kanjiChar, 'true');
            const dm = document.getElementById('d-mastery');
            if (dm) dm.innerText = '✔';
        } else {
            const hint = getAllValidReadings(kanjiData).slice(0,3)
                .map(r => toHira(r.replace(/[.\-].*/, ''))).join(', ');
            if (fb) { fb.style.color = '#e55'; fb.textContent = `✘ Dit : « ${displayed} » — Attendu : ${bestRead}  (${hint})`; }
        }
    };

    recognition.onerror = (e) => {
        if (btn) btn.classList.remove('listening');
        if (fb)  { fb.style.color = '#e55'; fb.textContent = 'Erreur micro : ' + e.error; }
    };

    recognition.onspeechend = () => recognition.stop();
}

/* ══════════════════════════════════════════════════
   STATE
══════════════════════════════════════════════════ */
let exemplesDb   = {};
let jlptMapping  = null;    // Mapping JLPT (chargé depuis data/mapping.json)
let exemplesByLevel = {};  // {n5: {...}, n4: {...}, ...} — exemples contextualisés
let kanjiDb  = [];
let kanjiMap = new Map();   // char → index dans kanjiDb  (O(1) lookup)
let categories = new Map(); // catId → {id, label, color, short, indices[]}
let seriesMap  = new Map(); // seriesId → {id, catId, label, indices[]}
let writer = null, currentChar = null, currentType = null;
let kanaAnimTimeouts = [], fetchCtrl = null;
let currentCatId = null;    // catégorie affichée
let currentJLPTLevel = null; // niveau JLPT actuel ('n5', 'n4', etc.)
let grammarHomeData = null;  // {levelId, data, examples} pour la page d'accueil grammar
let quizState = null;       // {indices, shuffled, idx, score, answered, title, sourceType, sourceId}
let searchOpen = false;

const SERIES_SIZE = 20;

/* ══════════════════════════════════════════════════
   TRACKING & PERSISTENCE (LocalStorage)
══════════════════════════════════════════════════ */
const STORAGE_KEY = 'kanji_trad_tracking';

function getTracking() {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
}

function saveTracking(tracking) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tracking));
}

function trackItem(itemId, status) {
    const tracking = getTracking();
    if (!tracking[itemId]) tracking[itemId] = {};
    
    if (status === null || status === 'null') {
        delete tracking[itemId];
    } else {
        tracking[itemId].status = status;
        tracking[itemId].lastUpdate = new Date().toISOString();
    }
    
    saveTracking(tracking);
    return tracking[itemId];
}

function getItemStatus(itemId) {
    return getTracking()[itemId]?.status || null;
}

/* ══════════════════════════════════════════════════
   WEB SPEECH API - Prononciation
══════════════════════════════════════════════════ */
function speakText(text, lang = 'ja-JP') {
    if (typeof SpeechSynthesisUtterance !== 'undefined') {
        const synth = window.speechSynthesis;
        if (synth.speaking) synth.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;
        utterance.rate = 0.8;
        utterance.pitch = 1;
        synth.speak(utterance);
    }
}

/* ══════════════════════════════════════════════════
   MAPPING CATÉGORIES : Anglais → Français
══════════════════════════════════════════════════ */
const VOCAB_CATEGORY_MAP = {
    'action': '🎬 Action',
    'color': '🎨 Couleurs',
    'descriptor': '✨ Descripteurs',
    'nature': '🌿 Nature',
    'time': '⏰ Temps',
    'food': '🍜 Nourriture',
    'body': '🏃 Corps',
    'weather': '⛅ Météo',
    'direction': '🧭 Directions',
    'people': '👥 Personnes',
    'family': '👨‍👩‍👧‍👦 Famille',
    'place': '🏠 Lieux',
    'object': '📦 Objets',
    'state': '💫 État',
    'communication': '💬 Communication',
    'movement': '🚶 Mouvement',
    'question': '❓ Questions',
    'interrogative': '❓ Interrogatifs',
    'number': '🔢 Nombres',
    'animal': '🐶 Animaux',
    'abstract': '🧠 Concepts',
    'art': '🎭 Arts',
    'language': '🗣️ Langues',
    'clothing': '👕 Vêtements',
    'phrase': '💭 Expressions',
    'grammar': '📚 Grammaire'
};

const GRAMMAR_TYPE_MAP = {
    'copula': 'Copule (être)',
    'verb-form': 'Formes verbales',
    'particle': 'Particules',
    'adjective': 'Adjectifs',
    'verb-phrase': 'Expressions verbales',
    'suffix': 'Suffixes',
    'expression': 'Expressions',
    'comparison': 'Comparaisons',
    'quotation': 'Citations',
    'opinion': 'Opinions',
    'conjunction': 'Conjonctions',
    'time-clause': 'Clauses temporelles'
};

/* ══════════════════════════════════════════════════
   DÉFINITIONS DE CATÉGORIES
══════════════════════════════════════════════════ */
const CAT_DEFS = [
    { id:"p1",  label:"Primaire 1", color:"#3ecf8e", short:"小1" },
    { id:"p2",  label:"Primaire 2", color:"#3ecf8e", short:"小2" },
    { id:"p3",  label:"Primaire 3", color:"#3ecf8e", short:"小3" },
    { id:"p4",  label:"Primaire 4", color:"#3ecf8e", short:"小4" },
    { id:"p5",  label:"Primaire 5", color:"#3ecf8e", short:"小5" },
    { id:"p6",  label:"Primaire 6", color:"#3ecf8e", short:"小6" },
    { id:"c1",  label:"Collège 1",  color:"#6c7bff", short:"中1" },
    { id:"c2",  label:"Collège 2",  color:"#6c7bff", short:"中2" },
    { id:"c3",  label:"Collège 3",  color:"#6c7bff", short:"中3" },
    { id:"hyo", label:"Hyōgaigai", color:"#e07b54", short:"表外" },
];

/* ══════════════════════════════════════════════════
   CONSTRUCTION DES STRUCTURES DE DONNÉES
══════════════════════════════════════════════════ */
function buildCategories() {
    const pBuckets = { "1":[], "2":[], "3":[], "4":[], "5":[], "6":[] };
    const collegeIdx = [], hyoIdx = [];

    kanjiDb.forEach((k, i) => {
        const c = String(k.grade ?? '').trim();
        if (pBuckets[c])       pBuckets[c].push(i);
        else if (c === '8')    collegeIdx.push(i);
        else                   hyoIdx.push(i);      // null, '', ou toute autre valeur
    });

    // Division du collège en 3 parts égales (par ordre d'apparition dans le JSON)
    const n = collegeIdx.length;
    const cut1 = Math.floor(n / 3), cut2 = Math.floor(2 * n / 3);
    const collegeParts = [
        collegeIdx.slice(0, cut1),
        collegeIdx.slice(cut1, cut2),
        collegeIdx.slice(cut2)
    ];

    categories.clear();
    CAT_DEFS.forEach(def => {
        let indices;
        const num = def.id[1];
        if      (def.id.startsWith('p')) indices = pBuckets[num] || [];
        else if (def.id === 'c1')        indices = collegeParts[0];
        else if (def.id === 'c2')        indices = collegeParts[1];
        else if (def.id === 'c3')        indices = collegeParts[2];
        else                             indices = hyoIdx;
        categories.set(def.id, { ...def, indices });
    });
}

function buildSeries() {
    seriesMap.clear();
    const MIN = 10, MAX = 20;
    for (const [catId, cat] of categories) {
        const { indices } = cat;
        if (!indices.length) continue;

        // Découpage en chunks de MAX
        const chunks = [];
        for (let i = 0; i < indices.length; i += MAX) {
            chunks.push(indices.slice(i, i + MAX));
        }

        // Fusion de la dernière chunk si elle est < MIN
        if (chunks.length >= 2 && chunks[chunks.length - 1].length < MIN) {
            const last = chunks.pop();
            chunks[chunks.length - 1] = chunks[chunks.length - 1].concat(last);
        }

        // Enregistrement avec plages de kanji (début–fin, 1-indexé)
        let offset = 0;
        chunks.forEach((chunk, i) => {
            const start = offset + 1;
            const end   = offset + chunk.length;
            const sid   = `${catId}_s${i + 1}`;
            seriesMap.set(sid, {
                id:    sid,
                catId,
                label: `Série ${i + 1}`,
                range: `${start}–${end}`,
                start,
                end,
                indices: chunk
            });
            offset += chunk.length;
        });
    }
}

/* ══════════════════════════════════════════════════
   UTILITAIRES
══════════════════════════════════════════════════ */
// Résoudre des indices → objets kanji (lecture seule, pas de copie)
function resolveKanjis(indices) {
    return indices.map(i => kanjiDb[i]);
}

/* ══════════════════════════════════════════════════
   LOGIQUE "MEILLEUR MATCH" — Règle d'or des lectures
   ─────────────────────────────────────────────────
   Algorithme :
   1. Extraire les racines WK (kun d'abord, puis on).
      Les entrées préfixées par "!" sont prioritaires.
   2. Pour chaque racine WK (ex: "た" depuis "!た") :
      chercher dans k.kun une entrée qui COMMENCE par
      cette racine (ex: "た.べる") → nettoyer → "たべる"
   3. Si aucun match kun, tenter avec on + wk_on.
   4. Fallback : first kun nettoyé, puis first on.
══════════════════════════════════════════════════ */
function kanjiDataLoader(char, onLoad, onError) {
    const cdn = `https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0/${char}.json`;
    const gh  = `https://raw.githubusercontent.com/chanind/hanzi-writer-data-jp/master/data/${char}.json`;
    fetch(gh)
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(onLoad)
        .catch(() =>
            fetch(cdn)
                .then(r => r.ok ? r.json() : Promise.reject())
                .then(onLoad)
                .catch(() => { if (typeof onError === 'function') onError(); })
        );
}

function getBestReading(k) {
    // --- NOUVEAU : Priorité absolue aux exceptions manuelles ---
    if (typeof quizOverrides !== 'undefined' && quizOverrides[k.char]) {
        return quizOverrides[k.char];
    }

    // Nettoyage d'une lecture brute : retire point et tiret et ce qui suit
    const clean = r => r.replace(/[.·＊*].*/, '').replace(/-.*/, '').replace(/^!/, '').trim();

    // Extraire les racines WK, priorité aux "!" en tête de liste
    const wkRoots = (arr) => {
        const priority = arr.filter(r => r.startsWith('!')).map(r => clean(r));
        const normal   = arr.filter(r => !r.startsWith('!')).map(r => clean(r));
        return [...priority, ...normal].filter(Boolean);
    };

    // Rechercher dans un tableau de lectures la première qui commence par la racine
    const findMatch = (readings, root) =>
        readings.find(r => clean(r).startsWith(root));

    // --- Étape 1 : WK KUN → KUN dict ---
    for (const root of wkRoots(k.wk_kun || [])) {
        const match = findMatch(k.kun, root);
        if (match) return clean(match);
    }

    // --- Étape 2 : WK ON → ON dict ---
    for (const root of wkRoots(k.wk_on || [])) {
        const match = findMatch(k.on, root);
        if (match) return clean(match);
    }

    // --- Étape 3 : WK racine directe (si déjà complète) ---
    const allWk = [...wkRoots(k.wk_kun || []), ...wkRoots(k.wk_on || [])];
    if (allWk.length > 0) return allWk[0];

    // --- Étape 4 : Fallback dictionnaire ---
    if (k.kun && k.kun.length) return clean(k.kun[0]);
    if (k.on && k.on.length)   return clean(k.on[0]);
    return '?';
}

// Toutes les lectures valides pour comparaison vocale (nettoyées + romaji)
function getAllValidReadings(k) {
    const clean = r => r.replace(/[.·＊*].*/, '').replace(/-.*/, '').replace(/^!/, '').trim();
    const set = new Set();
    // Meilleure lecture en tête
    set.add(getBestReading(k));
    // Toutes les lectures kun et on nettoyées
    k.kun.forEach(r => { const c = clean(r); if (c) set.add(c); });
    k.on.forEach(r  => { const c = clean(r); if (c) set.add(c); });
    // Versions romaji
    [...set].forEach(r => { const ro = kanaToRomaji(r); if (ro !== r) set.add(ro); });
    return [...set].filter(Boolean);
}

/* ── HELPER : génère les chips ON/KUN pour l'affichage quiz ──────────────
   Retourne du HTML avec toutes les lectures ON (fond vert) et KUN (fond bleu).
   clean : retire point/tiret/okurigana et déduplication.
   maxOn / maxKun : limite d'affichage pour ne pas saturer l'interface.
   showBadge : affiche le label ON / KUN sur chaque chip.
───────────────────────────────────────────────────────────────────────── */
function buildReadingChips(k, { maxOn = 4, maxKun = 4, showBadge = true, chipStyle = '' } = {}) {
    const clean = r => r.replace(/[.·＊*].*/, '').replace(/-.*/, '').replace(/^!/, '').trim();
    const seen  = new Set();

    const onChips = (k.on || [])
        .map(clean).filter(r => r && !seen.has(r) && seen.add(r))
        .slice(0, maxOn)
        .map(r => `<span class="quiz-reading-chip on-chip" style="display:inline-flex;flex-direction:column;align-items:center;${chipStyle}">
            ${showBadge ? '<span style="font-size:7px;opacity:0.65;line-height:1;margin-bottom:1px;font-weight:800;letter-spacing:.5px">ON</span>' : ''}
            <span class="chip-text" style="white-space:nowrap">${r}</span>
        </span>`).join('');

    const kunChips = (k.kun || [])
        .map(clean).filter(r => r && !seen.has(r) && seen.add(r))
        .slice(0, maxKun)
        .map(r => `<span class="quiz-reading-chip kun-chip" style="display:inline-flex;flex-direction:column;align-items:center;${chipStyle}">
            ${showBadge ? '<span style="font-size:7px;opacity:0.65;line-height:1;margin-bottom:1px;font-weight:800;letter-spacing:.5px">KUN</span>' : ''}
            <span class="chip-text" style="white-space:nowrap">${r}</span>
        </span>`).join('');

    if (!onChips && !kunChips) {
        // Fallback : afficher getBestReading si aucune lecture connue
        const best = getBestReading(k);
        return `<span class="quiz-reading-chip on-chip" ${chipStyle ? `style="${chipStyle}"` : ''}>
            <span class="chip-text">${best}</span>
        </span>`;
    }
    return onChips + kunChips;
}

// Label de réponse quiz : "Sens • meilleure lecture" (tronqué si besoin)
function choiceLabel(k) {
    const sens = k.meanings.filter(m => !m.toLowerCase().includes('radical'))[0] || k.meanings[0] || '?';
    const read = getBestReading(k);
    const full = read && read !== '?' ? `${sens} • ${read}` : sens;
    return full.length > 26 ? full.slice(0, 24) + '…' : full;
}

// Tirage aléatoire efficace de N leurres :
// Priorité au pool fourni (même série/catégorie), puis kanjiDb global en fallback
function pickDecoyIndices(excludeIdx, correctMeaning, count, preferredPool) {
    const result = [], tried = new Set([excludeIdx]);

    // Essayer d'abord dans le pool préféré (même catégorie/série)
    if (preferredPool && preferredPool.length > count + 1) {
        const shuffled = shuffleIndices([...preferredPool]);
        for (const i of shuffled) {
            if (result.length >= count) break;
            if (tried.has(i)) continue;
            tried.add(i);
            const k = kanjiDb[i];
            if (!k?.meanings[0] || k.meanings[0] === correctMeaning) continue;
            result.push(i);
        }
    }

    // Compléter depuis kanjiDb global si besoin
    let attempts = 0;
    while (result.length < count && attempts < 300) {
        const i = Math.floor(Math.random() * kanjiDb.length);
        attempts++;
        if (tried.has(i)) continue;
        tried.add(i);
        const k = kanjiDb[i];
        if (!k?.meanings[0] || k.meanings[0] === correctMeaning) continue;
        result.push(i);
    }
    return result;
}

// Fisher-Yates sur un tableau d'indices (in-place, retourne le même tableau)
function shuffleIndices(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/* ══════════════════════════════════════════════════
   RECHERCHE
══════════════════════════════════════════════════ */
// searchOpen already declared above
function toggleSearch() {
    searchOpen = !searchOpen;
    document.getElementById('search-bar').classList.toggle('open', searchOpen);
    // Changement ici : on s'assure que main-content existe pour éviter le plantage
    const main = document.getElementById('main-content');
    if(main) main.classList.toggle('search-open', searchOpen);

    if (searchOpen) {
        setTimeout(() => document.getElementById('search-input').focus(), 220);
        showSearchPanel();
    } else {
        hideSearchPanel();
        document.getElementById('search-input').value = '';
        document.getElementById('search-clear').classList.remove('show');
    }
}

// AJOUT : Fermeture au clic à l'extérieur
document.addEventListener('click', (e) => {
    const bar = document.getElementById('search-bar');
    const btn = document.getElementById('search-btn'); 
    if (searchOpen && bar && !bar.contains(e.target) && (!btn || !btn.contains(e.target))) {
        toggleSearch();
    }
});

function showSearchPanel() {
    document.getElementById('search-results').classList.add('open', 'with-bar');
}
function hideSearchPanel() {
    document.getElementById('search-results').classList.remove('open', 'with-bar');
}

function clearSearch() {
    document.getElementById('search-input').value = '';
    document.getElementById('search-clear').classList.remove('show');
    document.getElementById('search-results').innerHTML =
        '<div class="search-empty"><div class="big">🔎</div>Tapez un kanji, sa signification ou une lecture</div>';
    showSearchPanel();
}

// Table de conversion kana → romaji pour la recherche
const KANA_TO_ROMAJI = {"あ":"a","い":"i","う":"u","え":"e","お":"o","か":"ka","き":"ki","く":"ku","け":"ke","こ":"ko","さ":"sa","し":"shi","す":"su","せ":"se","そ":"so","た":"ta","ち":"chi","つ":"tsu","て":"te","と":"to","な":"na","に":"ni","ぬ":"nu","ね":"ne","の":"no","は":"ha","ひ":"hi","ふ":"fu","へ":"he","ほ":"ho","ま":"ma","み":"mi","む":"mu","め":"me","も":"mo","や":"ya","ゆ":"yu","よ":"yo","ら":"ra","り":"ri","る":"ru","れ":"re","ろ":"ro","わ":"wa","を":"wo","ん":"n","が":"ga","ぎ":"gi","ぐ":"gu","げ":"ge","ご":"go","ざ":"za","じ":"ji","ず":"zu","ぜ":"ze","ぞ":"zo","だ":"da","ぢ":"di","づ":"du","で":"de","ど":"do","ば":"ba","び":"bi","ぶ":"bu","べ":"be","ぼ":"bo","ぱ":"pa","ぴ":"pi","ぷ":"pu","ぺ":"pe","ぽ":"po","ア":"a","イ":"i","ウ":"u","エ":"e","オ":"o","カ":"ka","キ":"ki","ク":"ku","ケ":"ke","コ":"ko","サ":"sa","シ":"shi","ス":"su","セ":"se","ソ":"so","タ":"ta","チ":"chi","ツ":"tsu","テ":"te","ト":"to","ナ":"na","ニ":"ni","ヌ":"nu","ネ":"ne","ノ":"no","ハ":"ha","ヒ":"hi","フ":"fu","ヘ":"he","ホ":"ho","マ":"ma","ミ":"mi","ム":"mu","メ":"me","モ":"mo","ヤ":"ya","ユ":"yu","ヨ":"yo","ラ":"ra","リ":"ri","ル":"ru","レ":"re","ロ":"ro","ワ":"wa","ヲ":"wo","ン":"n"};
function kanaToRomaji(str) { return [...str].map(c => KANA_TO_ROMAJI[c] || c).join(''); }

function doSearch(query) {
    const q = query.trim().toLowerCase();
    document.getElementById('search-clear').classList.toggle('show', q.length > 0);
    if (!q) { clearSearch(); return; }
    showSearchPanel();

    const hits = kanjiDb.filter(k => {
        if (k.char === query) return true;
        if (k.meanings.some(m => m.toLowerCase().includes(q))) return true;
        if (k.on.some(r  => r.toLowerCase().includes(q))) return true;
        if (k.kun.some(r => r.replace(/[.\-].*/g,'').toLowerCase().includes(q))) return true;
        // Recherche romaji (ex: "ichi", "hito", "ka")
        if (k.on.some(r  => kanaToRomaji(r.toLowerCase()).includes(q))) return true;
        if (k.kun.some(r => kanaToRomaji(r.replace(/[\.\-].*/g,'')).includes(q))) return true;
        if (k.romaji && k.romaji.toLowerCase().includes(q)) return true;
        return false;
    }).slice(0, 60);

    const el = document.getElementById('search-results');
    if (!hits.length) {
        el.innerHTML = `<div class="search-empty"><div class="big">🙅</div>Aucun résultat pour « ${query} »</div>`;
        return;
    }
    el.innerHTML = hits.map(k => {
        const cat = [...categories.values()].find(c => c.indices.includes(kanjiMap.get(k.char)));
        const badge = cat
            ? `<span class="search-hit-badge" style="background:${cat.color}22;color:${cat.color};border:1px solid ${cat.color}44">${cat.short}</span>`
            : '';
        const safeChar = k.char.replace(/'/g, "\\'");
        // Ajout du toggleSearch() ici pour fermer la barre quand on clique sur un résultat
        return `<div class="search-hit" onclick="openDetail(kanjiDb[kanjiMap.get('${safeChar}')]);hideSearchPanel();toggleSearch()">
            <div class="search-hit-char">${k.char}</div>
            <div class="search-hit-info">
                <div class="search-hit-meaning">${k.meanings[0]}${k.meanings[1] ? ' · ' + k.meanings[1] : ''}</div>
                <div class="search-hit-readings">${[...k.on.slice(0,3), ...k.kun.slice(0,2)].join('  ')}</div>
            </div>
            ${badge}
        </div>`;
    }).join('');
}

// LOGIQUE MICRO RECHERCHE — supporte japonais et français
function initMicSearch() {
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
        // Langue auto : si champ vide ou dernière requête en latin → FR, sinon JP
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
            // Tenter la meilleure alternative parmi les 3
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
setTimeout(initMicSearch, 300);

/* ══════════════════════════════════════════════════
   SYSTÈME DE DOSSIERS / FAVORIS
   Stockage : localStorage clé 'kanji_folders_v1'
   Structure : { "Animaux": ["猫","犬"], ... }
══════════════════════════════════════════════════ */
const FOLDERS_KEY = 'kanji_folders_v1';

function loadFolders() {
    try { return JSON.parse(localStorage.getItem(FOLDERS_KEY)) || {}; }
    catch(_) { return {}; }
}

function saveFolders(folders) {
    try { localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders)); }
    catch(e) { console.warn('Folders save error:', e); }
}

function isKanjiInAnyFolder(char) {
    const f = loadFolders();
    return Object.values(f).some(arr => arr.includes(char));
}

function getFoldersContaining(char) {
    const f = loadFolders();
    return Object.keys(f).filter(name => f[name].includes(char));
}

function addKanjiToFolder(char, folderName) {
    const f = loadFolders();
    if (!f[folderName]) f[folderName] = [];
    if (!f[folderName].includes(char)) f[folderName].push(char);
    saveFolders(f);
}

function removeKanjiFromFolder(char, folderName) {
    const f = loadFolders();
    if (f[folderName]) {
        f[folderName] = f[folderName].filter(c => c !== char);
        if (f[folderName].length === 0) delete f[folderName];
    }
    saveFolders(f);
}

function renameFolder(oldName, newName) {
    if (!newName || oldName === newName) return false;
    const f = loadFolders();
    if (!f[oldName]) return false;
    if (f[newName]) return false; // doublon
    f[newName] = f[oldName];
    delete f[oldName];
    saveFolders(f);
    return true;
}

function deleteFolder(name) {
    const f = loadFolders();
    delete f[name];
    saveFolders(f);
}

// ── Modal dossiers ─────────────────────────────
let _fmChar = null;

function openFolderModal(char) {
    if (!char) return;
    _fmChar = char;
    document.getElementById('fm-kanji-label').textContent = `Kanji : ${char}`;
    document.getElementById('fm-new-inp').value = '';
    renderFolderModalList(char);
    document.getElementById('folder-modal').classList.add('open');
}

function closeFolderModal() {
    document.getElementById('folder-modal').classList.remove('open');
    _fmChar = null;
}

function renderFolderModalList(char) {
    const f       = loadFolders();
    const names   = Object.keys(f);
    const inList  = getFoldersContaining(char);
    const list    = document.getElementById('fm-folder-list');

    let html = '';

    // Bouton "Créer un nouveau dossier"
    html += `<div class="fm-item" onclick="toggleFmNewRow()">
        <span class="fm-item-icon">➕</span>
        <span class="fm-item-name" style="color:var(--accent)">Créer un nouveau dossier</span>
    </div>`;

    if (names.length === 0) {
        html += `<div style="padding:20px;text-align:center;color:var(--gray);font-size:13px">
            Aucun dossier encore créé</div>`;
    } else {
        names.forEach(name => {
            const isIn  = inList.includes(name);
            const count = f[name].length;
            html += `<div class="fm-item" onclick="toggleKanjiInFolder('${char.replace(/'/g,"\\'")}','${name.replace(/'/g,"\\'")}')">
                <span class="fm-item-icon">📁</span>
                <span class="fm-item-name">${name}</span>
                <span class="fm-item-count">${count} kanji</span>
                <span class="fm-item-check">${isIn ? '✔' : ''}</span>
            </div>`;
        });
    }

    list.innerHTML = html;
}

function toggleKanjiInFolder(char, folderName) {
    const inList = getFoldersContaining(char);
    if (inList.includes(folderName)) {
        removeKanjiFromFolder(char, folderName);
    } else {
        addKanjiToFolder(char, folderName);
    }
    renderFolderModalList(char);
    updateSaveBtnState(char);
}

function toggleFmNewRow() {
    const row = document.getElementById('fm-new-row');
    const inp = document.getElementById('fm-new-inp');
    const isHidden = row.style.display === 'none';
    row.style.display = isHidden ? '' : 'none';
    if (isHidden) setTimeout(() => inp.focus(), 50);
}

function confirmNewFolder() {
    const inp  = document.getElementById('fm-new-inp');
    const name = inp.value.trim();
    if (!name) { inp.focus(); return; }
    if (!_fmChar) return;

    addKanjiToFolder(_fmChar, name);
    inp.value = '';
    document.getElementById('fm-new-row').style.display = 'none';
    renderFolderModalList(_fmChar);
    updateSaveBtnState(_fmChar);
}

// ── Bouton ⭐ dans la fiche ─────────────────────
function updateSaveBtnState(char) {
    const btn  = document.getElementById('btn-save-kanji');
    const icon = document.getElementById('save-icon');
    if (!btn || !icon) return;
    const saved = isKanjiInAnyFolder(char);
    icon.textContent = saved ? '★' : '⭐';
    btn.classList.toggle('saved', saved);
    btn.title = saved ? 'Enregistré — cliquer pour modifier' : 'Enregistrer dans un dossier';
}

// ── Page "Mes Dossiers" ─────────────────────────
function navFolders() {
    toggleSidebar(false);
    document.getElementById('page-title').innerText = '📁 Mes Dossiers';
    renderFoldersPage();
}

function renderFoldersPage() {
    const main    = document.getElementById('main-content');
    const folders = loadFolders();
    const names   = Object.keys(folders);

    main.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.className = 'folders-wrap';

    if (names.length === 0) {
        wrap.innerHTML = `<div class="folder-empty">
            <div class="folder-empty-icon">📂</div>
            <div class="folder-empty-text">Aucun dossier créé.<br>
            Ouvrez une fiche kanji et appuyez sur ⭐ pour commencer.</div>
        </div>`;
        main.appendChild(wrap);
        return;
    }

    // Bouton "Créer un dossier vide"
    wrap.innerHTML = `<button onclick="promptCreateEmptyFolder()"
        style="width:100%;padding:12px;margin-bottom:16px;background:none;border:1px dashed var(--accent);border-radius:10px;color:var(--accent);font-size:13px;cursor:pointer;font-family:inherit;">
        ➕ Créer un dossier vide
    </button>`;

    names.forEach(name => {
        const kanjis = folders[name];
        const card   = document.createElement('div');
        card.className = 'folder-card';

        const kanjiChips = kanjis.map(c =>
            `<span class="folder-kanji-chip" onclick="event.stopPropagation();openKanjiFromChar('${c}')"
                title="${getKanjiMeaning(c)}">${c}</span>`
        ).join('');

        const safeN = name.replace(/'/g,"\\'");
        card.innerHTML = `
            <div class="folder-card-header">
                <span class="folder-card-icon">📁</span>
                <span class="folder-card-name">${name}</span>
                <span class="folder-card-count">${kanjis.length} kanji</span>
            </div>
            <div class="folder-card-kanjis">${kanjiChips || '<span style="color:var(--gray);font-size:12px">Dossier vide</span>'}</div>
            <div class="folder-card-actions">
                <button class="folder-action-btn" onclick="promptRenameFolder('${safeN}')">✏ Renommer</button>
                <button class="folder-action-btn" onclick="startFolderQuiz('${safeN}')">⚡ Quiz</button>
                <button class="folder-action-btn danger" onclick="promptDeleteFolder('${safeN}')">🗑 Supprimer</button>
            </div>`;

        wrap.appendChild(card);
    });

    main.appendChild(wrap);
}

function getKanjiMeaning(char) {
    const k = kanjiDb.find(k => k.char === char);
    if (!k) return char;
    return k.meanings.filter(m => !m.toLowerCase().includes('radical'))[0] || k.meanings[0] || '';
}

function openKanjiFromChar(char) {
    const idx = kanjiMap.get(char);
    if (idx === undefined) return;
    openDetail(kanjiDb[idx]);
}

function promptCreateEmptyFolder() {
    const name = prompt('Nom du nouveau dossier :');
    if (!name || !name.trim()) return;
    const f = loadFolders();
    if (!f[name.trim()]) { f[name.trim()] = []; saveFolders(f); }
    renderFoldersPage();
}

function promptRenameFolder(oldName) {
    const newName = prompt(`Renommer "${oldName}" en :`, oldName);
    if (!newName || !newName.trim() || newName.trim() === oldName) return;
    if (!renameFolder(oldName, newName.trim())) {
        alert('Un dossier avec ce nom existe déjà.');
        return;
    }
    renderFoldersPage();
}

function promptDeleteFolder(name) {
    if (!confirm(`Supprimer le dossier "${name}" ?\nLes kanjis ne seront pas supprimés, seulement le dossier.`)) return;
    deleteFolder(name);
    renderFoldersPage();
}

function startFolderQuiz(folderName) {
    const folders = loadFolders();
    const chars   = folders[folderName];
    if (!chars || chars.length < 2) {
        alert('Il faut au moins 2 kanjis dans le dossier pour lancer un quiz.');
        return;
    }
    // Construire un pool ad hoc d'indices
    const indices = chars.map(c => kanjiMap.get(c)).filter(i => i !== undefined);
    if (indices.length < 2) return;

    // Stocker temporairement dans quizState en utilisant startQuiz avec type 'folder'
    // On passe par un mode catégorie inline
    const tempId = '__folder__' + folderName;
    // Créer une entrée temporaire dans les catégories
    categories.set(tempId, { id: tempId, label: `📁 ${folderName}`, short: '📁', indices, color: '#f5a623' });
    showQuizModeModal('category', tempId);
}

/* ══════════════════════════════════════════════════
   SIDEBAR
══════════════════════════════════════════════════ */
function toggleSidebar(show) {
    document.getElementById('sidebar').classList.toggle('open', show);
    document.getElementById('overlay').classList.toggle('show', show);
}

function renderSidebar() {
    const c = document.getElementById('grade-list');
    c.innerHTML = '';

    // Si le mapping JLPT n'est pas chargé, afficher un message
    if (!jlptMapping) {
        c.innerHTML = '<div style="color:var(--gray);font-size:13px;padding:12px">Chargement des niveaux…</div>';
        return;
    }

    // Afficher les niveaux JLPT
    for (const [levelId, levelData] of Object.entries(jlptMapping.levels)) {
        const item = document.createElement('div');
        item.className = 'nav-grade-item';
        
        item.innerHTML = `
            <div class="nav-badge" style="background:${levelData.color}22;color:${levelData.color};border:1px solid ${levelData.color}44">${levelData.label}</div>
            <div class="nav-grade-text">
                <div class="main">${levelData.label_full}</div>
                <div class="sub">${levelData.count} kanji</div>
            </div>`;

        // Clic : charger le niveau JLPT et afficher le sélecteur de catégories
        item.onclick = () => {
            currentJLPTLevel = levelId;
            showLevelCategorySelector(levelId);
            toggleSidebar(false);
        };

        c.appendChild(item);
    }
}

/* ══════════════════════════════════════════════════
   LEVEL CATEGORY SELECTOR — Onglets Kanji | Vocab | Grammar
══════════════════════════════════════════════════ */
function showLevelCategorySelector(levelId) {
    if (!jlptMapping || !jlptMapping.levels[levelId]) return;
    
    const levelData = jlptMapping.levels[levelId];
    const mainContent = document.getElementById('main-content');
    
    // Construire les onglets
    const tabs = levelData.categories.map(cat => {
        const catData = jlptMapping.categories[cat];
        return `<button class="tab-btn" data-category="${cat}" onclick="loadJLPTCategory('${levelId}', '${cat}')" style="flex:1;padding:12px;background:rgba(255,255,255,0.05);border:none;color:var(--gray);font-size:14px;cursor:pointer;transition:all 0.15s;border-bottom:2px solid transparent" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">
            ${catData.icon} ${catData.label}
        </button>`;
    }).join('');
    
    mainContent.innerHTML = `
        <div style="display:flex;flex-direction:column;height:100%;gap:0">
            <div style="padding:16px;border-bottom:1px solid var(--border);background:var(--surface)">
                <div style="font-size:24px;font-weight:bold;margin-bottom:8px">${levelData.label_full}</div>
                <div style="font-size:13px;color:var(--gray)">${levelData.description}</div>
            </div>
            <div style="display:flex;gap:0;border-bottom:1px solid var(--border)">
                ${tabs}
            </div>
            <div id="category-content" style="flex:1;overflow-y:auto;padding:16px">
                <div style="text-align:center;color:var(--gray);margin-top:40px">
                    <div class="spinner" style="margin-bottom:16px"></div>
                    Chargement…
                </div>
            </div>
        </div>`;
    
    // Charger la première catégorie par défaut (kanji)
    if (levelData.categories.length > 0) {
        loadJLPTCategory(levelId, levelData.categories[0]);
    }
}

async function loadJLPTCategory(levelId, category) {
    const container = document.getElementById('category-content');
    if (!container) return;
    
    try {
        container.innerHTML = '<div style="text-align:center;color:var(--gray)"><div class="spinner" style="margin-bottom:16px"></div>Chargement…</div>';
        
        // Charger le fichier JSON correspondant
        const url = `./data/${levelId}/${category}.json`;
        const res = await fetch(url);
        
        if (!res.ok) {
            throw new Error(`Fichier non trouvé : ${url}`);
        }
        
        const data = await res.json();
        
        // Charger aussi les exemples si c'est vocab ou grammar
        let examples = null;
        if (category === 'vocab' || category === 'grammar') {
            try {
                const exRes = await fetch(`./data/${levelId}/exemples.json`);
                if (exRes.ok) {
                    examples = await exRes.json();
                }
            } catch (e) {
                console.warn(`Exemples non trouvés pour ${levelId}:`, e);
            }
        }
        
        // Afficher selon la catégorie
        if (category === 'kanji') {
            displayKanjiList(levelId, data);
        } else if (category === 'vocab') {
            displayVocabList(levelId, data, examples);
        } else if (category === 'grammar') {
            showGrammarHome(levelId, data, examples);
        }
        
        // Marquer l'onglet comme actif
        document.querySelectorAll('.tab-btn').forEach(btn => {
            if (btn.dataset.category === category) {
                btn.style.borderBottomColor = 'var(--accent)';
                btn.style.color = '#fff';
            } else {
                btn.style.borderBottomColor = 'transparent';
                btn.style.color = 'var(--gray)';
            }
        });
        
    } catch (e) {
        container.innerHTML = `<div style="color:#e55;font-size:13px;padding:20px;text-align:center">Erreur : ${e.message}</div>`;
        console.error('loadJLPTCategory error:', e);
    }
}

function displayKanjiList(levelId, data) {
    const container = document.getElementById('category-content');
    if (!data.chars || !Array.isArray(data.chars)) {
        container.innerHTML = '<div style="color:var(--gray)">Structure invalide</div>';
        return;
    }
    
    // Créer une grille de kanji cliquables
    const grid = data.chars.map(char => {
        const kanjiData = kanjiDb.find(k => k.char === char);
        if (!kanjiData) return '';
        return `<div onclick="openDetail({char:'${char}'})" style="padding:16px;text-align:center;border:1px solid var(--border);border-radius:8px;cursor:pointer;transition:all 0.15s;background:var(--surface)" onmouseover="this.style.background='rgba(255,255,255,0.08)'" onmouseout="this.style.background='var(--surface)'">
            <div style="font-size:32px;font-weight:bold">${char}</div>
            <div style="font-size:11px;color:var(--gray);margin-top:6px">${kanjiData.meanings[0] || '–'}</div>
        </div>`;
    }).join('');
    
    container.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(80px,1fr));gap:8px">
            ${grid}
        </div>`;
}

function displayVocabList(levelId, data, examples = null) {
    const container = document.getElementById('category-content');
    if (!Array.isArray(data)) {
        container.innerHTML = '<div style="color:var(--gray)">Structure invalide</div>';
        return;
    }
    
    // Grouper par catégorie
    const grouped = {};
    data.forEach(word => {
        const cat = word.category || 'other';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(word);
    });
    
    // Trier les catégories
    const sortedCats = Object.keys(grouped).sort();
    
    // Construire l'HTML
    let html = '<div style="display:flex;flex-direction:column;gap:16px">';
    
    sortedCats.forEach(cat => {
        const label = VOCAB_CATEGORY_MAP[cat] || `📌 ${cat}`;
        const words = grouped[cat];
        
        const wordCards = words.map(word => {
            // Charger les exemples pour ce mot s'ils existent
            const wordExamples = examples && examples.vocab && examples.vocab[word.id] ? examples.vocab[word.id] : [];
            const exHTML = wordExamples.length > 0 
                ? `<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border);font-size:10px;color:var(--gray)">
                    ${wordExamples.slice(0, 1).map(ex => `
                        <div style="margin-top:6px;padding:6px;background:rgba(0,0,0,0.2);border-radius:4px;line-height:1.3">
                            <div style="color:#fff;font-size:11px">${ex.jp}</div>
                            <div style="color:var(--accent);font-size:9px;margin-top:2px">${ex.ro}</div>
                            <div style="color:var(--gray);font-size:10px;margin-top:2px">${ex.fr}</div>
                        </div>
                    `).join('')}
                </div>`
                : '';
            
            return `
                <div style="padding:10px;background:rgba(255,255,255,0.02);border-left:3px solid var(--accent);border-radius:6px">
                    <div style="font-size:13px;font-weight:bold;color:#fff">${word.word}</div>
                    <div style="font-size:11px;color:var(--accent);margin-top:2px">${word.reading}</div>
                    <div style="font-size:12px;color:var(--gray);margin-top:4px;line-height:1.4">${word.meanings.join(' • ')}</div>
                    <div style="font-size:9px;color:var(--gray);margin-top:4px;opacity:0.6">${word.type}</div>
                    ${exHTML}
                </div>
            `;
        }).join('');
        
        html += `
            <div style="border:1px solid var(--border);border-radius:10px;overflow:hidden;background:var(--surface)">
                <div style="padding:12px;background:rgba(0,201,167,0.1);border-bottom:1px solid var(--border);cursor:pointer;user-select:none;" onclick="this.parentElement.querySelector('[data-words]').style.display = this.parentElement.querySelector('[data-words]').style.display === 'none' ? 'block' : 'none'; this.parentElement.querySelector('[data-arrow]').style.transform = this.parentElement.querySelector('[data-words]').style.display === 'none' ? 'rotate(0deg)' : 'rotate(90deg)'">
                    <div style="display:flex;align-items:center;gap:8px">
                        <span data-arrow style="display:inline-block;transition:transform 0.2s;transform:rotate(90deg)">▶</span>
                        <span style="font-size:13px;font-weight:bold">${label}</span>
                        <span style="font-size:11px;color:var(--gray);margin-left:auto">${words.length} mots</span>
                    </div>
                </div>
                <div data-words style="padding:12px;display:flex;flex-direction:column;gap:8px">
                    ${wordCards}
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

/* ══════════════════════════════════════════════════
   GRAMMAR - PAGE D'ACCUEIL STYLE HIBI
══════════════════════════════════════════════════ */
function showGrammarHome(levelId, data, examples = null) {
    const container = document.getElementById('category-content');
    if (!Array.isArray(data)) {
        container.innerHTML = '<div style="color:var(--gray)">Structure invalide</div>';
        return;
    }
    
    grammarHomeData = {levelId, data, examples};
    
    const tracking = getTracking();
    const mastered = Object.values(tracking).filter(t => t.status === 'mastered').length;
    const total = data.length;
    const progress = Math.round((mastered / total) * 100);
    
    const grouped = {};
    data.forEach(pattern => {
        const type = pattern.type || 'other';
        if (!grouped[type]) grouped[type] = [];
        grouped[type].push(pattern);
    });
    
    const sortedTypes = Object.keys(grouped).sort();
    
    let html = `<div style="display:flex;flex-direction:column;gap:16px">
        <div style="padding:16px;background:var(--surface);border-radius:10px;border:1px solid var(--border)">
            <div style="font-size:13px;color:var(--gray);margin-bottom:8px;text-transform:uppercase">Progression ${levelId.toUpperCase()}</div>
            <div style="font-size:28px;font-weight:bold;margin-bottom:8px">${mastered}/${total}</div>
            <div style="background:rgba(0,0,0,0.2);border-radius:4px;height:8px;overflow:hidden">
                <div style="background:var(--accent);height:100%;width:${progress}%;transition:width 0.3s"></div>
            </div>
            <div style="font-size:12px;color:var(--gray);margin-top:8px">${progress}% maîtrisé</div>
        </div>
        ${sortedTypes.map(type => {
            const patterns = grouped[type];
            const typeLabel = GRAMMAR_TYPE_MAP[type] || type;
            const typeMastered = patterns.filter(p => getItemStatus(p.id) === 'mastered').length;
            return `<div style="border:1px solid var(--border);border-radius:10px;overflow:hidden;background:var(--surface)">
                <div style="padding:12px;background:rgba(155,139,255,0.1);border-bottom:1px solid var(--border);cursor:pointer" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none';this.querySelector('[data-arrow]').style.transform=this.nextElementSibling.style.display==='none'?'rotate(0deg)':'rotate(90deg)'">
                    <div style="display:flex;justify-content:space-between">
                        <div><span data-arrow style="display:inline-block;transition:transform 0.2s;transform:rotate(90deg)">▶</span> <span style="font-size:13px;font-weight:bold">${typeLabel}</span></div>
                        <div style="font-size:11px;color:var(--gray)">${typeMastered}/${patterns.length}</div>
                    </div>
                </div>
                <div style="padding:8px;display:flex;flex-direction:column;gap:6px">
                    ${patterns.map(p => {
                        const s = getItemStatus(p.id);
                        return `<div style="padding:10px;background:rgba(255,255,255,0.02);border-left:3px solid var(--accent);border-radius:6px;cursor:pointer;display:flex;justify-content:space-between" onclick="showGrammarDetail('${p.id}')">
                            <div><div style="font-size:12px;font-weight:bold;color:#fff">${p.pattern}</div><div style="font-size:11px;color:var(--gray);margin-top:2px">${p.meaning.substring(0,45)}...</div></div>
                            <div style="font-size:14px">${s === 'mastered' ? '✓' : s === 'favorited' ? '❤' : ''}</div>
                        </div>`;
                    }).join('')}
                </div>
            </div>`;
        }).join('')}
    </div>`;
    
    container.innerHTML = html;
}

function showGrammarDetail(patternId) {
    const {levelId, data, examples} = grammarHomeData || {};
    const container = document.getElementById('category-content');
    const pattern = data.find(p => p.id === patternId);
    
    if (!pattern) {
        container.innerHTML = '<div style="color:var(--gray)">Pattern non trouvé</div>';
        return;
    }
    
    const patternExamples = examples && examples.grammar && pattern.examples
        ? pattern.examples.slice(0, 3).map(exId => ({id: exId, ...examples.grammar[exId]})).filter(ex => ex.jp)
        : [];
    
    const status = getItemStatus(pattern.id);
    
    let html = `<div style="display:flex;flex-direction:column;gap:16px">
        <div style="padding:16px;background:var(--surface);border-radius:10px;border:1px solid var(--border)">
            <button onclick="showGrammarHome(grammarHomeData.levelId, grammarHomeData.data, grammarHomeData.examples)" style="background:none;border:none;color:var(--accent);cursor:pointer;font-size:13px;margin-bottom:12px">← Retour</button>
            <div style="font-size:32px;font-weight:bold;color:var(--accent);margin-bottom:8px">${pattern.pattern}</div>
            <div style="font-size:16px;color:#fff;line-height:1.4">${pattern.meaning}</div>
            <div style="display:flex;gap:8px;margin-top:12px">
                <button onclick="trackItem('${pattern.id}', '${status === 'favorited' ? 'null' : 'favorited'}'); showGrammarHome(grammarHomeData.levelId, grammarHomeData.data, grammarHomeData.examples)" style="flex:1;padding:8px;background:${status === 'favorited' ? 'rgba(255,56,129,0.2)' : 'rgba(255,255,255,0.05)'};border:1px solid var(--border);border-radius:6px;color:#fff;cursor:pointer;font-size:12px">❤ ${status === 'favorited' ? 'Favorisé' : 'Favoriser'}</button>
                <button onclick="trackItem('${pattern.id}', '${status === 'mastered' ? 'null' : 'mastered'}'); showGrammarHome(grammarHomeData.levelId, grammarHomeData.data, grammarHomeData.examples)" style="flex:1;padding:8px;background:${status === 'mastered' ? 'rgba(0,201,167,0.2)' : 'rgba(255,255,255,0.05)'};border:1px solid var(--border);border-radius:6px;color:#fff;cursor:pointer;font-size:12px">✓ ${status === 'mastered' ? 'Maîtrisé' : 'Marquer maîtrisé'}</button>
            </div>
        </div>
        ${patternExamples.length > 0 ? `<div style="padding:16px;background:var(--surface);border-radius:10px;border:1px solid var(--border)">
            <div style="font-size:11px;color:var(--gray);text-transform:uppercase;margin-bottom:12px;font-weight:bold">Exemples</div>
            ${patternExamples.map(ex => `<div style="padding:12px;background:rgba(255,255,255,0.02);border-left:3px solid var(--accent);border-radius:6px;margin-bottom:8px;cursor:pointer" onclick="speakText('${ex.jp.replace(/'/g, "\\'")}')" title="Cliquer pour écouter">
                <div style="font-size:14px;color:#fff;margin-bottom:4px">${ex.jp}</div>
                <div style="font-size:11px;color:var(--accent);margin-bottom:4px">${ex.ro}</div>
                <div style="font-size:12px;color:var(--gray)">${ex.fr}</div>
            </div>`).join('')}
        </div>` : ''}
    </div>`;
    
    container.innerHTML = html;
}

function displayGrammarList(levelId, data, examples = null) {
    const container = document.getElementById('category-content');
    if (!Array.isArray(data)) {
        container.innerHTML = '<div style="color:var(--gray)">Structure invalide</div>';
        return;
    }
    
    // Grouper par type de grammaire
    const grouped = {};
    data.forEach(pattern => {
        const type = pattern.type || 'other';
        if (!grouped[type]) grouped[type] = [];
        grouped[type].push(pattern);
    });
    
    // Trier les types
    const sortedTypes = Object.keys(grouped).sort();
    
    // Construire l'HTML : afficher comme des leçons
    let html = '<div style="display:flex;flex-direction:column;gap:16px">';
    
    sortedTypes.forEach(type => {
        const label = GRAMMAR_TYPE_MAP[type] || type;
        const patterns = grouped[type];
        
        const patternCards = patterns.map((pattern, idx) => {
            // DEBUG
            if (idx === 0) console.log('Pattern 1:', pattern, 'Examples:', pattern.examples, 'Grammar DB:', examples?.grammar ? Object.keys(examples.grammar).length : 'none');
            
            // Charger les exemples réels pour ce pattern
            const patternExamples = examples && examples.grammar && pattern.examples
                ? pattern.examples.slice(0, 2).map(exId => examples.grammar[exId]).filter(ex => ex)
                : [];
            
            const exHTML = patternExamples.length > 0
                ? `<div data-examples style="display:none;margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">
                    <div style="font-size:11px;color:var(--gray);margin-bottom:8px;font-weight:bold">Exemples :</div>
                    ${patternExamples.map(ex => `
                        <div style="font-size:11px;padding:8px;background:rgba(0,0,0,0.2);border-radius:4px;margin-bottom:6px;line-height:1.4">
                            <div style="color:#fff;font-size:12px">${ex.jp}</div>
                            <div style="color:var(--accent);font-size:10px;margin-top:3px">${ex.ro}</div>
                            <div style="color:var(--gray);font-size:11px;margin-top:3px">${ex.fr}</div>
                        </div>
                    `).join('')}
                </div>`
                : '<div data-examples style="display:none;margin-top:10px;padding-top:10px;border-top:1px solid var(--border);font-size:11px;color:var(--gray)">Pas d\'exemples disponibles</div>';
            
            return `
                <div style="padding:12px;background:rgba(255,255,255,0.02);border-left:3px solid #9b8bff;border-radius:6px;cursor:pointer;transition:all 0.15s;user-select:none" onclick="const ex = this.querySelector('[data-examples]'); ex.style.display = ex.style.display === 'none' ? 'block' : 'none'" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='rgba(255,255,255,0.02)'">
                    <div style="font-size:14px;font-weight:bold;color:var(--accent);margin-bottom:6px">${pattern.pattern}</div>
                    <div style="font-size:13px;color:#fff;line-height:1.4;margin-bottom:8px">${pattern.meaning}</div>
                    <div style="font-size:10px;color:var(--gray);opacity:0.6">Cliquez pour voir les exemples →</div>
                    ${exHTML}
                </div>
            `;
        }).join('');
        
        html += `
            <div style="border:1px solid var(--border);border-radius:10px;overflow:hidden;background:var(--surface)">
                <div style="padding:12px;background:rgba(155,139,255,0.1);border-bottom:1px solid var(--border);cursor:pointer;user-select:none;" onclick="this.parentElement.querySelector('[data-lessons]').style.display = this.parentElement.querySelector('[data-lessons]').style.display === 'none' ? 'block' : 'none'; this.parentElement.querySelector('[data-arrow]').style.transform = this.parentElement.querySelector('[data-lessons]').style.display === 'none' ? 'rotate(0deg)' : 'rotate(90deg)'">
                    <div style="display:flex;align-items:center;gap:8px">
                        <span data-arrow style="display:inline-block;transition:transform 0.2s;transform:rotate(90deg)">▶</span>
                        <span style="font-size:13px;font-weight:bold">${label}</span>
                        <span style="font-size:11px;color:var(--gray);margin-left:auto">${patterns.length} leçons</span>
                    </div>
                </div>
                <div data-lessons style="padding:12px;display:flex;flex-direction:column;gap:8px">
                    ${patternCards}
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

/* ══════════════════════════════════════════════════
   DASHBOARD
══════════════════════════════════════════════════ */
function showDashboard(isBack = false) {
    // Si ce n'est pas un retour arrière, on enregistre l'état
    if (!isBack) history.pushState({ view: 'dashboard' }, '');

    document.getElementById('main-content').innerHTML = `
        <div class="dash-wrap">
            <div class="welcome-box">
                <img src="https://api.dicebear.com/7.x/bottts/svg?seed=tanuki" class="tanuki-img" alt="">
                <div style="font-size:13px;line-height:1.6">
                    Bienvenue !<br>Choisissez une catégorie pour commencer.
                </div>
            </div>
            <div class="dash-card">
                <div class="streak-info">
                    <div><span class="streak-val">365</span><span class="streak-label">Série actuelle 🔥</span></div>
                    <div><span class="streak-val">365</span><span class="streak-label">Meilleure série</span></div>
                    <div><span class="streak-val">今日</span><span class="streak-label">Dernière étude</span></div>
                </div>
                <div class="dots-grid">${Array(28).fill(0).map((_,i)=>`<div class="dot${i===27?' active':''}"></div>`).join('')}</div>
            </div>
            <div class="dash-card">
                <div class="section-title" style="font-size:11px;color:var(--gray);text-transform:uppercase;letter-spacing:1px;margin-bottom:14px;">Niveaux de maîtrise</div>
                <div id="progression-list"></div>
            </div>
        </div>`;
    // Appel de la fonction de progression si nécessaire ici
    if (typeof renderDashboard === 'function') renderDashboard();
}

/* ══════════════════════════════════════════════════
   NAVIGATION
══════════════════════════════════════════════════ */
function navDashboard() {
    toggleSidebar(false);
    document.getElementById('page-title').innerText = '漢字 Study';
    showDashboard();
    renderDashboard();
}
function navKana() { toggleSidebar(false); loadKanas(); }

/* ── PAGE CATÉGORIE (Version épurée) ────────────────── */

function loadCategory(catId, isBack = false) {
    toggleSidebar(false);
    const cat = categories.get(catId);
    if (!cat) return;
    
    // Enregistrement de l'état
    if (!isBack) history.pushState({ view: 'category', id: catId }, '');

    currentCatId = catId;
    document.getElementById('page-title').innerText = cat.label;
    const catSeries = [...seriesMap.values()].filter(s => s.catId === catId);

    const seriesCards = catSeries.map(ser => {
        const firstKanji = kanjiDb[ser.indices[0]]?.char ?? '？';
        return `<div class="series-card" onclick="loadSeriesPage('${ser.id}')" style="display:flex; align-items:center; justify-content:space-between; cursor:pointer;">
            <div style="display:flex; align-items:center; gap:15px;">
                <div class="series-card-kanji">${firstKanji}</div>
                <div class="series-card-body">
                    <div class="series-card-num" style="font-weight:bold;">${ser.label}</div>
                    <div style="font-size:12px; color:var(--gray);">${ser.indices.length} Kanji</div>
                </div>
            </div>
                <div style="color:var(--gray); font-size:14px;">❯</div>
            </div>
        </div>`;
    }).join('');

    document.getElementById('main-content').innerHTML = `
        <button class="back-btn-top" onclick="showDashboard()" style="display: flex; align-items: center; gap: 8px; background: var(--surface); border: 1px solid var(--border); color: var(--gray); padding: 8px 12px; border-radius: 10px; font-size: 12px; font-weight: bold; cursor: pointer; margin-bottom: 20px;">
            ← ACCUEIL
        </button>
        <div class="grade-overview">
            <div class="grade-hero">
                <div class="grade-hero-top">
                    <div class="grade-hero-badge" style="background:${cat.color}22;color:${cat.color};border:1px solid ${cat.color}44">${cat.short}</div>
                    <div class="grade-hero-info">
                        <h2>${cat.label}</h2>
                        <p>${cat.indices.length} kanji · ${catSeries.length} séries</p>
                    </div>
                </div>
                <button class="grade-quiz-btn" onclick="showQuizModeModal('category','${catId}')">⚡ Quiz — Choisir un mode</button>
            </div>
            <div class="section-cards-title">Séries</div>
            <div class="series-grid">${seriesCards}</div>
        </div>`;
}

/* ── PAGE SÉRIE (Avec Bouton Retour) ──────────────── */
function loadSeriesPage(seriesId, isBack = false) {
    toggleSidebar(false);
    const ser = seriesMap.get(seriesId);
    if (!ser) return;

    // Enregistrement de l'état
    if (!isBack) history.pushState({ view: 'series', id: seriesId }, '');

    const cat = categories.get(ser.catId);
    document.getElementById('page-title').innerText = `${cat.label} · ${ser.label}`;

    document.getElementById('main-content').innerHTML = `
        <button class="back-btn-top" onclick="loadCategory('${ser.catId}')" style="display: flex; align-items: center; gap: 8px; background: var(--surface); border: 1px solid var(--border); color: var(--gray); padding: 8px 12px; border-radius: 10px; font-size: 12px; font-weight: bold; cursor: pointer; margin-bottom: 20px;">
            ← LISTE DES SÉRIES
        </button>
        <div class="list-header">
            <div>
                <div style="font-size:14px;font-weight:bold">${ser.label}</div>
                <div class="list-header-info">${cat.label} · ${ser.range} (${ser.indices.length} kanji)</div>
            </div>
            <button class="list-quiz-btn" onclick="showQuizModeModal('series','${seriesId}')">Quiz ▶</button>
        </div>
        <div id="series-kanji-list"></div>`;

    const list = document.getElementById('series-kanji-list');
    resolveKanjis(ser.indices).forEach(k => list.appendChild(makeKanjiRow(k)));
}

function makeKanjiRow(k) {
    const row = document.createElement('div');
    row.className = 'kanji-row';
    row.onclick = () => openDetail(k);
    row.innerHTML = `
        <div class="kanji-char-large">${k.char}</div>
        <div class="kanji-info-main">
            <div class="tag-container">
                ${k.on.slice(0,3).map(r => `<span class="tag tag-on">${r}</span>`).join('')}
                ${k.kun.slice(0,2).map(r => `<span class="tag tag-kun">${r.split('.')[0]}</span>`).join('')}
            </div>
            <div style="font-size:13px;color:var(--gray)">${k.meanings[0] || ''}</div>
        </div>
        <div class="kanji-row-stroke">${k.strokes}t</div>`;
    return row;
}


/* ══════════════════════════════════════════════════
   MODAL SÉLECTION DE MODE QUIZ
══════════════════════════════════════════════════ */
let _quizModalSource = { type: null, id: null };

function showQuizModeModal(sourceType, sourceId) {
    _quizModalSource = { type: sourceType, id: sourceId };
    const m = document.getElementById('quiz-mode-modal');
    m.classList.add('open');
    m.style.display = 'flex';
}

function closeQuizModal() {
    const m = document.getElementById('quiz-mode-modal');
    m.classList.remove('open');
    m.style.display = 'none';
}

function launchQuizMode(mode) {
    closeQuizModal();
    // Si on vient de la fiche kanji, la fermer d'abord
    if (_quizModalSource.type === 'single') closeDetail();
    startQuiz({ type: _quizModalSource.type, id: _quizModalSource.id, mode });
}

function launchStrokeMode(mode) {
    closeQuizModal();
    if (_quizModalSource.type === 'single') closeDetail();
    startStrokeQuiz({ type: _quizModalSource.type, id: _quizModalSource.id, mode });
}

/* ══════════════════════════════════════════════════
   QUIZ VOCAL — startVoiceRecognition()
   Appelé depuis le prompt du mode vocal dans renderQuizQuestion
══════════════════════════════════════════════════ */
let _vocalRecognition = null;
let _vocalListening   = false;

/* ════════════════════════════════════════════════════
   startVoiceRecognition(autoStart)
   ─────────────────────────────────────────────────
   Corrections :
   • Prend la transcription à PLUS HAUTE CONFIDENCE
   • onspeechend → stop propre avant onend
   • Abort sécurisé avec délai 100ms avant nouvelle instance
   • null-checks sur tous les éléments DOM
   • Comparaison élargie : exact, préfixe, forme courte/longue
   • Auto-start en mode survie (autoStart=true)
════════════════════════════════════════════════════ */
function startVoiceRecognition(autoStart = false) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
        const fb = document.getElementById('vocal-feedback');
        if (fb) { fb.style.color = '#e55'; fb.textContent = 'Micro non supporté sur ce navigateur.'; }
        return;
    }
    if (_vocalListening) return;

    if (!quizState) return;
    const k = kanjiDb[quizState.indices[quizState.idx]];
    const validReadings = getAllValidReadings(k);
    const bestRead      = getBestReading(k);

    // On réutilise les fonctions partagées normalizeOralResult + isResultCorrect
    // qui gèrent : chiffres arabes ("8"→"はち"), kanji+okurigana ("入る"), katakana, etc.
    const matches = (said) => {
        if (!said) return false;
        // Tester d'abord isResultCorrect (gère tous les cas complexes)
        if (isResultCorrect(said, k.char, k)) return true;
        // Fallback : comparaison souple sur le normalisé (startsWith pour les formes longues)
        const ns = normalizeOralResult(said);
        return validReadings.some(r => {
            const nr = toHira(r.replace(/[.·＊*\-].*/, '').replace(/^!/, '').trim());
            return nr && (nr === ns || ns.startsWith(nr) || nr.startsWith(ns));
        });
    };

    // Abort sécurisé : nullifier d'abord, aborter ensuite
    const oldRec = _vocalRecognition;
    _vocalRecognition = null;
    if (oldRec) { try { oldRec.abort(); } catch(e){} }

    const doStart = () => {
        const micBtn = document.getElementById('mic-btn');
        const fb     = document.getElementById('vocal-feedback');
        if (!micBtn) return; // question déjà changée

        const rec = new SR();
        _vocalRecognition = rec;
        _vocalListening   = true;

        rec.lang            = 'ja-JP';
        rec.continuous      = false;
        rec.interimResults  = false;
        rec.maxAlternatives = 5;

        rec.onstart = () => {
            const btn = document.getElementById('mic-btn');
            const f   = document.getElementById('vocal-feedback');
            if (btn) btn.classList.add('listening');
            if (f)   { f.style.color = 'var(--gray)'; f.textContent = 'Écoute en cours… parlez maintenant'; }
        };

        rec.onspeechend = () => { try { rec.stop(); } catch(e){} };

        rec.onresult = (ev) => {
            // Transcription à la PLUS HAUTE CONFIANCE
            let bestSaid = '', bestConf = -1;
            const result = ev.results[0];
            for (let i = 0; i < result.length; i++) {
                const alt = result[i];
                if (alt.confidence > bestConf) { bestConf = alt.confidence; bestSaid = alt.transcript.trim(); }
            }
            if (!bestSaid && result.length > 0) bestSaid = result[0].transcript.trim();

            const isCorrect = matches(bestSaid);

            const btn2 = document.getElementById('mic-btn');
            const fb2  = document.getElementById('vocal-feedback');
            if (btn2) btn2.classList.remove('listening');
            if (fb2) {
                if (isCorrect) {
                    fb2.style.color = 'var(--accent)';
                    fb2.textContent = `✔ Correct ! « ${bestSaid} »`;
                } else {
                    const alts = validReadings.filter(r => r !== bestRead).slice(0, 2).join(', ');
                    fb2.style.color = '#e55';
                    fb2.textContent = `✘ « ${bestSaid || '(rien)'} »  –  Attendu : ${bestRead}${alts ? '  (ou ' + alts + ')' : ''}`;
                }
            }

            if (!quizState || quizState.answered) return;
            quizState.answered = true;
            if (isCorrect) {
                quizState.correct++;
                const oc = document.getElementById('quiz-correct');
                if (oc) oc.textContent = quizState.correct;
            } else {
                quizState.wrong++;
                const ow = document.getElementById('quiz-wrong');
                if (ow) ow.textContent = quizState.wrong;
            }
            const next = quizState.idx + 1;
            const scoreEl = document.getElementById('quiz-score-sub');
            if (scoreEl) scoreEl.textContent = `${(quizState.correct / next * 10).toFixed(1)} / 10.0`;

            if (isCorrect) {
                setTimeout(() => { if (quizState) { quizState.idx++; renderQuizQuestion(); } }, 1000);
            } else {
                // Laisser réessayer après 2s
                setTimeout(() => {
                    if (!quizState) return;
                    quizState.answered = false;
                    _vocalListening = false;
                    const btn3 = document.getElementById('mic-btn');
                    const fb3  = document.getElementById('vocal-feedback');
                    if (btn3 && fb3) { fb3.style.color = 'var(--gray)'; fb3.textContent = 'Réessayez ou → pour passer'; }
                }, 2000);
            }
        };

        rec.onerror = (ev) => {
            _vocalListening = false;
            const btn = document.getElementById('mic-btn');
            const f   = document.getElementById('vocal-feedback');
            if (btn) btn.classList.remove('listening');
            if (f) {
                const msg = ev.error === 'no-speech'   ? 'Aucune voix détectée — réessayez'
                          : ev.error === 'not-allowed' ? 'Accès micro refusé (vérifiez les permissions)'
                          : 'Erreur : ' + ev.error;
                f.style.color = '#e55'; f.textContent = msg;
            }
        };

        rec.onend = () => {
            _vocalListening = false;
            const btn = document.getElementById('mic-btn');
            if (btn) btn.classList.remove('listening');
        };

        try { rec.start(); }
        catch(e) {
            _vocalListening = false;
            const f = document.getElementById('vocal-feedback');
            if (f) { f.style.color = '#e55'; f.textContent = 'Impossible de démarrer le micro : ' + e.message; }
        }
    };

    setTimeout(doStart, oldRec ? 100 : 0);
}


/* ══════════════════════════════════════════════════
   QUIZ — API FLEXIBLE
   startQuiz({ type: "category", id: "p1" })
   startQuiz({ type: "series",   id: "p1_s1" })
══════════════════════════════════════════════════ */
let quizTimerInterval = null;
let quizPaused = false;

function startQuiz({ type, id, mode = 'kanji-to-read' }) {
    let indices, title, poolIndices;

    if (type === 'category') {
        const cat = categories.get(id);
        if (!cat || !cat.indices.length) return;
        indices = shuffleIndices([...cat.indices]);
        poolIndices = [...cat.indices];
        title = cat.label;
    } else if (type === 'series') {
        const ser = seriesMap.get(id);
        if (!ser || !ser.indices.length) return;
        const cat = categories.get(ser.catId);
        indices = shuffleIndices([...ser.indices]);
        poolIndices = [...(cat?.indices ?? ser.indices)];
        title = `${cat?.label ?? ''} · ${ser.label}`;
    } else if (type === 'single') {
        // Un seul kanji — depuis la fiche détail
        const idx = kanjiMap.get(id);
        if (idx === undefined) return;
        indices = [idx];
        // Pool = toute la catégorie du kanji pour les leurres
        const cat = [...categories.values()].find(c => c.indices.includes(idx));
        poolIndices = cat ? [...cat.indices] : [...Array(kanjiDb.length).keys()];
        title = `Entraînement : ${id}`;
    } else { return; }

    if (quizTimerInterval) clearInterval(quizTimerInterval);
    quizPaused = false;

    // On ajoute le MODE ici
    quizState = {
        indices, poolIndices, idx: 0,
        correct: 0, wrong: 0,
        answered: false, revealed: false,
        title, sourceType: type, sourceId: id,
        elapsedSec: 0,
        mode: mode // <--- IMPORTANT : On stocke le mode choisi
    };

    document.getElementById('quiz-correct').textContent = '0';
    document.getElementById('quiz-wrong').textContent = '0';
    document.getElementById('quiz-timer').textContent = '0:00';
    document.getElementById('quiz-view').style.display = 'flex';

    quizTimerInterval = setInterval(() => {
        if (!quizPaused && quizState) {
            quizState.elapsedSec++;
            const m = Math.floor(quizState.elapsedSec / 60);
            const s = quizState.elapsedSec % 60;
            document.getElementById('quiz-timer').textContent = `${m}:${String(s).padStart(2,'0')}`;
        }
    }, 1000);

    renderQuizQuestion();
}

function closeQuiz() {
    if (quizTimerInterval) { clearInterval(quizTimerInterval); quizTimerInterval = null; }
    // Stopper la reconnaissance vocale si active
    if (_vocalRecognition) { try { _vocalRecognition.abort(); } catch(e){} _vocalRecognition = null; }
    _vocalListening = false;
    document.getElementById('quiz-view').style.display = 'none';
    quizState = null;
    quizPaused = false;
}

// Passer une question vocale (compté comme erreur)
function skipVocalQuestion() {
    if (!quizState || quizState.answered) return;
    if (_vocalRecognition) { try { _vocalRecognition.abort(); } catch(e){} _vocalRecognition = null; }
    _vocalListening = false;
    quizState.answered = true;
    quizState.wrong++;
    const ow = document.getElementById('quiz-wrong');
    if (ow) ow.textContent = quizState.wrong;
    const next = quizState.idx + 1;
    const scoreEl = document.getElementById('quiz-score-sub');
    if (scoreEl) scoreEl.textContent = `${(quizState.correct / next * 10).toFixed(1)} / 10.0`;
    setTimeout(() => { if (quizState) { quizState.idx++; renderQuizQuestion(); } }, 300);
}

function togglePause() {
    quizPaused = !quizPaused;
    document.querySelector('.quiz-pause-btn').textContent = quizPaused ? '▶' : '⏸';
}

/* ─────────────────────────────────────────────────
   PHASE 1 — Affichage lectures + sens (sans kanji)
───────────────────────────────────────────────── */
function renderQuizQuestion() {
    if (!quizState || quizState.idx >= quizState.indices.length) { renderQuizResults(); return; }

    const qs = quizState;
    const k = kanjiDb[qs.indices[qs.idx]];
    
    let currentMode = qs.mode;
    if (qs.mode === 'survie') {
        currentMode = ['kanji-to-read', 'kanji-to-mean', 'read-to-kanji', 'mean-to-kanji', 'vocal'][Math.floor(Math.random() * 5)];
    } else if (qs.mode === 'mixte') {
        currentMode = ['kanji-to-read', 'kanji-to-mean'][Math.floor(Math.random() * 2)];
    }

    document.getElementById('quiz-prog-bar').style.width = (qs.idx / qs.indices.length * 100).toFixed(1) + '%';
    document.getElementById('quiz-counter-sub').textContent = `${qs.idx + 1} / ${qs.indices.length}`;
    
    qs.answered = false;
    qs.revealed = false;

    const bestRead = getBestReading(k);
    const meaning = k.meanings.filter(m => !m.toLowerCase().includes('radical')).slice(0,2).join(' • ');

    let promptHtml = "";
    
    if (currentMode === 'vocal') {
        const vMeaning = k.meanings.filter(m => !m.toLowerCase().includes('radical')).slice(0,2).join(' · ') || k.meanings[0] || '?';
        const vChips   = buildReadingChips(k, { maxOn: 3, maxKun: 3, showBadge: true });
        promptHtml = `
            <div style="font-size:11px;color:var(--gray);text-transform:uppercase;letter-spacing:1px;margin-bottom:14px">Sens affiché — Prononcez la lecture</div>
            <div class="quiz-meaning-big" style="font-size:30px;font-weight:bold;margin-bottom:12px;">${vMeaning}</div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-bottom:18px;opacity:0.45"
                 title="Lectures possibles (aide — masquée volontairement)">${vChips}</div>
            <button id="mic-btn" class="mic-btn" onclick="startVoiceRecognition()" title="Appuyer pour parler">🎤</button>
            <div id="vocal-feedback" style="font-size:13px;color:var(--gray);margin-top:16px;min-height:22px;text-align:center;max-width:300px;line-height:1.5;"></div>
            <button onclick="skipVocalQuestion()" style="margin-top:18px;background:none;border:1px solid var(--border);color:var(--gray);padding:8px 20px;border-radius:8px;font-size:12px;cursor:pointer;font-family:inherit;">→ Passer</button>`;
    } else if (currentMode === 'kanji-to-read' || currentMode === 'kanji-to-mean') {
        // REMPLACÉ PAR LE CONTENEUR ANIMÉ
        promptHtml = `
            <div id="quiz-kanji-animated" class="quiz-kanji-animated"></div>
            <div class="quiz-tap-hint">Trouvez la bonne réponse</div>`;
    } else if (currentMode === 'read-to-kanji') {
        promptHtml = `
            <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-bottom:14px">
                ${buildReadingChips(k, { maxOn: 4, maxKun: 4, showBadge: true })}
            </div>
            <div class="quiz-tap-hint">Quel est le kanji correspondant ?</div>`;
    } else if (currentMode === 'mean-to-kanji') {
        promptHtml = `<div class="quiz-meaning-big">${meaning}</div>
                      <div class="quiz-tap-hint">Quel est le kanji correspondant ?</div>`;
    }

    const clickAttr = currentMode !== 'vocal' ? `onclick="revealChoices('${currentMode}')"` : "";

    document.getElementById('quiz-body').innerHTML = `
        <div class="quiz-prompt-wrap" id="quiz-prompt" ${clickAttr}>
            ${promptHtml}
            <div class="quiz-choices-grid" id="quiz-choices" style="display:none"></div>
        </div>`;


// --- INITIALISATION HANZIWRITER ---
if (currentMode === 'kanji-to-read' || currentMode === 'kanji-to-mean') {
    setTimeout(() => {
        const targetId = 'quiz-kanji-animated';
        const targetDiv = document.getElementById(targetId);
        
        if (!targetDiv) {
            console.error(`La div #${targetId} est introuvable dans le DOM.`);
            return;
        }

        // 1. On vide la div pour éviter les conflits d'anciennes animations
        targetDiv.innerHTML = '';

        // 2. On sécurise le caractère (on s'assure qu'on a bien une chaîne propre)
        const charToDraw = String(k.char).trim();

        const writer = HanziWriter.create(targetId, charToDraw, {
            width: 160,
            height: 160,
            padding: 5,
            strokeAnimationSpeed: 1,
            delayBetweenStrokes: 200,
            strokeColor:  '#00c9a7',
            outlineColor: '#18181f',   // = --surface, fond exact du writer-main
            charColor:    '#18181f',   // idem : traits non-animés invisibles sur fond
            showOutline: true,
            // L'outil de chargement blindé contre les bugs d'encodage
            charDataLoader: kanjiDataLoader,
            onLoadCharDataError: () => {
                if (targetDiv) targetDiv.innerHTML =
                    `<div style="font-size:90px;line-height:160px;text-align:center;color:#fff">${charToDraw}</div>`;
            }
        });
        
        writer.animateCharacter();
    }, 50);
}

    // --- AUTO-START MICRO en mode vocal ---
    // Délai de 650ms pour laisser le DOM se stabiliser et l'utilisateur lire le sens
    if (currentMode === 'vocal') {
        _vocalListening = false; // reset au cas où une session précédente traînerait
        setTimeout(() => {
            if (quizState && !quizState.answered) startVoiceRecognition(true);
        }, 650);
    }
}

/* ─────────────────────────────────────────────────
   PHASE 2 — Révélation des 6 kanjis (tap)
───────────────────────────────────────────────── */
function revealChoices(currentMode) {
    if (!quizState || quizState.revealed) return;
    quizState.revealed = true;

    const qs = quizState;
    const kIdx = qs.indices[qs.idx];
    const decoys = pickDecoyIndices(kIdx, kanjiDb[kIdx].meanings[0], 5, qs.poolIndices);
    const choices = shuffleIndices([kIdx, ...decoys]);

    const grid = document.getElementById('quiz-choices');
    grid.style.display = 'grid';
    if (currentMode === 'kanji-to-read') {
        grid.classList.add('chip-mode');
    } else {
        grid.classList.remove('chip-mode');
    }
    
    grid.innerHTML = choices.map(ci => {
        const target = kanjiDb[ci];
        let content = "";

        if (currentMode === 'kanji-to-read') {
            // Toutes les lectures ON + KUN en chips compactes (max 3+3)
            content = `<div style="display:flex;flex-wrap:wrap;gap:3px;justify-content:center;align-items:flex-start;width:100%">
                ${buildReadingChips(target, { maxOn: 3, maxKun: 3, showBadge: true, chipStyle: 'padding:3px 6px;font-size:12px;min-width:0' })}
            </div>`;
        } else if (currentMode === 'kanji-to-mean') {
            content = target.meanings.filter(m => !m.toLowerCase().includes('radical'))[0] || target.meanings[0] || '?';
        } else if (currentMode === 'read-to-kanji' || currentMode === 'mean-to-kanji') {
            content = target.char;
        } else {
            content = target.char;
        }

        const fontSize = (currentMode === 'read-to-kanji' || currentMode === 'mean-to-kanji') ? '36px' : '14px';
        const isChipMode = currentMode === 'kanji-to-read';

        return `<div class="quiz-kanji-choice" data-idx="${ci}" onclick="answerQuiz(this,${ci},${kIdx})"
            style="${isChipMode ? 'font-size:14px;align-items:center' : `font-size:${content.length > 8 ? '18px' : fontSize}`}">
            ${content}
        </div>`;
    }).join('');

    document.querySelectorAll('.quiz-tap-hint').forEach(h => h.style.display = 'none');
}

function toggleExamples() { /* placeholder pour une future expansion */ }

/* ─────────────────────────────────────────────────
   RÉPONSE
───────────────────────────────────────────────── */
let _qfmPending = null; // callback exécuté au clic "Continuer"

function showQuizFeedbackModal(k, isCorrect, onContinue) {
    _qfmPending = onContinue;

    const card = document.getElementById('qfm-card');
    card.classList.remove('correct', 'wrong');
    card.classList.add(isCorrect ? 'correct' : 'wrong');

    document.getElementById('qfm-kanji').textContent = k.char;

    const meanings = k.meanings.filter(m => !m.toLowerCase().includes('radical'));
    document.getElementById('qfm-meaning').textContent =
        (meanings.length ? meanings : k.meanings).slice(0, 3).join(' · ') || '–';

    const cleanReading = r => r.replace(/[.·＊*].*/, '').replace(/-.*/, '').replace(/^!/, '').trim();
    const seenOn = new Set(), seenKun = new Set();

    const onTags = (k.on || [])
        .map(cleanReading).filter(r => r && !seenOn.has(r) && seenOn.add(r))
        .map(r => `<span class="tag tag-on">${toKata(r)}</span>`).join('');
    const kunTags = (k.kun || [])
        .map(cleanReading).filter(r => r && !seenKun.has(r) && seenKun.add(r))
        .map(r => `<span class="tag tag-kun">${toHira(r)}</span>`).join('');

    document.getElementById('qfm-on').innerHTML  = onTags  || '<span class="tag-empty">Aucune</span>';
    document.getElementById('qfm-kun').innerHTML = kunTags || '<span class="tag-empty">Aucune</span>';

    document.getElementById('qfm-verdict').textContent =
        isCorrect ? '✔ Bonne réponse !' : `✘ Réponse correcte : ${k.char}`;

    document.getElementById('quiz-feedback-modal').classList.add('open');
}

function continueAfterFeedback() {
    document.getElementById('quiz-feedback-modal').classList.remove('open');
    const cb = _qfmPending;
    _qfmPending = null;
    if (cb) cb();
}

function answerQuiz(btn, chosenIdx, correctIdx) {
    if (!quizState || quizState.answered) return;
    quizState.answered = true;

    const isCorrect = chosenIdx === correctIdx;
    if (isCorrect) {
        btn.classList.add('correct');
        quizState.correct++;
        document.getElementById('quiz-correct').textContent = quizState.correct;
    } else {
        btn.classList.add('wrong');
        quizState.wrong++;
        document.getElementById('quiz-wrong').textContent = quizState.wrong;
    }

    // Révéler la bonne réponse sur toutes les cellules
    document.querySelectorAll('.quiz-kanji-choice').forEach(b => {
        b.classList.add('locked');
        if (parseInt(b.dataset.idx) === correctIdx && !b.classList.contains('correct')) {
            b.classList.add('reveal');
        }
    });

    // Mise à jour score flottant
    const next = quizState.idx + 1;
    const scoreFloat = (quizState.correct / next * 10).toFixed(1);
    document.getElementById('quiz-score-sub').textContent = `${scoreFloat} / 10.0`;

// APRÈS :
const correctKanji = kanjiDb[correctIdx];
setTimeout(() => {
    showQuizFeedbackModal(correctKanji, isCorrect, () => {
        if (quizState) { quizState.idx++; renderQuizQuestion(); }
    });
}, isCorrect ? 400 : 700);
}

function renderQuizResults() {
    if (quizTimerInterval) { clearInterval(quizTimerInterval); quizTimerInterval = null; }
    if (!quizState) return;
    document.getElementById('quiz-prog-bar').style.width = '100%';
    document.getElementById('quiz-examples-btn').style.display = 'none';

    const { correct, indices, sourceType, sourceId, elapsedSec } = quizState;
    const total   = indices.length;
    const wrong   = total - correct;
    const pct     = Math.round(correct / total * 100);
    const emoji   = pct >= 80 ? '🎉' : pct >= 60 ? '👍' : pct >= 40 ? '💪' : '😅';
    const msg     = pct >= 80 ? 'Excellent !' : pct >= 60 ? 'Bien joué !' : pct >= 40 ? 'Continuez !' : 'À réviser…';
    const m = Math.floor(elapsedSec / 60), s = elapsedSec % 60;
    const timeStr = `${m}:${String(s).padStart(2,'0')}`;
    
    // Save quiz scores to localStorage for each kanji
    indices.forEach(idx => {
        const kanji = kanjiDb[idx];
        if (kanji) {
            localStorage.setItem(`quiz_${kanji.char}`, pct);
        }
    });

    document.getElementById('quiz-body').innerHTML = `
        <div class="quiz-results">
            <div class="quiz-results-emoji">${emoji}</div>
            <div class="quiz-score-big">${pct}%</div>
            <div class="quiz-score-label">${msg}</div>
            <div class="quiz-breakdown">
                <div class="quiz-breakdown-row"><span>✔ Corrects</span><strong style="color:var(--accent)">${correct}</strong></div>
                <div class="quiz-breakdown-row"><span>✘ Erreurs</span><strong style="color:#e55">${wrong}</strong></div>
                <div class="quiz-breakdown-row"><span>Total</span><strong>${total}</strong></div>
                <div class="quiz-breakdown-row"><span>Temps</span><strong>${timeStr}</strong></div>
            </div>
            <div class="quiz-btn-row">
                <button class="quiz-action-btn secondary" onclick="closeQuiz()">Fermer</button>
                <button class="quiz-action-btn primary"
                    onclick="startQuiz({type:'${sourceType}',id:'${sourceId}'})">Rejouer ↺</button>
            </div>
        </div>`;
}

/* ══════════════════════════════════════════════════
   QUIZ DE TRACÉ (Stroke Order Quiz) - VERSION OPTIMISÉE
   ───────────────────────────────────────────────── */
let strokeQuizState  = null;
let strokeWriter     = null;
let sqTimerInterval  = null;
let sqPaused         = false;

/**
 * Enregistre un Kanji réussi sans faute dans le localStorage
 */
function markMastered(character) {
    localStorage.setItem('mastered_' + character, 'true');
    console.log(`🎯 Kanji ${character} marqué comme maîtrisé !`);
}

/**
 * Initialise le moteur de tracé selon le mode
 */
function createStrokeWriter(elementId, character, isHardcore) {
    const el = document.getElementById(elementId);
    if (!el) return null;

    if (typeof HanziWriter === 'undefined') {
        console.warn("[Kanji Learner] HanziWriter indisponible pour createStrokeWriter, attente...");
        setTimeout(() => createStrokeWriter(elementId, character, isHardcore), 150);
        return null;
    }

    // 1. Définition des options de base (communes aux deux modes)
    const baseOptions = {
        width:    280,
        height:   280,
        padding:  24,
        drawingWidth:     8,
        // renderer canvas par défaut (fiable pour le tracé tactile mobile)
        charDataLoader: kanjiDataLoader,
        onLoadCharDataError: () => {
            console.warn('HanziWriter: données manquantes pour', character);
            setTimeout(() => {
                const fb = document.getElementById('sq-feedback');
                if (fb) { fb.style.color = '#f5a623'; fb.textContent = `Données manquantes pour ${character} — passage automatique`; }
                setTimeout(sqSkip, 1200);
            }, 300);
        }
    };

    // 2. Configuration spécifique selon le mode
    if (isHardcore) {
        return HanziWriter.create(elementId, character, {
            ...baseOptions,
            showCharacter:       false, 
            
            // 🎯 LE SECRET EST LÀ : On dit au moteur de ne pas dessiner le contour.
            // Le quiz marchera parfaitement en arrière-plan avec les données JSON !
            showOutline:         false, 
            
            strokeColor:         '#00c9a7', // Ton trait et tes succès seront bien verts
            drawingColor:        '#00c9a7',
            highlightOnComplete: false,     
            showHintAfterMisses: 4,     
        });
    } else {
        return HanziWriter.create(elementId, character, {
            ...baseOptions,
            showCharacter:       false,
            showOutline:         true,
            outlineColor:        '#88899E',   // guide vert comme les traits réussis
            outlineOpacity:      0.15,        // très discret, juste visible comme guide
            strokeColor:         '#00c9a7',
            drawingColor:        '#00c9a7',
            highlightOnComplete: true,
            showHintAfterMisses: 2,
        });
    }
}

function startStrokeQuiz({ type, id, mode = 'trace-easy' }) {
    let indices, title;
    if (type === 'category') {
        const cat = categories.get(id);
        if (!cat || !cat.indices.length) return;
        indices = shuffleIndices([...cat.indices]);
        title = cat.label;
    } else if (type === 'series') {
        const ser = seriesMap.get(id);
        if (!ser || !ser.indices.length) return;
        const cat = categories.get(ser.catId);
        indices = shuffleIndices([...ser.indices]);
        title = `${cat?.label ?? ''} · ${ser.label}`;
    } else if (type === 'single') {
        const kanji = kanjiDb.find(k => k.char === id);
        if (!kanji) return;
        indices = [kanjiDb.indexOf(kanji)];
        title = `Pratique : ${kanji.char}`;
    } else { return; }

    if (sqTimerInterval) clearInterval(sqTimerInterval);
    sqPaused = false;

    strokeQuizState = {
        indices, idx: 0,
        correct: 0, wrong: 0,
        title, sourceType: type, sourceId: id,
        elapsedSec: 0,
        mistakesThisKanji: 0,
        mode: mode 
    };

    document.getElementById('sq-correct').textContent = '0';
    document.getElementById('sq-wrong').textContent = '0';
    document.getElementById('sq-timer').textContent = '0:00';
    document.getElementById('stroke-quiz-view').style.display = 'flex';

    sqTimerInterval = setInterval(() => {
        if (!sqPaused && strokeQuizState) {
            strokeQuizState.elapsedSec++;
            const m = Math.floor(strokeQuizState.elapsedSec / 60);
            const s = strokeQuizState.elapsedSec % 60;
            document.getElementById('sq-timer').textContent = `${m}:${String(s).padStart(2,'0')}`;
        }
    }, 1000);

    renderStrokeQuizQuestion();
}

function renderStrokeQuizQuestion() {
    if (!strokeQuizState) return;
    const qs = strokeQuizState;
    if (qs.idx >= qs.indices.length) { renderStrokeQuizResults(); return; }

    // Annuler les timers et nettoyer l'ancien writer AVANT de réécrire le DOM
    if (qs._nextTimer) { clearTimeout(qs._nextTimer); qs._nextTimer = null; }
    if (strokeWriter) { try { strokeWriter.cancelQuiz(); } catch(_) {} strokeWriter = null; }

    const k          = kanjiDb[qs.indices[qs.idx]];
    const isHardcore = (qs.mode === 'trace-hard');

    document.getElementById('sq-prog-bar').style.width = (qs.idx / qs.indices.length * 100).toFixed(1) + '%';
    document.getElementById('sq-counter').textContent  = `${qs.idx + 1} / ${qs.indices.length}`;
    updateSqScore();
    qs.mistakesThisKanji = 0;

    const meanings      = k.meanings.filter(m => !m.toLowerCase().includes('radical'));
    const mainMeaning   = meanings.length ? meanings[0] : (k.meanings[0] || '?');
    const extraMeanings = meanings.slice(1, 3);

    const extraHtml = extraMeanings.length
        ? `<div style="display:flex;flex-wrap:wrap;gap:4px;justify-content:center;margin-top:4px">
            ${extraMeanings.map(m => `<span style="font-size:11px;color:var(--gray);background:var(--card);border:1px solid var(--border);border-radius:5px;padding:2px 8px">${m}</span>`).join('')}
           </div>` : '';

    const readingsChips = buildReadingChips(k, { maxOn: 4, maxKun: 4, showBadge: true });
    const strokeDots    = Array(k.strokes).fill(0).map((_, i) =>
        `<div class="sq-stroke-dot" id="sq-dot-${i}"></div>`).join('');

    document.getElementById('stroke-quiz-body').innerHTML = `
        <div class="sq-kanji-header">
            <div class="sq-meaning" style="font-size:22px;font-weight:bold">${mainMeaning}</div>
            ${extraHtml}
            <div class="sq-readings-row" style="margin-top:10px;display:flex;flex-wrap:wrap;gap:6px;justify-content:center">
                ${readingsChips}
            </div>
        </div>
        <div class="sq-canvas-wrap" id="sq-canvas-wrap" style="touch-action:none;">
            <div id="sq-writer-target"></div>
            <div class="sq-grid-overlay"></div>
        </div>
        <div class="sq-stroke-tracker" id="sq-stroke-tracker">${strokeDots}</div>
        <div id="sq-feedback" style="height:22px;margin-top:10px;font-weight:bold;text-align:center;font-size:13px;color:var(--gray)"></div>
        <div class="sq-actions">
            <button class="sq-btn hint" onclick="sqShowHint()">💡 Indice</button>
            <button class="sq-btn skip" onclick="sqSkip()">Passer →</button>
        </div>`;

    // Attendre le prochain frame pour que le DOM soit stabilisé
    // avant d'initialiser HanziWriter (évite le bug "élément invisible")
    requestAnimationFrame(() => {
        if (!strokeQuizState || strokeQuizState.idx !== qs.idx) return;

        strokeWriter = createStrokeWriter('sq-writer-target', k.char, isHardcore);
        if (!strokeWriter) { sqSkip(); return; }

        const sqBody = document.getElementById('stroke-quiz-body');
        if (sqBody) sqBody.classList.add('tracing');

        // Attendre que HanziWriter ait créé son SVG (asynchrone)
        // puis poser touch-action:none et bloquer le scroll sans toucher aux pointer events
        requestAnimationFrame(() => {
            const target = document.getElementById('sq-writer-target');
            if (!target) return;
            target.style.touchAction = 'none';
            target.querySelectorAll('*').forEach(el => { el.style.touchAction = 'none'; });

            // Bloquer scroll uniquement sur touchmove (pas touchstart ni touchend)
            // touchstart bloqué = certains navigateurs ne génèrent plus pointerdown
            // touchend bloqué = pointerup n'est plus généré → onComplete ne fire jamais
            target.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
        });

        let strokesDone = 0;
        let lastStrokeTimer = null;
        let _quizCompleted = false;

        const triggerComplete = (totalMistakes) => {
            if (_quizCompleted) return;
            _quizCompleted = true;
            if (lastStrokeTimer) { clearTimeout(lastStrokeTimer); lastStrokeTimer = null; }
            if (!strokeQuizState) return;

            const sqBody = document.getElementById('stroke-quiz-body');
            if (sqBody) sqBody.classList.remove('tracing');

            const totalErrors = (totalMistakes != null) ? totalMistakes : qs.mistakesThisKanji;
            const isClean = totalErrors === 0;

            if (isClean) { qs.correct++; document.getElementById('sq-correct').textContent = qs.correct; }
            else         { qs.wrong++;   document.getElementById('sq-wrong').textContent   = qs.wrong; }
            updateSqScore();
            if (isClean) markMastered(k.char);

            const fb = document.getElementById('sq-feedback');
            if (fb) {
                fb.style.color = isClean ? 'var(--accent)' : '#e55';
                fb.textContent = isClean ? '✔ Parfait !' : `Terminé — ${totalErrors} erreur${totalErrors > 1 ? 's' : ''}`;
            }
            qs._nextTimer = setTimeout(() => {
                qs._nextTimer = null;
                if (!strokeQuizState) return;
                strokeQuizState.idx++;
                renderStrokeQuizQuestion();
            }, 1100);
        };

        // Callbacks stockés dans qs._quizCallbacks pour être réutilisés
        // par sqShowHint() lors du redémarrage du quiz après un indice
        const quizCallbacks = {
            onMistake() {
                qs.mistakesThisKanji++;
                const dot = document.getElementById(`sq-dot-${strokesDone}`);
                if (dot) { dot.classList.add('mistake'); setTimeout(() => dot.classList.remove('mistake'), 400); }
                const wrap = document.getElementById('sq-canvas-wrap');
                if (wrap) { wrap.classList.add('flash-err'); setTimeout(() => wrap.classList.remove('flash-err'), 350); }
                const fb = document.getElementById('sq-feedback');
                if (fb) { fb.style.color = '#e55'; fb.textContent = isHardcore ? 'Mauvais tracé !' : 'Mauvais tracé, regarde l\'aide…'; }
            },
            onCorrectStroke() {
                const dot = document.getElementById(`sq-dot-${strokesDone}`);
                if (dot) dot.classList.add('done');
                strokesDone++;
                const wrap = document.getElementById('sq-canvas-wrap');
                if (wrap) { wrap.classList.add('flash-ok'); setTimeout(() => wrap.classList.remove('flash-ok'), 350); }
                const fb = document.getElementById('sq-feedback');
                if (fb) { fb.style.color = 'var(--accent)'; fb.textContent = 'Bien !';
                    setTimeout(() => { if (fb && fb.textContent === 'Bien !') fb.textContent = ''; }, 800); }

                if (strokesDone >= k.strokes) {
                    if (lastStrokeTimer) clearTimeout(lastStrokeTimer);
                    lastStrokeTimer = setTimeout(() => {
                        lastStrokeTimer = null;
                        triggerComplete(qs.mistakesThisKanji);
                    }, 700);
                }
            },
            onComplete(summary) {
                const totalMistakes = (summary && typeof summary.totalMistakes !== 'undefined')
                    ? summary.totalMistakes : qs.mistakesThisKanji;
                triggerComplete(totalMistakes);
            }
        };
        qs._quizCallbacks  = quizCallbacks;
        qs._isHardcore     = isHardcore;
        qs._strokesDoneRef = () => strokesDone; // référence live

        strokeWriter.quiz(quizCallbacks);
    });
}

function updateSqScore() {
    if (!strokeQuizState) return;
    const qs = strokeQuizState;
    const done = qs.correct + qs.wrong;
    const scoreFloat = done > 0 ? (qs.correct / done * 10).toFixed(1) : '0.0';
    document.getElementById('sq-score-sub').textContent = `${scoreFloat} / 10.0`;
}

function closeStrokeQuiz() {
    if (sqTimerInterval) clearInterval(sqTimerInterval);
    strokeWriter = null;
    document.getElementById('stroke-quiz-view').style.display = 'none';
    strokeQuizState = null;
}

/* ─────────────────────────────────────────────────
   Boutons auxiliaires
───────────────────────────────────────────────── */
function sqShowHint() {
    if (!strokeWriter || !strokeQuizState) return;
    const qs = strokeQuizState;
    const k  = kanjiDb[qs.indices[qs.idx]];
    if (!k || !qs._quizCallbacks) return;

    // Nombre de traits déjà validés
    const strokesDone = qs._strokesDoneRef ? qs._strokesDoneRef() : 0;
    if (strokesDone >= k.strokes) return;

    // Compter comme erreur
    qs.mistakesThisKanji++;
    const fb = document.getElementById('sq-feedback');
    if (fb) { fb.style.color = '#f5a623'; fb.textContent = `💡 Indice — trait ${strokesDone + 1}`; }

    // API HanziWriter réelle :
    // cancelQuiz() → animateStroke(N) → quiz({ quizStartStrokeNum: N+1, ...mêmes callbacks })
    try { strokeWriter.cancelQuiz(); } catch(_) {}

    strokeWriter.animateStroke(strokesDone, {
        onComplete: () => {
            if (!strokeQuizState || !strokeWriter) return;
            setTimeout(() => {
                if (!strokeQuizState || !strokeWriter) return;
                if (fb) fb.textContent = '';
                strokeWriter.quiz({
                    quizStartStrokeNum:  strokesDone + 1,
                    showHintAfterMisses: qs._isHardcore ? false : 1,
                    ...qs._quizCallbacks
                });
            }, 400);
        }
    });
}

function sqSkip() {
    if (!strokeQuizState) return;
    if (strokeQuizState._nextTimer) { clearTimeout(strokeQuizState._nextTimer); strokeQuizState._nextTimer = null; }
    if (strokeWriter) { try { strokeWriter.cancelQuiz(); } catch(_) {} strokeWriter = null; }
    const sqBody = document.getElementById('stroke-quiz-body');
    if (sqBody) sqBody.classList.remove('tracing');
    strokeQuizState.wrong++;
    strokeQuizState.idx++;
    document.getElementById('sq-wrong').textContent = strokeQuizState.wrong;
    updateSqScore();
    renderStrokeQuizQuestion();
}

/* ─────────────────────────────────────────────────
   Résultats stroke quiz
───────────────────────────────────────────────── */
function renderStrokeQuizResults() {
    if (sqTimerInterval) { clearInterval(sqTimerInterval); sqTimerInterval = null; }
    if (!strokeQuizState) return;
    document.getElementById('sq-prog-bar').style.width = '100%';

    const { correct, wrong, indices, sourceType, sourceId, elapsedSec } = strokeQuizState;
    const total   = indices.length;
    const pct     = Math.round(correct / total * 100);
    const emoji   = pct >= 80 ? '🎉' : pct >= 60 ? '👍' : pct >= 40 ? '💪' : '😅';
    const msg     = pct >= 80 ? 'Excellent !' : pct >= 60 ? 'Bien joué !' : pct >= 40 ? 'Continuez !' : 'À réviser…';
    const m = Math.floor(elapsedSec / 60), s = elapsedSec % 60;
    
    // Save trace scores to localStorage for each kanji
    indices.forEach(idx => {
        const kanji = kanjiDb[idx];
        if (kanji) {
            localStorage.setItem(`trace_${kanji.char}`, pct);
        }
    });
    
    // Re-render dashboard if visible (for single kanji practice)
    if (sourceType === 'single') {
        renderDashboard();
    }

    document.getElementById('stroke-quiz-body').innerHTML = `
        <div class="quiz-results" style="padding-top:40px">
            <div class="quiz-results-emoji">${emoji}</div>
            <div class="quiz-score-big">${pct}%</div>
            <div class="quiz-score-label">${msg}</div>
            <div class="quiz-breakdown">
                <div class="quiz-breakdown-row"><span>✔ Sans erreur</span><strong style="color:var(--accent)">${correct}</strong></div>
                <div class="quiz-breakdown-row"><span>✘ Avec erreurs</span><strong style="color:#e55">${wrong}</strong></div>
                <div class="quiz-breakdown-row"><span>Total</span><strong>${total}</strong></div>
                <div class="quiz-breakdown-row"><span>Temps</span><strong>${m}:${String(s).padStart(2,'0')}</strong></div>
            </div>
            <div class="quiz-btn-row">
                <button class="quiz-action-btn secondary" onclick="closeStrokeQuiz()">Fermer</button>
                <button class="quiz-action-btn primary"
                    onclick="startStrokeQuiz({type:'${sourceType}',id:'${sourceId}'})">Rejouer ↺</button>
            </div>
        </div>`;
}

/* ══════════════════════════════════════════════════
   KANA DATA
══════════════════════════════════════════════════ */
const hiraganaBase = [
    [{c:'あ',r:'a'},{c:'い',r:'i'},{c:'う',r:'u'},{c:'え',r:'e'},{c:'お',r:'o'}],
    [{c:'か',r:'ka'},{c:'き',r:'ki'},{c:'く',r:'ku'},{c:'け',r:'ke'},{c:'こ',r:'ko'}],
    [{c:'さ',r:'sa'},{c:'し',r:'shi'},{c:'す',r:'su'},{c:'せ',r:'se'},{c:'そ',r:'so'}],
    [{c:'た',r:'ta'},{c:'ち',r:'chi'},{c:'つ',r:'tsu'},{c:'て',r:'te'},{c:'と',r:'to'}],
    [{c:'な',r:'na'},{c:'に',r:'ni'},{c:'ぬ',r:'nu'},{c:'ね',r:'ne'},{c:'の',r:'no'}],
    [{c:'は',r:'ha'},{c:'ひ',r:'hi'},{c:'ふ',r:'fu'},{c:'へ',r:'he'},{c:'ほ',r:'ho'}],
    [{c:'ま',r:'ma'},{c:'み',r:'mi'},{c:'む',r:'mu'},{c:'め',r:'me'},{c:'も',r:'mo'}],
    [{c:'や',r:'ya'},null,{c:'ゆ',r:'yu'},null,{c:'よ',r:'yo'}],
    [{c:'ら',r:'ra'},{c:'り',r:'ri'},{c:'る',r:'ru'},{c:'れ',r:'re'},{c:'ろ',r:'ro'}],
    [{c:'わ',r:'wa'},null,null,null,{c:'を',r:'wo'}],
    [{c:'ん',r:'n'},null,null,null,null]
];
const katakanaBase = [
    [{c:'ア',r:'a'},{c:'イ',r:'i'},{c:'ウ',r:'u'},{c:'エ',r:'e'},{c:'オ',r:'o'}],
    [{c:'カ',r:'ka'},{c:'キ',r:'ki'},{c:'ク',r:'ku'},{c:'ケ',r:'ke'},{c:'コ',r:'ko'}],
    [{c:'サ',r:'sa'},{c:'シ',r:'shi'},{c:'ス',r:'su'},{c:'セ',r:'se'},{c:'ソ',r:'so'}],
    [{c:'タ',r:'ta'},{c:'チ',r:'chi'},{c:'ツ',r:'tsu'},{c:'テ',r:'te'},{c:'ト',r:'to'}],
    [{c:'ナ',r:'na'},{c:'ニ',r:'ni'},{c:'ヌ',r:'nu'},{c:'ネ',r:'ne'},{c:'ノ',r:'no'}],
    [{c:'ハ',r:'ha'},{c:'ヒ',r:'hi'},{c:'フ',r:'fu'},{c:'ヘ',r:'he'},{c:'ホ',r:'ho'}],
    [{c:'マ',r:'ma'},{c:'ミ',r:'mi'},{c:'ム',r:'mu'},{c:'メ',r:'me'},{c:'モ',r:'mo'}],
    [{c:'ヤ',r:'ya'},null,{c:'ユ',r:'yu'},null,{c:'ヨ',r:'yo'}],
    [{c:'ラ',r:'ra'},{c:'リ',r:'ri'},{c:'ル',r:'ru'},{c:'レ',r:'re'},{c:'ロ',r:'ro'}],
    [{c:'ワ',r:'wa'},null,null,null,{c:'ヲ',r:'wo'}],
    [{c:'ン',r:'n'},null,null,null,null]
];
const hiraganaDakuten = [
    [{c:'が',r:'ga'},{c:'ぎ',r:'gi'},{c:'ぐ',r:'gu'},{c:'げ',r:'ge'},{c:'ご',r:'go'}],
    [{c:'ざ',r:'za'},{c:'じ',r:'ji'},{c:'ず',r:'zu'},{c:'ぜ',r:'ze'},{c:'ぞ',r:'zo'}],
    [{c:'だ',r:'da'},{c:'ぢ',r:'di'},{c:'づ',r:'du'},{c:'で',r:'de'},{c:'ど',r:'do'}],
    [{c:'ば',r:'ba'},{c:'び',r:'bi'},{c:'ぶ',r:'bu'},{c:'べ',r:'be'},{c:'ぼ',r:'bo'}]
];
const katakanaDakuten = [
    [{c:'ガ',r:'ga'},{c:'ギ',r:'gi'},{c:'グ',r:'gu'},{c:'ゲ',r:'ge'},{c:'ゴ',r:'go'}],
    [{c:'ザ',r:'za'},{c:'ジ',r:'ji'},{c:'ズ',r:'zu'},{c:'ゼ',r:'ze'},{c:'ゾ',r:'zo'}],
    [{c:'ダ',r:'da'},{c:'ヂ',r:'di'},{c:'ヅ',r:'du'},{c:'デ',r:'de'},{c:'ド',r:'do'}],
    [{c:'バ',r:'ba'},{c:'ビ',r:'bi'},{c:'ブ',r:'bu'},{c:'ベ',r:'be'},{c:'ボ',r:'bo'}]
];
const hiraganaHandakuten = [[{c:'ぱ',r:'pa'},{c:'ぴ',r:'pi'},{c:'ぷ',r:'pu'},{c:'ぺ',r:'pe'},{c:'ぽ',r:'po'}]];
const katakanaHandakuten = [[{c:'パ',r:'pa'},{c:'ピ',r:'pi'},{c:'プ',r:'pu'},{c:'ペ',r:'pe'},{c:'ポ',r:'po'}]];
const hiraganaSokuon = [[{c:'っ',r:'–'},null,null,null,null]];
const katakanaSokuon = [[{c:'ッ',r:'–'},null,null,null,null]];
const hiraganaYoon = [
    [{c:'きゃ',r:'kya'},{c:'きゅ',r:'kyu'},{c:'きょ',r:'kyo'},null,null],
    [{c:'しゃ',r:'sha'},{c:'しゅ',r:'shu'},{c:'しょ',r:'sho'},null,null],
    [{c:'ちゃ',r:'cha'},{c:'ちゅ',r:'chu'},{c:'ちょ',r:'cho'},null,null],
    [{c:'にゃ',r:'nya'},{c:'にゅ',r:'nyu'},{c:'にょ',r:'nyo'},null,null],
    [{c:'ひゃ',r:'hya'},{c:'ひゅ',r:'hyu'},{c:'ひょ',r:'hyo'},null,null],
    [{c:'みゃ',r:'mya'},{c:'みゅ',r:'myu'},{c:'みょ',r:'myo'},null,null],
    [{c:'りゃ',r:'rya'},{c:'りゅ',r:'ryu'},{c:'りょ',r:'ryo'},null,null],
    [{c:'ぎゃ',r:'gya'},{c:'ぎゅ',r:'gyu'},{c:'ぎょ',r:'gyo'},null,null],
    [{c:'じゃ',r:'ja'}, {c:'じゅ',r:'ju'}, {c:'じょ',r:'jo'}, null,null],
    [{c:'びゃ',r:'bya'},{c:'びゅ',r:'byu'},{c:'びょ',r:'byo'},null,null],
    [{c:'ぴゃ',r:'pya'},{c:'ぴゅ',r:'pyu'},{c:'ぴょ',r:'pyo'},null,null]
];
const katakanaYoon = [
    [{c:'キャ',r:'kya'},{c:'キュ',r:'kyu'},{c:'キョ',r:'kyo'},null,null],
    [{c:'シャ',r:'sha'},{c:'シュ',r:'shu'},{c:'ショ',r:'sho'},null,null],
    [{c:'チャ',r:'cha'},{c:'チュ',r:'chu'},{c:'チョ',r:'cho'},null,null],
    [{c:'ニャ',r:'nya'},{c:'ニュ',r:'nyu'},{c:'ニョ',r:'nyo'},null,null],
    [{c:'ヒャ',r:'hya'},{c:'ヒュ',r:'hyu'},{c:'ヒョ',r:'hyo'},null,null],
    [{c:'ミャ',r:'mya'},{c:'ミュ',r:'myu'},{c:'ミョ',r:'myo'},null,null],
    [{c:'リャ',r:'rya'},{c:'リュ',r:'ryu'},{c:'リョ',r:'ryo'},null,null],
    [{c:'ギャ',r:'gya'},{c:'ギュ',r:'gyu'},{c:'ギョ',r:'gyo'},null,null],
    [{c:'ジャ',r:'ja'}, {c:'ジュ',r:'ju'}, {c:'ジョ',r:'jo'}, null,null],
    [{c:'ビャ',r:'bya'},{c:'ビュ',r:'byu'},{c:'ビョ',r:'byo'},null,null],
    [{c:'ピャ',r:'pya'},{c:'ピュ',r:'pyu'},{c:'ピョ',r:'pyo'},null,null]
];
const kanaGroups = {
    hira: [
        {title:null,            rows:hiraganaBase},
        {title:'Dakuten ゛',    rows:hiraganaDakuten},
        {title:'Handakuten ゜', rows:hiraganaHandakuten},
        {title:'Sokuon 促音',   rows:hiraganaSokuon},
        {title:'Yoon 拗音',     rows:hiraganaYoon}
    ],
    kata: [
        {title:null,            rows:katakanaBase},
        {title:'Dakuten ゛',    rows:katakanaDakuten},
        {title:'Handakuten ゜', rows:katakanaHandakuten},
        {title:'Sokuon 促音',   rows:katakanaSokuon},
        {title:'Yoon 拗音',     rows:katakanaYoon}
    ]
};

function loadKanas() {
    document.getElementById('page-title').innerText = 'Kana';
    document.getElementById('main-content').innerHTML = `
        <div class="kana-tabs">
            <div class="kana-tab active" id="tab-hira" onclick="switchKanaTab('hira')">Hiragana あ</div>
            <div class="kana-tab"        id="tab-kata" onclick="switchKanaTab('kata')">Katakana ア</div>
        </div>
        <div id="kana-grid-container" style="padding:12px"></div>`;
    renderKanaGrid('hira');
}
function switchKanaTab(type) {
    document.getElementById('tab-hira').classList.toggle('active', type==='hira');
    document.getElementById('tab-kata').classList.toggle('active', type==='kata');
    renderKanaGrid(type);
}
function renderKanaGrid(type) {
    const container = document.getElementById('kana-grid-container');
    container.innerHTML = '';
    for (const group of kanaGroups[type]) {
        if (group.title) {
            const h = document.createElement('div');
            h.className = 'kana-section-title';
            h.textContent = group.title;
            container.appendChild(h);
        }
        const grid = document.createElement('div');
        grid.className = 'kana-grid';
        for (const row of group.rows) {
            for (const kana of row) {
                const cell = document.createElement('div');
                if (!kana) {
                    cell.className = 'kana-cell empty';
                } else {
                    const isYoon = [...kana.c].length > 1;
                    cell.className = 'kana-cell';
                    cell.innerHTML = `<span class="kana-char${isYoon?' yoon':''}">${kana.c}</span><span class="kana-rom">${kana.r}</span>`;
                    cell.onclick = () => openKanaDetail(kana);
                }
                grid.appendChild(cell);
            }
        }
        container.appendChild(grid);
    }
}

/* ══════════════════════════════════════════════════
   KANJIVG ANIMATION (conservé intégralement)
══════════════════════════════════════════════════ */
async function fetchPaths(char, signal) {
    const cp  = char.codePointAt(0).toString(16).padStart(5,'0');
    const res = await fetch(`https://cdn.jsdelivr.net/gh/KanjiVG/kanjivg@master/kanji/${cp}.svg`, {signal});
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const doc = new DOMParser().parseFromString(await res.text(), 'image/svg+xml');
    return [...doc.querySelectorAll('path')].map(p => p.getAttribute('d'));
}
function makeGroup(dList, transform, color) {
    const NS = 'http://www.w3.org/2000/svg';
    const g  = document.createElementNS(NS, 'g');
    if (transform) g.setAttribute('transform', transform);
    for (const d of dList) {
        const p = document.createElementNS(NS, 'path');
        p.setAttribute('d', d); p.setAttribute('fill', 'none');
        p.setAttribute('stroke', color); p.setAttribute('stroke-width', '3');
        p.setAttribute('stroke-linecap', 'round'); p.setAttribute('stroke-linejoin', 'round');
        p.setAttribute('vector-effect', 'non-scaling-stroke');
        g.appendChild(p);
    }
    return g;
}
async function animateKanaChar(char) {
    const chars  = [...char], isYoon = chars.length > 1;
    const svgEl  = document.getElementById('kana-writer-svg');
    const spn    = document.getElementById('writer-spinner');
    const hanz   = document.getElementById('kanji-writer-target');
    if (fetchCtrl) fetchCtrl.abort();
    fetchCtrl = new AbortController();
    const { signal } = fetchCtrl;
    kanaAnimTimeouts.forEach(clearTimeout); kanaAnimTimeouts = [];
    hanz.style.display = 'none'; svgEl.style.display = 'none'; spn.style.display = 'block';
    try {
        const groups = await Promise.all(chars.map(c => fetchPaths(c, signal)));
        if (signal.aborted) return;
        svgEl.innerHTML = ''; svgEl.setAttribute('viewBox', '0 0 109 109');
        const tf = isYoon ? ['scale(0.62)', 'translate(65,65) scale(0.35)'] : [null];
        chars.forEach((_, i) => svgEl.appendChild(makeGroup(groups[i], tf[i], '#2a2a3a')));
        const animPaths = [];
        chars.forEach((_, i) => {
            const g = makeGroup(groups[i], tf[i], '#00c9a7');
            svgEl.appendChild(g); animPaths.push(...g.querySelectorAll('path'));
        });
        spn.style.display = 'none'; svgEl.style.display = 'block';
        animPaths.forEach(p => {
            const len = p.getTotalLength();
            p.style.strokeDasharray = len; p.style.strokeDashoffset = len; p.style.transition = 'none';
        });
        const DUR = 550, PAU = 150; let delay = 100;
        animPaths.forEach(p => {
            const t = setTimeout(() => { p.style.transition = `stroke-dashoffset ${DUR}ms ease`; p.style.strokeDashoffset = '0'; }, delay);
            delay += DUR + PAU; kanaAnimTimeouts.push(t);
        });
        document.getElementById('d-strokes').innerText = groups.reduce((s,g) => s + g.length, 0);
    } catch(err) {
        if (err.name === 'AbortError') return;
        spn.style.display = 'none';
        svgEl.innerHTML = `<text x="54" y="80" text-anchor="middle" fill="#dde0eb" font-size="60" font-family="serif">${char}</text>`;
        svgEl.style.display = 'block';
        document.getElementById('d-strokes').innerText = '?';
    }
}

/* ══════════════════════════════════════════════════
   FONCTIONS GLOBALES : EXEMPLES & AUDIO
══════════════════════════════════════════════════ */

async function renderExemples(char) {
    const container = document.getElementById('exemples-container');
    if (!container) return;
    container.innerHTML = '';

    let liste = null;
    
    // 1. Essayer de charger depuis data/nX/exemples.json si on a un niveau JLPT actif
    if (currentJLPTLevel && exemplesByLevel[currentJLPTLevel]) {
        const levelExamples = exemplesByLevel[currentJLPTLevel];
        if (levelExamples.kanji && levelExamples.kanji[char]) {
            liste = levelExamples.kanji[char];
        }
    }
    
    // 2. Fallback : charger depuis exemplesDb (universel, charge en bg dans init)
    if (!liste && exemplesDb && exemplesDb[char]) {
        liste = exemplesDb[char];
    }
    
    // 3. Si rien n'a été trouvé et qu'on a un niveau JLPT, charger en async
    if (!liste && currentJLPTLevel) {
        try {
            if (!exemplesByLevel[currentJLPTLevel]) {
                const res = await fetch(`./data/${currentJLPTLevel}/exemples.json`);
                if (res.ok) {
                    exemplesByLevel[currentJLPTLevel] = await res.json();
                    if (exemplesByLevel[currentJLPTLevel].kanji && exemplesByLevel[currentJLPTLevel].kanji[char]) {
                        liste = exemplesByLevel[currentJLPTLevel].kanji[char];
                    }
                }
            }
        } catch (e) {
            console.warn(`Impossible de charger exemples pour ${currentJLPTLevel}:`, e);
        }
    }
    
    // 4. Si toujours rien, afficher un message
    if (!liste || liste.length === 0) {
        container.innerHTML = `
            <div style="font-size:9px;color:var(--gray);text-transform:uppercase;letter-spacing:1.2px;font-weight:700;margin-bottom:12px">Exemples et Lectures</div>
            <div style="color:var(--gray);font-size:13px;text-align:center;padding:20px;border:1px dashed var(--border);border-radius:10px;">Aucun exemple disponible</div>`;
        return;
    }

    // Format : { jp, ka?, ro?, fr }
    // ka = lecture kana de la phrase (nouveau), ro = romaji (ancien ou nouveau)
    const items = liste.map(ex => {
        const safe = (ex.jp || char).replace(/'/g, "\\'");
        const kanaLine   = ex.ka
            ? `<div style="font-size:0.88rem;color:#9b8bff;margin-bottom:3px;line-height:1.5">${ex.ka}</div>`
            : '';
        const romajiLine = ex.ro
            ? `<div style="font-size:0.78rem;color:var(--accent);margin-bottom:4px;font-family:monospace;opacity:0.8">${ex.ro}</div>`
            : '';
        return `<div onclick="speakSentence('${safe}')"
            style="background:rgba(255,255,255,0.03);padding:14px;border-radius:10px;margin-bottom:10px;cursor:pointer;border-left:3px solid var(--accent);transition:background 0.15s"
            onmouseenter="this.style.background='rgba(255,255,255,0.06)'"
            onmouseleave="this.style.background='rgba(255,255,255,0.03)'">
            <div style="font-size:1.1rem;color:#fff;margin-bottom:5px;line-height:1.4">${ex.jp}</div>
            ${kanaLine}${romajiLine}
            <div style="font-size:0.88rem;color:#a0a0b0;line-height:1.4">${ex.fr}</div>
        </div>`;
    }).join('');

    container.innerHTML = `
        <div style="font-size:9px;color:var(--gray);text-transform:uppercase;letter-spacing:1.2px;font-weight:700;margin-bottom:12px">Exemples et Lectures</div>
        ${items}`;
}

function speakSentence(text) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const msg = new SpeechSynthesisUtterance(text);
    msg.lang = 'ja-JP';
    msg.rate = 0.8;
    window.speechSynthesis.speak(msg);
}

/* ══════════════════════════════════════════════════
   GESTION DES DÉTAILS (KANJI)
══════════════════════════════════════════════════ */

function openDetail(kanji) {
    currentType = 'kanji'; 
    currentChar = kanji.char;
    window.currentKanjiForStroke = kanji.char;
    
    // Si kanji n'a pas toutes ses propriétés, chercher dans kanjiDb
    if (!kanji.meanings) {
        const fullKanji = kanjiDb.find(k => k.char === kanji.char);
        if (fullKanji) {
            kanji = fullKanji;
        }
    }

    // Chercher la catégorie (ancienne navigation) — peut être undefined avec JLPT
    const cat = [...categories.values()].find(c => c.indices.includes(kanjiMap.get(kanji.char)));

    const detailView = document.getElementById('detail-view');
    detailView.style.display = 'flex';
    detailView.querySelector('.detail-content').scrollTop = 0;

    document.getElementById('detail-char-title').innerText = kanji.char;

    // 1. Sens nettoyés
    const cleanMeanings = kanji.meanings.filter(m => !m.toLowerCase().includes('radical'));
    document.getElementById('d-meaning').innerText = cleanMeanings.length > 0 ? cleanMeanings.join(' · ') : (kanji.meanings[0] || '–');

    // 2. Reset feedback oral
    document.getElementById('voice-feedback').textContent = '';
    document.getElementById('voice-feedback').style.color = 'var(--gray)';

    // 3. Stats
    // Afficher le niveau JLPT si on vient de cette navigation, sinon afficher la catégorie ancienne
    let levelDisplay = '–';
    if (currentJLPTLevel && jlptMapping) {
        levelDisplay = jlptMapping.levels[currentJLPTLevel].label;
    } else if (cat) {
        levelDisplay = cat.short;
    }
    document.getElementById('d-level').innerText = levelDisplay;
    document.getElementById('d-strokes').innerText = kanji.strokes;
    document.getElementById('d-romaji').innerText  = kanji.romaji || '–';

    // Maîtrise depuis localStorage
    const mastered = localStorage.getItem('mastered_' + kanji.char);
    document.getElementById('d-mastery').innerText = mastered ? '✔' : '0%';

    // 4. Lectures ON / KUN
    document.getElementById('section-on').style.display  = kanji.on.length  ? '' : 'none';
    document.getElementById('section-kun').style.display = kanji.kun.length ? '' : 'none';
    document.getElementById('d-on').innerHTML  = kanji.on.map(r  => `<span class="tag tag-on"  style="font-size:14px;padding:4px 10px">${r}</span>`).join('');
    document.getElementById('d-kun').innerHTML = kanji.kun.map(r => `<span class="tag tag-kun" style="font-size:14px;padding:4px 10px">${r}</span>`).join('');

    // 5. Boutons : montrer les boutons kanji
    document.getElementById('btn-oral-test').style.display = '';
    const dqb = document.getElementById('detail-quiz-btn');
    if (dqb) dqb.style.display = '';
    const bsk = document.getElementById('btn-save-kanji');
    if (bsk) bsk.style.display = '';
    updateSaveBtnState(kanji.char);

   // 6. HanziWriter
    document.getElementById('kana-writer-svg').style.display     = 'none';
    document.getElementById('writer-spinner').style.display      = 'none';
    document.getElementById('kanji-writer-target').style.display = 'block';
    document.getElementById('kanji-writer-target').innerHTML     = '';
    
    writer = HanziWriter.create('kanji-writer-target', kanji.char, {
        width: 160, height: 160, padding: 14,
        strokeColor: '#00c9a7', 
        outlineColor: '#88899E',   // = --surface, fond exact du writer-main
        charColor:    '#88899E',   // traits non-animés invisibles sur fond
        drawingColor: '#00c9a7', 
        showOutline: true,
        // ...
        charDataLoader: kanjiDataLoader
    });
    writer.animateCharacter();

    // 7. Stroke guide (async) — les exemples s'affichent dans tous les cas,
    // même si le fetch KanjiVG échoue (catch sur le reject de la promesse)
    renderStrokeGuide(kanji.char)
        .then(() => renderExemples(kanji.char))
        .catch(() => renderExemples(kanji.char));
}

function openKanaDetail(kana) {
    currentType = 'kana'; currentChar = kana.c;
    const code = kana.c.codePointAt(0);
    const label = (code >= 0x3040 && code <= 0x309F) ? 'Hiragana' : 'Katakana';
    const isYoon = [...kana.c].length > 1, isSokuon = kana.c === 'っ' || kana.c === 'ッ';
    
    document.getElementById('detail-view').style.display = 'flex';
    document.getElementById('detail-char-title').innerText = kana.c;
    document.getElementById('d-level').innerText  = label;
    document.getElementById('d-romaji').innerText = kana.r;
    document.getElementById('d-mastery').innerText = '–';
    document.getElementById('section-on').style.display  = 'none';
    document.getElementById('section-kun').style.display = 'none';
    document.getElementById('voice-feedback').textContent = '';

    // Masquer les boutons réservés aux kanji
    document.getElementById('btn-oral-test').style.display = 'none';
    const dqb = document.getElementById('detail-quiz-btn');
    if (dqb) dqb.style.display = 'none';
    const bsk = document.getElementById('btn-save-kanji');
    if (bsk) bsk.style.display = 'none';

    // Masquer la grille stroke guide
    document.getElementById('stroke-guide-grid').innerHTML = '';
    document.getElementById('stroke-guide-title').style.display = 'none';
    
    let meaning = `Syllabe « ${kana.r} »`;
    if (isYoon)   meaning = `Yoon (拗音) — combiné « ${kana.r} »`;
    if (isSokuon) meaning = 'Sokuon (促音) — double la consonne suivante';
    
    document.getElementById('d-meaning').innerText = meaning;
    document.getElementById('d-strokes').innerText = '…';
    document.getElementById('kanji-writer-target').innerHTML = '';
    document.getElementById('kanji-writer-target').style.display = 'none';
    
    // Vider les exemples pour les kana
    const exContainer = document.getElementById('exemples-container');
    if (exContainer) exContainer.innerHTML = '';
    
    animateKanaChar(kana.c);
}

function closeDetail() {
    document.getElementById('detail-view').style.display = 'none';
    kanaAnimTimeouts.forEach(clearTimeout); 
    kanaAnimTimeouts = [];
    if (fetchCtrl) { fetchCtrl.abort(); fetchCtrl = null; }

    const exContainer = document.getElementById('exemples-container');
    if (exContainer) exContainer.innerHTML = '';
}

function launchDetailTrace() {
    const char = window.currentKanjiForStroke;
    if (!char) return;
    closeDetail();
    startStrokeQuiz({ type: 'single', id: char, mode: 'trace-easy' });
}

function replayAnimation() {
    if (currentType === 'kanji' && typeof writer !== 'undefined' && writer) {
        // On lance l'animation complète
        writer.animateCharacter({
            onComplete: function() {
                // Dès que l'animation est finie, on vérifie si un quiz était actif
                // et si oui, on relance le mode dessin !
                if (writer._quiz) {
                    writer.quiz(); 
                }
            }
        });
    } 
    else if (currentType === 'kana' && currentChar) {
        animateKanaChar(currentChar);
    }
}

/* ══════════════════════════════════════════════════
   STROKE ORDER GUIDE
   Grille de mini-SVGs : chaque cellule i affiche
   • traits 1..i-1 en gris (outline)
   • trait i en vert accent (mis en valeur)
   • numéro i en haut à droite
   Source : KanjiVG (même fetchPaths() que l'animation kana)
══════════════════════════════════════════════════ */
async function renderStrokeGuide(char) {
    const row   = document.getElementById('stroke-guide-grid');
    const title = document.getElementById('stroke-guide-title');
    if (!row) return;

    row.innerHTML = '';
    if (title) title.style.display = 'none';

    try {        const cp  = char.codePointAt(0).toString(16).padStart(5,'0');
        const res = await fetch(`https://cdn.jsdelivr.net/gh/KanjiVG/kanjivg@master/kanji/${cp}.svg`);
        if (!res.ok) throw new Error(res.status);

        const doc      = new DOMParser().parseFromString(await res.text(), 'image/svg+xml');
        const vb       = doc.querySelector('svg')?.getAttribute('viewBox') || '0 0 109 109';
        const allPaths = [...doc.querySelectorAll('path')].map(p => p.getAttribute('d'));
        if (!allPaths.length) throw new Error('no paths');

        const NS = 'http://www.w3.org/2000/svg';

        if (title) title.style.display = '';

        for (let i = 0; i < allPaths.length; i++) {
            const cell = document.createElement('div');
            cell.className = 'stroke-guide-cell';

            const svg = document.createElementNS(NS, 'svg');
            svg.setAttribute('viewBox', vb);

            // Traits précédents en gris
            for (let j = 0; j < i; j++) {
                const p = document.createElementNS(NS, 'path');
                p.setAttribute('d', allPaths[j]);
                p.setAttribute('fill', 'none');
                p.setAttribute('stroke', '#3a3a55');
                p.setAttribute('stroke-width', '3.5');
                p.setAttribute('stroke-linecap', 'round');
                p.setAttribute('stroke-linejoin', 'round');
                svg.appendChild(p);
            }

            // Trait courant en vert
            const cur = document.createElementNS(NS, 'path');
            cur.setAttribute('d', allPaths[i]);
            cur.setAttribute('fill', 'none');
            cur.setAttribute('stroke', '#00c9a7');
            cur.setAttribute('stroke-width', '4');
            cur.setAttribute('stroke-linecap', 'round');
            cur.setAttribute('stroke-linejoin', 'round');
            svg.appendChild(cur);

            cell.appendChild(svg);

            const num = document.createElement('span');
            num.className = 'stroke-guide-num';
            num.textContent = i + 1;
            cell.appendChild(num);

            row.appendChild(cell);
        }

        document.getElementById('d-strokes').innerText = allPaths.length;

    } catch (e) {
        row.innerHTML = '';
        if (title) title.style.display = 'none';
        console.warn('Stroke guide indisponible pour', char, e.message);
    }
}

/* ══════════════════════════════════════════════════
    INIT & DASHBOARD LOGIC
   ══════════════════════════════════════════════════ */

// Map grades to JLPT levels and calculate mastery
function getJLPTLevel(grade) {
    if (!grade) return null;
    const g = parseInt(grade);
    if (g >= 1 && g <= 2) return 5; // N5
    if (g === 3) return 4; // N4
    if (g === 4 || g === 5) return 3; // N3
    if (g === 6 || g === 8) return 2; // N2 (including college)
    return 1; // N1 (rare/advanced)
}

// Calculate mastery score based on quiz performance and writing practice
function getKanjiMastery(kanjiChar) {
    const quizScore = parseInt(localStorage.getItem(`quiz_${kanjiChar}`) || '0');
    const traceScore = parseInt(localStorage.getItem(`trace_${kanjiChar}`) || '0');
    // Average of both scores, or 0 if no practice
    if (quizScore === 0 && traceScore === 0) return 0;
    return Math.round((quizScore + traceScore) / 2);
}

// 1. La fonction de rendu du Dashboard (doit être définie AVANT init)
function renderDashboard() {
    const container = document.getElementById('progression-list');
    if (!container) {
        console.warn("Conteneur 'progression-list' non trouvé dans le DOM.");
        return;
    }

    container.innerHTML = ''; 

    const jlptLevels = [
        { jlpt: 5, label: 'N5 - Débutant' },
        { jlpt: 4, label: 'N4 - Élémentaire' },
        { jlpt: 3, label: 'N3 - Intermédiaire' },
        { jlpt: 2, label: 'N2 - Avancé' },
        { jlpt: 1, label: 'N1 - Expert' }
    ];

    jlptLevels.forEach(levelDef => {
        // Get all kanji for this JLPT level
        const kanjiForLevel = kanjiDb.filter(k => {
            const jlpt = getJLPTLevel(k.grade);
            return jlpt === levelDef.jlpt;
        });
        const totalInLevel = kanjiForLevel.length;
        
        // Calculate average mastery for this level
        const totalMastery = kanjiForLevel.reduce((sum, k) => sum + getKanjiMastery(k.char), 0);
        const avgMastery = totalInLevel > 0 ? Math.round(totalMastery / totalInLevel) : 0;
        
        // Count kanji with any practice (quiz or trace)
        const practiced = kanjiForLevel.filter(k => {
            const quiz = localStorage.getItem(`quiz_${k.char}`);
            const trace = localStorage.getItem(`trace_${k.char}`);
            return quiz || trace;
        }).length;

        container.innerHTML += `
            <div class="prog-item">
                <div class="prog-info">
                    <span class="prog-name">${levelDef.label}</span>
                    <span class="prog-stats">${practiced} / ${totalInLevel} · ${avgMastery}%</span>
                </div>
                <div class="prog-track">
                    <div class="prog-fill" style="width: ${avgMastery}%;"></div>
                </div>
            </div>
        `;
    });
}

// 2. La fonction d'initialisation principale
async function init() {
    const mainContent = document.getElementById('main-content');
    
    // Affichage du loader
    mainContent.innerHTML = `
        <div style="height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px">
            <div class="spinner"></div>
            <div style="font-size:13px;color:var(--gray)">Chargement de la base de données…</div>
        </div>`;

    try {
        // Chargement en parallèle : mapping JLPT + Kanjis
        const [mappingRes, kanjiRes] = await Promise.all([
            fetch('./data/mapping.json'),
            fetch('https://raw.githubusercontent.com/shinobux9-max/Kanji-trad/refs/heads/main/kanji_jouyou_fr.json')
        ]);
        
        if (!kanjiRes.ok) throw new Error(`Erreur réseau kanji : ${kanjiRes.status}`);
        
        // Charger mapping (fallback si fichier manquant)
        if (mappingRes.ok) {
            jlptMapping = await mappingRes.json();
            console.log('✅ Mapping JLPT chargé');
        } else {
            console.warn('⚠️ data/mapping.json non trouvé, fallback à structure par défaut');
            jlptMapping = null;
        }

        let text = await kanjiRes.text();
        text = text.trim();
        // Nettoyage sommaire au cas où le JSON GitHub soit mal formé
        if (!text.startsWith('{')) text = '{' + text;
        if (!text.endsWith('}'))  text = text.replace(/,\s*$/, '') + '}';
        const data = JSON.parse(text);

        // Transformation en tableau d'objets
        kanjiDb = [];
        kanjiMap.clear();
        Object.entries(data).forEach(([char, v], i) => {
            kanjiDb.push({
                char,
                grade:    v.classe ?? null,
                meanings: v.sens            || [],
                on:       v.lectures_on     || [],
                kun:      v.lectures_kun    || [],
                wk_on:    v.wk_lectures_on  || [],
                wk_kun:   v.wk_lectures_kun || [],
                strokes:  v.traits || 0,
                romaji:   v.romaji || '–'
            });
            kanjiMap.set(char, i);
        });

        // Chargement des exemples : localStorage en priorité, GitHub en fallback
        const CACHE_KEY = 'exemplesDb_v2';
        try {
            // 1. Essai depuis le cache localStorage (instantané, offline-proof)
            const cached = localStorage.getItem(CACHE_KEY);
            if (cached) {
                exemplesDb = JSON.parse(cached);
                console.log(`✅ Exemples depuis cache (${Object.keys(exemplesDb).length} kanji)`);
            }

            // 2. Toujours rafraîchir depuis GitHub en arrière-plan
            fetch('https://raw.githubusercontent.com/shinobux9-max/Kanji-trad/refs/heads/main/exemples.json')
                .then(r => r.ok ? r.json() : Promise.reject(r.status))
                .then(data => {
                    exemplesDb = data;
                    try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch(_) {}
                    console.log(`✅ Exemples mis à jour depuis GitHub (${Object.keys(data).length} kanji)`);
                })
                .catch(e => console.warn('Refresh exemples GitHub échoué :', e));

        } catch(e) {
            console.warn('Exemples non disponibles :', e.message);
            exemplesDb = {};
        }

        // Construction des structures internes
        buildCategories();
        buildSeries();
        renderSidebar();

        // Affichage du dashboard : d'abord le HTML (showDashboard),
        // puis les barres de progression (renderDashboard)
        document.getElementById('page-title').innerText = '漢字 Study';
        showDashboard();
        renderDashboard();

        console.log(`✅ ${kanjiDb.length} kanji chargés — ${seriesMap.size} séries créées`);

    } catch(e) {
        console.error('Erreur BDD:', e);
        mainContent.innerHTML = `
            <div style="padding:40px 20px;text-align:center;color:var(--gray)">
                <div style="font-size:40px;margin-bottom:12px">⚠️</div>
                <div style="margin-bottom:16px">Impossible de charger la base de données.<br>${e.message}</div>
                <button onclick="init()" style="padding:10px 24px;background:var(--accent);border:none;color:#000;border-radius:8px;font-weight:bold;cursor:pointer;font-size:14px">Réessayer</button>
            </div>`;
    }
}

// Lancement au démarrage
init();

/* ── GESTION DU BOUTON RETOUR SYSTÈME (Android / Navigateur) ── */
window.onpopstate = function(event) {
    // Si l'application n'est pas encore chargée (kanjiDb vide), on ne fait rien
    if (kanjiDb.length === 0) return;

    if (event.state) {
        const state = event.state;
        if (state.view === 'dashboard') {
            showDashboard(true);
            renderDashboard(); // On relance le rendu des barres de progression
        } else if (state.view === 'category') {
            loadCategory(state.id, true);
        } else if (state.view === 'series') {
            loadSeriesPage(state.id, true);
        }
    } else {
        // Si on revient au tout début de l'historique
        showDashboard(true);
        renderDashboard();
    }
};
