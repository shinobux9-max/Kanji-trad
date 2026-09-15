/**
 * js/features/strokes.js
 * Tracé kanji (HanziWriter) et Stroke Quiz — reproduit fidèlement la section "QUIZ DE TRACÉ
 * (Stroke Order Quiz)" du monolithe kanji.js.
 *
 * NOTE : le fichier réel de ce projet s'appelle strokes.js (avec un "s"), l'arborescence
 * cible communiquée liste "stroke.js" (singulier) — divergence de nommage déjà signalée
 * ailleurs dans ce chantier.
 *
 * REMPLACE l'ancien stub (initKanjiWriter/startStrokeQuiz(character, onComplete)) : ce
 * dernier ne correspond à RIEN dans le monolithe réel — le vrai système gère le mode
 * hardcore (sans aide visuelle), le comptage d'erreurs par trait, les indices, une file de
 * plusieurs kanji (catégorie/série/kanji seul/file de révision SRS), etc.
 *
 * kanjiDataLoader a été DÉPLACÉE dans features/kanji.js (voir ce fichier pour la raison :
 * cycle d'import évité, kanji.js n'a besoin de rien depuis ce fichier).
 */

import { state } from '../core/state.js';
import { shuffleIndices, buildReadingChips, kanjiDataLoader, closeDetail } from './kanji.js';
import { gradeReview } from '../learning/srs.js';

let strokeQuizState  = null;
let strokeWriter      = null;
let sqTimerInterval   = null;
let sqPaused          = false;

/**
 * Enregistre un Kanji réussi sans faute dans le localStorage. Clé legacy 'mastered_<char>' —
 * vestige du monolithe, écrit mais jamais relu ailleurs dans le code observé ; préservé tel
 * quel (ne pas "nettoyer" ce qui n'a pas été demandé).
 */
export function markMastered(character) {
    localStorage.setItem('mastered_' + character, 'true');
    console.log(`🎯 Kanji ${character} marqué comme maîtrisé !`);
}

/**
 * Initialise le moteur de tracé selon le mode (normal avec aide visuelle, ou hardcore sans).
 */
export function createStrokeWriter(elementId, character, isHardcore, loaderOptions = {}) {
    const el = document.getElementById(elementId);
    if (!el) return null;

    if (typeof HanziWriter === 'undefined') {
        console.warn("[Kanji Learner] HanziWriter indisponible pour createStrokeWriter, attente...");
        setTimeout(() => createStrokeWriter(elementId, character, isHardcore, loaderOptions), 150);
        return null;
    }

    // dataLoader/onDataError/dimensions personnalisables (ex: tracé kana yōon) — comportement
    // kanji inchangé par défaut
    const { dataLoader = kanjiDataLoader, onDataError = sqSkip, width = 280, height = 280, padding = 24 } = loaderOptions;

    const baseOptions = {
        width, height, padding,
        drawingWidth:     8,
        charDataLoader: dataLoader,
        onLoadCharDataError: () => {
            console.warn('HanziWriter: données manquantes pour', character);
            setTimeout(() => {
                const fb = document.getElementById('sq-feedback');
                if (fb) { fb.style.color = '#f5a623'; fb.textContent = `Données manquantes pour ${character} — passage automatique`; }
                setTimeout(onDataError, 1200);
            }, 300);
        }
    };

    if (isHardcore) {
        return HanziWriter.create(elementId, character, {
            ...baseOptions,
            showCharacter:       false,
            // 🎯 Le secret : dire au moteur de ne pas dessiner le contour. Le quiz marchera
            // parfaitement en arrière-plan avec les données JSON !
            showOutline:         false,
            strokeColor:         '#00c9a7',
            drawingColor:        '#00c9a7',
            highlightOnComplete: false,
            showHintAfterMisses: 4,
        });
    } else {
        return HanziWriter.create(elementId, character, {
            ...baseOptions,
            showCharacter:       false,
            showOutline:         true,
            outlineColor:        '#88899E',
            outlineOpacity:      0.15,
            strokeColor:         '#00c9a7',
            drawingColor:        '#00c9a7',
            highlightOnComplete: true,
            showHintAfterMisses: 2,
        });
    }
}

