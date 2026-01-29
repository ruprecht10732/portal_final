/**
 * Enterprise Data Grid Component
 * Main grid component with ARIA support, keyboard navigation, and mobile-first design
 */

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { DataGridStore } from './data-grid.store';
import { DataGridHeaderComponent } from './data-grid-header.component';
import { DataGridBodyComponent } from './data-grid-body.component';
import { DataGridPaginationComponent } from './data-grid-pagination.component';
import { DataGridToolbarComponent } from './data-grid-toolbar.component';
import { DataGridCardsComponent } from './data-grid-cards.component';
import { ButtonComponent } from '../button/button.component';

import {
  BulkOperationResult,
  CellEditEvent,
  DataRequest,
  DataResponse,
  FilterChangeEvent,
  FilterConfig,
  GridColumn,
  GridConfig,
  PageChangeEvent,
  RealTimeUpdate,
  SelectionChangeEvent,
  SortChangeEvent,
} from './data-grid.types';
import { fromEvent, Observable, Subject } from 'rxjs';

@Component({
  selector: 'shared-data-grid',
  templateUrl: './data-grid.component.html',
  styleUrl: './data-grid.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [DataGridStore],
  imports: [
    FormsModule,
    ReactiveFormsModule,
    DataGridHeaderComponent,
    DataGridBodyComponent,
    DataGridPaginationComponent,
    DataGridToolbarComponent,
    DataGridCardsComponent,
    ButtonComponent,
  ],
  host: {
    'class': 'block w-full',
    '[attr.aria-busy]': 'store.loadingState() === "loading"',
  },
})
export class DataGridComponent<T extends Record<string, unknown>> {
  protected readonly store = inject(DataGridStore<T>);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private outsidePointerDownBound = false;

  // ============ Inputs ============
  
  /** Column definitions */
  readonly columns = input.required<GridColumn<T>[]>();
  
  /** Row data (for client-side mode) */
  readonly data = input<T[]>([]);
  
  /** Total items count (for server-side mode) */
  readonly totalItems = input<number>(0);
  
  /** Grid configuration */
  readonly config = input<Partial<GridConfig<T>>>({});
  
  /** Loading state override */
  readonly loading = input<boolean>(false);
  
  /** Error message */
  readonly error = input<string>('');
  
  /** Grid label for accessibility */
  readonly ariaLabel = input<string>('Data grid');
  
  /** Enable server-side data fetching */
  readonly serverSide = input<boolean>(false);
  
  /** Fetch data function for server-side mode */
  readonly fetchData = input<((request: DataRequest) => Observable<DataResponse<T>>) | null>(null);

  // ============ Outputs ============
  
  /** Emitted when data request changes (for server-side mode) */
  readonly dataRequest = output<DataRequest>();
  
  /** Emitted when selection changes */
  readonly selectionChange = output<SelectionChangeEvent<T>>();
  
  /** Emitted when a cell edit is completed */
  readonly cellEdit = output<CellEditEvent<T>>();
  
  /** Emitted when rows need to be saved */
  readonly saveRows = output<T[]>();
  
  /** Emitted when a row needs to be deleted */
  readonly deleteRows = output<T[]>();
  
  /** Emitted when a row is double-clicked (for navigation) */
  readonly rowDoubleClick = output<T>();
  
  /** Emitted when sort changes */
  readonly sortChange = output<SortChangeEvent>();
  
  /** Emitted when filters change */
  readonly filterChange = output<FilterChangeEvent>();
  
  /** Emitted when page changes */
  readonly pageChange = output<PageChangeEvent>();

  // ============ View Children ============
  
  private readonly gridContainer = viewChild<ElementRef<HTMLDivElement>>('gridContainer');
  private readonly announcerRef = viewChild<ElementRef<HTMLDivElement>>('announcer');

  // ============ Internal State ============
  
  protected readonly uid = 'grid-' + Math.random().toString(36).substring(2, 9);
  private readonly realTimeUpdates$ = new Subject<RealTimeUpdate<T>>();
  private lastRequest: DataRequest | null = null;

  // ============ Computed Values ============
  
  protected readonly showToolbar = computed(() => {
    const cols = this.store.columns();
    return cols.some(c => c.filterable) || cols.some(c => c.sortable);
  });

  protected readonly currentAnnouncement = computed(() => {
    const announcements = this.store.announcements();
    return announcements[0] ?? null;
  });

  protected readonly hasDirtyRows = computed(() => this.store.hasDirtyRows());

