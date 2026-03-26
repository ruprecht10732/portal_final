import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, EMPTY, finalize, forkJoin } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PartnersService } from '../../../../core/services/partners.service';
import type { PartnerOfferTermsHistoryItem } from '../../../../core/services/partner-offer.types';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { CardComponent } from '../../../../shared/components/card/card.component';
import { PageLayoutComponent } from '../../../../shared/components/page-layout/page-layout.component';
import { SkeletonComponent } from '../../../../shared/components/skeleton/skeleton.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';

@Component({
  selector: 'app-organization-partner-offer-terms-settings',
  imports: [ButtonComponent, CardComponent, DatePipe, PageLayoutComponent, SkeletonComponent, TextareaComponent, TranslatePipe],
  templateUrl: './organization-partner-offer-terms-settings.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'xl:flex xl:flex-col xl:flex-1 xl:min-h-0 xl:overflow-y-auto' },
})
export class OrganizationPartnerOfferTermsSettingsComponent {
  protected readonly content = signal('');
  private readonly initialContent = signal('');
  protected readonly history = signal<PartnerOfferTermsHistoryItem[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly isSaving = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly successMessage = signal('');

  private readonly partnersService = inject(PartnersService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly hasChanges = computed(() => this.content().trim() !== this.initialContent().trim());
  protected readonly canSave = computed(() => !this.isSaving() && this.content().trim().length > 0 && this.hasChanges());

  constructor() {
    this.load();
  }

  protected save(): void {
    if (!this.canSave()) {
      return;
    }

    this.isSaving.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    this.partnersService.updateOfferTerms({ content: this.content().trim() })
      .pipe(
        catchError(() => {
          this.errorMessage.set(this.translate.instant('organization.settings.partnerOfferTerms.saveFailed'));
          return EMPTY;
        }),
        finalize(() => this.isSaving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((response) => {
        this.content.set(response.content ?? '');
        this.initialContent.set(response.content ?? '');
        this.successMessage.set(this.translate.instant('organization.settings.partnerOfferTerms.saved'));
        this.loadHistory();
      });
  }

  private load(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    forkJoin({
      terms: this.partnersService.getOfferTerms(),
      history: this.partnersService.listOfferTermsHistory(),
    })
      .pipe(
        catchError(() => {
          this.errorMessage.set(this.translate.instant('organization.settings.partnerOfferTerms.loadFailed'));
          return EMPTY;
        }),
        finalize(() => this.isLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ terms, history }) => {
        const content = terms.content ?? '';
        this.content.set(content);
        this.initialContent.set(content);
        this.history.set(history.items ?? []);
      });
  }

  private loadHistory(): void {
    this.partnersService.listOfferTermsHistory()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => this.history.set(response.items ?? []),
      });
  }
}
