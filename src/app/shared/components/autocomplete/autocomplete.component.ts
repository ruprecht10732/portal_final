import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';
import { OverlayModule } from '@angular/cdk/overlay';
import {
  Combobox,
  ComboboxInput,
  ComboboxPopup,
} from '@angular/aria/combobox';
import { Listbox, Option } from '@angular/aria/listbox';

export interface AutocompleteOption {
  label: string;
  value: string;
}

@Component({
  selector: 'shared-autocomplete',
  imports: [
    OverlayModule,
    Combobox,
    ComboboxInput,
    ComboboxPopup,
    Listbox,
    Option,
  ],
  templateUrl: './autocomplete.component.html',
  styleUrl: './autocomplete.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AutocompleteComponent {
  /** Two-way bound input value */
  value = model('');
  /** Options to display in the suggestion list */
  options = input<readonly AutocompleteOption[]>([]);
  /** Label text above the autocomplete */
  label = input<string>('');
  /** Placeholder text inside the input */
  placeholder = input('Start typing...');
  /** Whether the autocomplete is disabled */
  disabled = input(false);
  /** Whether the input is required */
  required = input(false);
  /** Hint text below the input */
  hint = input<string>('');
  /** Error message to display */
  error = input<string>('');
  /** Filter mode for Angular Aria combobox */
  filterMode = input<'auto-select' | 'manual' | 'highlight'>('manual');

  protected readonly isOpen = signal(false);
  protected readonly activeIndex = signal(-1);
  protected readonly inputEl = viewChild<ElementRef<HTMLInputElement>>('input');

  protected readonly uid = 'autocomplete-' + Math.random().toString(36).substring(2, 9);
  protected readonly listboxId = this.uid + '-listbox';
  protected readonly hintId = this.uid + '-hint';
  protected readonly errorId = this.uid + '-error';

  protected readonly filteredOptions = computed(() => {
    const query = this.value().trim().toLowerCase();
    if (!query) return this.options();
    return this.options().filter(option => option.label.toLowerCase().includes(query));
  });

  protected open(): void {
    if (this.disabled()) return;
    this.isOpen.set(true);
    this.resetActiveIndex();
  }

  protected toggle(): void {
    if (this.disabled()) return;
    this.isOpen.update(open => !open);
    if (this.isOpen()) {
      this.resetActiveIndex();
      return;
    }
    this.inputEl()?.nativeElement.focus();
  }

  protected close(): void {
    this.isOpen.set(false);
    this.activeIndex.set(-1);
  }

  protected onInput(): void {
    if (this.disabled()) return;
    if (!this.isOpen()) {
      this.isOpen.set(true);
    }
    this.resetActiveIndex();
  }

  protected onKeydown(event: KeyboardEvent): void {
    const options = this.filteredOptions();
    if (!options.length) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.open();
        this.moveActiveIndex(1, options.length);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.open();
        this.moveActiveIndex(-1, options.length);
        break;
      case 'Enter': {
        const option = options[this.activeIndex()];
        if (this.activeIndex() >= 0 && option) {
          event.preventDefault();
          this.selectOption(option);
        }
        break;
      }
      case 'Escape':
        if (this.isOpen()) {
          event.preventDefault();
          this.close();
        }
        break;
    }
  }

  protected selectOption(option: AutocompleteOption): void {
    this.value.set(option.label);
    this.close();
    this.inputEl()?.nativeElement.focus();
  }

  protected getOptionId(index: number): string {
    return `${this.listboxId}-option-${index}`;
  }

  protected describedBy(): string | undefined {
    const ids: string[] = [];
    if (this.error()) ids.push(this.errorId);
    if (this.hint()) ids.push(this.hintId);
    return ids.length ? ids.join(' ') : undefined;
  }

  private resetActiveIndex(): void {
    const options = this.filteredOptions();
    this.activeIndex.set(options.length ? 0 : -1);
  }

  private moveActiveIndex(delta: number, count: number): void {
    const current = this.activeIndex();
    const next = current < 0 ? 0 : (current + delta + count) % count;
    this.activeIndex.set(next);
  }
}
