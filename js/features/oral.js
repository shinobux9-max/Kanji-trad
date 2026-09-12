/**
 * js/features/oral.js
 * Reconnaissance vocale et tests oraux
 */

let recognitionInstance = null;

/**
 * Vérifie si la reconnaissance vocale est disponible sur le navigateur
 */
export function isSpeechAvailable() {
    return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
}

/**
 * Initialise le moteur de reconnaissance vocale en japonais
 */
export function initSpeechRecognition(onResultCallback, onErrorCallback) {
    if (!isSpeechAvailable()) {
        console.warn("La reconnaissance vocale n'est pas supportée par ce navigateur.");
        return null;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionInstance = new SpeechRecognition();
    recognitionInstance.lang = 'ja-JP';
    recognitionInstance.interimResults = false;

    recognitionInstance.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (typeof onResultCallback === 'function') {
            onResultCallback(transcript);
        }
    };

    recognitionInstance.onerror = (event) => {
        console.error("Erreur de reconnaissance vocale:", event.error);
        if (typeof onErrorCallback === 'function') {
            onErrorCallback(event.error);
        }
    };

    return recognitionInstance;
}

/**
 * Démarre l'écoute du microphone
 */
export function startListening() {
    if (recognitionInstance) {
        recognitionInstance.start();
    }
}