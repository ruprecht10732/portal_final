import { ChangeDetectionStrategy, Component, inject, OnInit, signal, SecurityContext } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { PartnersService } from '../../../core/services/partners.service';
import { type OfferDetailResponse, centsToEuros } from '../../../core/services/partner-offer.types';
import { ErrorReportingService } from '../../../core/services/error-reporting.service';
import { extractErrorMessage } from '../../../core/utils/error-utils';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { PageLayoutComponent } from '../../../shared/components/page-layout/page-layout.component';

@Component({
  selector: 'app-partners-offer-detail',
  templateUrl: './partners-offer-detail.component.html',
  styleUrl: './partners-offer-detail.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, ButtonComponent, PageLayoutComponent],
  host: { class: 'xl:flex xl:flex-col xl:flex-1 xl:min-h-0 xl:overflow-hidden' },
})
export class PartnersOfferDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly sanitizer = inject(DomSanitizer);
  protected readonly partnersService = inject(PartnersService);
  private readonly reporter = inject(ErrorReportingService);
  private currentOfferId: string | null = null;

  protected readonly offer = signal<OfferDetailResponse | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly regeneratingPdf = signal(false);

  protected readonly centsToEuros = centsToEuros;

  ngOnInit(): void {
    const offerId = this.route.snapshot.paramMap.get('offerId');
    if (!offerId) {
      this.router.navigate(['/app/offers']);
      return;
    }
    this.currentOfferId = offerId;
    this.loadOfferDetail(offerId);
  }

  protected regeneratePdf(): void {
    if (!this.currentOfferId || this.regeneratingPdf()) {
      return;
    }

    this.regeneratingPdf.set(true);
    this.partnersService.regenerateOfferPdf(this.currentOfferId).subscribe({
      next: () => {
        this.loadOfferDetail(this.currentOfferId!);
        this.regeneratingPdf.set(false);
      },
      error: (err) => {
        const msg = extractErrorMessage(err, 'Kon ondertekende PDF niet opnieuw genereren');
        this.error.set(msg);
        this.reporter.report(err);
        this.regeneratingPdf.set(false);
      },
    });
  }

  private loadOfferDetail(offerId: string): void {
    this.loading.set(true);
    this.partnersService.getOfferDetail(offerId).subscribe({
      next: (detail) => {
        this.offer.set({
          ...detail,
          lineItems: detail.lineItems ?? [],
          inspectionSlots: detail.inspectionSlots ?? [],
          jobSlots: detail.jobSlots ?? [],
          photos: detail.photos ?? [],
        });
        this.loading.set(false);
      },
      error: (err) => {
        const msg = extractErrorMessage(err, 'Kon aanbod detail niet laden');
        this.error.set(msg);
        this.reporter.report(err);
        this.loading.set(false);
      },
    });
  }

  protected goBack(): void {
    this.router.navigate(['/app/offers']);
  }

  protected openVakmanLink(): void {
    const token = this.offer()?.publicToken;
    if (!token) return;

    const acceptanceUrl = this.partnersService.buildOfferAcceptanceUrl(token);
    globalThis.open(acceptanceUrl, '_blank', 'noopener,noreferrer');
  }

  protected offerPdfUrl(): string | null {
    if (!this.currentOfferId) {
      return null;
    }
    return this.partnersService.buildOfferPdfUrl(this.currentOfferId);
  }

  protected renderDescription(value: string | null | undefined): SafeHtml {
    const source = (value ?? '').trim();
    if (!source) {
      return '';
    }
    const sanitized = this.sanitizer.sanitize(SecurityContext.HTML, source) ?? '';
    return this.sanitizer.bypassSecurityTrustHtml(sanitized);
  }

  protected formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('nl-NL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  protected formatSlots(slots: { start: string; end: string }[] | null | undefined): string {
    if (!slots?.length) return '—';
    return slots
      .map(
        (s) =>
          `${new Date(s.start).toLocaleString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} – ${new Date(s.end).toLocaleString('nl-NL', { hour: '2-digit', minute: '2-digit' })}`,
      )
      .join(', ');
  }
}
