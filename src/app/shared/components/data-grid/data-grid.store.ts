/**
 * Enterprise Data Grid Store
 * Signal-based state management for the data grid component
 */

import { computed, Injectable, signal } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { PAGINATION_DEFAULTS, TIMEOUT_MS } from '../../../core/config';
import {
  AriaAnnouncement,
  BulkOperationResult,
  CellPosition,
  DataRequest,
  DEFAULT_GRID_CONFIG,
  FilterConfig,
  GridColumn,
  GridConfig,
  LoadingState,
  PaginationConfig,
  RealTimeUpdate,
  RowState,
  SortConfig,
} from './data-grid.types';

/**
 * Data grid store service
 * Manages all grid state using Angular signals
 */
@Injectable()
export class DataGridStore<T extends Record<string, unknown>> {
  // ============ Core Data State ============
  private readonly _rows = signal<RowState<T>[]>([]);
  private readonly _columns = signal<GridColumn<T>[]>([]);
  private readonly _config = signal<GridConfig<T>>(DEFAULT_GRID_CONFIG as GridConfig<T>);

  // ============ UI State ============
  private readonly _loadingState = signal<LoadingState>('idle');
  private readonly _searchTerm = signal('');
  private readonly _sort = signal<SortConfig | null>(null);
  private readonly _filters = signal<FilterConfig[]>([]);
  private readonly _focusedCell = signal<CellPosition | null>(null);
  private readonly _editingCell = signal<CellPosition | null>(null);

  // ============ Pagination State ============
  private readonly _pagination = signal<PaginationConfig>({
    page: 1,
    pageSize: PAGINATION_DEFAULTS.pageSize,
    totalItems: 0,
    pageSizeOptions: [...PAGINATION_DEFAULTS.pageSizeOptions],
  });

  // ============ Network State ============
  private readonly _isOnline = signal(typeof navigator === 'undefined' ? true : navigator.onLine);
  private readonly _offlineQueue = signal<{ action: string; payload: unknown }[]>([]);
  private readonly _lastRefresh = signal<number>(Date.now());

  // ============ Announcements ============
  private readonly _announcements = signal<AriaAnnouncement[]>([]);

  // ============ Viewport/Mobile State ============
  private readonly _viewportWidth = signal(globalThis.window === undefined ? 1024 : globalThis.window.innerWidth);
  private readonly _scrollState = signal({ scrollLeft: 0, scrollWidth: 0, clientWidth: 0 });

  // ============ Observables for data fetching ============
  private readonly _dataRequest$ = new BehaviorSubject<DataRequest | null>(null);
  private readonly _refreshTrigger$ = new Subject<void>();
  private readonly _realTimeUpdates$ = new Subject<RealTimeUpdate<T>>();

  // ============ Public Readonly Signals ============
  readonly rows = this._rows.asReadonly();
  readonly columns = this._columns.asReadonly();
  readonly config = this._config.asReadonly();
  readonly loadingState = this._loadingState.asReadonly();
  readonly searchTerm = this._searchTerm.asReadonly();
  readonly sort = this._sort.asReadonly();
  readonly filters = this._filters.asReadonly();
  readonly pagination = this._pagination.asReadonly();
  readonly focusedCell = this._focusedCell.asReadonly();
  readonly editingCell = this._editingCell.asReadonly();
  readonly isOnline = this._isOnline.asReadonly();
  readonly offlineQueue = this._offlineQueue.asReadonly();
  readonly announcements = this._announcements.asReadonly();
  readonly viewportWidth = this._viewportWidth.asReadonly();
  readonly scrollState = this._scrollState.asReadonly();

  // ============ Computed Signals ============

  /** Whether we're in mobile view (below breakpoint) */
  readonly isMobileView = computed(() => 
    this._viewportWidth() < this._config().mobileBreakpoint
  );

  /** Whether to show card view (mobile + card view enabled) */
  readonly showCardView = computed(() => 
    this.isMobileView() && this._config().cardViewEnabled
  );

  /** Whether there's content to scroll left */
  readonly canScrollLeft = computed(() => 
    this._scrollState().scrollLeft > 0
  );

  /** Whether there's content to scroll right */
  readonly canScrollRight = computed(() => {
    const { scrollLeft, scrollWidth, clientWidth } = this._scrollState();
    return scrollLeft + clientWidth < scrollWidth - 1; // -1 for rounding
  });

