import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { EMPTY, Subject, debounceTime, distinctUntilChanged, switchMap } from 'rxjs';

import { PartnersService } from '../../../core/services/partners.service';
import type { Partner, CreateOfferResponse } from '../../../core/services/partners.types';
import { LeadsService } from '../../../core/services/leads.service';
import type { Lead, LeadService } from '../../../core/services/leads.types';
import { QuotesService } from '../../../core/services/quotes.service';
import type { QuoteResponse } from '../../../core/services/quotes.types';
import { ErrorReportingService } from '../../../core/services/error-reporting.service';
import { ToastService } from '../../../core/services/toast.service';
import { extractErrorMessage } from '../../../core/utils/error-utils';

import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { CardComponent } from '../../../shared/components/card/card.component';
import { AutocompleteComponent, type AutocompleteOption } from '../../../shared/components/autocomplete/autocomplete.component';
import { NumberInputComponent } from '../../../shared/components/number-input/number-input.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';

interface Option {
  label: string;
  value: string;
}

@Component({
  selector: 'app-partners-offer-create',
  imports: [
    TranslatePipe,
    LucideAngularModule,
    PageHeaderComponent,
    CardComponent,
    AutocompleteComponent,
    NumberInputComponent,
    ButtonComponent,
  ],
  templateUrl: './partners-offer-create.component.html',
  styleUrl: './partners-offer-create.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartnersOfferCreateComponent {
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly partnersService = inject(PartnersService);
  private readonly leadsService = inject(LeadsService);
  private readonly quotesService = inject(QuotesService);
  private readonly reporter = inject(ErrorReportingService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  // Search streams
  private readonly partnerSearch$ = new Subject<string>();
  private readonly leadSearch$ = new Subject<string>();

  // Partner search/selection
  protected readonly partnerSearch = signal('');
  protected readonly partnerSearchLoading = signal(false);
  protected readonly partnerSearchError = signal<string | null>(null);
  protected readonly partnerResults = signal<Partner[]>([]);
  protected readonly selectedPartnerId = signal<string | null>(null);

  // Lead search/selection
  protected readonly leadSearch = signal('');
  protected readonly leadSearchLoading = signal(false);
  protected readonly leadSearchError = signal<string | null>(null);
  protected readonly leadResults = signal<Lead[]>([]);
  protected readonly selectedLead = signal<Lead | null>(null);
  protected readonly leadLoading = signal(false);

  // Quotes (Accepted) for selected lead
  protected readonly quotesLoading = signal(false);
  protected readonly quotesError = signal<string | null>(null);
  protected readonly quotes = signal<QuoteResponse[]>([]);
  protected readonly selectedQuoteId = signal<string | null>(null);

  // Inline quote->service linking (when quote.leadServiceId is missing)
  protected readonly linkingQuoteService = signal(false);
  protected readonly linkServiceQuoteId = signal<string | null>(null);
  protected readonly linkServiceLeadServiceId = signal<string | null>(null);
  protected readonly linkServiceError = signal<string | null>(null);

  // Offer inputs
  protected readonly expiresInHours = signal<number>(12);

  // Offer create output
  protected readonly creating = signal(false);
  protected readonly createError = signal<string | null>(null);
  protected readonly createdOffer = signal<CreateOfferResponse | null>(null);

  // Optional link action
  protected readonly linkingLead = signal(false);

  constructor() {
    this.partnerSearch$
      .pipe(
        debounceTime(350),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
        switchMap((query) => {
          const trimmed = query.trim();
          if (trimmed.length < 2) {
            this.partnerResults.set([]);
            this.partnerSearchLoading.set(false);
            this.partnerSearchError.set(null);
            return EMPTY;
          }

          this.partnerSearchLoading.set(true);
          this.partnerSearchError.set(null);
          return this.partnersService.list({
            search: trimmed,
            page: 1,
            pageSize: 10,
            sortBy: 'businessName',
            sortOrder: 'asc',
          });
        }),
      )
      .subscribe({
        next: (response) => {
          this.partnerResults.set(response.items ?? []);
          this.partnerSearchLoading.set(false);
        },
        error: (err) => {
          const message = extractErrorMessage(err, this.translate.instant('partners.createOfferPage.errors.searchPartners'));
          this.partnerSearchError.set(message);
          this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
          this.partnerSearchLoading.set(false);
        },
      });

    this.leadSearch$
      .pipe(
        debounceTime(350),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
        switchMap((query) => {
          const trimmed = query.trim();
          if (trimmed.length < 2) {
            this.leadResults.set([]);
            this.leadSearchLoading.set(false);
            this.leadSearchError.set(null);
            return EMPTY;
          }

          this.leadSearchLoading.set(true);
          this.leadSearchError.set(null);
          return this.leadsService.list({ search: trimmed, page: 1, pageSize: 10, sortBy: 'createdAt', sortOrder: 'desc' });
        }),
      )
      .subscribe({
        next: (response) => {
          this.leadResults.set(response.items ?? []);
          this.leadSearchLoading.set(false);
        },
        error: (err) => {
          const message = extractErrorMessage(err, this.translate.instant('partners.createOfferPage.errors.searchLeads'));
          this.leadSearchError.set(message);
          this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
          this.leadSearchLoading.set(false);
        },
      });
  }

  protected readonly partnerOptions = computed<AutocompleteOption[]>(() =>
    (this.partnerResults() ?? []).map(p => ({ value: p.id, label: `${p.businessName} — ${p.city}` })),
  );

  protected readonly selectedPartner = computed(() => {
    const id = this.selectedPartnerId();
    if (!id) return null;
    return this.partnerResults().find(p => p.id === id) ?? null;
  });

  protected readonly leadOptions = computed<AutocompleteOption[]>(() =>
    (this.leadResults() ?? []).map(l => ({
      value: l.id,
      label: `${l.consumer.firstName} ${l.consumer.lastName} — ${l.address.street} ${l.address.houseNumber}, ${l.address.city}`,
    })),
  );

  protected readonly leadServiceOptions = computed<Option[]>(() => {
    const lead = this.selectedLead();
    if (!lead?.services?.length) return [];
    return (lead.services ?? []).map((s: LeadService) => ({ label: s.serviceType, value: s.id }));
  });

  protected readonly selectedQuote = computed(() => {
    const quoteId = this.selectedQuoteId();
    if (!quoteId) return null;
    return this.quotes().find(q => q.id === quoteId) ?? null;
  });

  protected readonly acceptanceUrl = computed(() => {
    const offer = this.createdOffer();
    if (!offer) return null;
    return this.partnersService.buildOfferAcceptanceUrl(offer.publicToken);
  });

  protected readonly canCreateOffer = computed(() => {
    if (this.creating()) return false;
    if (!this.selectedPartnerId()) return false;
    const quote = this.selectedQuote();
    if (!quote) return false;
    if (quote.status !== 'Accepted') return false;
    if (!quote.leadServiceId) return false;
    if (quote.totalCents <= 0) return false;
    return true;
  });

  protected goBack(): void {
	this.router.navigate(['/app/offers']);
  }

  protected onPartnerSearchChange(value: string): void {
    this.partnerSearch.set(value);
    this.selectedPartnerId.set(null);
    this.createdOffer.set(null);
    this.createError.set(null);
    this.partnerSearch$.next(value);
  }

  protected onPartnerSelected(value: string): void {
    const opt = this.partnerOptions().find(o => o.label === value);
    if (!opt) return;
    this.selectedPartnerId.set(opt.value);
  }

  protected clearPartner(): void {
    this.partnerSearch.set('');
    this.partnerSearchError.set(null);
    this.partnerResults.set([]);
    this.selectedPartnerId.set(null);
  }

  protected onLeadSearchChange(value: string): void {
    this.leadSearch.set(value);
    this.selectedLead.set(null);
    this.quotes.set([]);
    this.selectedQuoteId.set(null);
    this.quotesError.set(null);
    this.createdOffer.set(null);
    this.createError.set(null);
    this.leadSearch$.next(value);
  }

  protected onLeadSelected(value: string): void {
    const opt = this.leadOptions().find(o => o.label === value);
    if (!opt) return;

    this.leadLoading.set(true);
    this.quotes.set([]);
    this.selectedQuoteId.set(null);
    this.quotesError.set(null);
    this.leadsService.getById(opt.value).subscribe({
      next: (lead) => {
        this.selectedLead.set(lead);
        this.leadLoading.set(false);

		this.loadQuotesForLead(lead.id);
      },
      error: (err) => {
        const message = extractErrorMessage(err, this.translate.instant('partners.createOfferPage.errors.loadLead'));
        this.leadSearchError.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.leadLoading.set(false);
      },
    });
  }

  protected clearLead(): void {
    this.leadSearch.set('');
    this.leadSearchError.set(null);
    this.leadResults.set([]);
    this.selectedLead.set(null);
    this.quotes.set([]);
    this.selectedQuoteId.set(null);
    this.quotesError.set(null);
  }

  protected setExpiresInHours(value: number | null): void {
    const safe = typeof value === 'number' && Number.isFinite(value) ? value : 12;
    this.expiresInHours.set(safe);
  }

  protected createOffer(): void {
    if (!this.canCreateOffer()) return;

    const partnerId = this.selectedPartnerId()!;
    const quote = this.selectedQuote();
    if (!quote) return;

    const expiresInHours = Math.max(1, Math.min(12, Math.floor(this.expiresInHours() || 12)));

    this.creating.set(true);
    this.createError.set(null);
    this.createdOffer.set(null);

    this.partnersService
      .createOfferFromQuote({ partnerId, quoteId: quote.id, expiresInHours })
      .subscribe({
        next: (resp) => {
          this.createdOffer.set(resp);
          this.creating.set(false);
          this.toast.success(this.translate.instant('partners.createOfferPage.success.offerCreated'));
        },
        error: (err) => {
          const message = extractErrorMessage(err, this.translate.instant('partners.createOfferPage.errors.createOffer'));
          this.createError.set(message);
          this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
          this.creating.set(false);
        },
      });
  }

  protected selectQuote(quote: QuoteResponse): void {
    if (quote.status !== 'Accepted') return;
    if (!quote.leadServiceId) return;
    this.selectedQuoteId.set(quote.id);
    this.createdOffer.set(null);
    this.createError.set(null);
  }

  protected startLinkServiceForQuote(quote: QuoteResponse): void {
    this.linkServiceQuoteId.set(quote.id);
    this.linkServiceLeadServiceId.set(this.leadServiceOptions()[0]?.value ?? null);
    this.linkServiceError.set(null);
  }

  protected cancelLinkService(): void {
    this.linkServiceQuoteId.set(null);
    this.linkServiceLeadServiceId.set(null);
    this.linkServiceError.set(null);
  }

  protected saveQuoteServiceLink(quote: QuoteResponse): void {
    const leadServiceId = this.linkServiceLeadServiceId();
    if (!leadServiceId || this.linkingQuoteService()) return;

    this.linkingQuoteService.set(true);
    this.linkServiceError.set(null);
    this.quotesService.setLeadServiceId(quote.id, leadServiceId).subscribe({
      next: (updated) => {
        this.quotes.update(current => current.map(q => (q.id === updated.id ? updated : q)));
        this.linkingQuoteService.set(false);
        this.toast.success(this.translate.instant('common.saved'));
        this.cancelLinkService();

        if (updated.leadServiceId) {
          this.selectedQuoteId.set(updated.id);
        }
      },
      error: (err) => {
        const message = extractErrorMessage(err, this.translate.instant('common.error'), {
          allowErrorMessage: true,
          allowMessageField: true,
        });
        this.linkServiceError.set(message);
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.linkingQuoteService.set(false);
      },
    });
  }

  private loadQuotesForLead(leadId: string): void {
    this.quotesLoading.set(true);
    this.quotesError.set(null);

    this.quotesService
      .list({
        leadId,
        status: 'Accepted',
        page: 1,
        pageSize: 25,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      })
      .subscribe({
        next: (resp) => {
          this.quotes.set(resp.items ?? []);
          this.quotesLoading.set(false);

          const firstEligible = (resp.items ?? []).find(q => q.status === 'Accepted' && !!q.leadServiceId && q.totalCents > 0);
          this.selectedQuoteId.set(firstEligible?.id ?? null);
        },
        error: (err) => {
          const message = extractErrorMessage(err, this.translate.instant('partners.createOfferPage.errors.loadQuotes'));
          this.quotesError.set(message);
          this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
          this.quotesLoading.set(false);
        },
      });
  }

  protected linkPartnerToLead(): void {
    const partnerId = this.selectedPartnerId();
    const lead = this.selectedLead();
    if (!partnerId || !lead || this.linkingLead()) return;

    this.linkingLead.set(true);
    this.partnersService.linkLead(partnerId, lead.id).subscribe({
      next: () => {
        this.linkingLead.set(false);
        this.toast.success(this.translate.instant('partners.createOfferPage.success.partnerLinked'));
      },
      error: (err) => {
        const message = extractErrorMessage(err, this.translate.instant('partners.createOfferPage.errors.linkPartner'));
        this.reporter.report(err, { source: 'http', silent: true, userMessage: message });
        this.toast.error(message);
        this.linkingLead.set(false);
      },
    });
  }

  protected openAcceptanceLink(): void {
    const url = this.acceptanceUrl();
    if (!url) return;
    globalThis.open(url, '_blank', 'noopener');
  }

  protected openWhatsApp(): void {
    const partner = this.selectedPartner();
    const offer = this.createdOffer();
    if (!partner || !offer) return;

    const url = this.partnersService.buildOfferWhatsAppUrl(
      partner.contactPhone,
      partner.businessName,
      offer.publicToken,
      offer.vakmanPriceCents,
    );

    globalThis.open(url, '_blank', 'noopener');
  }

  protected formatEuroCents(cents: number): string {
    const lang = this.translate.currentLang || 'nl';
    const locale = lang === 'nl' ? 'nl-NL' : 'en-US';
    return (cents / 100).toLocaleString(locale, {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
    });
  }
}
