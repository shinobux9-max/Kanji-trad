/**
 * js/features/quiz.js
 * Quiz kanji (QCM lectures/sens/kanji + mode vocal) — reproduit fidèlement la section
 * "QUIZ — API FLEXIBLE" du monolithe kanji.js, ainsi que le mode vocal du quiz
 * (startVoiceRecognition, distinct du test oral de la fiche détail qui reste dans
 * features/oral.js).
 *
 * REMPLACE l'ancien stub (startQuiz/submitQuizAnswer avec state.quizState.active/questions/
 * currentIndex/score) : cette forme ne correspond à RIEN dans le monolithe réel — le vrai
 * quiz est un système de reconnaissance à choix multiples avec HanziWriter animé et 6 modes
 * différents (kanji-to-read, kanji-to-mean, read-to-kanji, mean-to-kanji, vocal, mixte,
 * survie), pas un simple index de questions.
 */

import { state } from '../core/state.js';
import { pushModalState } from '../core/navigation.js';
import { startStrokeQuiz } from './strokes.js';
import { getBestReading, buildReadingChips, pickDecoyIndices, shuffleIndices, getAllValidReadings, closeDetail, kanjiDataLoader, loadFolders } from './kanji.js';
import { isResultCorrect, normalizeOralResult, toHira, toKata } from './oral.js';

let quizTimerInterval = null;
let quizPaused = false;

/* ══════════════════════════════════════════════════
   MODAL SÉLECTION DE MODE QUIZ
══════════════════════════════════════════════════ */
let _quizModalSource = { type: null, id: null };

export function showQuizModeModal(sourceType, sourceId) {
    _quizModalSource = { type: sourceType, id: sourceId };
    const m = document.getElementById('quiz-mode-modal');
    m.classList.add('open');
    m.style.display = 'flex';
}

export function closeQuizModal() {
    const m = document.getElementById('quiz-mode-modal');
    m.classList.remove('open');
    m.style.display = 'none';
}

export function launchQuizMode(mode) {
    closeQuizModal();
    // Si on vient de la fiche kanji, la fermer d'abord
    if (_quizModalSource.type === 'single') closeDetail();
    startQuiz({ type: _quizModalSource.type, id: _quizModalSource.id, mode });
}

// ⚠️ ATTENTION : appelle startStrokeQuiz({type,id,mode}) — le VRAI système de tracé, pas
// encore porté (features/strokes.js n'a pour l'instant que kanjiDataLoader). Contrairement
// aux forward-refs onclick="..." ailleurs, ceci est un appel JS réel : lèvera une
// ReferenceError si invoqué avant que startStrokeQuiz soit porté avec la bonne signature.
export function launchStrokeMode(mode) {
    closeQuizModal();
    if (_quizModalSource.type === 'single') closeDetail();
    startStrokeQuiz({ type: _quizModalSource.type, id: _quizModalSource.id, mode });
}

/* ══════════════════════════════════════════════════
   QUIZ — API FLEXIBLE
   startQuiz({ type: "category", id: "p1" })
   startQuiz({ type: "series",   id: "p1_s1" })
══════════════════════════════════════════════════ */
export function startQuiz({ type, id, mode = 'kanji-to-read' }) {
    let indices, title, poolIndices;

    if (type === 'category') {
        const cat = state.categories.get(id);
        if (!cat || !cat.indices.length) return;
        indices = shuffleIndices([...cat.indices]);
        poolIndices = [...cat.indices];
        title = cat.label;
    } else if (type === 'series') {
        const ser = state.seriesMap.get(id);
        if (!ser || !ser.indices.length) return;
        const cat = state.categories.get(ser.catId);
        indices = shuffleIndices([...ser.indices]);
        poolIndices = [...(cat?.indices ?? ser.indices)];
        title = `${cat?.label ?? ''} · ${ser.label}`;
    } else if (type === 'single') {
        // Un seul kanji — depuis la fiche détail
        const idx = state.data.kanjiMap.get(id);
        if (idx === undefined) return;
        indices = [idx];
        // Pool = toute la catégorie du kanji pour les leurres
        const cat = [...state.categories.values()].find(c => c.indices.includes(idx));
        poolIndices = cat ? [...cat.indices] : [...Array(state.data.kanjiDb.length).keys()];
        title = `Entraînement : ${id}`;
    } else { return; }

    if (quizTimerInterval) clearInterval(quizTimerInterval);
    quizPaused = false;
    pushModalState('quiz');

    // On ajoute le MODE ici
    state.quizState = {
        indices, poolIndices, idx: 0,
        correct: 0, wrong: 0,
        answered: false, revealed: false,
        title, sourceType: type, sourceId: id,
        elapsedSec: 0,
        mode: mode
    };

    document.getElementById('quiz-correct').textContent = '0';
    document.getElementById('quiz-wrong').textContent = '0';
    document.getElementById('quiz-timer').textContent = '0:00';
    document.getElementById('quiz-view').style.display = 'flex';

    quizTimerInterval = setInterval(() => {
        if (!quizPaused && state.quizState) {
            state.quizState.elapsedSec++;
            const m = Math.floor(state.quizState.elapsedSec / 60);
            const s = state.quizState.elapsedSec % 60;
            document.getElementById('quiz-timer').textContent = `${m}:${String(s).padStart(2,'0')}`;
        }
    }, 1000);

    renderQuizQuestion();
}