  /** Frozen columns (for sticky positioning) */
  readonly frozenColumns = computed(() => 
    this._columns().filter(col => col.frozen && col.visible !== false)
  );

  /** Visible columns only */
  readonly visibleColumns = computed(() => 
    this._columns().filter(col => col.visible !== false)
  );

  /** Whether any rows are selected */
  readonly hasSelection = computed(() => 
    this._rows().some(row => row.selected)
  );

  /** All selected rows */
  readonly selectedRows = computed(() => 
    this._rows().filter(row => row.selected)
  );

  /** Whether all rows are selected */
  readonly allSelected = computed(() => {
    const rows = this._rows();
    return rows.length > 0 && rows.every(row => row.selected);
  });

  /** Partially selected state for header checkbox */
  readonly partiallySelected = computed(() => 
    !this.allSelected() && this.hasSelection()
  );

  /** Count of selected rows */
  readonly selectedCount = computed(() => 
    this._rows().filter(row => row.selected).length
  );

  /** Whether any rows have unsaved changes */
  readonly hasDirtyRows = computed(() => 
    this._rows().some(row => row.dirty)
  );

  /** All dirty rows */
  readonly dirtyRows = computed(() => 
    this._rows().filter(row => row.dirty)
  );

  /** Rows with errors */
  readonly rowsWithErrors = computed(() => 
    this._rows().filter(row => row.error || Object.keys(row.cellErrors).length > 0)
  );

  /** Whether grid is in edit mode */
  readonly isEditing = computed(() => 
    this._editingCell() !== null || this._rows().some(row => row.editing)
  );

  /** Total pages based on pagination */
  readonly totalPages = computed(() => {
    const { pageSize, totalItems } = this._pagination();
    return Math.ceil(totalItems / pageSize);
  });

