import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { OverlayModule } from '@angular/cdk/overlay';
import { RouterLink } from '@angular/router';
import { ButtonComponent } from '../button/button.component';

export interface MenuItem {
  label: string;
  route?: string;
  href?: string;
  disabled?: boolean;
  items?: readonly MenuItem[];
}

export interface MenuSection {
  label?: string;
  items: readonly MenuItem[];
}

@Component({
  selector: 'shared-menu',
  imports: [OverlayModule, RouterLink, ButtonComponent],
  templateUrl: './menu.component.html',
  styleUrl: './menu.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MenuComponent {
  triggerLabel = input('Menu');
  ariaLabel = input<string | undefined>(undefined);
  triggerVariant = input<'primary' | 'secondary' | 'ghost' | 'success' | 'danger'>('secondary');
  triggerSize = input<'default' | 'compact'>('compact');
  iconOnly = input(false);
  showChevron = input(true);
  fullWidth = input(false);
  sections = input<readonly MenuSection[]>([]);
  disabled = input(false);
  closeOnSelect = input(true);

  itemSelected = output<MenuItem>();

  protected readonly isOpen = signal(false);
  protected readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');
  protected readonly menuPanel = viewChild<ElementRef<HTMLDivElement>>('menuPanel');

  protected readonly uid = 'menu-' + Math.random().toString(36).substring(2, 9);
  protected readonly menuId = this.uid + '-panel';

  protected toggle(): void {
    if (this.disabled()) return;
    this.isOpen.update(open => !open);
    if (this.isOpen()) {
      setTimeout(() => this.focusFirstItem(), 0);
    }
  }

  protected close(): void {
    this.isOpen.set(false);
    this.trigger()?.nativeElement?.focus();
  }

  protected onTriggerKeydown(event: KeyboardEvent): void {
    if (this.disabled()) return;
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!this.isOpen()) {
        this.isOpen.set(true);
        setTimeout(() => this.focusFirstItem(), 0);
      }
      return;
    }
    if (event.key === 'Escape' && this.isOpen()) {
      event.preventDefault();
      this.close();
    }
  }

  protected onMenuKeydown(event: KeyboardEvent): void {
    const items = this.getFocusableItems();
    if (!items.length) return;

    const currentIndex = items.indexOf(document.activeElement as HTMLElement);

    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault();
        const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % items.length;
        items[nextIndex]?.focus();
        break;
      }
      case 'ArrowUp': {
        event.preventDefault();
        const nextIndex = currentIndex < 0 ? items.length - 1 : (currentIndex - 1 + items.length) % items.length;
        items[nextIndex]?.focus();
        break;
      }
      case 'Home': {
        event.preventDefault();
        items[0]?.focus();
        break;
      }
      case 'End': {
        event.preventDefault();
        items.at(-1)?.focus();
        break;
      }
      case 'Escape': {
        event.preventDefault();
        this.close();
        break;
      }
    }
  }

  protected selectItem(item: MenuItem): void {
    if (item.disabled) return;
    this.itemSelected.emit(item);
    if (this.closeOnSelect()) {
      this.close();
    }
  }

  protected isDisabled(item: MenuItem): boolean {
    return !!item.disabled;
  }

  private focusFirstItem(): void {
    const items = this.getFocusableItems();
    items[0]?.focus();
  }

  private getFocusableItems(): HTMLElement[] {
    const panel = this.menuPanel()?.nativeElement;
    if (!panel) return [];
    return Array.from(panel.querySelectorAll<HTMLElement>('[data-menu-item="true"]'))
      .filter(item => item.getAttribute('aria-disabled') !== 'true');
  }
}
