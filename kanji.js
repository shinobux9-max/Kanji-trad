/* kanji.js - Core logic for Kanji Learner */

// Global State
window.currentKanjiForStroke = null;
window.currentGrade = null;
window.currentSeries = null;
window.userFolders = JSON.parse(localStorage.getItem('kanji_folders') || '{}');

// Navigation functions
function toggleSidebar(open) {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    if (open) {
        sidebar.classList.add('open');
        overlay.classList.add('show');
    } else {
        sidebar.classList.remove('open');
        overlay.classList.remove('show');
    }
}

function toggleSearch() {
    const searchBar = document.getElementById('search-bar');
    const searchResults = document.getElementById('search-results');
    const container = document.getElementById('main-content');
    
    const isOpen = searchBar.classList.contains('open');
    if (isOpen) {
        searchBar.classList.remove('open');
        searchResults.classList.remove('open');
        container.classList.remove('search-open');
    } else {
        searchBar.classList.add('open');
        searchResults.classList.add('open');
        searchResults.classList.add('with-bar');
        container.classList.add('search-open');
        document.getElementById('search-input').focus();
    }
}

function clearSearch() {
    const input = document.getElementById('search-input');
    input.value = '';
    doSearch('');
    document.getElementById('search-clear').classList.remove('show');
}

function doSearch(query) {
    const clearBtn = document.getElementById('search-clear');
    if (query.trim().length > 0) {
        clearBtn.classList.add('show');
    } else {
        clearBtn.classList.remove('show');
    }
    // Search implementation...
}

function navDashboard() {
    toggleSidebar(false);
    document.getElementById('page-title').textContent = '漢字 Study';
    const container = document.getElementById('main-content');
    container.innerHTML = `
        <div class="dash-wrap">
            <div class="welcome-box">
                <div>
                    <h3 style="margin:0 0 4px;font-size:16px;">Okaeri! 👋</h3>
                    <p style="margin:0;font-size:12px;color:var(--gray);">Prêt à poursuivre votre apprentissage des kanji ?</p>
                </div>
            </div>
            <div class="dash-card">
                <div class="streak-info">
                    <div><span class="streak-val">0</span><span class="streak-label">JOURS DE SUITE</span></div>
                    <div><span class="streak-val">0</span><span class="streak-label">KANJI APPRIS</span></div>
                    <div><span class="streak-val">0%</span><span class="streak-label">PRÉCISION</span></div>
                </div>
                <div class="dots-grid">
                    <div class="dot"></div><div class="dot"></div><div class="dot"></div><div class="dot"></div><div class="dot"></div><div class="dot"></div><div class="dot"></div>
                </div>
            </div>
        </div>
    `;
}

function navKana() {
    toggleSidebar(false);
    document.getElementById('page-title').textContent = 'Kana';
    const container = document.getElementById('main-content');
    container.innerHTML = `
        <div class="kana-tabs">
            <div class="kana-tab active" onclick="switchKanaTab('hiragana')">Hiragana</div>
            <div class="kana-tab" onclick="switchKanaTab('katakana')">Katakana</div>
        </div>
        <div style="padding:16px;" id="kana-content">
            <div class="kana-section-title">Voyelles</div>
            <div class="kana-grid">
                <div class="kana-cell"><span class="kana-char">あ</span><span class="kana-rom">a</span></div>
                <div class="kana-cell"><span class="kana-char">い</span><span class="kana-rom">i</span></div>
                <div class="kana-cell"><span class="kana-char">う</span><span class="kana-rom">u</span></div>
                <div class="kana-cell"><span class="kana-char">え</span><span class="kana-rom">e</span></div>
                <div class="kana-cell"><span class="kana-char">お</span><span class="kana-rom">o</span></div>
            </div>
        </div>
    `;
}

function navFolders() {
    toggleSidebar(false);
    document.getElementById('page-title').textContent = 'Mes Dossiers';
    const container = document.getElementById('main-content');
    container.innerHTML = `
        <div class="folders-wrap">
            <div class="folder-empty">
                <div class="folder-empty-icon">📁</div>
                <div class="folder-empty-text">Aucun dossier créé pour le moment.<br>Enregistrez des kanji depuis leur fiche détaillée !</div>
            </div>
        </div>
    `;
}

function closeDetail() {
    document.getElementById('detail-view').style.display = 'none';
}

function openFolderModal(kanji) {
    window.currentKanjiForStroke = kanji;
    document.getElementById('fm-kanji-label').textContent = kanji || '';
    document.getElementById('folder-modal').classList.add('open');
}

function closeFolderModal() {
    document.getElementById('folder-modal').classList.remove('open');
}

function confirmNewFolder() {
    const input = document.getElementById('fm-new-inp');
    const name = input.value.trim();
    if (name) {
        if (!window.userFolders[name]) {
            window.userFolders[name] = [];
        }
        if (window.currentKanjiForStroke && !window.userFolders[name].includes(window.currentKanjiForStroke)) {
            window.userFolders[name].push(window.currentKanjiForStroke);
        }
        localStorage.setItem('kanji_folders', JSON.stringify(window.userFolders));
        input.value = '';
        closeFolderModal();
    }
}

// Quiz & Mode triggers
function openQuizModal() {
    document.getElementById('quiz-mode-modal').classList.add('open');
}

function closeQuizModal() {
    document.getElementById('quiz-mode-modal').classList.remove('open');
}

function launchQuizMode(mode) {
    closeQuizModal();
    document.getElementById('quiz-view').style.display = 'flex';
}

function launchStrokeMode(mode) {
    closeQuizModal();
    document.getElementById('stroke-quiz-view').style.display = 'flex';
}

function closeQuiz() {
    document.getElementById('quiz-view').style.display = 'none';
}

function closeStrokeQuiz() {
    document.getElementById('stroke-quiz-view').style.display = 'none';
}

function replayAnimation() {
    console.log("Replaying stroke animation...");
}

function startOralTest(kanji) {
    console.log("Starting oral test for:", kanji);
}

function launchDetailTrace() {
    document.getElementById('stroke-quiz-view').style.display = 'flex';
}

function togglePause() {
    console.log("Toggle quiz pause");
}

function toggleStrokePause() {
    console.log("Toggle stroke quiz pause");
}

function continueAfterFeedback() {
    document.getElementById('quiz-feedback-modal').classList.remove('open');
}

// Initialize home screen on load
document.addEventListener('DOMContentLoaded', () => {
    navDashboard();
});
