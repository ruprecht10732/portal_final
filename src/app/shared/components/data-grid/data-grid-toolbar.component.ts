 
/**
 * Data Grid Toolbar Component
 * Provides search, filter controls, and action buttons
 */

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { OverlayModule } from '@angular/cdk/overlay';
import { TranslatePipe } from '@ngx-translate/core';
import { FilterConfig, GridColumn } from './data-grid.types';
import { ColumnLabelPipe } from './data-grid.pipes';
import { DataGridFilterConfigService } from './data-grid-filter-config.service';
import { BottomSheetComponent } from '../bottom-sheet';
import { InputComponent } from '../input/input.component';
import { ButtonComponent } from '../button/button.component';
import { CheckboxComponent } from '../checkbox/checkbox.component';
import { SelectComponent } from '../select/select.component';

@Component({
  selector: 'data-grid-toolbar',
  imports: [FormsModule, OverlayModule, ColumnLabelPipe, BottomSheetComponent, InputComponent, ButtonComponent, CheckboxComponent, SelectComponent, TranslatePipe],
  templateUrl: './data-grid-toolbar.component.html',
  styleUrl: './data-grid-toolbar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataGridToolbarComponent<T = unknown> {
  private readonly filterConfig = inject(DataGridFilterConfigService);
  
  // ============ View Children ============
  
  protected readonly filterTrigger = viewChild<ElementRef<HTMLButtonElement>>('filterTrigger');
  protected readonly columnPickerTrigger = viewChild<ElementRef<HTMLButtonElement>>('columnPickerTrigger');
  
  // ============ Inputs ============
  
  readonly columns = input<GridColumn<T>[]>([]);
  /** All columns (including hidden) for column picker */
  readonly allColumns = input<GridColumn<T>[]>([]);
  /** Whether column picker is enabled */
  readonly columnPickerEnabled = input<boolean>(true);
  readonly searchTerm = input<string>('');
  readonly filters = input<FilterConfig[]>([]);
  readonly hasSelection = input<boolean>(false);
  readonly selectedCount = input<number>(0);
  readonly hasDirtyRows = input<boolean>(false);
  readonly isOnline = input<boolean>(true);
  readonly hasPendingOps = input<boolean>(false);

  // ============ Outputs ============
  
  readonly searchChange = output<string>();
  readonly filterChange = output<FilterConfig>();
  readonly clearFilters = output<void>();
  readonly saveRequest = output<void>();
  readonly cancelRequest = output<void>();
  readonly deleteRequest = output<void>();
  /** Emitted when column visibility is toggled */
  readonly columnVisibilityChange = output<string>();

  // ============ Internal State ============
  
  protected readonly localSearchTerm = signal('');
  protected readonly showFilters = signal(false);
  protected readonly activeFilterColumn = signal<string | null>(null);
  protected readonly filterValue = signal('');
  protected readonly showColumnPicker = signal(false);
  protected readonly isMobile = signal(globalThis.window?.innerWidth < 640);

  constructor() {
    // Track viewport changes
    if (globalThis.window) {
      const resizeObserver = new ResizeObserver(() => {
        this.isMobile.set(globalThis.window.innerWidth < 640);
      });
      resizeObserver.observe(document.body);
    }
  }

  // ============ Computed Values ============
  
  protected readonly filterableColumns = computed(() =>
    this.columns().filter(col => col.filterable)
  );

  protected readonly hasActiveFilters = computed(() =>
    this.filters().length > 0 || this.searchTerm().length > 0
  );

  protected readonly activeFilterColumnData = computed(() => {
    const id = this.activeFilterColumn();
    if (!id) return null;
    return this.columns().find(col => col.id === id) ?? null;
  });

  protected readonly filterableColumnOptions = computed(() =>
    this.filterableColumns().map(col => ({ label: col.header, value: col.id }))
  );

  protected readonly activeFilterUiConfig = computed(() =>
    this.filterConfig.getFilterUiConfig(this.activeFilterColumnData())
  );

  // ============ Methods ============
  
  protected onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.localSearchTerm.set(value);
    this.searchChange.emit(value);
  }

  protected onSearchValueChange(value: string): void {
    this.localSearchTerm.set(value);
    this.searchChange.emit(value);
  }

  protected clearSearch(): void {
    this.localSearchTerm.set('');
    this.searchChange.emit('');
  }

  protected toggleFilters(): void {
    const opening = !this.showFilters();
    if (opening) this.showColumnPicker.set(false);
    this.showFilters.set(opening);
  }

  protected closeFilters(): void {
    this.showFilters.set(false);
    this.activeFilterColumn.set(null);
    this.filterValue.set('');
  }

  protected selectFilterColumn(columnId: string | null): void {
    if (!columnId) return;
    this.activeFilterColumn.set(columnId);
    this.filterValue.set('');
  }

  protected applyFilter(): void {
    const columnId = this.activeFilterColumn();
    const value = this.filterValue();
    
    if (!columnId || !value.trim()) return;
    
    this.filterChange.emit({
      columnId,
      value: value.trim(),
      operator: 'contains',
    });
    
    this.activeFilterColumn.set(null);
    this.filterValue.set('');
    if (this.isMobile()) {
      this.closeFilters();
    }
  }

  protected removeFilter(columnId: string): void {
    // Emit a filter with empty value to signal removal
    this.filterChange.emit({
      columnId,
      value: '',
      operator: 'contains',
    });
  }

  protected onClearAll(): void {
    this.localSearchTerm.set('');
    this.clearFilters.emit();
  }

  protected onSave(): void {
    this.saveRequest.emit();
  }

  protected onCancel(): void {
    this.cancelRequest.emit();
  }

  protected onDelete(): void {
    this.deleteRequest.emit();
  }

  // ============ Column Picker Methods ============

  protected toggleColumnPicker(): void {
    const opening = !this.showColumnPicker();
    if (opening) this.closeFilters();
    this.showColumnPicker.set(opening);
  }

  protected closeColumnPicker(): void {
    this.showColumnPicker.set(false);
  }

  protected onColumnVisibilityToggle(columnId: string): void {
    this.columnVisibilityChange.emit(columnId);
  }

  protected isColumnVisible(column: GridColumn<T>): boolean {
    return column.visible !== false;
  }
}