export function closeQuiz() {
    if (quizTimerInterval) { clearInterval(quizTimerInterval); quizTimerInterval = null; }
    // Stopper la reconnaissance vocale si active
    if (_vocalRecognition) { try { _vocalRecognition.abort(); } catch(e){} _vocalRecognition = null; }
    _vocalListening = false;
    document.getElementById('quiz-view').style.display = 'none';
    state.quizState = null;
    quizPaused = false;
}

// Passer une question vocale (compté comme erreur)
export function skipVocalQuestion() {
    if (!state.quizState || state.quizState.answered) return;
    if (_vocalRecognition) { try { _vocalRecognition.abort(); } catch(e){} _vocalRecognition = null; }
    _vocalListening = false;
    state.quizState.answered = true;
    state.quizState.wrong++;
    const ow = document.getElementById('quiz-wrong');
    if (ow) ow.textContent = state.quizState.wrong;
    const next = state.quizState.idx + 1;
    const scoreEl = document.getElementById('quiz-score-sub');
    if (scoreEl) scoreEl.textContent = `${(state.quizState.correct / next * 10).toFixed(1)} / 10.0`;
    setTimeout(() => { if (state.quizState) { state.quizState.idx++; renderQuizQuestion(); } }, 300);
}

export function togglePause() {
    quizPaused = !quizPaused;
    document.querySelector('.quiz-pause-btn').textContent = quizPaused ? '▶' : '⏸';
}

