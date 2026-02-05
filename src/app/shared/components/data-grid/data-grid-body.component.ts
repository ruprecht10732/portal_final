/**
 * Data Grid Body Component
 * Renders grid rows with inline editing support and keyboard navigation
 */

import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
} from '@angular/core';
import {
  CellEditEvent,
  CellPosition,
  GridColumn,
  RowState,
} from './data-grid.types';
import { OptionLabelPipe } from './data-grid.pipes';
import { StatusBadgeComponent } from '../status-badge/status-badge.component';
import dayjs from 'dayjs';
import 'dayjs/locale/nl';
import relativeTime from 'dayjs/plugin/relativeTime';
import { toSignal } from '@angular/core/rxjs-interop';
import { CheckboxComponent } from '../checkbox/checkbox.component';
import { DataGridAddressCellComponent } from './data-grid-address-cell.component';
import { DataGridIconCellComponent } from './data-grid-icon-cell.component';
import { DataGridColorCellComponent } from './data-grid-color-cell.component';
import { DataGridStore } from './data-grid.store';
import { AddressSuggestion } from '../../../core/services/address.service';
import { LucideAngularModule } from 'lucide-angular';
import { TranslateService, TranslatePipe } from '@ngx-translate/core';

dayjs.extend(relativeTime);
@Component({
  selector: 'data-grid-body',
  templateUrl: './data-grid-body.component.html',
  styleUrl: './data-grid-body.component.css',
  imports: [CheckboxComponent, OptionLabelPipe, DataGridIconCellComponent, DataGridColorCellComponent, DataGridAddressCellComponent, StatusBadgeComponent, LucideAngularModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'role': 'rowgroup',
  },
})
export class DataGridBodyComponent<T extends Record<string, unknown>> {
  private readonly store = inject(DataGridStore<T>);
  private readonly translate = inject(TranslateService);
  private readonly lang = toSignal(this.translate.onLangChange, {
    initialValue: { lang: 'nl', translations: {} },
  });

  // ============ Inputs ============
  
  readonly columns = input<GridColumn<T>[]>([]);
  readonly rows = input<RowState<T>[]>([]);
  readonly focusedCell = input<CellPosition | null>(null);
  readonly editingCell = input<CellPosition | null>(null);
  readonly selectable = input<boolean>(true);
  readonly rowIdField = input<keyof T>('id' as keyof T);
  readonly rowViewActionEnabled = input<boolean>(false);
  readonly rowDeleteActionEnabled = input<boolean>(false);
  readonly rowDeleteActionPredicate = input<((row: T) => boolean) | null>(null);
  readonly statusField = input<keyof T | string | undefined>(undefined);

  // ============ Outputs ============
  
  readonly cellFocus = output<CellPosition>();
  readonly cellEdit = output<{ rowIndex: number; columnIndex: number }>();
  readonly cellValueChange = output<{ rowIndex: number; columnId: string; value: unknown }>();
  readonly cellEditComplete = output<boolean>();
  readonly rowSelect = output<number>();
  readonly rowDoubleClick = output<number>();
  readonly rowDelete = output<number>();
  readonly navigate = output<'up' | 'down' | 'left' | 'right' | 'home' | 'end'>();
  readonly cellEditEvent = output<CellEditEvent<T>>();

  constructor() {
    effect(() => {
      const lang = this.lang().lang ?? 'en';
      const normalized = lang.toLowerCase().split('-')[0];
      dayjs.locale(normalized);
    });
  }

  // ============ Methods ============
  
  protected isCellFocused(rowIndex: number, columnIndex: number): boolean {
    const focused = this.focusedCell();
    return focused?.rowIndex === rowIndex && focused?.columnIndex === columnIndex;
  }

  protected getCellValue(row: RowState<T>, column: GridColumn<T>): unknown {
    return this.getColumnValue(row, column);
  }

  /** Get safe value for input binding (avoids "undefined" string) */
  protected getInputValue(row: RowState<T>, column: GridColumn<T>): string | number {
    const value = this.getColumnValue(row, column);
    if (value === null || value === undefined) {
      return '';
    }
    return value as string | number;
  }

  protected getInputStringValue(row: RowState<T>, column: GridColumn<T>): string {
    const value = this.getInputValue(row, column);
    return value === '' ? '' : String(value);
  }

