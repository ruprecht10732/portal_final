import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { EMPTY, Subject, debounceTime, distinctUntilChanged, switchMap } from 'rxjs';

import { QuotesService } from '../../../core/services/quotes.service';
import type { QuoteResponse } from '../../../core/services/quotes.types';
import { PartnersService } from '../../../core/services/partners.service';
import type { Partner } from '../../../core/services/partners.types';
import type { AutocompleteOption } from '../../../shared/components/autocomplete/autocomplete.component';
import { extractErrorMessage } from '../../../core/utils/error-utils';
import { ErrorReportingService } from '../../../core/services/error-reporting.service';
import { ToastService } from '../../../core/services/toast.service';

import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { CardComponent } from '../../../shared/components/card/card.component';
import { AutocompleteComponent } from '../../../shared/components/autocomplete/autocomplete.component';
import { NumberInputComponent } from '../../../shared/components/number-input/number-input.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';

@Component({
  selector: 'app-offertes-partner-offer',
  templateUrl: './offertes-partner-offer.component.html',
  styleUrl: './offertes-partner-offer.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, PageHeaderComponent, CardComponent, AutocompleteComponent, NumberInputComponent, ButtonComponent],
})
export class OffertesPartnerOfferComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly quotesService = inject(QuotesService);
  private readonly partnersService = inject(PartnersService);
  private readonly reporter = inject(ErrorReportingService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly partnerSearch$ = new Subject<string>();

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly quote = signal<QuoteResponse | null>(null);

  protected readonly partnerSearch = signal('');
  protected readonly partnerSearchLoading = signal(false);
  protected readonly partnerSearchError = signal<string | null>(null);
  protected readonly partnerResults = signal<Partner[]>([]);
  protected readonly selectedPartnerId = signal<string | null>(null);

  protected readonly expiresInHours = signal<number>(12);

  protected readonly offerCreating = signal(false);
  protected readonly offerError = signal<string | null>(null);
  protected readonly createdOfferToken = signal<string | null>(null);
  protected readonly createdOfferVakmanPriceCents = signal<number | null>(null);

  protected readonly selectedPartner = computed(() => {
    const id = this.selectedPartnerId();
    if (!id) return null;
    return this.partnerResults().find(p => p.id === id) ?? null;
  });

  protected readonly partnerOptions = computed<AutocompleteOption[]>(() =>
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

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/app/offertes']);
      return;
    }

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
          return this.partnersService.list({ search: trimmed, page: 1, pageSize: 10, sortBy: 'businessName', sortOrder: 'asc' });
        }),
      )
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

  protected onPartnerSearchChange(value: string): void {
    this.partnerSearch.set(value);
    this.selectedPartnerId.set(null);
    this.createdOfferToken.set(null);
    this.createdOfferVakmanPriceCents.set(null);
    this.offerError.set(null);
    this.partnerSearch$.next(value);
  }

  protected onPartnerSelected(value: string): void {
    const opt = this.partnerOptions().find(o => o.label === value);
    if (!opt) return;
    this.selectedPartnerId.set(opt.value);
  }

  protected clearPartnerSearch(): void {
    this.partnerSearch.set('');
    this.partnerSearchError.set(null);
    this.partnerResults.set([]);
    this.selectedPartnerId.set(null);
    this.partnerSearchLoading.set(false);
  }

  protected createOffer(): void {
    const q = this.quote();
    const partnerId = this.selectedPartnerId();
    if (!q || !partnerId || this.offerCreating()) return;
    if (q.status !== 'Accepted') return;
    if (!q.leadServiceId) return;

    const expiresInHours = Math.max(1, Math.min(12, Math.floor(this.expiresInHours() || 12)));

    this.offerCreating.set(true);
    this.offerError.set(null);
    this.createdOfferToken.set(null);
    this.createdOfferVakmanPriceCents.set(null);

    this.partnersService
      .createOfferFromQuote({ partnerId, quoteId: q.id, expiresInHours })
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

    const url = this.partnersService.buildOfferWhatsAppUrl(partner.contactPhone, partner.businessName, token, vakmanPrice);
    globalThis.open(url, '_blank', 'noopener');
  }

  protected formatEuroCents(cents: number): string {
    const lang = this.translate.getCurrentLang() || this.translate.getFallbackLang() || 'nl';
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
