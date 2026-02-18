import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { QuotesService } from '../../../core/services/quotes.service';
import type { QuoteResponse } from '../../../core/services/quotes.types';
import { PartnersService } from '../../../core/services/partners.service';
import type { Partner } from '../../../core/services/partners.types';
import type { SelectOption } from '../../../shared/components/select/select.component';
import { extractErrorMessage } from '../../../core/utils/error-utils';
import { ErrorReportingService } from '../../../core/services/error-reporting.service';
import { ToastService } from '../../../core/services/toast.service';

import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { CardComponent } from '../../../shared/components/card/card.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { SelectComponent } from '../../../shared/components/select/select.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';

@Component({
  selector: 'app-offertes-partner-offer',
  templateUrl: './offertes-partner-offer.component.html',
  styleUrl: './offertes-partner-offer.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, PageHeaderComponent, CardComponent, InputComponent, SelectComponent, ButtonComponent],
})
export class OffertesPartnerOfferComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly quotesService = inject(QuotesService);
  private readonly partnersService = inject(PartnersService);
  private readonly reporter = inject(ErrorReportingService);
  private readonly toast = inject(ToastService);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly quote = signal<QuoteResponse | null>(null);

  protected readonly partnerSearch = signal('');
  protected readonly partnerSearchLoading = signal(false);
  protected readonly partnerSearchError = signal<string | null>(null);
  protected readonly partnerResults = signal<Partner[]>([]);
  protected readonly selectedPartnerId = signal<string | null>(null);

  protected readonly offerCreating = signal(false);
  protected readonly offerError = signal<string | null>(null);
  protected readonly createdOfferToken = signal<string | null>(null);
  protected readonly createdOfferVakmanPriceCents = signal<number | null>(null);

  protected readonly selectedPartner = computed(() => {
    const id = this.selectedPartnerId();
    if (!id) return null;
    return this.partnerResults().find(p => p.id === id) ?? null;
  });

  protected readonly partnerOptions = computed<SelectOption<string>[]>(() =>
    (this.partnerResults() ?? []).map(p => ({ value: p.id, label: `${p.businessName} — ${p.city}` })),
  );

  protected readonly offerAcceptanceUrl = computed(() => {
    const token = this.createdOfferToken();
    if (!token) return null;
    return this.partnersService.buildOfferAcceptanceUrl(token);
  });

  protected readonly canCreateOffer = computed(() => {
    const q = this.quote();
    if (!q) return false;
    if (this.offerCreating()) return false;
    if (!this.selectedPartnerId()) return false;
    if (!q.leadServiceId) return false;
    if (q.totalCents <= 0) return false;
    return q.status === 'Accepted';
  });

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/app/offertes']);
      return;
    }
    this.loadQuote(id);
  }

  protected goBack(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.router.navigate(['/app/offertes', id]);
      return;
    }
    this.router.navigate(['/app/offertes']);
  }

  protected searchPartners(): void {
    const query = this.partnerSearch().trim();
    if (!query || this.partnerSearchLoading()) return;

    this.partnerSearchLoading.set(true);
    this.partnerSearchError.set(null);
    this.partnerResults.set([]);
    this.selectedPartnerId.set(null);

    this.partnersService
      .list({ search: query, page: 1, pageSize: 10, sortBy: 'businessName', sortOrder: 'asc' })
      .subscribe({
        next: (response) => {
          this.partnerResults.set(response.items ?? []);
          this.partnerSearchLoading.set(false);
        },
        error: (err) => {
          const message = extractErrorMessage(err, this.translate.instant('offertes.partnerOffer.errors.searchPartners'));
          this.partnerSearchError.set(message);
          this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
          this.partnerSearchLoading.set(false);
        },
      });
  }

  protected clearPartnerSearch(): void {
    this.partnerSearch.set('');
    this.partnerSearchError.set(null);
    this.partnerResults.set([]);
    this.selectedPartnerId.set(null);
  }

  protected createOffer(): void {
    const q = this.quote();
    const partnerId = this.selectedPartnerId();
    if (!q || !partnerId || !q.leadServiceId || this.offerCreating()) return;
    if (q.status !== 'Accepted') return;

    this.offerCreating.set(true);
    this.offerError.set(null);
    this.createdOfferToken.set(null);
    this.createdOfferVakmanPriceCents.set(null);

    this.partnersService
      .createOffer({
        partnerId,
        leadServiceId: q.leadServiceId,
        pricingSource: 'quote',
        customerPriceCents: q.totalCents,
        expiresInHours: 48,
      })
      .subscribe({
        next: (resp) => {
          this.createdOfferToken.set(resp.publicToken);
          this.createdOfferVakmanPriceCents.set(resp.vakmanPriceCents);
          this.offerCreating.set(false);
          this.toast.success(this.translate.instant('offertes.partnerOffer.success.offerCreated'));
        },
        error: (err) => {
          const message = extractErrorMessage(err, this.translate.instant('offertes.partnerOffer.errors.createOffer'));
          this.offerError.set(message);
          this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
          this.offerCreating.set(false);
        },
      });
  }

  protected linkPartnerToLead(): void {
    const q = this.quote();
    const partnerId = this.selectedPartnerId();
    if (!q || !partnerId) return;

    this.offerError.set(null);
    this.partnersService.linkLead(partnerId, q.leadId).subscribe({
      next: () => {
        this.toast.success(this.translate.instant('offertes.partnerOffer.success.partnerLinked'));
      },
      error: (err) => {
        const message = extractErrorMessage(err, this.translate.instant('offertes.partnerOffer.errors.linkPartner'));
        this.offerError.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
      },
    });
  }

  protected openWhatsApp(): void {
    const partner = this.selectedPartner();
    const token = this.createdOfferToken();
    const vakmanPrice = this.createdOfferVakmanPriceCents();
    if (!partner || !token || !vakmanPrice) return;

    const url = this.partnersService.buildOfferWhatsAppUrl(
      partner.contactPhone,
      partner.businessName,
      token,
      vakmanPrice,
    );
    globalThis.open(url, '_blank', 'noopener');
  }

  protected formatEuroCents(cents: number): string {
    const lang = this.translate.currentLang || 'nl';
    const locale = lang === 'nl' ? 'nl-NL' : 'en-US';
    return (cents / 100).toLocaleString(locale, { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 });
  }

  private loadQuote(id: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.quote.set(null);

    this.quotesService.getById(id).subscribe({
      next: (quote) => {
        this.quote.set(quote);
        this.loading.set(false);
      },
      error: (err) => {
        const message = extractErrorMessage(err, this.translate.instant('offertes.partnerOffer.errors.loadQuote'));
        this.error.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.loading.set(false);
      },
    });
  }
}
