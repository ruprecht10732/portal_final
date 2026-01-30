/**
 * Data Grid Icon Cell Component
 * Inline icon picker cell for editing icons in the data grid
 */

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { OverlayModule } from '@angular/cdk/overlay';
import { LucideAngularModule } from 'lucide-angular';
import { AVAILABLE_ICONS } from '../icon-picker/available-icons';

@Component({
  selector: 'data-grid-icon-cell',
  imports: [OverlayModule, LucideAngularModule],
  template: `
    <div class="relative w-full" cdkOverlayOrigin #origin="cdkOverlayOrigin">
      <button
        #trigger
        type="button"
        class="w-full min-h-7 px-2 py-1 text-sm bg-transparent flex items-center gap-2 cursor-pointer focus:outline-none"
        [class.text-zinc-500]="!value()"
        (click)="toggle()"
        (keydown)="onTriggerKeydown($event)"
        [attr.aria-expanded]="isOpen()"
        [attr.aria-haspopup]="'listbox'"
      >
        @if (value()) {
          <lucide-icon [name]="value()!" class="h-4 w-4 shrink-0"></lucide-icon>
          <span class="truncate text-xs">{{ value() }}</span>
        } @else {
          <span class="text-zinc-400 text-xs">Select icon</span>
        }
      </button>

      <ng-template
        cdkConnectedOverlay
        [cdkConnectedOverlayOrigin]="origin"
        [cdkConnectedOverlayOpen]="isOpen()"
        [cdkConnectedOverlayMinWidth]="260"
        [cdkConnectedOverlayFlexibleDimensions]="true"
        (overlayOutsideClick)="close()"
        (detach)="close()"
      >
        <div
          class="bg-white border border-black shadow-xl mt-px max-h-64 overflow-hidden flex flex-col focus:outline-none z-50"
          (keydown)="onPanelKeydown($event)"
        >
          <!-- Search input -->
          <div class="p-2 border-b border-zinc-200">
            <div class="relative">
              <lucide-icon name="search" class="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400"></lucide-icon>
              <input
                #searchInput
                type="text"
                class="w-full pl-8 pr-3 py-1.5 text-sm border border-zinc-200 focus:outline-none focus:border-black"
                placeholder="Search..."
                [value]="searchQuery()"
                (input)="onSearchInput($event)"
                aria-label="Search icons"
              />
            </div>
          </div>

          <!-- Icon grid -->
          <div class="overflow-y-auto p-2 flex-1">
            @if (filteredIcons().length > 0) {
              <div class="grid grid-cols-5 gap-1">
                @for (icon of filteredIcons(); track icon; let i = $index) {
                  <button
                    type="button"
                    (click)="selectIcon(icon)"
                    (mouseenter)="activeIndex.set(i)"
                    class="flex items-center justify-center p-1.5 rounded cursor-pointer transition-colors duration-150 outline-none aspect-square"
                    [class.bg-black]="value() === icon"
                    [class.text-white]="value() === icon"
                    [class.ring-2]="activeIndex() === i && value() !== icon"
                    [class.ring-black]="activeIndex() === i && value() !== icon"
                    [class.hover:bg-zinc-100]="value() !== icon"
                    [title]="icon"
                  >
                    <lucide-icon [name]="icon" class="h-4 w-4"></lucide-icon>
                  </button>
                }
              </div>
            } @else {
              <div class="px-2 py-4 text-xs text-zinc-400 italic text-center">No icons found</div>
            }
          </div>

          <!-- Clear button -->
          @if (value()) {
            <div class="px-2 py-1.5 border-t border-zinc-200 bg-zinc-50">
              <button
                type="button"
                class="w-full text-xs text-zinc-600 hover:text-zinc-900 py-1"
                (click)="clearSelection()"
              >
                Clear selection
              </button>
            </div>
          }
        </div>
      </ng-template>
    </div>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataGridIconCellComponent {
  readonly value = input<string | null>(null);
  readonly valueChange = output<string | null>();

  protected readonly isOpen = signal(false);
  protected readonly searchQuery = signal('');
  protected readonly activeIndex = signal(-1);
  protected readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');
  protected readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  protected readonly allIcons = AVAILABLE_ICONS;

  protected readonly filteredIcons = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    if (!query) return this.allIcons;
    return this.allIcons.filter(icon => icon.includes(query));
  });

  protected toggle(): void {
    this.isOpen.update(open => !open);
    if (this.isOpen()) {
      const currentValue = this.value();
      const idx = currentValue ? this.allIcons.indexOf(currentValue) : -1;
      this.activeIndex.set(Math.max(0, idx));
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

  protected selectIcon(icon: string): void {
    this.valueChange.emit(icon);
    this.close();
    this.trigger()?.nativeElement.focus();
  }

  protected clearSelection(): void {
    this.valueChange.emit(null);
    this.close();
    this.trigger()?.nativeElement.focus();
  }

  protected onSearchInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchQuery.set(target.value);
    this.activeIndex.set(0);
  }

  protected onTriggerKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      this.toggle();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      event.stopPropagation();
      if (!this.isOpen()) {
        this.toggle();
      }
    }
  }

  protected onPanelKeydown(event: KeyboardEvent): void {
    const icons = this.filteredIcons();
    if (!icons.length) return;

    const columns = 5;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        event.stopPropagation();
        this.activeIndex.update(i => Math.min(i + columns, icons.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        event.stopPropagation();
        this.activeIndex.update(i => Math.max(i - columns, 0));
        break;
      case 'ArrowRight':
        event.preventDefault();
        event.stopPropagation();
        this.activeIndex.update(i => Math.min(i + 1, icons.length - 1));
        break;
      case 'ArrowLeft':
        event.preventDefault();
        event.stopPropagation();
        this.activeIndex.update(i => Math.max(i - 1, 0));
        break;
      case 'Enter': {
        event.preventDefault();
        event.stopPropagation();
        const index = this.activeIndex();
        if (index >= 0 && index < icons.length) {
          this.selectIcon(icons[index]);
        }
        break;
      }
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        this.close();
        this.trigger()?.nativeElement.focus();
        break;
    }
  }
}
