import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { SSEService } from '../../core/services/sse.service';
import { WhatsAppDeviceStatusService } from '../../core/services/whatsapp-device-status.service';
import { localizeWhatsAppStatusMessage } from '../../core/utils/whatsapp-status.util';
import { AIJobSidebarPanelComponent } from '../../shared/components/ai-job-sidebar-panel/ai-job-sidebar-panel.component';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { NotificationSidebarPanelComponent } from '../../shared/components/notification-sidebar-panel/notification-sidebar-panel.component';
import { ToastContainerComponent } from '../../shared/components/toast-container/toast-container.component';
import { AuthenticatedMobileNavComponent } from './authenticated-mobile-nav.component';
import { AuthenticatedSidebarComponent } from './authenticated-sidebar.component';
import { MobileSectionTabsComponent } from './mobile-section-tabs.component';

@Component({
  selector: 'app-authenticated-layout',
  imports: [
    RouterLink,
    RouterOutlet,
    TranslatePipe,
    AIJobSidebarPanelComponent,
    ButtonComponent,
    NotificationSidebarPanelComponent,
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
  protected readonly whatsAppDeviceStatus = inject(WhatsAppDeviceStatusService);
  private readonly translate = inject(TranslateService);

  protected readonly showTimeoutWarning = signal(false);
  protected readonly mobileMenuOpen = signal(false);
  protected readonly dismissedWhatsAppBannerKey = signal<string | null>(null);
  protected readonly whatsAppBannerKey = computed(() => {
    const status = this.whatsAppDeviceStatus.status();
    if (!status) {
      return null;
    }

    return `${status.state}:${status.message}:${status.canSend}:${status.needsReauth}`;
  });
  protected readonly showWhatsAppReconnectBanner = computed(() => {
    const bannerKey = this.whatsAppBannerKey();
    if (!bannerKey || !this.whatsAppDeviceStatus.needsReconnectBanner()) {
      return false;
    }

    return this.dismissedWhatsAppBannerKey() !== bannerKey;
  });
  protected readonly whatsAppBannerMessage = computed(() => {
    const message = this.whatsAppDeviceStatus.status()?.message;
    return localizeWhatsAppStatusMessage(message, this.translate);
  });

  constructor() {
    this.whatsAppDeviceStatus.startPolling();
  }

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

  protected dismissWhatsAppBanner(): void {
    const bannerKey = this.whatsAppBannerKey();
    if (!bannerKey) {
      return;
    }

    this.dismissedWhatsAppBannerKey.set(bannerKey);
  }
}
