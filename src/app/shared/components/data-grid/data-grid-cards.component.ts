/**
 * Data Grid Cards Component
 * Mobile-friendly card-based view for data grid rows
 * Implements NN/g and Mohammadi mobile table patterns
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
import { GridColumn, RowState, CellEditEvent } from './data-grid.types';
import { OptionLabelPipe } from './data-grid.pipes';
import { BottomSheetComponent } from '../bottom-sheet';

@Component({
  selector: 'data-grid-cards',
  templateUrl: './data-grid-cards.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, OptionLabelPipe, BottomSheetComponent],
})
export class DataGridCardsComponent<T extends Record<string, unknown>> {
  // ============ Inputs ============
  
  /** Column definitions */
  readonly columns = input.required<GridColumn<T>[]>();
  
  /** Row data with state */
  readonly rows = input.required<RowState<T>[]>();
  
  /** Whether rows are selectable */
  readonly selectable = input<boolean>(true);
  
  /** Field to use as row ID */
  readonly rowIdField = input<keyof T>('id' as keyof T);
  
  /** Field to use as card title */
  readonly cardTitleField = input<keyof T | undefined>(undefined);
  
  /** Number of preview fields before expand */
  readonly previewFieldCount = input<number>(3);

  // ============ Outputs ============
  
  /** Row selection toggle */
  readonly rowSelect = output<number>();
  
  /** Cell value change */
  readonly cellValueChange = output<{ rowIndex: number; columnId: string; value: unknown }>();
  
  /** Cell edit event */
  readonly cellEditEvent = output<CellEditEvent<T>>();
  
  /** Delete row request */
  readonly deleteRow = output<number>();

  // ============ Internal State ============
  
  /** Track which cards are expanded */
  protected readonly expandedCards = signal<Set<number>>(new Set());
  
  /** Track which card is in edit mode */
  protected readonly editingCardIndex = signal<number | null>(null);

  // ============ Computed Values ============
  
  /** Columns to show in preview (excluding title field) */
  protected readonly previewColumns = computed(() => {
    const cols = this.columns();
    const titleField = this.cardTitleField();
    const count = this.previewFieldCount();
    
    return cols
      .filter(col => col.visible !== false && col.field !== titleField)
      .slice(0, count);
  });

  /** Columns to show in expanded section */
  protected readonly expandedColumns = computed(() => {
    const cols = this.columns();
    const titleField = this.cardTitleField();
    const count = this.previewFieldCount();
    
    return cols
      .filter(col => col.visible !== false && col.field !== titleField)
      .slice(count);
  });

  /** Editable columns (visible) */
  protected readonly editableColumns = computed(() =>
    this.columns().filter(col => col.visible !== false && col.editable)
  );

  /** Whether cards have expandable content */
  protected readonly hasExpandableContent = computed(() => 
    this.expandedColumns().length > 0
  );

  /** Get title column */
  protected readonly titleColumn = computed(() => {
    const titleField = this.cardTitleField();
    if (!titleField) return this.columns()[0];
    return this.columns().find(col => col.field === titleField) ?? this.columns()[0];
  });

  // ============ Methods ============

  /** Get cell value from row */
  protected getCellValue(row: RowState<T>, column: GridColumn<T>): unknown {
    const field = column.field as string;
    return row.current[field];
  }

  /** Get safe value for input binding (avoids "undefined" string) */
  protected getInputValue(row: RowState<T>, column: GridColumn<T>): string | number {
    const value = this.getCellValue(row, column);
    if (value === null || value === undefined) {
      return '';
    }
    return value as string | number;
  }

  /** Get row ID */
  protected getRowId(row: RowState<T>): string | number {
    const field = this.rowIdField();
    return row.current[field] as string | number;
  }

  /** Toggle card expansion */
  protected toggleExpanded(index: number): void {
    this.expandedCards.update(set => {
      const newSet = new Set(set);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  }

  /** Check if card is expanded */
  protected isExpanded(index: number): boolean {
    return this.expandedCards().has(index);
  }

  /** Toggle edit mode for card */
  protected toggleEdit(index: number, event: Event): void {
    event.stopPropagation();
    const current = this.editingCardIndex();
    if (current === index) {
      this.editingCardIndex.set(null);
      return;
    }
    this.editingCardIndex.set(index);
    // Also expand when editing
    this.expandedCards.update(s => new Set(s).add(index));
  }

  /** Check if card is in edit mode */
  protected isEditing(index: number): boolean {
    return this.editingCardIndex() === index;
  }

  protected closeEdit(): void {
    this.editingCardIndex.set(null);
  }

  /** Handle row selection */
  protected onSelect(index: number, event: Event): void {
    event.stopPropagation();
    this.rowSelect.emit(index);
  }

  /** Handle cell value change */
  protected onCellChange(
    rowIndex: number, 
    column: GridColumn<T>, 
    event: Event
  ): void {
    const target = event.target as HTMLInputElement | HTMLSelectElement;
    let value: unknown = target.value;
    
    // Convert value based on cell type
    if (column.cellType === 'number') {
      value = target.value === '' ? null : Number(target.value);
    } else if (column.cellType === 'boolean') {
      value = (target as HTMLInputElement).checked;
    }
    
    this.cellValueChange.emit({
      rowIndex,
      columnId: column.id,
      value,
    });
  }

  /** Handle delete button click */
  protected onDelete(index: number, event: Event): void {
    event.stopPropagation();
    this.deleteRow.emit(index);
  }

  /** Track function for rows */
  protected trackByRowId(index: number, row: RowState<T>): string | number {
    return this.getRowId(row);
  }

  /** Get status class for card border */
  protected getStatusClass(row: RowState<T>): string {
    if (row.error) return 'border-l-red-500';
    if (row.recentlyUpdated) return 'border-l-green-500';
    if (row.isNew) return 'border-l-blue-500';
    if (row.dirty) return 'border-l-amber-500';
    return 'border-l-transparent';
  }

  /** Get background class for card */
  protected getBgClass(row: RowState<T>): string {
    if (row.error) return 'bg-red-50';
    if (row.recentlyUpdated) return 'bg-green-50';
    if (row.isNew) return 'bg-blue-50';
    if (row.dirty) return 'bg-amber-50';
    return 'bg-white';
  }

  /** Format cell value for display */
  protected formatValue(value: unknown, column: GridColumn<T>): string {
    if (value === null || value === undefined) return '—';
    
    if (column.cellType === 'date' && value instanceof Date) {
      return value.toLocaleDateString();
    }
    
    if (column.cellType === 'boolean') {
      return ''; // Will use icon instead
    }
    
    return String(value);
  }
}
