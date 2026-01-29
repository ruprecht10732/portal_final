/**
 * Data Grid Cards Component
 * Mobile-friendly card-based view for data grid rows
 * Implements NN/g and Mohammadi mobile table patterns
 */

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GridColumn, RowState, CellEditEvent } from './data-grid.types';
import { BottomSheetComponent } from '../bottom-sheet';
import { InputComponent } from '../input/input.component';
import { SelectComponent } from '../select/select.component';
import { CheckboxComponent } from '../checkbox/checkbox.component';
import { ButtonComponent } from '../button/button.component';

@Component({
  selector: 'data-grid-cards',
  templateUrl: './data-grid-cards.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    BottomSheetComponent,
    InputComponent,
    SelectComponent,
    CheckboxComponent,
    ButtonComponent,
  ],
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
  
  /** Row double-click for navigation */
  readonly rowDoubleClick = output<number>();
  
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

  private readonly autoOpenedNewRows = new WeakSet<RowState<T>>();

  constructor() {
    effect(() => {
      if (this.editingCardIndex() !== null) return;
      const rows = this.rows();
      const newRowIndex = rows.findIndex(row => row.isNew && !this.autoOpenedNewRows.has(row));
      if (newRowIndex >= 0) {
        this.autoOpenedNewRows.add(rows[newRowIndex]);
        this.editingCardIndex.set(newRowIndex);
      }
    });
  }

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
    return this.getValueByPath(row.current, column.field as string);
  }

  /** Get safe value for input binding (avoids "undefined" string) */
  protected getInputValue(row: RowState<T>, column: GridColumn<T>): string | number {
    const value = this.getValueByPath(row.current, column.field as string);
    if (value === null || value === undefined) {
      return '';
    }
    return value as string | number;
  }

  protected getInputString(row: RowState<T>, column: GridColumn<T>): string {
    const value = this.getInputValue(row, column);
    return value === '' ? '' : String(value);
  }

  /** Get row ID */
  protected getRowId(row: RowState<T>): string | number {
    const field = this.rowIdField();
    return row.current[field] as string | number;
  }

  /** Get normalized title text for display */
  protected getTitleText(row: RowState<T>): string {
    const title = this.formatValue(this.getCellValue(row, this.titleColumn()), this.titleColumn());
    return title || 'Untitled';
  }

  /** Derive initials for the avatar placeholder */
  protected getInitials(row: RowState<T>): string {
    const title = this.getTitleText(row).trim();
    if (!title) return '?';

    const parts = title.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }

    return title.slice(0, 2).toUpperCase();
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
  protected onSelect(index: number): void {
    this.rowSelect.emit(index);
  }

  /** Handle card double-click for navigation */
  protected onCardDoubleClick(index: number): void {
    this.rowDoubleClick.emit(index);
  }

  /** Handle cell value change */
  protected onCellValueChange(
    rowIndex: number,
    column: GridColumn<T>,
    value: unknown
  ): void {
    let nextValue: unknown = value;

    if (column.cellType === 'number') {
      const raw = value as string | number | null | undefined;
      nextValue = raw === '' || raw === null || raw === undefined ? null : Number(raw);
    } else if (column.cellType === 'boolean') {
      nextValue = !!value;
    }

    this.cellValueChange.emit({
      rowIndex,
      columnId: column.id,
      value: nextValue,
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
    return 'border-zinc-200 dark:border-zinc-800';
  }

  /** Get background class for card */
  protected getBgClass(row: RowState<T>): string {
    if (row.error) return 'bg-red-50 dark:bg-red-950/20';
    if (row.selected) return 'bg-zinc-50 dark:bg-zinc-800/50';
    return 'bg-white dark:bg-zinc-900';
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
    
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch {
        return '—';
      }
    }

    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
      return value.toString();
    }
    if (typeof value === 'symbol') {
      return value.description ?? '—';
    }

    return '—';
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
}