  /** Get display value as string for title attribute */
  protected getCellDisplayValue(row: RowState<T>, column: GridColumn<T>): string {
    const value = this.getColumnValue(row, column);
    return this.formatValueForDisplay(value, column, true);
  }

  protected getRelativeDateValue(row: RowState<T>, column: GridColumn<T>): string {
    const value = this.getColumnValue(row, column);
    if (value === null || value === undefined || value === '') {
      return '—';
    }

    return this.formatRelativeDate(value);
  }

  protected getSelectMeta(column: GridColumn<T>, value: unknown): { label?: string; value: unknown; icon?: string | null; color?: string | null; description?: string | null } | null {
    if (!column.metaOptions || value === null || value === undefined || value === '') return null;
    return column.metaOptions.find(option => option.value === value) ?? null;
  }

  protected isStatusColumn(column: GridColumn<T>): boolean {
    const statusField = this.statusField();
    if (!statusField) return false;
    return String(column.field) === String(statusField) || String(column.id) === String(statusField);
  }

  protected getStatusLabel(row: RowState<T>, column: GridColumn<T>): string {
    const value = this.getColumnValue(row, column);
    if (value === null || value === undefined || value === '') return '—';
    if (column.selectOptions) {
      const option = column.selectOptions.find(o => o.value === value);
      if (option?.label) return option.label;
    }
    return this.valueToString(value);
  }