  /** Page numbers for pagination UI */
  readonly pageNumbers = computed(() => {
    const total = this.totalPages();
    const current = this._pagination().page;
    const pages: number[] = [];
    
    // Show up to 7 page numbers
    const maxVisible = PAGINATION_DEFAULTS.maxVisiblePages;
    let start = Math.max(1, current - Math.floor(maxVisible / 2));
    const end = Math.min(total, start + maxVisible - 1);
    
    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1);
    }
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    
    return pages;
  });

  /** Whether data might be stale */
  readonly isDataStale = computed(() => {
    if (!this._config().staleDataDetection) return false;
    const elapsed = Date.now() - this._lastRefresh();
    return elapsed > this._config().staleDataThreshold;
  });

  /** Current data request parameters */
  readonly currentRequest = computed<DataRequest>(() => ({
    page: this._pagination().page,
    pageSize: this._pagination().pageSize,
    sort: this._sort(),
    filters: this._filters(),
    searchTerm: this._searchTerm(),
  }));

  /** Whether there are pending offline operations */
  readonly hasPendingOfflineOps = computed(() => 
    this._offlineQueue().length > 0
  );

  constructor() {
    this.setupNetworkListeners();
    this.setupViewportListener();
  }

  // ============ Configuration Methods ============

  /** Initialize store with columns and config */
  initialize(columns: GridColumn<T>[], config?: Partial<GridConfig<T>>): void {
    this._columns.set(columns.map(col => ({ ...col, visible: col.visible ?? true })));
    if (config) {
      this._config.update(c => ({ ...c, ...config }));
    }
  }

  /** Update configuration */
  updateConfig(config: Partial<GridConfig<T>>): void {
    this._config.update(c => ({ ...c, ...config }));
  }

  // ============ Data Methods ============

  /** Set rows data (transforms to RowState) */
  setData(data: T[], totalItems?: number): void {
    const rows: RowState<T>[] = data.map(item => ({
      original: { ...item },
      current: { ...item },
      selected: false,
      editing: false,
      dirty: false,
      saving: false,
      error: null,
      cellErrors: {},
      isNew: false,
      version: (item as Record<string, unknown>)['version'] as number | undefined,
      recentlyUpdated: false,
    }));
    
    this._rows.set(rows);
    this._lastRefresh.set(Date.now());
    
    if (totalItems !== undefined) {
      this._pagination.update(p => (
        p.totalItems === totalItems ? p : { ...p, totalItems }
      ));
    }
    
    this.announce('Data loaded', 'polite');
  }

  /** Add a new empty row for creation */
  addNewRow(template: Partial<T> = {}): void {
    const newRow: RowState<T> = {
      original: template as T,
      current: template as T,
      selected: false,
      editing: true,
      dirty: true,
      saving: false,
      error: null,
      cellErrors: {},
      isNew: true,
      recentlyUpdated: false,
    };
    
    this._rows.update(rows => [newRow, ...rows]);
    
    // Focus the first editable cell of the new row
    const firstEditableCol = this.visibleColumns().findIndex(col => col.editable);
    if (firstEditableCol >= 0) {
      this._focusedCell.set({ rowIndex: 0, columnIndex: firstEditableCol });
      this._editingCell.set({ rowIndex: 0, columnIndex: firstEditableCol });
    }
    
    this.announce('New row added. Ready for input.', 'polite');
  }

  /** Remove a row (for new rows not yet saved) */
  removeNewRow(rowIndex: number): void {
    const rows = this._rows();
    if (rows[rowIndex]?.isNew) {
      this._rows.update(r => r.filter((_, i) => i !== rowIndex));
      this.announce('New row removed', 'polite');
    }
  }

  /** Discard all unsaved changes and remove new rows */
  discardDirtyChanges(): void {
    this._rows.update(rows =>
      rows
        .filter(row => !row.isNew)
        .map(row =>
          row.dirty
            ? {
                ...row,
                current: { ...row.original },
                dirty: false,
                editing: false,
                cellErrors: {},
                error: null,
              }
            : row
        )
    );

    this._editingCell.set(null);
    this._focusedCell.set(null);
    this.announce('Changes discarded', 'polite');
  }

  // ============ Selection Methods ============

  /** Toggle row selection */
  toggleRowSelection(rowIndex: number): void {
    this._rows.update(rows => 
      rows.map((row, i) => 
        i === rowIndex ? { ...row, selected: !row.selected } : row
      )
    );
  }

  /** Select/deselect all rows */
  toggleAllSelection(): void {
    const shouldSelect = !this.allSelected();
    this._rows.update(rows => 
      rows.map(row => ({ ...row, selected: shouldSelect }))
    );
    
    this.announce(
      shouldSelect ? 'All rows selected' : 'All rows deselected', 
      'polite'
    );
  }

  /** Clear all selections */
  clearSelection(): void {
    this._rows.update(rows => 
      rows.map(row => ({ ...row, selected: false }))
    );
  }

  // ============ Edit Methods ============

  /** Start editing a cell */
  startCellEdit(rowIndex: number, columnIndex: number): void {
    const column = this._columns()[columnIndex];
    
    if (!column?.editable) return;
    
    // Check for stale data
    if (this.isDataStale()) {
      this.announce('Data may be outdated. Refreshing before edit.', 'assertive');
      // In a real implementation, trigger a refresh here
    }
    
    this._editingCell.set({ rowIndex, columnIndex });
    this._rows.update(rows => 
      rows.map((row, i) => 
        i === rowIndex ? { ...row, editing: true } : row
      )
    );
    
    this.announce(`Editing ${column.header}`, 'polite');
  }

  /** Update cell value during edit */
  updateCellValue(rowIndex: number, columnId: string, value: unknown): void {
    const column = this._columns().find(c => c.id === columnId);
    if (!column) return;
    
    this._rows.update(rows => 
      rows.map((row, i) => {
        if (i !== rowIndex) return row;
        
        const newCurrent = this.setValueByPath(row.current, column.field as string, value);
        
        // Run validation if defined
        const error = column.validator?.(value, newCurrent) ?? null;
        const cellErrors = { ...row.cellErrors };
        
        if (error) {
          cellErrors[columnId] = error;
        } else {
          delete cellErrors[columnId];
        }
        
        // Check if dirty by comparing with original
        const isDirty = JSON.stringify(newCurrent) !== JSON.stringify(row.original);
        
        return {
          ...row,
          current: newCurrent,
          dirty: isDirty,
          cellErrors,
        };
      })
    );
  }

  /** Update multiple values in a specific row at once */
  updateRowValues(rowIndex: number, updates: Record<string, unknown>): void {
    if (Object.keys(updates).length === 0) return;

    this._rows.update(rows =>
      rows.map((row, i) => (i === rowIndex ? this.applyRowUpdates(row, updates) : row))
    );

    this.announce('Row updated with address details', 'polite');
  }

  /** Complete cell edit (commit or cancel) */
  completeCellEdit(commit: boolean): void {
    const editingCell = this._editingCell();
    if (!editingCell) return;
    
    const { rowIndex, columnIndex } = editingCell;
    const column = this._columns()[columnIndex];
    
    this._rows.update(rows => 
      rows.map((row, i) => {
        if (i !== rowIndex) return row;
        
        if (commit) {
          // Keep the edited value
          return { ...row, editing: false };
        } else {
          // Revert to original value for this cell
          const originalValue = this.getValueByPath(row.original, column.field as string);
          const revertedCurrent = this.setValueByPath(row.current, column.field as string, originalValue);
          const cellErrors = { ...row.cellErrors };
          delete cellErrors[column.id];
          
          const isDirty = JSON.stringify(revertedCurrent) !== JSON.stringify(row.original);
          
          return {
            ...row,
            current: revertedCurrent,
            editing: false,
            dirty: isDirty,
            cellErrors,
          };
        }
      })
    );
    
    this._editingCell.set(null);
    this.announce(commit ? 'Edit saved' : 'Edit cancelled', 'polite');
  }

  /** Revert all changes for a row */
  revertRow(rowIndex: number): void {
    this._rows.update(rows => 
      rows.map((row, i) => 
        i === rowIndex 
          ? {
              ...row,
              current: { ...row.original },
              dirty: false,
              editing: false,
              cellErrors: {},
              error: null,
            }
          : row
      )
    );
    
    this.announce('Row changes discarded', 'polite');
  }

  /** Mark row as saving */
  markRowSaving(rowIndex: number, saving: boolean): void {
    this._rows.update(rows => 
      rows.map((row, i) => 
        i === rowIndex ? { ...row, saving } : row
      )
    );
    
    if (saving) {
      this.announce('Saving...', 'polite');
    }
  }

  /** Mark row save complete */
  markRowSaveComplete(rowIndex: number, success: boolean, error?: string): void {
    this._rows.update(rows => 
      rows.map((row, i) => {
        if (i !== rowIndex) return row;
        
        if (success) {
          return {
            ...row,
            original: { ...row.current },
            dirty: false,
            saving: false,
            error: null,
            isNew: false,
          };
        } else {
          return {
            ...row,
            saving: false,
            error: error ?? 'Save failed',
          };
        }
      })
    );
    
    this.announce(success ? 'Changes saved' : `Save failed: ${error}`, success ? 'polite' : 'assertive');
  }

  /** Handle bulk save results */
  handleBulkSaveResult(result: BulkOperationResult<T>): void {
    const rowIdField = this._config().rowIdField as string;
    
    this._rows.update(rows => 
      rows.map(row => {
        const rowId = row.current[rowIdField];
        
        // Check if this row was in the successful list
        const wasSuccessful = result.successful.some(
          s => s[rowIdField] === rowId
        );
        
        if (wasSuccessful) {
          return {
            ...row,
            original: { ...row.current },
            dirty: false,
            saving: false,
            error: null,
            isNew: false,
          };
        }
        
        // Check if this row failed
        const failure = result.failed.find(
          f => f.row[rowIdField] === rowId
        );
        
        if (failure) {
          return {
            ...row,
            saving: false,
            error: failure.error,
          };
        }
        
        return row;
      })
    );
    
    const successCount = result.successful.length;
    const failCount = result.failed.length;
    
    if (failCount > 0) {
      this.announce(
        `${successCount} saved, ${failCount} failed. Review errors.`,
        'assertive'
      );
    } else {
      this.announce(`${successCount} changes saved`, 'polite');
    }
  }

  // ============ Real-Time Update Methods ============

  /** Handle real-time update from server */
  handleRealTimeUpdate(update: RealTimeUpdate<T>): void {
    const config = this._config();
    const rowIdField = config.rowIdField as string;
    
    switch (update.type) {
      case 'update':
        this._rows.update(rows => 
          rows.map(row => {
            if (row.current[rowIdField] !== update.rowId) return row;
            
            // Check if user is currently editing this row
            if (row.editing) {
              // Don't overwrite, just mark that there's a conflict
              return {
                ...row,
                error: 'This record was modified by another user. Review changes.',
              };
            }
            
            // Update the row and highlight it
            return {
              ...row,
              original: update.data as T,
              current: update.data as T,
              recentlyUpdated: true,
              version: update.timestamp,
            };
          })
        );
        
        // Clear the highlight after animation
        setTimeout(() => {
          this._rows.update(rows => 
            rows.map(row => 
              row.current[rowIdField] === update.rowId
                ? { ...row, recentlyUpdated: false }
                : row
            )
          );
        }, TIMEOUT_MS.highlightDuration);
        
        this.announce('A row was updated by another user', 'polite');
        break;
        
      case 'delete': {
        this._rows.update(rows => 
          rows.filter(row => row.current[rowIdField] !== update.rowId)
        );
        
        // Adjust pagination if needed
        const newTotal = this._pagination().totalItems - 1;
        this._pagination.update(p => ({ ...p, totalItems: newTotal }));
        
        this.announce('A row was deleted by another user', 'polite');
        break;
      }
        
      case 'create':
        if (update.data) {
          const newRow: RowState<T> = {
            original: update.data,
            current: update.data,
            selected: false,
            editing: false,
            dirty: false,
            saving: false,
            error: null,
            cellErrors: {},
            isNew: false,
            version: update.timestamp,
            recentlyUpdated: true,
          };
          
          this._rows.update(rows => [newRow, ...rows]);
          
          setTimeout(() => {
            this._rows.update(rows => 
              rows.map((row, i) => 
                i === 0 ? { ...row, recentlyUpdated: false } : row
              )
            );
          }, TIMEOUT_MS.highlightDuration);
          
          this.announce('A new row was added by another user', 'polite');
        }
        break;
    }
  }

  // ============ Sorting & Filtering Methods ============

  /** Update sort configuration */
  setSort(columnId: string): void {
    const currentSort = this._sort();
    
    if (currentSort?.columnId === columnId) {
      // Toggle direction or clear
      if (currentSort.direction === 'asc') {
        this._sort.set({ columnId, direction: 'desc' });
      } else {
        this._sort.set(null);
      }
    } else {
      this._sort.set({ columnId, direction: 'asc' });
    }
    
    // Reset to first page when sorting changes
    this._pagination.update(p => ({ ...p, page: 1 }));
    
    const newSort = this._sort();
    const column = this._columns().find(c => c.id === columnId);
    
    const sortDirection = newSort?.direction === 'asc' ? 'ascending' : 'descending';
    const announcement = newSort 
      ? `Sorted by ${column?.header ?? columnId} ${sortDirection}`
      : 'Sort cleared';
    this.announce(announcement, 'polite');
  }

  /** Set search term */
  setSearchTerm(term: string): void {
    this._searchTerm.set(term);
    // Reset to first page when searching
    this._pagination.update(p => ({ ...p, page: 1 }));
  }

  /** Add or update a filter */
  setFilter(filter: FilterConfig): void {
    this._filters.update(filters => {
      const existing = filters.findIndex(f => f.columnId === filter.columnId);
      if (existing >= 0) {
        return filters.map((f, i) => i === existing ? filter : f);
      }
      return [...filters, filter];
    });
    
    // Reset to first page when filters change
    this._pagination.update(p => ({ ...p, page: 1 }));
  }

  /** Remove a filter */
  removeFilter(columnId: string): void {
    this._filters.update(filters => 
      filters.filter(f => f.columnId !== columnId)
    );
    
    // Reset to first page when filters change
    this._pagination.update(p => ({ ...p, page: 1 }));
  }

  /** Clear all filters */
  clearFilters(): void {
    this._filters.set([]);
    this._searchTerm.set('');
    this._pagination.update(p => ({ ...p, page: 1 }));
    
    this.announce('All filters cleared', 'polite');
  }

  // ============ Pagination Methods ============

  /** Go to specific page */
  goToPage(page: number): void {
    const totalPages = this.totalPages();
    const validPage = Math.max(1, Math.min(page, totalPages));
    
    this._pagination.update(p => ({ ...p, page: validPage }));
    this.announce(`Page ${validPage} of ${totalPages}`, 'polite');
  }

  /** Go to next page */
  nextPage(): void {
    if (this._pagination().page < this.totalPages()) {
      this.goToPage(this._pagination().page + 1);
    }
  }

  /** Go to previous page */
  previousPage(): void {
    if (this._pagination().page > 1) {
      this.goToPage(this._pagination().page - 1);
    }
  }

  /** Change page size */
  setPageSize(size: number): void {
    this._pagination.update(p => ({ ...p, pageSize: size, page: 1 }));
    this.announce(`Showing ${size} items per page`, 'polite');
  }

  /** Handle "vanishing row" edge case - adjust page if current page is empty */
  adjustPageIfEmpty(): void {
    const { page, totalItems, pageSize } = this._pagination();
    const maxPage = Math.max(1, Math.ceil(totalItems / pageSize));
    
    if (page > maxPage) {
      this.goToPage(maxPage);
    }
  }

  // ============ Navigation Methods ============

  /** Set focused cell */
  setFocusedCell(position: CellPosition | null): void {
    this._focusedCell.set(position);
  }

  /** Navigate to adjacent cell */
  navigateCell(direction: 'up' | 'down' | 'left' | 'right' | 'home' | 'end'): void {
    const current = this._focusedCell();
    if (!current) return;
    
    const rows = this._rows();
    const cols = this.visibleColumns();
    
    let { rowIndex, columnIndex } = current;
    
    switch (direction) {
      case 'up':
        rowIndex = Math.max(0, rowIndex - 1);
        break;
      case 'down':
        rowIndex = Math.min(rows.length - 1, rowIndex + 1);
        break;
      case 'left':
        columnIndex = Math.max(0, columnIndex - 1);
        break;
      case 'right':
        columnIndex = Math.min(cols.length - 1, columnIndex + 1);
        break;
      case 'home':
        columnIndex = 0;
        break;
      case 'end':
        columnIndex = cols.length - 1;
        break;
    }
    
    this._focusedCell.set({ rowIndex, columnIndex });
    
    // Announce for screen readers
    const column = cols[columnIndex];
    const row = rows[rowIndex];
    const value = row ? this.getValueByPath(row.current, column.field as string) : undefined;
    
    this.announce(`${column.header}: ${value}`, 'polite');
  }

  // ============ Loading State Methods ============

  /** Set loading state */
  setLoadingState(state: LoadingState): void {
    this._loadingState.set(state);
    
    if (state === 'loading') {
      this.announce('Loading data...', 'polite');
    } else if (state === 'error') {
      this.announce('Error loading data', 'assertive');
    }
  }

  // ============ Offline Queue Methods ============

  /** Add operation to offline queue */
  queueOfflineOperation(action: string, payload: unknown): void {
    const config = this._config();
    
    if (!config.offlineQueue) return;
    
    this._offlineQueue.update(queue => {
      if (queue.length >= config.maxOfflineQueueSize) {
        // Remove oldest operation
        return [...queue.slice(1), { action, payload }];
      }
      return [...queue, { action, payload }];
    });
    
    this.announce('Change queued for when connection restores', 'polite');
  }

  /** Clear offline queue (after successful sync) */
  clearOfflineQueue(): void {
    this._offlineQueue.set([]);
    this.announce('All queued changes synced', 'polite');
  }

  // ============ Announcements ============

  /** Add announcement for screen readers */
  announce(message: string, politeness: 'polite' | 'assertive'): void {
    this._announcements.update(announcements => [
      ...announcements,
      { message, politeness },
    ]);
    
    // Clear after announcement is read
    setTimeout(() => {
      this._announcements.update(a => a.slice(1));
    }, TIMEOUT_MS.feedbackClear / 2);
  }

  // ============ Private Methods ============

  private setupNetworkListeners(): void {
    if (globalThis.window === undefined) return;
    
    globalThis.addEventListener('online', () => {
      this._isOnline.set(true);
      this.announce('Connection restored', 'polite');
    });
    
    globalThis.addEventListener('offline', () => {
      this._isOnline.set(false);
      this.announce('Connection lost. Changes will be queued.', 'assertive');
    });
  }

  private setupViewportListener(): void {
    if (globalThis.window === undefined) return;
    
    const updateWidth = () => this._viewportWidth.set(window.innerWidth);
    
    // Use ResizeObserver if available for better performance
    if ('ResizeObserver' in globalThis) {
      const observer = new ResizeObserver(updateWidth);
      observer.observe(document.documentElement);
    } else {
      globalThis.addEventListener('resize', updateWidth);
    }
  }

  // ============ Viewport/Scroll Methods ============

  /** Update scroll state (called from component on scroll event) */
  updateScrollState(scrollLeft: number, scrollWidth: number, clientWidth: number): void {
    this._scrollState.set({ scrollLeft, scrollWidth, clientWidth });
  }

  /** Update viewport width manually (for SSR or testing) */
  setViewportWidth(width: number): void {
    this._viewportWidth.set(width);
  }

  // ============ Column Visibility Methods ============

  /** Toggle column visibility */
  toggleColumnVisibility(columnId: string): void {
    this._columns.update(cols => 
      cols.map(col => 
        col.id === columnId 
          ? { ...col, visible: col.visible === false }
          : col
      )
    );
    
    const column = this._columns().find(c => c.id === columnId);
    const state = column?.visible === false ? 'hidden' : 'shown';
    this.announce(`${column?.header ?? columnId} column ${state}`, 'polite');
  }

  /** Set multiple columns visibility at once */
  setColumnsVisibility(visibilityMap: Record<string, boolean>): void {
    this._columns.update(cols => 
      cols.map(col => 
        Object.hasOwn(visibilityMap, col.id)
          ? { ...col, visible: visibilityMap[col.id] }
          : col
      )
    );
  }

  /** Show all columns */
  showAllColumns(): void {
    this._columns.update(cols => 
      cols.map(col => ({ ...col, visible: true }))
    );
    this.announce('All columns visible', 'polite');
  }

  /** Set column width */
  setColumnWidth(columnId: string, width: number): void {
    this._columns.update(cols => 
      cols.map(col => 
        col.id === columnId 
          ? { ...col, width: `${width}px` }
          : col
      )
    );
  }

  // ============ Validation Methods ============

  /** Validate dirty rows and update cell errors; returns valid rows */
  validateDirtyRows(): T[] {
    const columns = this._columns();
    const validRows: T[] = [];

    this._rows.update(rows =>
      rows.map((row) => {
        if (!row.dirty) return row;

        const cellErrors = { ...row.cellErrors };
        let hasError = false;

        for (const column of columns) {
          if (!column.validator) continue;
          const value = this.getValueByPath(row.current, column.field as string);
          const error = column.validator(value, row.current) ?? null;

          if (error) {
            cellErrors[column.id] = error;
            hasError = true;
          } else {
            delete cellErrors[column.id];
          }
        }

        const nextRow = {
          ...row,
          cellErrors,
          error: hasError ? 'Fix validation errors before saving.' : null,
        };

        if (!hasError) {
          validRows.push(nextRow.current);
        }

        return nextRow;
      })
    );

    return validRows;
  }

  private getValueByPath(obj: T, path: string): unknown {
    if (!path.includes('.')) {
      return obj[path as keyof T];
    }

    return path.split('.').reduce<unknown>((acc, key) => {
      if (acc && typeof acc === 'object') {
        return (acc as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj as unknown);
  }

  private setValueByPath(obj: T, path: string, value: unknown): T {
    if (!path.includes('.')) {
      return { ...obj, [path as keyof T]: value } as T;
    }

    const keys = path.split('.');
    const next = { ...(obj as Record<string, unknown>) } as Record<string, unknown>;
    let cursor = next;
    let originalCursor = obj as Record<string, unknown>;

    for (let i = 0; i < keys.length - 1; i += 1) {
      const key = keys[i];
      const originalChild = (originalCursor?.[key] as Record<string, unknown>) ?? {};
      const child = { ...originalChild };
      cursor[key] = child;
      cursor = child;
      originalCursor = originalChild;
    }

    const lastKey = keys.at(-1);
    if (lastKey) {
      cursor[lastKey] = value;
    }

    return next as T;
  }

  private applyRowUpdates(row: RowState<T>, updates: Record<string, unknown>): RowState<T> {
    let newCurrent = { ...row.current };
    const cellErrors = { ...row.cellErrors };

    Object.entries(updates).forEach(([field, value]) => {
      newCurrent = this.setValueByPath(newCurrent, field, value);

      const column = this._columns().find(c => c.field === field);
      if (!column) return;

      const error = column.validator?.(value, newCurrent) ?? null;
      if (error) {
        cellErrors[column.id] = error;
      } else {
        delete cellErrors[column.id];
      }
    });

    const isDirty = JSON.stringify(newCurrent) !== JSON.stringify(row.original);

    return {
      ...row,
      current: newCurrent,
      dirty: isDirty,
      cellErrors,
    };
  }
}
