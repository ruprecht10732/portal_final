/**
 * Pagination constants
 */

export const DEFAULT_PAGE_SIZE = 20;

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

export const MAX_VISIBLE_PAGES = 7;

export const PAGINATION_DEFAULTS = {
  pageSize: DEFAULT_PAGE_SIZE,
  pageSizeOptions: PAGE_SIZE_OPTIONS,
  maxVisiblePages: MAX_VISIBLE_PAGES,
} as const;
