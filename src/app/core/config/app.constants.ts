/**
 * Cross-cutting application constants
 */

/** Debounce delay values in milliseconds */
export const DEBOUNCE_MS = {
  search: 300,
  urlUpdate: 300,
} as const;

/** Timeout values in milliseconds */
export const TIMEOUT_MS = {
  feedbackClear: 2000,
  announcementClear: 3000,
  staleData: 300000, // 5 minutes
  highlightDuration: 2000,
} as const;

/** Minimum length validation values */
export const MIN_LENGTH = {
  address: 3,
  password: 8,
  phone: 5,
} as const;

/** Maximum length validation values */
export const MAX_LENGTH = {
  source: 50,
  consumerNote: 2000,
} as const;