  constructor() {
    // Initialize store when inputs change
    effect(() => {
      const columns = this.columns();
      const config = this.config();
      this.store.initialize(columns, config);
    });

    // Clear focused/edited cell when clicking outside of the grid
    effect(() => {
      const gridEl = this.gridContainer()?.nativeElement;
      if (!gridEl || this.outsidePointerDownBound) return;

      this.outsidePointerDownBound = true;
      fromEvent<PointerEvent>(this.document, 'pointerdown', { capture: true }).pipe(
        takeUntilDestroyed(this.destroyRef),
      ).subscribe((event) => {
        const target = event.target;
        if (!(target instanceof Node)) return;
        if (gridEl.contains(target)) return;

        // Exit edit mode (commit current value) and clear focus highlight
        if (this.store.editingCell()) {
          this.store.completeCellEdit(true);
        }
        this.store.setFocusedCell(null);
      });
    });

    // Update store data when input data changes (client-side mode)
    effect(() => {
      const data = this.data();
      const total = this.totalItems() || data.length;
      this.store.setData(data, total);
    });

    // Update loading state
    effect(() => {
      if (this.loading()) {
        this.store.setLoadingState('loading');
      } else if (this.error()) {
        this.store.setLoadingState('error');
      } else {
        this.store.setLoadingState('idle');
      }
    });

    // Emit data request when parameters change (server-side mode)
    effect(() => {
      if (this.serverSide()) {
        const request = this.store.currentRequest();
        if (!this.isSameRequest(request, this.lastRequest)) {
          this.lastRequest = request;
          this.dataRequest.emit(request);
        }
      }
    });

    // Handle selection changes
    effect(() => {
      const selectedRows = this.store.selectedRows();
      this.selectionChange.emit({
        selectedRows: selectedRows.map(r => r.current),
        allSelected: this.store.allSelected(),
      });
    });
  }

  // ============ Public API ============
  
  /** Set data from external source (for server-side mode) */
  setServerData(data: T[], totalItems: number): void {
    this.store.setData(data, totalItems);
  }

  /** Handle real-time update from external source */
  handleRealTimeUpdate(update: RealTimeUpdate<T>): void {
    this.store.handleRealTimeUpdate(update);
  }

  /** Handle bulk save result */
  handleBulkSaveResult(result: BulkOperationResult<T>): void {
    this.store.handleBulkSaveResult(result);
  }

  /** Refresh data (triggers data request) */
  refresh(): void {
    const request = this.store.currentRequest();
    this.dataRequest.emit(request);
  }

  /** Add a new row for creation */
  addNewRow(template?: Partial<T>): void {
    this.store.addNewRow(template);
  }

  /** Get current dirty rows */
  getDirtyRows(): T[] {
    return this.store.dirtyRows().map(r => r.current);
  }

  /** Get selected rows */
  getSelectedRows(): T[] {
    return this.store.selectedRows().map(r => r.current);
  }

  // ============ Event Handlers ============

  protected onSortChange(columnId: string): void {
    this.store.setSort(columnId);
    this.sortChange.emit({ sort: this.store.sort() });
  }

  protected onFilterChange(filter: FilterConfig): void {
    this.store.setFilter(filter);
    this.filterChange.emit({ filters: this.store.filters() });
  }

  protected onSearchChange(term: string): void {
    this.store.setSearchTerm(term);
  }

  protected onPageChange(page: number): void {
    this.store.goToPage(page);
    const pagination = this.store.pagination();
    this.pageChange.emit({ page: pagination.page, pageSize: pagination.pageSize });
  }

  protected onPageSizeChange(size: number): void {
    this.store.setPageSize(size);
    const pagination = this.store.pagination();
    this.pageChange.emit({ page: pagination.page, pageSize: pagination.pageSize });
  }

  protected onCellEdit(event: CellEditEvent<T>): void {
    this.cellEdit.emit(event);
  }

  protected onRowDoubleClick(rowIndex: number): void {
    const row = this.store.rows()[rowIndex];
    if (row) {
      this.rowDoubleClick.emit(row.current);
    }
  }

  protected onSaveRequest(rows: T[]): void {
    const validRows = this.store.validateDirtyRows();
    if (validRows.length > 0) {
      this.saveRows.emit(validRows);
    }
  }

  protected onCancelRequest(): void {
    this.store.discardDirtyChanges();
  }

  protected onDeleteRequest(rows: T[]): void {
    this.deleteRows.emit(rows);
  }

  protected onAddRow(): void {
    this.store.addNewRow();
  }

  protected onSaveRows(rows: T[]): void {
    this.saveRows.emit(rows);
  }

  protected onClearFilters(): void {
    this.store.clearFilters();
  }

  /** Handle horizontal scroll for scroll indicators */
  protected onTableScroll(event: Event): void {
    const el = event.target as HTMLElement;
    this.store.updateScrollState(el.scrollLeft, el.scrollWidth, el.clientWidth);
  }

  /** Handle column resize */
  protected onColumnResize(event: { columnId: string; width: number }): void {
    // Column width is already updated in the DOM by the header component
    // This event can be used to persist the width or update column config
    this.store.setColumnWidth(event.columnId, event.width);
  }

  /** Handle row delete from card view */
  protected onCardDelete(rowIndex: number): void {
    const row = this.store.rows()[rowIndex];
    if (row) {
      if (row.isNew) {
        this.store.removeNewRow(rowIndex);
      } else {
        this.deleteRows.emit([row.current]);
      }
    }
  }

  private isSameRequest(next: DataRequest, prev: DataRequest | null): boolean {
    if (!prev) return false;
    if (next.page !== prev.page || next.pageSize !== prev.pageSize) return false;
    if (next.searchTerm !== prev.searchTerm) return false;

    const nextSort = next.sort;
    const prevSort = prev.sort;
    if (nextSort?.columnId !== prevSort?.columnId || nextSort?.direction !== prevSort?.direction) {
      return false;
    }

    if (next.filters.length !== prev.filters.length) return false;
    for (let i = 0; i < next.filters.length; i += 1) {
      const a = next.filters[i];
      const b = prev.filters[i];
      if (!b) return false;
      if (a.columnId !== b.columnId || a.operator !== b.operator || a.value !== b.value) {
        return false;
      }
    }

    return true;
  }
}
