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
import { LucideAngularModule } from 'lucide-angular';
import { AVAILABLE_ICONS } from './available-icons';
import { FieldShellComponent } from '../field-shell/field-shell.component';

@Component({
  selector: 'shared-icon-picker',
  imports: [OverlayModule, LucideAngularModule, FieldShellComponent],
  templateUrl: './icon-picker.component.html',
  styleUrl: './icon-picker.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IconPickerComponent {
  /** Two-way bound value for the selected icon */
  value = model<string | null>(null);
  /** Label text above the picker */
  label = input<string>('');
  /** Placeholder when no icon selected */
  placeholder = input('Select an icon');
  /** Accessible label when no visible label is provided */
  ariaLabel = input<string | undefined>(undefined);
  /** Whether the picker is disabled */
  disabled = input(false);
  /** Whether a selection is required */
  required = input(false);
  /** Hint text below the picker */
  hint = input<string>('');
  /** Error message to display */
  error = input<string>('');
  /** Compact mode for inline/grid editing */
  compact = input(false);

  protected readonly isOpen = signal(false);
  protected readonly searchQuery = signal('');
  protected readonly activeIndex = signal(-1);
  protected readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');
  protected readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  protected readonly uid = 'icon-picker-' + Math.random().toString(36).substring(2, 9);
  protected readonly listboxId = this.uid + '-listbox';
  protected readonly hintId = this.uid + '-hint';
  protected readonly errorId = this.uid + '-error';

  protected readonly allIcons = AVAILABLE_ICONS;

  /** Filtered icons based on search query */
  protected readonly filteredIcons = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    if (!query) return this.allIcons;
    return this.allIcons.filter(icon => icon.includes(query));
  });

  /** Current selected icon display name */
  protected readonly displayValue = computed(() => {
    const currentValue = this.value();
    if (!currentValue) return '';
    return currentValue;
  });

  protected readonly selectedIndex = computed(() => {
    const currentValue = this.value();
    if (!currentValue) return -1;
    return this.filteredIcons().indexOf(currentValue);
  });

  protected toggle(): void {
    if (this.disabled()) return;
    this.isOpen.update(open => !open);
    if (this.isOpen()) {
      this.activeIndex.set(Math.max(0, this.selectedIndex()));
      // Focus search input after overlay opens
      setTimeout(() => this.searchInput()?.nativeElement.focus(), 0);
    } else {
      this.searchQuery.set('');
    }
  }

  protected close(): void {
    this.isOpen.set(false);
    this.activeIndex.set(-1);
    this.searchQuery.set('');
  }

  private openWithDefaultActiveIndex(): void {
    this.isOpen.set(true);
    this.activeIndex.set(Math.max(0, this.selectedIndex()));
    setTimeout(() => this.searchInput()?.nativeElement.focus(), 0);
  }

  protected selectIcon(icon: string): void {
    this.value.set(icon);
    this.close();
    this.trigger()?.nativeElement.focus();
  }

  protected clearSelection(event: Event): void {
    event.stopPropagation();
    this.value.set(null);
    this.trigger()?.nativeElement.focus();
  }

  protected onTriggerKeydown(event: KeyboardEvent): void {
    const icons = this.filteredIcons();
    if (!icons.length) return;

    switch (event.key) {
      case 'ArrowDown':
        this.handleArrowDown(event, icons);
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
    }
  }

  protected onPanelKeydown(event: KeyboardEvent): void {
    const icons = this.filteredIcons();
    if (!icons.length) return;

    const columns = this.getGridColumns();

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.activeIndex.update(i => Math.min(i + columns, icons.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.activeIndex.update(i => Math.max(i - columns, 0));
        break;
      case 'ArrowRight':
        event.preventDefault();
        this.activeIndex.update(i => Math.min(i + 1, icons.length - 1));
        break;
      case 'ArrowLeft':
        event.preventDefault();
        this.activeIndex.update(i => Math.max(i - 1, 0));
        break;
      case 'Enter': {
        event.preventDefault();
        const index = this.activeIndex();
        const icon = icons[index];
        if (index >= 0 && index < icons.length && icon) {
          this.selectIcon(icon);
        }
        break;
      }
      case 'Escape':
        event.preventDefault();
        this.close();
        this.trigger()?.nativeElement.focus();
        break;
      case 'Home':
        event.preventDefault();
        this.activeIndex.set(0);
        break;
      case 'End':
        event.preventDefault();
        this.activeIndex.set(icons.length - 1);
        break;
    }
  }

  protected onSearchInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchQuery.set(target.value);
    this.activeIndex.set(0);
  }

  private handleArrowDown(event: KeyboardEvent, icons: readonly string[]): void {
    event.preventDefault();
    if (this.isOpen()) {
      this.activeIndex.update(i => Math.min(i + 1, icons.length - 1));
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
      const icon = this.filteredIcons()[index];
      if (index >= 0 && icon) {
        this.selectIcon(icon);
      }
      return;
    }
    this.toggle();
  }

  private handleEscape(event: KeyboardEvent): void {
    event.preventDefault();
    this.close();
  }

  private getGridColumns(): number {
    // Matches the CSS grid columns (5 columns)
    return 5;
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
}
