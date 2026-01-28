import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';
import { OverlayModule } from '@angular/cdk/overlay';

export interface MultiSelectOption<T = unknown> {
  label: string;
  value: T;
}

@Component({
  selector: 'shared-multiselect',
  imports: [OverlayModule],
  templateUrl: './multiselect.component.html',
  styleUrl: './multiselect.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MultiSelectComponent<T = unknown> {
  /** Two-way bound values for the multiselect */
  value = model<readonly T[]>([]);
  /** Options to display in the dropdown */
  options = input<readonly MultiSelectOption<T>[]>([]);
  /** Label text above the multiselect */
  label = input<string>('');
  /** Placeholder when no values selected */
  placeholder = input('Select one or more');
  /** Whether the multiselect is disabled */
  disabled = input(false);
  /** Whether a selection is required */
  required = input(false);
  /** Hint text below the multiselect */
  hint = input<string>('');
  /** Error message to display */
  error = input<string>('');

  protected readonly isOpen = signal(false);
  protected readonly activeIndex = signal(-1);
  protected readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');
  protected readonly listbox = viewChild<ElementRef<HTMLDivElement>>('listbox');

  protected readonly uid = 'multiselect-' + Math.random().toString(36).substring(2, 9);
  protected readonly listboxId = this.uid + '-listbox';
  protected readonly hintId = this.uid + '-hint';
  protected readonly errorId = this.uid + '-error';

  /** Computed display value showing selected option labels */
  protected readonly displayValue = computed(() => {
    const values = this.value();
    if (!values.length) return '';
    const labels = this.options()
      .filter(option => values.includes(option.value))
      .map(option => option.label);
    if (!labels.length) return '';
    if (labels.length === 1) return labels[0];
    return `${labels[0]} + ${labels.length - 1} more`;
  });

  protected readonly listboxSize = computed(() => {
    const count = this.options().length;
    return Math.min(Math.max(count, 3), 8);
  });

  protected toggle(): void {
    if (this.disabled()) return;
    this.isOpen.update(open => !open);
    if (this.isOpen()) {
      setTimeout(() => this.focusFirstOption(), 0);
      return;
    }
    this.trigger()?.nativeElement.focus();
  }

  protected close(): void {
    this.isOpen.set(false);
    this.activeIndex.set(-1);
    this.trigger()?.nativeElement.focus();
  }

  protected isSelected(option: MultiSelectOption<T>): boolean {
    return this.value().includes(option.value);
  }

  protected onOptionToggle(index: number, checked: boolean): void {
    const option = this.options()[index];
    if (!option) return;
    this.value.update(values => {
      const current = values ?? [];
      if (checked) {
        if (current.includes(option.value)) return current;
        return [...current, option.value];
      }
      return current.filter(value => value !== option.value);
    });
  }

  protected onKeydown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp':
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (!this.isOpen()) {
          this.isOpen.set(true);
          setTimeout(() => this.focusFirstOption(), 0);
        }
        break;
      case 'Escape':
        if (this.isOpen()) {
          event.preventDefault();
          this.close();
        }
        break;
    }
  }

  protected onListboxKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      const count = this.options().length;
      if (!count) return;
      const nextIndex = this.getNextIndex(direction, count);
      this.activeIndex.set(nextIndex);
      this.focusOptionByIndex(nextIndex);
    }
  }

  protected getOptionId(index: number): string {
    return `${this.listboxId}-option-${index}`;
  }

  private focusFirstOption(): void {
    const container = this.listbox()?.nativeElement;
    const inputs = container?.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    const first = inputs?.item(0);
    this.activeIndex.set(0);
    first?.focus();
  }

  private focusOptionByIndex(index: number): void {
    const container = this.listbox()?.nativeElement;
    const inputs = container?.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    const target = inputs?.item(index);
    target?.focus();
  }

  private getNextIndex(direction: number, count: number): number {
    const current = this.activeIndex();
    if (current < 0) return direction > 0 ? 0 : count - 1;
    return (current + direction + count) % count;
  }

  protected describedBy(): string | undefined {
    const ids: string[] = [];
    if (this.error()) ids.push(this.errorId);
    if (this.hint()) ids.push(this.hintId);
    return ids.length ? ids.join(' ') : undefined;
  }
}
