import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, EMPTY, finalize } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { OrganizationService } from '../../../../core/services/organization.service';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { CardComponent } from '../../../../shared/components/card/card.component';
import { NumberInputComponent } from '../../../../shared/components/number-input/number-input.component';
import { PageLayoutComponent } from '../../../../shared/components/page-layout/page-layout.component';
import { SkeletonComponent } from '../../../../shared/components/skeleton/skeleton.component';

@Component({
  selector: 'app-organization-quote-defaults-settings',
  imports: [ButtonComponent, CardComponent, NumberInputComponent, PageLayoutComponent, SkeletonComponent, TranslatePipe],
  templateUrl: './organization-quote-defaults-settings.component.html',
  styleUrl: './organization-quote-defaults-settings.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganizationQuoteDefaultsSettingsComponent {
  protected readonly quotePaymentDays = signal<number | null>(7);
  private readonly initialQuotePaymentDays = signal<number>(7);

  protected readonly quoteValidDays = signal<number | null>(14);
  private readonly initialQuoteValidDays = signal<number>(14);

  protected readonly isLoading = signal(true);
  protected readonly isSaving = signal(false);
  protected readonly successMessage = signal('');
  protected readonly errorMessage = signal('');

  private readonly orgService = inject(OrganizationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);

  protected readonly hasChanges = computed(() =>
    (this.quotePaymentDays() ?? this.initialQuotePaymentDays()) !== this.initialQuotePaymentDays() ||
    (this.quoteValidDays() ?? this.initialQuoteValidDays()) !== this.initialQuoteValidDays()
  );

  protected readonly canSave = computed(() =>
    !this.isSaving() &&
    this.hasChanges() &&
    (this.quotePaymentDays() ?? 0) >= 1 &&
    (this.quoteValidDays() ?? 0) >= 1
  );

  constructor() {
    this.loadSettings();
  }

  private loadSettings(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    this.orgService
      .getSettings()
      .pipe(
        catchError(() => {
          this.errorMessage.set(this.translate.instant('organization.settings.loadFailed'));
          return EMPTY;
        }),
        finalize(() => this.isLoading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(settings => {
        this.quotePaymentDays.set(settings.quotePaymentDays);
        this.initialQuotePaymentDays.set(settings.quotePaymentDays);
        this.quoteValidDays.set(settings.quoteValidDays);
        this.initialQuoteValidDays.set(settings.quoteValidDays);
      });
  }

  protected save(): void {
    if (!this.canSave()) return;

    this.isSaving.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    this.orgService
      .updateSettings({
        ...(this.quotePaymentDays() == null ? {} : { quotePaymentDays: this.quotePaymentDays()! }),
        ...(this.quoteValidDays() == null ? {} : { quoteValidDays: this.quoteValidDays()! }),
      })
      .pipe(
        catchError(() => {
          this.errorMessage.set(this.translate.instant('organization.settings.saveFailed'));
          return EMPTY;
        }),
        finalize(() => this.isSaving.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(settings => {
        this.quotePaymentDays.set(settings.quotePaymentDays);
        this.initialQuotePaymentDays.set(settings.quotePaymentDays);
        this.quoteValidDays.set(settings.quoteValidDays);
        this.initialQuoteValidDays.set(settings.quoteValidDays);
        this.successMessage.set(this.translate.instant('organization.settings.saved'));
      });
  }
}
