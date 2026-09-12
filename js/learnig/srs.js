/**
 * js/learning/srs.js
 * Algorithme SRS (Spaced Repetition System) et gestion de la file de révision
 */

import { getTrackingData, getItemTracking, updateItemTracking } from '../core/storage.js';
import { state } from '../core/state.js';

export function getSrsInfo(itemId) {
    const tracking = getItemTracking(itemId) || {};
    return {
        interval: tracking.interval || 0,
        ease: tracking.ease || 2.5,
        repetitions: tracking.repetitions || 0,
        nextReview: tracking.nextReview || null,
        status: tracking.status || 'new'
    };
}

export function gradeReview(itemId, quality, meta = {}) {
    let { interval, ease, repetitions } = getSrsInfo(itemId);

    if (quality >= 3) {
        if (repetitions === 0) interval = 1;
        else if (repetitions === 1) interval = 6;
        else interval = Math.round(interval * ease);
        repetitions += 1;
    } else {
        repetitions = 0;
        interval = 1;
    }

    ease = ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (ease < 1.3) ease = 1.3;

    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + interval);

    const updatedData = {
        interval,
        ease,
        repetitions,
        nextReview: nextReviewDate.toISOString(),
        status: quality >= 3 ? 'learned' : 'reviewing',
        lastReviewed: new Date().toISOString(),
        ...meta
    };

    return updateItemTracking(itemId, updatedData);
}

/**
 * Construit la liste des éléments dus pour révision aujourd'hui
 */
export function buildReviewQueue() {
    const tracking = getTrackingData();
    const now = new Date();
    const queue = [];

    const allItems = [
        ...state.data.kanjiDb.map(i => ({ ...i, itemType: 'kanji' })),
        ...state.data.vocabDb.map(i => ({ ...i, itemType: 'vocab' })),
        ...state.data.grammarDb.map(i => ({ ...i, itemType: 'grammar' }))
    ];

    allItems.forEach(item => {
        const itemTrack = tracking[item.id || item.kanji];
        if (itemTrack && itemTrack.nextReview) {
            if (new Date(itemTrack.nextReview) <= now) {
                queue.push(item);
            }
        }
    });

    return queue;
}