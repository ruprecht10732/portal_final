import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { AuthenticatedMobileNavComponent } from './authenticated-mobile-nav.component';
import { AuthenticatedSidebarComponent } from './authenticated-sidebar.component';

@Component({
  selector: 'app-authenticated-layout',
  imports: [RouterLink, RouterOutlet, ButtonComponent, AuthenticatedMobileNavComponent, AuthenticatedSidebarComponent],
  templateUrl: './authenticated-layout.component.html',
  styleUrl: './authenticated-layout.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthenticatedLayoutComponent {
  protected readonly showTimeoutWarning = signal(false);
  protected readonly mobileMenuOpen = signal(false);

  protected toggleMobileMenu(): void {
    this.mobileMenuOpen.update(v => !v);
  }

  protected closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }

  protected openTimeoutWarning(): void {
    this.showTimeoutWarning.set(true);
  }

  protected closeTimeoutWarning(): void {
    this.showTimeoutWarning.set(false);
  }
}
