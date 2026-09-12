/**
 * js/ui/common.js
 * Composants UI génériques et utilitaires de rendu DOM
 */

export function createBadge(level) {
    const span = document.createElement('span');
    span.className = `badge badge-${level ? level.toLowerCase() : 'default'}`;
    span.textContent = level || 'N/A';
    return span;
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