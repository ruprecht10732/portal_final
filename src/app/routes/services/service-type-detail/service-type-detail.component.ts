import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { ServiceTypesService } from '../../../core/services/service-types.service';
import type { ServiceTypeItem } from '../../../core/services/service-types.types';
import { ErrorReportingService } from '../../../core/services/error-reporting.service';
import { ToastService } from '../../../core/services/toast.service';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-service-type-detail',
  imports: [
    DatePipe,
    TranslatePipe,
    LucideAngularModule,
    ButtonComponent,
    ConfirmDialogComponent,
  ],
  templateUrl: './service-type-detail.component.html',
  styleUrl: './service-type-detail.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiceTypeDetailComponent implements OnInit {
  private readonly serviceTypesService = inject(ServiceTypesService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly reporter = inject(ErrorReportingService);
  private readonly translate = inject(TranslateService);
  private readonly toast = inject(ToastService);

  protected readonly serviceType = signal<ServiceTypeItem | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly deleting = signal(false);
  protected readonly showDeleteDialog = signal(false);

  protected readonly isActive = computed(() => this.serviceType()?.isActive ?? false);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadServiceType(id);
    } else {
      this.loading.set(false);
      this.error.set(this.translate.instant('services.errors.loadFailed'));
    }
  }

  private loadServiceType(id: string): void {
    this.loading.set(true);
    this.serviceTypesService.getById(id).subscribe({
      next: (item) => {
        this.serviceType.set(item);
        this.loading.set(false);
      },
      error: (err) => {
        const message = this.getErrorMessage(err, this.translate.instant('services.errors.loadFailed'));
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.loading.set(false);
      },
    });
  }

  protected goBack(): void {
    this.router.navigate(['/app/services']);
  }

  protected openDeleteDialog(): void {
    this.showDeleteDialog.set(true);
  }

  protected closeDeleteDialog(): void {
    this.showDeleteDialog.set(false);
  }

  protected confirmDelete(): void {
    const item = this.serviceType();
    if (!item || this.deleting()) return;

    this.deleting.set(true);
    this.serviceTypesService.delete(item.id).subscribe({
      next: () => {
        this.toast.success(this.translate.instant('services.detail.deleteSuccess'));
        this.router.navigate(['/app/services']);
      },
      error: (err) => {
        const message = this.getErrorMessage(err, this.translate.instant('services.errors.deleteFailed'));
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.deleting.set(false);
        this.closeDeleteDialog();
      },
    });
  }

  private getErrorMessage(error: unknown, fallback: string): string {
    if (error && typeof error === 'object' && 'error' in error) {
      const nested = (error as { error?: { error?: string } | string }).error;
      if (typeof nested === 'string') return nested;
      if (nested && typeof nested === 'object' && 'error' in nested && typeof nested.error === 'string') {
        return nested.error;
      }
    }
    return fallback;
  }
}
