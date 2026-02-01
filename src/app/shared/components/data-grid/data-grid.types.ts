/**
 * Enterprise Data Grid Types
 * Defines all interfaces and types for the data grid component
 */

import {
  DEBOUNCE_MS,
  TIMEOUT_MS,
  MOBILE_BREAKPOINT,
  ROW_HEIGHT,
  CARD_PREVIEW_FIELD_COUNT,
  MAX_MOBILE_COLUMNS,
} from '../../../core/config';

/** Address mapping configuration for address cells */
export interface AddressFieldMapping {
  /** Field key for street */
  street?: string;
  /** Field key for house number */
  houseNumber?: string;
  /** Field key for zip/postcode */
  zipCode?: string;
  /** Field key for city */
  city?: string;
  /** Field key for state/province */
  state?: string;
  /** Field key for country */
  country?: string;
}

/** Column definition for the data grid */
export interface GridColumn<T = unknown> {
  /** Unique identifier for the column */
  id: string;
  /** Header text to display */
  header: string;
  /** Property key to access from row data */
  field: keyof T | string;
  /** Column width (CSS value) */
  width?: string;
  /** Minimum column width */
  minWidth?: string;
  /** Maximum column width */
  maxWidth?: string;
  /** Whether column is sortable */
  sortable?: boolean;
  /** Whether column is filterable */
  filterable?: boolean;
  /** Whether column is editable */
  editable?: boolean;
  /** Editability scope (defaults to always when editable is true) */
  editableWhen?: 'always' | 'new-only';
  /** Custom cell renderer type */
  cellType?: 'text' | 'number' | 'date' | 'boolean' | 'select' | 'custom' | 'address' | 'icon' | 'color';
  /** Address field mapping for address cell type */
  addressMapping?: AddressFieldMapping;
  /** Options for select type cells */
  selectOptions?: readonly { label: string; value: unknown }[];
  /** Metadata for select options (icon/color/description) */
  metaOptions?: readonly { label?: string; value: unknown; icon?: string | null; color?: string | null; description?: string | null }[];
  /** Validation function for editable cells */
  validator?: (value: unknown, row: T) => string | null;
  /** Custom cell template identifier */
  templateId?: string;
  /** Whether column is visible */
  visible?: boolean;
  /** Alignment for cell content */
  align?: 'left' | 'center' | 'right';
  /** Whether column is frozen */
  frozen?: boolean;
}

/** Sort configuration */
export interface SortConfig {
  /** Column ID being sorted */
  columnId: string;
  /** Sort direction */
  direction: 'asc' | 'desc';
}

/** Filter configuration */
export interface FilterConfig {
  /** Column ID being filtered */
  columnId: string;
  /** Filter value */
  value: string;
  /** Filter operator */
  operator: 'contains' | 'equals' | 'startsWith' | 'endsWith' | 'gt' | 'lt' | 'gte' | 'lte';
}

/** Pagination configuration */
export interface PaginationConfig {
  /** Current page (1-indexed) */
  page: number;
  /** Items per page */
  pageSize: number;
  /** Total items count */
  totalItems: number;
  /** Available page size options */
  pageSizeOptions: readonly number[];
}

/** Row state for tracking edits and selection */
export interface RowState<T> {
  /** Original row data */
  original: T;
  /** Current/edited row data */
  current: T;
  /** Whether row is selected */
  selected: boolean;
  /** Whether row is in edit mode */
  editing: boolean;
  /** Whether row is dirty (has unsaved changes) */
  dirty: boolean;
  /** Whether row is being saved */
  saving: boolean;
  /** Row-level error message */
  error: string | null;
  /** Cell-level validation errors */
  cellErrors: Record<string, string>;
  /** Whether this is a new (unsaved) row */
  isNew: boolean;
  /** Timestamp for optimistic concurrency */
  version?: number;
  /** Whether row was recently updated by another user */
  recentlyUpdated: boolean;
}

/** Grid loading states */
export type LoadingState = 'idle' | 'loading' | 'saving' | 'error';

/** Navigation mode for pagination */
export type NavigationMode = 'pagination' | 'infinite-scroll';

/** Cell edit event */
export interface CellEditEvent<T> {
  rowId: string | number;
  columnId: string;
  oldValue: unknown;
  newValue: unknown;
  row: T;
}

/** Row selection event */
export interface SelectionChangeEvent<T> {
  selectedRows: T[];
  allSelected: boolean;
}

