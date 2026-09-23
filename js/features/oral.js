/**
 * js/features/oral.js
 * Reconnaissance vocale et tests oraux
 *
 * NOTE : stripRubyForSpeech() a été déplacée dans features/kanji.js (voir ce fichier) — bien
 * qu'ajoutée ici initialement, elle est en réalité utilisée par kanji ET vocab ET grammaire
 * (pas spécifique à l'oral), et la garder ici créerait un cycle d'import avec kanji.js
 * (dont ce module a maintenant besoin pour getAllValidReadings/quizOverrides).
 */

import { quizOverrides, getAllValidReadings, getBestReading } from './kanji.js';
import { state } from '../core/state.js';
import { trackItem } from '../core/storage.js';
import { refreshMasteryUI } from '../ui/common.js';

/* ══════════════════════════════════════════════════
   QUIZ VOCAL — NORMALISATION DU RÉSULTAT MICRO
   Gère : chiffres arabes, kanji+okurigana, katakana. Équivalent EXACT de la section du même
   nom dans le monolithe. Utilisée par le test oral de la fiche détail (startOralTest) ET par
   le mode vocal du quiz (features/quiz.js::startVoiceRecognition).
══════════════════════════════════════════════════ */

// Table inverse : chiffre arabe -> hiragana
const arabicToHira = {
    '0':'ぜろ','1':'いち','2':'に','3':'さん','4':'よん','5':'ご',
    '6':'ろく','7':'なな','8':'はち','9':'きゅう','10':'じゅう',
    '11':'じゅういち','12':'じゅうに','20':'にじゅう',
    '100':'ひゃく','1000':'せん','10000':'まん'
};

// Katakana -> hiragana
export const toHira = s => s.replace(/[\u30a1-\u30f6]/g,
    c => String.fromCharCode(c.charCodeAt(0) - 0x60));

// Hiragana -> Katakana (inverse de toHira) — pour l'affichage On'yomi
export const toKata = s => s.replace(/[\u3041-\u3096]/g,
    c => String.fromCharCode(c.charCodeAt(0) + 0x60));

// Nettoie et normalise ce que le micro a capté
export function normalizeOralResult(raw) {
    let s = raw.replace(/[。\.、，？！!\?\s「」『』]/g, '').trim();

    // 1. Chiffre arabe -> hiragana (le moteur retourne "8" pour "はち")
    if (arabicToHira[s]) return arabicToHira[s];

    // 2. Katakana -> hiragana
    s = toHira(s);

    // 3. Si le résultat contient encore des kanji, remplacer chaque kanji par sa lecture via
    //    quizOverrides (sans okurigana ni point)
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
export function isResultCorrect(rawResult, kanjiChar, kanjiData) {
    const s = normalizeOralResult(rawResult);

    // --- Cas 1 : résultat = kanji cible seul ou kanji + okurigana ---
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

/**
 * Équivalent EXACT de speakText(text, lang) du monolithe — synthèse vocale (Web Speech API),
 * utilisée par vocab/grammaire/kanji pour le bouton 🔊. Placée ici (pas ui/common.js) : même
 * famille que la reconnaissance vocale ci-dessus, aucune dépendance, aucun risque de cycle.
 */
export function speakText(text, lang = 'ja-JP') {
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

/**
 * Équivalent EXACT de speakSentence(text) du monolithe — variante simplifiée de speakText()
 * (toujours 'ja-JP', pas de paramètre de langue), utilisée par features/kanji.js pour les
 * exemples de phrases. Séparée de speakText() dans le monolithe original — jamais fusionnées,
 * même si redondantes en apparence (cf. HANDOFF.md, règle "ne jamais fusionner deux fonctions
 * qui semblent similaires si le monolithe les garde séparées").
 */
export function speakSentence(text) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const msg = new SpeechSynthesisUtterance(text);
    msg.lang = 'ja-JP';
    msg.rate = 0.8;
    window.speechSynthesis.speak(msg);
}

/**
 * Équivalent EXACT de startOralTest(kanjiChar) du monolithe — jamais portée avant cette
 * session (gap connu, signalé dès une session très antérieure dans le HANDOFF : "startOralTest
 * PAS FAIT"). Découverte concrètement manquante en scannant les onclick="..." d'index.html
 * lui-même (jamais fait avant la bascule finale) plutôt que ceux des fichiers JS entre eux.
 */
export function startOralTest(kanjiChar) {
    const kanjiData = state.data.kanjiDb.find(k => k.char === kanjiChar);
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

        const alternatives = Array.from({ length: event.results[0].length },
            (_, i) => event.results[0][i].transcript.trim());

        const isCorrect = alternatives.some(alt => isResultCorrect(alt, kanjiChar, kanjiData));
        const displayed = alternatives[0];

        if (isCorrect) {
            if (fb) { fb.style.color = 'var(--accent)'; fb.textContent = `✔ Correct ! « ${displayed} »`; }
            localStorage.setItem('mastered_' + kanjiChar, 'true');
            trackItem(kanjiChar, 'mastered');
            refreshMasteryUI();
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
