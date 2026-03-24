import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, EMPTY, finalize } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { OrganizationService } from '../../../../core/services/organization.service';
import { isEmailValid } from '../../../../core/utils/email.util';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { CardComponent } from '../../../../shared/components/card/card.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { NumberInputComponent } from '../../../../shared/components/number-input/number-input.component';
import { PageLayoutComponent } from '../../../../shared/components/page-layout/page-layout.component';
import { SkeletonComponent } from '../../../../shared/components/skeleton/skeleton.component';

@Component({
  selector: 'app-organization-quote-defaults-settings',
  imports: [ButtonComponent, CardComponent, InputComponent, NumberInputComponent, PageLayoutComponent, SkeletonComponent, TranslatePipe],
  templateUrl: './organization-quote-defaults-settings.component.html',
  styleUrl: './organization-quote-defaults-settings.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'xl:flex xl:flex-col xl:flex-1 xl:min-h-0 xl:overflow-y-auto' },
})
export class OrganizationQuoteDefaultsSettingsComponent {
  protected readonly quotePaymentDays = signal<number | null>(7);
  private readonly initialQuotePaymentDays = signal<number>(7);

  protected readonly quoteValidDays = signal<number | null>(14);
  private readonly initialQuoteValidDays = signal<number>(14);

  protected readonly offerMarginPercent = signal<number | null>(10);
  private readonly initialOfferMarginPercent = signal<number>(10);

  protected readonly notificationEmail = signal('');
  private readonly initialNotificationEmail = signal('');

  protected readonly reviewUrl = signal('');
  private readonly initialReviewUrl = signal('');

  protected readonly isLoading = signal(true);
  protected readonly isSaving = signal(false);
  protected readonly successMessage = signal('');
  protected readonly errorMessage = signal('');

  private readonly orgService = inject(OrganizationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);

  protected readonly hasChanges = computed(() =>
    (this.quotePaymentDays() ?? this.initialQuotePaymentDays()) !== this.initialQuotePaymentDays() ||
    (this.quoteValidDays() ?? this.initialQuoteValidDays()) !== this.initialQuoteValidDays() ||
    (this.offerMarginPercent() ?? this.initialOfferMarginPercent()) !== this.initialOfferMarginPercent() ||
    this.notificationEmail().trim() !== this.initialNotificationEmail().trim() ||
    this.reviewUrl().trim() !== this.initialReviewUrl().trim()
  );

  protected readonly notificationEmailError = computed(() => {
    const value = this.notificationEmail().trim();
    if (!value) {
      return '';
    }
    return isEmailValid(value) ? '' : this.translate.instant('organization.settings.notificationEmailInvalid');
  });

  protected readonly canSave = computed(() =>
    !this.isSaving() &&
    this.hasChanges() &&
    this.notificationEmailError() === '' &&
    (this.quotePaymentDays() ?? 0) >= 1 &&
    (this.quoteValidDays() ?? 0) >= 1 &&
    (this.offerMarginPercent() ?? -1) >= 0 &&
    (this.offerMarginPercent() ?? 101) <= 50
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
        const offerMarginPercent = settings.offerMarginBasisPoints / 100;
        this.offerMarginPercent.set(offerMarginPercent);
        this.initialOfferMarginPercent.set(offerMarginPercent);
        const notificationEmail = settings.notificationEmail ?? '';
        this.notificationEmail.set(notificationEmail);
        this.initialNotificationEmail.set(notificationEmail);
        const reviewUrl = settings.reviewUrl ?? '';
        this.reviewUrl.set(reviewUrl);
        this.initialReviewUrl.set(reviewUrl);
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
        ...(this.offerMarginPercent() == null ? {} : { offerMarginBasisPoints: Math.round(this.offerMarginPercent()! * 100) }),
        notificationEmail: this.notificationEmail().trim(),
        ...(this.reviewUrl().trim() ? { reviewUrl: this.reviewUrl().trim() } : {}),
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
        const offerMarginPercent = settings.offerMarginBasisPoints / 100;
        this.offerMarginPercent.set(offerMarginPercent);
        this.initialOfferMarginPercent.set(offerMarginPercent);
        const notificationEmail = settings.notificationEmail ?? '';
        this.notificationEmail.set(notificationEmail);
        this.initialNotificationEmail.set(notificationEmail);
        const reviewUrl = settings.reviewUrl ?? '';
        this.reviewUrl.set(reviewUrl);
        this.initialReviewUrl.set(reviewUrl);
        this.successMessage.set(this.translate.instant('organization.settings.saved'));
      });
  }
}
