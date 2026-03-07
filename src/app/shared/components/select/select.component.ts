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
import { FieldShellComponent } from '../field-shell/field-shell.component';

export interface SelectOption<T = unknown> {
  label: string;
  value: T;
}

@Component({
  selector: 'shared-select',
  imports: [OverlayModule, FieldShellComponent],
  templateUrl: './select.component.html',
  styleUrl: './select.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SelectComponent<T = unknown> {
  /** Two-way bound value for the select */
  value = model<T | null>(null);
  /** Options to display in the dropdown */
  options = input<readonly SelectOption<T>[]>([]);
  /** Label text above the select */
  label = input<string>('');
  /** Placeholder when no value selected */
  placeholder = input('Select an option');
  /** Accessible label when no visible label is provided */
  ariaLabel = input<string | undefined>(undefined);
  /** Whether the select is disabled */
  disabled = input(false);
  /** Whether a selection is required */
  required = input(false);
  /** Hint text below the select */
  hint = input<string>('');
  /** Error message to display */
  error = input<string>('');
  /** Whether the field renders projected suffix content inside the control area */
  hasSuffix = input(false);

  protected readonly isOpen = signal(false);
  protected readonly activeIndex = signal(-1);
  protected readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');

  protected readonly uid = 'select-' + Math.random().toString(36).substring(2, 9);
  protected readonly listboxId = this.uid + '-listbox';
  protected readonly hintId = this.uid + '-hint';
  protected readonly errorId = this.uid + '-error';

  /** Computed display value showing selected option label */
  protected readonly displayValue = computed(() => {
    const currentValue = this.value();
    if (currentValue === null || currentValue === undefined) return '';
    const selected = this.options().find(opt => opt.value === currentValue);
    return selected?.label ?? '';
  });

  protected readonly selectedIndex = computed(() => {
    const currentValue = this.value();
    if (currentValue === null || currentValue === undefined) return -1;
    return this.options().findIndex(opt => opt.value === currentValue);
  });

  protected toggle(): void {
    if (this.disabled()) return;
    this.isOpen.update(open => !open);
    if (this.isOpen()) {
      this.activeIndex.set(Math.max(0, this.selectedIndex()));
    }
  }

  protected close(): void {
    this.isOpen.set(false);
    this.activeIndex.set(-1);
  }

  private openWithDefaultActiveIndex(): void {
    this.isOpen.set(true);
    this.activeIndex.set(Math.max(0, this.selectedIndex()));
  }

  protected selectOption(option: SelectOption<T>): void {
    this.value.set(option.value);
    this.close();
    this.trigger()?.nativeElement.focus();
  }

  protected onKeydown(event: KeyboardEvent): void {
    const opts = this.options();
    if (!opts.length) return;

    switch (event.key) {
      case 'ArrowDown':
        this.handleArrowDown(event, opts);
        break;
      case 'ArrowUp':
        this.handleArrowUp(event);
        break;
      case 'Enter':
      case ' ':
        this.handleSelectKey(event);
        break;
      case 'Escape':
        this.handleEscape(event);
        break;
      case 'Home':
        this.handleHome(event);
        break;
      case 'End':
        this.handleEnd(event, opts);
        break;
    }
  }

  private handleArrowDown(event: KeyboardEvent, opts: readonly SelectOption<T>[]): void {
    event.preventDefault();
    if (this.isOpen()) {
      this.activeIndex.update(i => Math.min(i + 1, opts.length - 1));
      return;
    }
    this.openWithDefaultActiveIndex();
  }

  private handleArrowUp(event: KeyboardEvent): void {
    event.preventDefault();
    if (this.isOpen()) {
      this.activeIndex.update(i => Math.max(i - 1, 0));
      return;
    }
    this.openWithDefaultActiveIndex();
  }

  private handleSelectKey(event: KeyboardEvent): void {
    event.preventDefault();
    if (this.isOpen()) {
      const index = this.activeIndex();
      const opt = this.options()[index];
      if (index >= 0 && opt) {
        this.selectOption(opt);
      }
      return;
    }
    this.toggle();
  }

  private handleEscape(event: KeyboardEvent): void {
    event.preventDefault();
    this.close();
  }

  private handleHome(event: KeyboardEvent): void {
    event.preventDefault();
    if (this.isOpen()) {
      this.activeIndex.set(0);
    }
  }

  private handleEnd(event: KeyboardEvent, opts: readonly SelectOption<T>[]): void {
    event.preventDefault();
    if (this.isOpen()) {
      this.activeIndex.set(opts.length - 1);
    }
  }

  protected getOptionId(index: number): string {
    return `${this.listboxId}-option-${index}`;
  }

  protected onOptionKeydown(event: KeyboardEvent, option: SelectOption<T>): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.selectOption(option);
    }
  }

  protected describedBy(): string | undefined {
    const ids: string[] = [];
    if (this.error()) ids.push(this.errorId);
    if (this.hint()) ids.push(this.hintId);
    return ids.length ? ids.join(' ') : undefined;
  }
}