  protected isHexColor(value: unknown): boolean {
    return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value.trim());
  }

  protected hexOrTransparent(value: unknown): string {
    if (this.isHexColor(value)) return (value as string).trim();
    return 'transparent';
  }

  protected getCellError(row: RowState<T>, columnId: string): string | null {
    return row.cellErrors[columnId] ?? null;
  }

  protected getCellErrorId(rowIndex: number, columnId: string): string {
    return `cell-error-${rowIndex}-${columnId}`;
  }

  protected getAriaColIndex(columnIndex: number): number {
    return columnIndex + 1 + (this.selectable() ? 1 : 0);
  }

  protected onCellClick(rowIndex: number, columnIndex: number): void {
    this.cellFocus.emit({ rowIndex, columnIndex });
  }

  protected onCellKeydown(event: KeyboardEvent, rowIndex: number, columnIndex: number): void {
    const column = this.columns()[columnIndex];
    if (!column || this.isInteractiveElement(event.target)) {
      return;
    }

    if (this.isEditingCell(rowIndex, columnIndex) && (event.key === 'Home' || event.key === 'End' || event.key === 'Enter')) {
      return;
    }

    switch (event.key) {
      case 'ArrowUp':
        this.handleArrowNavigation(event, 'up');
        return;
      case 'ArrowDown':
        this.handleArrowNavigation(event, 'down');
        return;
      case 'ArrowLeft':
        this.handleHorizontalNavigation(event, 'left');
        return;
      case 'ArrowRight':
        this.handleHorizontalNavigation(event, 'right');
        return;
      case 'Home':
        this.handleHomeEnd(event, 'home');
        return;
      case 'End':
        this.handleHomeEnd(event, 'end');
        return;
      case 'Enter':
        this.handleEnterKey(event, rowIndex, column, columnIndex);
        return;
      case ' ':
        this.handleSpaceKey(event, rowIndex);
        return;
      default:
        this.handleAlphanumericKey(event, rowIndex, column);
    }
  }

  private handleArrowNavigation(event: KeyboardEvent, direction: 'up' | 'down'): void {
    event.preventDefault();
    this.navigate.emit(direction);
  }

  private handleHorizontalNavigation(event: KeyboardEvent, direction: 'left' | 'right'): void {
    event.preventDefault();
    this.navigate.emit(direction);
  }

  private handleHomeEnd(event: KeyboardEvent, direction: 'home' | 'end'): void {
    if (this.isEditingCell(this.focusedCell()?.rowIndex ?? -1, this.focusedCell()?.columnIndex ?? -1)) {
      return;
    }
    if (event.ctrlKey || event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      this.navigate.emit(direction);
    }
  }

  private handleEnterKey(event: KeyboardEvent, rowIndex: number, column: GridColumn<T>, columnIndex: number): void {
    if (this.isEditingCell(rowIndex, columnIndex)) {
      return;
    }
    if (!this.isCellEditable(rowIndex, column)) return;
    const control = this.getEditableControl(event);
    if (control) {
      event.preventDefault();
      control.focus();
      this.placeCaretAtEnd(control);
    } else {
      event.preventDefault();
      this.navigate.emit('down');
    }
  }

  private handleSpaceKey(event: KeyboardEvent, rowIndex: number): void {
    if (!this.selectable()) {
      return;
    }
    event.preventDefault();
    this.rowSelect.emit(rowIndex);
  }

  private handleAlphanumericKey(event: KeyboardEvent, rowIndex: number, column: GridColumn<T>): void {
    if (this.isCellEditable(rowIndex, column) && event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
      const control = this.getEditableControl(event);
      if (!control) return;

      event.preventDefault();
      control.focus();

      if (control instanceof HTMLInputElement && control.type !== 'checkbox' && control.type !== 'date') {
        control.value = event.key;
        this.onInputChange(rowIndex, column, control);
      }
    }
  }

  protected onInputChange(
    rowIndex: number,
    column: GridColumn<T>,
    eventOrTarget: Event | HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | string,
  ): void {
    if (typeof eventOrTarget === 'string') {
      this.emitCellValueChange(rowIndex, column, eventOrTarget);
      return;
    }

    const target = eventOrTarget instanceof Event
      ? eventOrTarget.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      : eventOrTarget;
    const value = column.cellType === 'boolean' && target instanceof HTMLInputElement
      ? target.checked
      : target.value;

    this.emitCellValueChange(rowIndex, column, value);
  }

  protected onInputEnter(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.navigate.emit('down');
  }

  protected onAddressSelect(
    rowIndex: number,
    column: GridColumn<T>,
    address: AddressSuggestion
  ): void {
    const mapping = column.addressMapping;
    if (!mapping) return;

    const updates: Record<string, unknown> = {};
    if (mapping.label) updates[mapping.label] = address.label;
    if (mapping.street) updates[mapping.street] = address.street;
    if (mapping.houseNumber) updates[mapping.houseNumber] = address.houseNumber;
    if (mapping.zipCode) updates[mapping.zipCode] = address.zipCode;
    if (mapping.city) updates[mapping.city] = address.city;
    if (mapping.state && address.state !== undefined) updates[mapping.state] = address.state;
    if (mapping.country && address.country !== undefined) updates[mapping.country] = address.country;

    if (Object.keys(updates).length === 0) return;

    this.store.updateRowValues(rowIndex, updates);
    this.navigate.emit('right');
  }

  protected onRowSelect(rowIndex: number): void {
    this.rowSelect.emit(rowIndex);
  }

  protected onRowDoubleClick(rowIndex: number): void {
    this.rowDoubleClick.emit(rowIndex);
  }

  protected onRowDelete(rowIndex: number): void {
    this.rowDelete.emit(rowIndex);
  }

  protected canDeleteRow(row: RowState<T>): boolean {
    const predicate = this.rowDeleteActionPredicate();
    return predicate ? predicate(row.current) : true;
  }

  private isInteractiveElement(target: EventTarget | null): boolean {
    if (target instanceof HTMLElement && target.isContentEditable) {
      return true;
    }
    return target instanceof HTMLInputElement
      || target instanceof HTMLSelectElement
      || target instanceof HTMLTextAreaElement;
  }

  private getEditableControl(event: Event): HTMLElement | null {
    const cell = event.currentTarget as HTMLElement | null;
    if (!cell) return null;
    return cell.querySelector('[contenteditable="true"], input, select, textarea');
  }

  protected getInputType(column: GridColumn<T>): string {
    switch (column.cellType) {
      case 'number':
        return 'number';
      case 'date':
        return 'date';
      default:
        return 'text';
    }
  }

  protected trackByRowId(index: number, row: RowState<T>): string | number {
    return row.current[this.rowIdField()] as string | number ?? index;
  }

  protected getEditableDisplayValue(row: RowState<T>, column: GridColumn<T>): string {
    const value = this.getColumnValue(row, column);
    return this.formatValueForDisplay(value, column, false);
  }

  protected isCellEditable(rowIndex: number, column: GridColumn<T>): boolean {
    if (!column.editable) return false;
    const editScope = column.editableWhen ?? 'always';
    if (editScope === 'new-only') {
      return this.rows()[rowIndex]?.isNew ?? false;
    }
    return true;
  }

  private isEditingCell(rowIndex: number, columnIndex: number): boolean {
    const editing = this.editingCell();
    return editing?.rowIndex === rowIndex && editing?.columnIndex === columnIndex;
  }

  private emitCellValueChange(rowIndex: number, column: GridColumn<T>, value: unknown): void {
    const row = this.rows()[rowIndex];
    if (!row) return;
    const oldValue = this.getColumnValue(row, column);

    if (oldValue !== value) {
      this.cellEditEvent.emit({
        rowId: row.current[this.rowIdField()] as string | number,
        columnId: column.id,
        oldValue,
        newValue: value,
        row: row.current,
      });
    }

    this.cellValueChange.emit({ rowIndex, columnId: column.id, value });
  }

  private valueToString(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return '';
  }

  private formatValueForDisplay(value: unknown, column: GridColumn<T>, includeDate: boolean): string {
    if (value === null || value === undefined || value === '') {
      return '';
    }

    if (column.cellType === 'boolean') {
      return value ? 'Yes' : 'No';
    }

    if (includeDate && column.cellType === 'date') {
      return this.formatRelativeDate(value);
    }

    if (column.cellType === 'select' && column.selectOptions) {
      const option = column.selectOptions.find(o => o.value === value);
      return option?.label ?? this.valueToString(value);
    }

    return this.valueToString(value);
  }


  private formatRelativeDate(value: unknown): string {
    if (value === null || value === undefined || value === '') {
      return this.valueToString(value);
    }
    const parsed = dayjs(value as string | number | Date);
    if (!parsed.isValid()) {
      return this.valueToString(value);
    }
    return parsed.fromNow();
  }

  private placeCaretAtEnd(element: HTMLElement): void {
    if (!element.isContentEditable) return;
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    const selection = globalThis.getSelection?.();
    if (!selection) return;
    selection.removeAllRanges();
    selection.addRange(range);
  }

  /** Calculate left position for frozen columns */
  protected getFrozenColumnLeft(columnIndex: number): string {
    const cols = this.columns();
    let left = this.selectable() ? 40 : 0; // checkbox column width
    
    for (let i = 0; i < columnIndex; i++) {
      const col = cols[i];
      if (col?.frozen) {
        // Use minWidth or default
        const width = col.minWidth ?? col.width ?? '150px';
        left += this.parseColumnWidth(width);
      }
    }
    
    return `${left}px`;
  }

  private parseColumnWidth(value: string | number): number {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const parsed = Number.parseInt(String(value), 10);
    return Number.isFinite(parsed) ? parsed : 150;
  }

  /** Get tooltip text explaining row status */
  protected getRowStatusTooltip(row: RowState<T>): string | null {
    if (row.saving) return 'Saving...';
    if (row.error) return `Error: ${row.error}`;
    if (row.recentlyUpdated) return 'Recently saved';
    if (row.isNew) return 'New row (unsaved)';
    if (row.dirty) return 'Unsaved changes';
    return null;
  }

  private getValueByPath(obj: T, path: string): unknown {
    if (!this.isString(path)) return undefined;
    if (!path.includes('.')) {
      return obj[path as keyof T];
    }
    const keys = path.split('.');
    let acc: unknown = obj;
    for (const key of keys) {
      if (!this.isSafePathKey(key)) return undefined;
      if (!this.isObject(acc) || !Object.hasOwn(acc, key)) return undefined;
      acc = (acc as Record<string, unknown>)[key];
    }
    return acc;
  }

  private isSafePathKey(key: string): boolean {
    return key !== '__proto__' && key !== 'prototype' && key !== 'constructor';
  }

  private isObject(val: unknown): val is object {
    return typeof val === 'object' && val !== null;
  }

  private isString(val: unknown): val is string {
    return typeof val === 'string';
  }

  private getColumnValue(row: RowState<T>, column: GridColumn<T>): unknown {
    return this.getValueByPath(row.current, column.field as string);
  }
}
