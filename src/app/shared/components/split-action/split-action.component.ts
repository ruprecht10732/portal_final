import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonComponent } from '../button/button.component';
import { MenuComponent, type MenuItem, type MenuSection } from '../menu/menu.component';

export interface SplitMenuItem extends MenuItem {
  action?: string;
}

export interface SplitMenuSection extends Omit<MenuSection, 'items'> {
  items: readonly SplitMenuItem[];
}

@Component({
  selector: 'shared-split-action',
  imports: [ButtonComponent, MenuComponent, TranslatePipe],
  templateUrl: './split-action.component.html',
  styleUrl: './split-action.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SplitActionComponent {
  primaryLabel = input('offertes.save');
  primaryAriaLabel = input<string | undefined>(undefined);
  primaryVariant = input<'primary' | 'secondary' | 'ghost' | 'success' | 'danger'>('primary');
  menuVariant = input<'primary' | 'secondary' | 'ghost' | 'success' | 'danger'>('secondary');
  size = input<'default' | 'compact'>('compact');
  primaryDisabled = input(false);
  primaryLoading = input(false);
  menuDisabled = input(false);
  menuSections = input<readonly SplitMenuSection[]>([]);
  menuAriaLabel = input<string | undefined>(undefined);
  menuTriggerLabel = input('offertes.actions');

  primaryClicked = output<void>();
  actionSelected = output<string>();

  protected onPrimaryClick(): void {
    if (this.primaryDisabled() || this.primaryLoading()) return;
    this.primaryClicked.emit();
  }

  protected onMenuItemSelected(item: MenuItem): void {
    const action = (item as SplitMenuItem).action;
    if (action) this.actionSelected.emit(action);
  }
}
