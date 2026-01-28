/**
 * Data Grid Toolbar Component
 * Provides search, filter controls, and action buttons
 */

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FilterConfig, GridColumn } from './data-grid.types';
import { ColumnLabelPipe } from './data-grid.pipes';

@Component({
  selector: 'data-grid-toolbar',
  imports: [FormsModule, ColumnLabelPipe],
  templateUrl: './data-grid-toolbar.component.html',
  styleUrl: './data-grid-toolbar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataGridToolbarComponent<T = unknown> {
  // ============ Inputs ============
  
  readonly columns = input<GridColumn<T>[]>([]);
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
  readonly addRow = output<void>();
  readonly saveRequest = output<void>();
  readonly deleteRequest = output<void>();

  // ============ Internal State ============
  
  protected readonly localSearchTerm = signal('');
  protected readonly showFilters = signal(false);
  protected readonly activeFilterColumn = signal<string | null>(null);
  protected readonly filterValue = signal('');

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

  // ============ Methods ============
  
  protected onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.localSearchTerm.set(value);
    this.searchChange.emit(value);
  }

  protected toggleFilters(): void {
    this.showFilters.update(v => !v);
  }

  protected selectFilterColumn(columnId: string): void {
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

  protected onAddRow(): void {
    this.addRow.emit();
  }

  protected onSave(): void {
    this.saveRequest.emit();
  }

  protected onDelete(): void {
    this.deleteRequest.emit();
  }
}
