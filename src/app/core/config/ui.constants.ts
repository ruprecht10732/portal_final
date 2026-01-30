/**
 * UI-related constants
 */

/** Tailwind 'sm' breakpoint */
export const MOBILE_BREAKPOINT = 640;

export const ROW_HEIGHT = 48;

export const CARD_PREVIEW_FIELD_COUNT = 3;

export const MAX_MOBILE_COLUMNS = 4;

export const MAP_CONFIG = {
  defaultHeight: 180,
  defaultZoom: 16,
  boundingBoxDelta: 0.005,
} as const;

export const Z_INDEX = {
  dropdown: 1000,
} as const;

export const MULTISELECT_BOUNDS = {
  minItems: 3,
  maxItems: 8,
} as const;
