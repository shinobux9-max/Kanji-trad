/**
 * js/core/storage.js
 * Centralisation de la gestion du stockage local (localStorage)
 */

export const STORAGE_KEYS = {
    TRACKING: 'kanji_trad_tracking',
    WEAKNESS: 'kanji_trad_weakness',
    FOLDERS: 'kanji_trad_folders',
    SETTINGS: 'kanji_trad_settings'
};

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

export function getItemTracking(itemId) {
    const tracking = getTrackingData();
    return tracking[itemId] || null;
}

export function updateItemTracking(itemId, statusData) {
    const tracking = getTrackingData();
    tracking[itemId] = {
        ...tracking[itemId],
        ...statusData,
        updatedAt: new Date().toISOString()
    };
    saveTrackingData(tracking);
    return tracking[itemId];
}

// --- WEAKNESSES (FAIBLESSES) ---

export function getWeaknessData() {
    return getStorageItem(STORAGE_KEYS.WEAKNESS, {});
}

export function saveWeaknessData(weaknessData) {
    setStorageItem(STORAGE_KEYS.WEAKNESS, weaknessData);
}

// --- DOSSIERS / FAVORIS ---

export function getFoldersData() {
    return getStorageItem(STORAGE_KEYS.FOLDERS, []);
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