/**
 * js/core/storage.js
 * Centralisation de la gestion du stockage local (localStorage)
 */

export const STORAGE_KEYS = {
    TRACKING: 'kanji_trad_tracking',
    WEAKNESS: 'kanji_trad_weakness',
    // ATTENTION : la vraie clé historique est 'kanji_folders_v1' (voir FOLDERS_KEY dans
    // l'ancien kanji.js). Ne JAMAIS la changer sous peine de rendre invisibles les dossiers
    // déjà enregistrés par les utilisateurs existants.
    FOLDERS: 'kanji_folders_v1',
    SETTINGS: 'kanji_trad_settings' // non utilisée par le code actuel — placeholder, à vérifier avant usage
};

/* ══════════════════════════════════════════════════
   REGISTRE D'INVALIDATION DE CACHE
   ─────────────────────────────────────────────────
   Dans le monolithe, trackItem() vide directement `levelStatsCache` (un cache déclaré
   plus loin, utilisé par le dashboard/les stats vocab-grammaire). Pour éviter que ce module
   "core" importe un cache qui appartient logiquement à ui/dashboard.js ou
   features/vocabulary.js (et donc un risque de dépendance circulaire), les modules
   propriétaires d'un cache s'enregistrent ici au démarrage ; trackItem() se contente
   d'appeler tous les invalidateurs enregistrés — comportement identique à l'original,
   couplage explicite au lieu d'implicite.
══════════════════════════════════════════════════ */
const cacheInvalidators = new Set();

export function registerCacheInvalidator(fn) {
    if (typeof fn === 'function') cacheInvalidators.add(fn);
}

/**
 * Lit une donnée JSON du localStorage de manière sécurisée
 */
export function getStorageItem(key, defaultValue = {}) {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
        console.error(`Erreur lors de la lecture de ${key} dans localStorage:`, error);
        return defaultValue;
    }
}

/**
 * Écrit une donnée en JSON dans le localStorage de manière sécurisée
 */
export function setStorageItem(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        console.error(`Erreur lors de l'écriture de ${key} dans localStorage:`, error);
    }
}

// --- TRACKING ---

export function getTrackingData() {
    return getStorageItem(STORAGE_KEYS.TRACKING, {});
}

export function saveTrackingData(trackingData) {
    setStorageItem(STORAGE_KEYS.TRACKING, trackingData);
}

// Conservée pour compatibilité avec le reste du stub existant (accès en lecture seule à
// l'entrée brute d'un item, y compris son éventuel .srs) — mais ce n'est PAS l'équivalent de
// getItemStatus() ci-dessous, qui est la fonction réellement utilisée partout dans l'app pour
// lire un statut ('mastered' / 'favorited' / null).
export function getItemTracking(itemId) {
    const tracking = getTrackingData();
    return tracking[itemId] || null;
}

/**
 * Équivalent EXACT de trackItem(itemId, status) du monolithe kanji.js.
 * - status === null ou 'null' -> supprime l'entrée entièrement (jamais un simple merge : c'est
 *   ce qui permet de "démarquer" un item, et ce que consultent getFoldersContaining,
 *   isKanjiInAnyFolder, les compteurs de maîtrise, etc.)
 * - sinon -> écrit { status, lastUpdate } SANS toucher aux autres clés déjà présentes sur
 *   l'entrée (notamment .srs, écrite séparément par saveSrsInfo() dans learning/srs.js —
 *   les deux systèmes partagent le même objet tracking[itemId] par item).
 * - invalide tous les caches enregistrés via registerCacheInvalidator(), exactement comme le
 *   monolithe vidait `levelStatsCache` à chaque changement de statut.
 */
export function trackItem(itemId, status) {
    const tracking = getTrackingData();
    if (!tracking[itemId]) tracking[itemId] = {};

    if (status === null || status === 'null') {
        delete tracking[itemId];
    } else {
        tracking[itemId].status = status;
        tracking[itemId].lastUpdate = new Date().toISOString();
    }

    saveTrackingData(tracking);
    cacheInvalidators.forEach(fn => fn());
    return tracking[itemId];
}

/**
 * Équivalent EXACT de getItemStatus(itemId) du monolithe : retourne le statut ('mastered',
 * 'favorited', ...) ou null si l'item n'a pas d'entrée ou pas de champ .status.
 */
export function getItemStatus(itemId) {
    return getTrackingData()[itemId]?.status || null;
}

// --- WEAKNESSES (FAIBLESSES) ---

export function getWeaknessData() {
    return getStorageItem(STORAGE_KEYS.WEAKNESS, {});
}

export function saveWeaknessData(weaknessData) {
    setStorageItem(STORAGE_KEYS.WEAKNESS, weaknessData);
}

// --- DOSSIERS / FAVORIS ---
// Structure réelle (voir loadFolders() du monolithe) : un OBJET { "NomDossier": ["猫","犬"] },
// jamais un tableau. addKanjiToFolder/removeKanjiFromFolder/renameFolder/deleteFolder et les
// lecteurs isKanjiInAnyFolder/getFoldersContaining restent à extraire dans features/kanji.js
// (logique métier, pas du stockage pur) — seuls les accès bruts sont ici.

export function getFoldersData() {
    return getStorageItem(STORAGE_KEYS.FOLDERS, {});
}

export function saveFoldersData(foldersData) {
    setStorageItem(STORAGE_KEYS.FOLDERS, foldersData);
}

// --- SETTINGS / PREFERENCES ---

export function getSettingsData() {
    return getStorageItem(STORAGE_KEYS.SETTINGS, {});
}

export function saveSettingsData(settings) {
    setStorageItem(STORAGE_KEYS.SETTINGS, settings);
}