/**
 * Shared animation presets for anime.js
 * All spring configs tuned to the marketplace's golden/dark aesthetic
 */

// Spring easing strings for anime.js v4
// Format: spring(mass, stiffness, damping, velocity)
export const SPRING_GENTLE = 'spring(1, 120, 20, 0)';
export const SPRING_SNAPPY = 'spring(0.5, 200, 15, 0)';
export const SPRING_HEAVY = 'spring(1.5, 100, 25, 0)';

// Stagger presets (delay in ms between each element)
export const STAGGER_GRID = 40;
export const STAGGER_FAST = 30;
export const STAGGER_CENTER = 50;

// Duration presets (ms)
export const DURATION_FAST = 300;
export const DURATION_NORMAL = 500;
export const DURATION_SLOW = 800;