/* ─────────────────────────────────────────────────
   PHASE 1 — Affichage lectures + sens (sans kanji)
───────────────────────────────────────────────── */
export function renderQuizQuestion() {
    if (!state.quizState || state.quizState.idx >= state.quizState.indices.length) { renderQuizResults(); return; }

    const qs = state.quizState;
    const k = state.data.kanjiDb[qs.indices[qs.idx]];

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
            <div style="font-size:0.6875rem;color:var(--gray);text-transform:uppercase;letter-spacing:1px;margin-bottom:14px">Sens affiché — Prononcez la lecture</div>
            <div class="quiz-meaning-big" style="font-size:1.875rem;font-weight:bold;margin-bottom:12px;">${vMeaning}</div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-bottom:18px;opacity:0.45"
                 title="Lectures possibles (aide — masquée volontairement)">${vChips}</div>
            <button id="mic-btn" class="mic-btn" onclick="startVoiceRecognition()" title="Appuyer pour parler">🎤</button>
            <div id="vocal-feedback" style="font-size:0.8125rem;color:var(--gray);margin-top:16px;min-height:22px;text-align:center;max-width:300px;line-height:1.5;"></div>
            <button onclick="skipVocalQuestion()" style="margin-top:18px;background:none;border:1px solid var(--border);color:var(--gray);padding:8px 20px;border-radius:8px;font-size:0.75rem;cursor:pointer;font-family:inherit;">→ Passer</button>`;
    } else if (currentMode === 'kanji-to-read' || currentMode === 'kanji-to-mean') {
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
                        `<div style="font-size:5.625rem;line-height:160px;text-align:center;color:#fff">${charToDraw}</div>`;
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
            if (state.quizState && !state.quizState.answered) startVoiceRecognition(true);
        }, 650);
    }
}

/* ─────────────────────────────────────────────────
   PHASE 2 — Révélation des 6 kanjis (tap)
───────────────────────────────────────────────── */
export function revealChoices(currentMode) {
    if (!state.quizState || state.quizState.revealed) return;
    state.quizState.revealed = true;

    const qs = state.quizState;
    const kIdx = qs.indices[qs.idx];
    const decoys = pickDecoyIndices(kIdx, state.data.kanjiDb[kIdx].meanings[0], 5, qs.poolIndices);
    const choices = shuffleIndices([kIdx, ...decoys]);

    const grid = document.getElementById('quiz-choices');
    grid.style.display = 'grid';
    if (currentMode === 'kanji-to-read') {
        grid.classList.add('chip-mode');
    } else {
        grid.classList.remove('chip-mode');
    }

    grid.innerHTML = choices.map(ci => {
        const target = state.data.kanjiDb[ci];
        let content = "";

        if (currentMode === 'kanji-to-read') {
            // Toutes les lectures ON + KUN en chips compactes (max 3+3)
            content = `<div style="display:flex;flex-wrap:wrap;gap:3px;justify-content:center;align-items:flex-start;width:100%">
                ${buildReadingChips(target, { maxOn: 3, maxKun: 3, showBadge: true, chipStyle: 'padding:3px 6px;font-size:0.75rem;min-width:0' })}
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
            style="${isChipMode ? 'font-size:0.875rem;align-items:center' : `font-size:${content.length > 8 ? '18px' : fontSize}`}">
            ${content}
        </div>`;
    }).join('');

    document.querySelectorAll('.quiz-tap-hint').forEach(h => h.style.display = 'none');
}

export function toggleExamples() { /* placeholder pour une future expansion */ }

/* ─────────────────────────────────────────────────
   RÉPONSE
───────────────────────────────────────────────── */
let _qfmPending = null; // callback exécuté au clic "Continuer"

export function showQuizFeedbackModal(k, isCorrect, onContinue) {
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

export function continueAfterFeedback() {
    document.getElementById('quiz-feedback-modal').classList.remove('open');
    const cb = _qfmPending;
    _qfmPending = null;
    if (cb) cb();
}

export function answerQuiz(btn, chosenIdx, correctIdx) {
    if (!state.quizState || state.quizState.answered) return;
    state.quizState.answered = true;

    const isCorrect = chosenIdx === correctIdx;
    if (isCorrect) {
        btn.classList.add('correct');
        state.quizState.correct++;
        document.getElementById('quiz-correct').textContent = state.quizState.correct;
    } else {
        btn.classList.add('wrong');
        state.quizState.wrong++;
        document.getElementById('quiz-wrong').textContent = state.quizState.wrong;
    }

    // Révéler la bonne réponse sur toutes les cellules
    document.querySelectorAll('.quiz-kanji-choice').forEach(b => {
        b.classList.add('locked');
        if (parseInt(b.dataset.idx) === correctIdx && !b.classList.contains('correct')) {
            b.classList.add('reveal');
        }
    });

    // Mise à jour score flottant
    const next = state.quizState.idx + 1;
    const scoreFloat = (state.quizState.correct / next * 10).toFixed(1);
    document.getElementById('quiz-score-sub').textContent = `${scoreFloat} / 10.0`;

    const correctKanji = state.data.kanjiDb[correctIdx];
    setTimeout(() => {
        showQuizFeedbackModal(correctKanji, isCorrect, () => {
            if (state.quizState) { state.quizState.idx++; renderQuizQuestion(); }
        });
    }, isCorrect ? 400 : 700);
}

export function renderQuizResults() {
    if (quizTimerInterval) { clearInterval(quizTimerInterval); quizTimerInterval = null; }
    if (!state.quizState) return;
    document.getElementById('quiz-prog-bar').style.width = '100%';
    document.getElementById('quiz-examples-btn').style.display = 'none';

    const { correct, indices, sourceType, sourceId, elapsedSec } = state.quizState;
    const total   = indices.length;
    const wrong   = total - correct;
    const pct     = Math.round(correct / total * 100);
    const emoji   = pct >= 80 ? '🎉' : pct >= 60 ? '👍' : pct >= 40 ? '💪' : '😅';
    const msg     = pct >= 80 ? 'Excellent !' : pct >= 60 ? 'Bien joué !' : pct >= 40 ? 'Continuez !' : 'À réviser…';
    const m = Math.floor(elapsedSec / 60), s = elapsedSec % 60;
    const timeStr = `${m}:${String(s).padStart(2,'0')}`;

    // Save quiz scores to localStorage for each kanji
    indices.forEach(idx => {
        const kanji = state.data.kanjiDb[idx];
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
                <button class="quiz-action-btn secondary" onclick="history.back()">Fermer</button>
                <button class="quiz-action-btn primary"
                    onclick="startQuiz({type:'${sourceType}',id:'${sourceId}'})">Rejouer ↺</button>
            </div>
        </div>`;
}

