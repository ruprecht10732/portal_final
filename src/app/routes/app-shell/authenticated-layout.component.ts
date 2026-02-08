import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { SSEService } from '../../core/services/sse.service';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { ToastContainerComponent } from '../../shared/components/toast-container/toast-container.component';
import { AuthenticatedMobileNavComponent } from './authenticated-mobile-nav.component';
import { AuthenticatedSidebarComponent } from './authenticated-sidebar.component';
import { MobileSectionTabsComponent } from './mobile-section-tabs.component';

@Component({
  selector: 'app-authenticated-layout',
  imports: [
    RouterLink,
    RouterOutlet,
    ButtonComponent,
    ToastContainerComponent,
    AuthenticatedMobileNavComponent,
    AuthenticatedSidebarComponent,
    MobileSectionTabsComponent,
  ],
  templateUrl: './authenticated-layout.component.html',
  styleUrl: './authenticated-layout.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthenticatedLayoutComponent {
  // Initialize SSE service for real-time notifications (side-effect injection)
  protected readonly _ = inject(SSEService);

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