export function startStrokeQuiz({ type, id, mode = 'trace-easy' }) {
    let indices, title;
    if (type === 'category') {
        const cat = state.categories.get(id);
        if (!cat || !cat.indices.length) return;
        indices = shuffleIndices([...cat.indices]);
        title = cat.label;
    } else if (type === 'series') {
        const ser = state.seriesMap.get(id);
        if (!ser || !ser.indices.length) return;
        const cat = state.categories.get(ser.catId);
        indices = shuffleIndices([...ser.indices]);
        title = `${cat?.label ?? ''} · ${ser.label}`;
    } else if (type === 'single') {
        const kanji = state.data.kanjiDb.find(k => k.char === id);
        if (!kanji) return;
        indices = [state.data.kanjiDb.indexOf(kanji)];
        title = `Pratique : ${kanji.char}`;
    } else if (type === 'queue') {
        // id est ici un tableau de caractères (file de révision SRS)
        indices = id.map(char => state.data.kanjiDb.findIndex(k => k.char === char)).filter(i => i !== -1);
        if (indices.length === 0) return;
        title = 'Révision';
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

export function renderStrokeQuizQuestion() {
    if (!strokeQuizState) return;
    const qs = strokeQuizState;
    if (qs.idx >= qs.indices.length) { renderStrokeQuizResults(); return; }

    // Annuler les timers et nettoyer l'ancien writer AVANT de réécrire le DOM
    if (qs._nextTimer) { clearTimeout(qs._nextTimer); qs._nextTimer = null; }
    if (strokeWriter) { try { strokeWriter.cancelQuiz(); } catch(_) {} strokeWriter = null; }

    const k          = state.data.kanjiDb[qs.indices[qs.idx]];
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
            ${extraMeanings.map(m => `<span style="font-size:0.6875rem;color:var(--gray);background:var(--card);border:1px solid var(--border);border-radius:5px;padding:2px 8px">${m}</span>`).join('')}
           </div>` : '';

    const readingsChips = buildReadingChips(k, { maxOn: 4, maxKun: 4, showBadge: true });
    const strokeDots    = Array(k.strokes).fill(0).map((_, i) =>
        `<div class="sq-stroke-dot" id="sq-dot-${i}"></div>`).join('');

    document.getElementById('stroke-quiz-body').innerHTML = `
        <div class="sq-kanji-header">
            <div class="sq-meaning" style="font-size:1.375rem;font-weight:bold">${mainMeaning}</div>
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
        <div id="sq-feedback" style="height:22px;margin-top:10px;font-weight:bold;text-align:center;font-size:0.8125rem;color:var(--gray)"></div>
        <div class="sq-actions">
            <button class="sq-btn hint" onclick="sqShowHint()">💡 Indice</button>
            <button class="sq-btn skip" onclick="sqSkip()">Passer →</button>
        </div>`;

    // Attendre le prochain frame pour que le DOM soit stabilisé avant d'initialiser HanziWriter
    requestAnimationFrame(() => {
        if (!strokeQuizState || strokeQuizState.idx !== qs.idx) return;

        strokeWriter = createStrokeWriter('sq-writer-target', k.char, isHardcore);
        if (!strokeWriter) { sqSkip(); return; }

        const sqBody = document.getElementById('stroke-quiz-body');
        if (sqBody) sqBody.classList.add('tracing');

        // Attendre que HanziWriter ait créé son SVG (asynchrone) puis poser touch-action:none
        requestAnimationFrame(() => {
            const target = document.getElementById('sq-writer-target');
            if (!target) return;
            target.style.touchAction = 'none';
            target.querySelectorAll('*').forEach(el => { el.style.touchAction = 'none'; });
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

        // Callbacks stockés dans qs._quizCallbacks pour être réutilisés par sqShowHint() lors
        // du redémarrage du quiz après un indice
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

export function updateSqScore() {
    if (!strokeQuizState) return;
    const qs = strokeQuizState;
    const done = qs.correct + qs.wrong;
    const scoreFloat = done > 0 ? (qs.correct / done * 10).toFixed(1) : '0.0';
    document.getElementById('sq-score-sub').textContent = `${scoreFloat} / 10.0`;
}

export function closeStrokeQuiz() {
    if (sqTimerInterval) clearInterval(sqTimerInterval);
    strokeWriter = null;
    strokeQuizState = null;

    // Nettoyage du tracé kana (même overlay #stroke-quiz-view, état séparé, pas encore porté
    // — voir core/state.js pour ces trois emplacements réservés)
    if (state.kanaTraceTimerInterval) clearInterval(state.kanaTraceTimerInterval);
    if (state.kanaTraceState && state.kanaTraceState._nextTimer) clearTimeout(state.kanaTraceState._nextTimer);
    if (state.kanaTraceWriter) { try { state.kanaTraceWriter.cancelQuiz(); } catch(_) {} }
    state.kanaTraceWriter = null;
    state.kanaTraceState  = null;

    document.getElementById('stroke-quiz-view').style.display = 'none';
}

export function sqShowHint() {
    if (!strokeWriter || !strokeQuizState) return;
    const qs = strokeQuizState;
    const k  = state.data.kanjiDb[qs.indices[qs.idx]];
    if (!k || !qs._quizCallbacks) return;

    // Nombre de traits déjà validés
    const strokesDone = qs._strokesDoneRef ? qs._strokesDoneRef() : 0;
    if (strokesDone >= k.strokes) return;

    // Compter comme erreur
    qs.mistakesThisKanji++;
    const fb = document.getElementById('sq-feedback');
    if (fb) { fb.style.color = '#f5a623'; fb.textContent = `💡 Indice — trait ${strokesDone + 1}`; }

    // API HanziWriter réelle : cancelQuiz() -> animateStroke(N) -> quiz({ quizStartStrokeNum: N+1, ... })
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

export function sqSkip() {
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

// ⚠️ ATTENTION : appelle renderDashboard() (ui/dashboard.js, pas encore porté) quand
// sourceType === 'single' — un vrai appel JS, pas un onclick="..." : lèvera une
// ReferenceError dans ce cas précis tant que ui/dashboard.js n'existe pas.
export function renderStrokeQuizResults() {
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
        const kanji = state.data.kanjiDb[idx];
        if (kanji) {
            localStorage.setItem(`trace_${kanji.char}`, pct);
        }
    });

    // Si la session vient de la file de révision SRS, on nourrit aussi le planning générique
    if (sourceType === 'queue') {
        const quality = pct >= 80 ? 3 : pct >= 60 ? 2 : pct >= 40 ? 1 : 0;
        indices.forEach(idx => {
            const kanji = state.data.kanjiDb[idx];
            if (kanji) gradeReview(kanji.char, quality, { type: 'kanji', label: kanji.char });
        });
    }

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
   REJOUER / LANCER LE TRACÉ DEPUIS LA FICHE DÉTAIL (kanji ou kana)
   ─────────────────────────────────────────────────
   Placées ici (pas dans features/kanji.js) car elles sont fondamentalement des
   déclencheurs du système de tracé — kanji.js n'a pas besoin de les connaître, et les
   mettre dans kanji.js aurait recréé le cycle kanji.js<->strokes.js qu'on vient de résoudre.
   ⚠️ La branche 'kana' ci-dessous appelle animateKanaChar()/showKanaTraceModal()
   (features/kana.js, tracé kana pas encore porté) — de vrais appels JS, pas des onclick :
   lèveront une ReferenceError si l'utilisateur ouvre une fiche kana et appuie sur ces
   boutons, tant que kana.js n'aura pas porté sa partie tracé.
══════════════════════════════════════════════════ */
export function replayAnimation() {
    if (state.currentType === 'kanji' && typeof state.writer !== 'undefined' && state.writer) {
        // On lance l'animation complète
        state.writer.animateCharacter({
            onComplete: function() {
                // Dès que l'animation est finie, on vérifie si un quiz était actif
                // et si oui, on relance le mode dessin !
                if (state.writer._quiz) {
                    state.writer.quiz();
                }
            }
        });
    }
    else if (state.currentType === 'kana' && state.currentChar) {
        animateKanaChar(state.currentChar);
    }
}

export function launchDetailTrace() {
    if (state.currentType === 'kana') {
        const kana = window.currentKanaForStroke;
        if (!kana) return;
        closeDetail();
        showKanaTraceModal(kana);
        return;
    }
    const char = window.currentKanjiForStroke;
    if (!char) return;
    closeDetail();
    startStrokeQuiz({ type: 'single', id: char, mode: 'trace-easy' });
}