/* ══════════════════════════════════════════════════
   QUIZ VOCAL — startVoiceRecognition()
   Mode 'vocal' DANS le quiz principal — distinct du test oral de la fiche détail
   (startOralTest, features/oral.js, pas encore porté). Appelé depuis le prompt du mode
   vocal dans renderQuizQuestion.
══════════════════════════════════════════════════ */
let _vocalRecognition = null;
let _vocalListening   = false;

export function startVoiceRecognition(autoStart = false) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
        const fb = document.getElementById('vocal-feedback');
        if (fb) { fb.style.color = '#e55'; fb.textContent = 'Micro non supporté sur ce navigateur.'; }
        return;
    }
    if (_vocalListening) return;

    if (!state.quizState) return;
    const k = state.data.kanjiDb[state.quizState.indices[state.quizState.idx]];
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

            if (!state.quizState || state.quizState.answered) return;
            state.quizState.answered = true;
            if (isCorrect) {
                state.quizState.correct++;
                const oc = document.getElementById('quiz-correct');
                if (oc) oc.textContent = state.quizState.correct;
            } else {
                state.quizState.wrong++;
                const ow = document.getElementById('quiz-wrong');
                if (ow) ow.textContent = state.quizState.wrong;
            }
            const next = state.quizState.idx + 1;
            const scoreEl = document.getElementById('quiz-score-sub');
            if (scoreEl) scoreEl.textContent = `${(state.quizState.correct / next * 10).toFixed(1)} / 10.0`;

            if (isCorrect) {
                setTimeout(() => { if (state.quizState) { state.quizState.idx++; renderQuizQuestion(); } }, 1000);
            } else {
                // Laisser réessayer après 2s
                setTimeout(() => {
                    if (!state.quizState) return;
                    state.quizState.answered = false;
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
   QUIZ DEPUIS UN DOSSIER (favoris)
   ─────────────────────────────────────────────────
   Placée ici (pas dans features/kanji.js) car elle appelle showQuizModeModal() — un vrai
   appel JS, pas un onclick="..." : la mettre dans kanji.js aurait recréé le cycle
   kanji.js<->quiz.js déjà résolu ailleurs dans ce chantier.
══════════════════════════════════════════════════ */
export function startFolderQuiz(folderName) {
    const folders = loadFolders();
    const chars   = folders[folderName];
    if (!chars || chars.length < 2) {
        alert('Il faut au moins 2 kanjis dans le dossier pour lancer un quiz.');
        return;
    }
    // Construire un pool ad hoc d'indices
    const indices = chars.map(c => state.data.kanjiMap.get(c)).filter(i => i !== undefined);
    if (indices.length < 2) return;

    // Stocker temporairement dans quizState en utilisant startQuiz avec type 'folder'
    // On passe par un mode catégorie inline
    const tempId = '__folder__' + folderName;
    // Créer une entrée temporaire dans les catégories
    state.categories.set(tempId, { id: tempId, label: `📁 ${folderName}`, short: '📁', indices, color: '#f5a623' });
    showQuizModeModal('category', tempId);
}