/** Sort change event */
export interface SortChangeEvent {
  sort: SortConfig | null;
}

/** Filter change event */
export interface FilterChangeEvent {
  filters: FilterConfig[];
}

/** Page change event */
export interface PageChangeEvent {
  page: number;
  pageSize: number;
}

/** Server-side data request */
export interface DataRequest {
  page: number;
  pageSize: number;
  sort: SortConfig | null;
  filters: FilterConfig[];
  searchTerm: string;
}

/** Server-side data response */
export interface DataResponse<T> {
  data: T[];
  totalItems: number;
  page: number;
  pageSize: number;
}

/** Bulk operation result */
export interface BulkOperationResult<T> {
  successful: T[];
  failed: { row: T; error: string }[];
}

/** Real-time update event */
export interface RealTimeUpdate<T> {
  type: 'create' | 'update' | 'delete';
  rowId: string | number;
  data?: T;
  timestamp: number;
}

/** Grid configuration */
export interface GridConfig<T> {
  /** Unique row identifier field */
  rowIdField: keyof T;
  /** Navigation mode */
  navigationMode: NavigationMode;
  /** Enable row selection */
  selectable: boolean;
  /** Enable multi-row selection */
  multiSelect: boolean;
  /** Enable column resizing */
  resizable: boolean;
  /** Enable row reordering */
  reorderable: boolean;
  /** Enable virtual scrolling */
  virtualScroll: boolean;
  /** Virtual scroll row height (px) */
  rowHeight: number;
  /** Debounce time for search (ms) */
  searchDebounce: number;
  /** Auto-refresh interval (ms), 0 to disable */
  autoRefreshInterval: number;
  /** Enable stale data detection */
  staleDataDetection: boolean;
  /** Stale data threshold (ms) */
  staleDataThreshold: number;
  /** Enable offline queue */
  offlineQueue: boolean;
  /** Max offline queue size */
  maxOfflineQueueSize: number;
  
  // ============ Mobile/Card View Configuration ============
  
  /** Enable card view on mobile (switches from table to cards below breakpoint) */
  cardViewEnabled: boolean;
  /** Breakpoint (px) below which card view is used */
  mobileBreakpoint: number;
  /** Field to use as card title/header */
  cardTitleField?: keyof T | string;
  /** Field to use as subtitle (e.g. phone/email) */
  cardSubtitleField?: keyof T | string;
  /** Secondary subtitle field */
  cardSecondarySubtitleField?: keyof T | string;
  /** Field to use for status chip */
  statusField?: keyof T | string;
  /** Number of fields to show before "expand" in card view */
  cardPreviewFieldCount: number;
  /** Enable column visibility picker in toolbar */
  columnPickerEnabled: boolean;
  /** Maximum columns visible on mobile (table view) */
  maxMobileColumns: number;
  /** Enable add-row bar on mobile/card view */
  mobileAddRowEnabled: boolean;
  /** Show per-row view action (eye icon) */
  rowViewActionEnabled: boolean;
  /** Show per-row delete action (trash icon) */
  rowDeleteActionEnabled: boolean;
}

/** Default grid configuration */
export const DEFAULT_GRID_CONFIG: GridConfig<unknown> = {
  rowIdField: 'id' as keyof unknown,
  navigationMode: 'pagination',
  selectable: true,
  multiSelect: true,
  resizable: true,
  reorderable: false,
  virtualScroll: false,
  rowHeight: ROW_HEIGHT,
  searchDebounce: DEBOUNCE_MS.search,
  autoRefreshInterval: 0,
  staleDataDetection: true,
  staleDataThreshold: TIMEOUT_MS.staleData,
  offlineQueue: true,
  maxOfflineQueueSize: 100,
  
  // Mobile/Card View defaults
  cardViewEnabled: true,
  mobileBreakpoint: MOBILE_BREAKPOINT,
  cardTitleField: undefined,
  cardPreviewFieldCount: CARD_PREVIEW_FIELD_COUNT,
  columnPickerEnabled: true,
  maxMobileColumns: MAX_MOBILE_COLUMNS,
  mobileAddRowEnabled: true,
  rowViewActionEnabled: false,
  rowDeleteActionEnabled: false,
};

/** Cell position for keyboard navigation */
export interface CellPosition {
  rowIndex: number;
  columnIndex: number;
}

/** Announced message for screen readers */
export interface AriaAnnouncement {
  message: string;
  politeness: 'polite' | 'assertive';
}
