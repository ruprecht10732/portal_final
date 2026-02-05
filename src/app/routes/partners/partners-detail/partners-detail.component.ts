import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { PartnersService } from '../../../core/services/partners.service';
import { ServiceTypesService } from '../../../core/services/service-types.service';
import type { Partner } from '../../../core/services/partners.types';
import type { ServiceTypeItem } from '../../../core/services/service-types.types';
import { ErrorReportingService } from '../../../core/services/error-reporting.service';
import { ToastService } from '../../../core/services/toast.service';
import { extractErrorMessage } from '../../../core/utils/error-utils';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';

@Component({
  selector: 'app-partners-detail',
  templateUrl: './partners-detail.component.html',
  styleUrl: './partners-detail.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, LucideAngularModule, ButtonComponent, ConfirmDialogComponent, PageHeaderComponent],
})
export class PartnersDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly partnersService = inject(PartnersService);
  private readonly serviceTypesService = inject(ServiceTypesService);
  private readonly reporter = inject(ErrorReportingService);
  private readonly translate = inject(TranslateService);
  private readonly toast = inject(ToastService);

  protected readonly partner = signal<Partner | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly deleting = signal(false);
  protected readonly showDeleteDialog = signal(false);
  protected readonly logoDownloadUrl = signal<string | null>(null);
  protected readonly logoError = signal<string | null>(null);
  protected readonly logoImageError = signal(false);
  protected readonly serviceTypes = signal<ServiceTypeItem[]>([]);
  protected readonly serviceTypesLoading = signal(false);
  protected readonly serviceTypesError = signal<string | null>(null);
  protected readonly serviceTypeLabels = computed<Record<string, string>>(() => (
    this.serviceTypes().reduce((acc, item) => {
      acc[item.id] = item.name;
      return acc;
    }, {} as Record<string, string>)
  ));
  protected readonly logoPreviewUrl = computed(() => {
    return this.logoDownloadUrl();
  });
  protected readonly logoInitials = computed(() => {
    const name = this.partner()?.businessName || '';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'P';
    const first = parts[0] ?? '';
    if (parts.length === 1) return (first.slice(0, 2) || 'P').toUpperCase();
    const initials = `${first[0] ?? ''}${parts[1]?.[0] ?? ''}`.trim();
    return (initials || first.slice(0, 2) || 'P').toUpperCase();
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.goBack();
      return;
    }
    this.loadPartner(id);
  }

  protected goBack(): void {
    this.router.navigate(['/app/partners']);
  }

  protected editPartner(): void {
    const partner = this.partner();
    if (!partner) return;
    this.router.navigate(['/app/partners', partner.id, 'edit']);
  }

  protected openDeleteDialog(): void {
    this.showDeleteDialog.set(true);
  }

  protected closeDeleteDialog(): void {
    this.showDeleteDialog.set(false);
  }

  protected confirmDelete(): void {
    const partner = this.partner();
    if (!partner || this.deleting()) return;

    this.deleting.set(true);
    this.partnersService.delete(partner.id).subscribe({
      next: () => {
        this.toast.success(this.translate.instant('partners.detail.deleteSuccess'));
        this.router.navigate(['/app/partners']);
      },
      error: err => {
        const message = extractErrorMessage(err, this.translate.instant('partners.errors.deleteFailed'));
        this.toast.error(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.deleting.set(false);
        this.closeDeleteDialog();
      },
    });
  }

  protected formatDate(value: string): string {
    return new Intl.DateTimeFormat('nl-NL', {
      dateStyle: 'long',
      timeStyle: 'short',
    }).format(new Date(value));
  }

  private loadPartner(id: string): void {
    this.loading.set(true);
    this.partnersService.getById(id).subscribe({
      next: partner => {
        this.partner.set(partner);
        this.loading.set(false);
        this.loadServiceTypes();
        this.loadLogo(partner);
      },
      error: err => {
        const message = extractErrorMessage(err, this.translate.instant('partners.errors.loadFailed'));
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.loading.set(false);
      },
    });
  }

  private loadServiceTypes(): void {
    this.serviceTypesLoading.set(true);
    this.serviceTypesError.set(null);
    this.serviceTypesService.listAdmin({ page: 1, pageSize: 100, sortBy: 'displayOrder', sortOrder: 'asc' }).subscribe({
      next: response => {
        this.serviceTypes.set(response.items ?? []);
        this.serviceTypesLoading.set(false);
      },
      error: () => {
        this.serviceTypesService.listActive().subscribe({
          next: response => {
            this.serviceTypes.set(response.items ?? []);
            this.serviceTypesLoading.set(false);
          },
          error: err => {
            const message = extractErrorMessage(err, this.translate.instant('partners.detail.errors.loadServiceTypes'));
            this.serviceTypesError.set(message);
            this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
            this.serviceTypesLoading.set(false);
          },
        });
      },
    });
  }

  private loadLogo(partner: Partner): void {
    if (!partner.logoFileKey) {
      this.logoDownloadUrl.set(null);
      this.logoImageError.set(false);
      return;
    }

    this.partnersService.getLogoDownloadUrl(partner.id).subscribe({
      next: response => {
        this.logoDownloadUrl.set(response.downloadUrl);
        this.logoImageError.set(false);
        this.logoError.set(null);
      },
      error: err => {
        const message = extractErrorMessage(err, this.translate.instant('partners.detail.errors.loadLogo'));
        this.logoError.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
      },
    });
  }
}
