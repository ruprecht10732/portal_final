/**
 * Pagination constants
 */

export const DEFAULT_PAGE_SIZE = 20;

export const PAGINATION_DEFAULTS = {
  pageSize: DEFAULT_PAGE_SIZE,
  pageSizeOptions: [10, 25, 50, 100] as const,
  maxVisiblePages: 7,
} as const;
