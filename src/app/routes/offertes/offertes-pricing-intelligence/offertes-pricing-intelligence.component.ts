import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { TranslatePipe } from '@ngx-translate/core';
import { forkJoin } from 'rxjs';

import { QuotesService } from '../../../core/services/quotes.service';
import {
  centsToEuros,
  derivePostcodePrefixZip4,
  type PricingIntelligenceAggregateResponse,
  type PricingIntelligenceCorrectionResponse,
  type PricingIntelligenceOutcomeResponse,
  type PricingIntelligenceRecordsResponse,
  type PricingIntelligenceSnapshotResponse,
  type PricingIntelligenceSummaryResponse,
} from '../../../core/services/quotes.types';
import { extractErrorMessage } from '../../../core/utils/error-utils';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';

@Component({
  selector: 'app-offertes-pricing-intelligence',
  imports: [TranslatePipe, LucideAngularModule, DatePipe, ButtonComponent, InputComponent, PageHeaderComponent],
  templateUrl: './offertes-pricing-intelligence.component.html',
  styleUrl: './offertes-pricing-intelligence.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'xl:flex xl:flex-col xl:flex-1 xl:min-h-0 xl:overflow-y-auto' },
})
export class OffertesPricingIntelligenceComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly quotesService = inject(QuotesService);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly serviceTypeInput = signal('');
  protected readonly postcodePrefixInput = signal('');
  protected readonly summary = signal<PricingIntelligenceSummaryResponse | null>(null);
  protected readonly records = signal<PricingIntelligenceRecordsResponse | null>(null);

  protected readonly appliedServiceType = computed(() => this.summary()?.serviceType ?? this.serviceTypeInput().trim());
  protected readonly appliedRegionPrefix = computed(() => this.summary()?.regionPrefix || derivePostcodePrefixZip4(this.postcodePrefixInput()));
  protected readonly hasQuery = computed(() => this.appliedServiceType().length > 0);
  protected readonly totalSamples = computed(() =>
    (this.summary()?.aggregates ?? []).reduce((sum, aggregate) => sum + aggregate.sampleCount, 0),
  );
  protected readonly acceptedTotal = computed(() =>
    (this.summary()?.aggregates ?? []).reduce((sum, aggregate) => sum + aggregate.acceptedCount, 0),
  );
  protected readonly rejectedTotal = computed(() =>
    (this.summary()?.aggregates ?? []).reduce((sum, aggregate) => sum + aggregate.rejectedCount, 0),
  );
  protected readonly weightedAverageQuotedCents = computed(() => {
    const aggregates = this.summary()?.aggregates ?? [];
    const sampleCount = this.totalSamples();
    if (sampleCount === 0) {
      return 0;
    }

    const total = aggregates.reduce((sum, aggregate) => sum + aggregate.averageQuotedCents * aggregate.sampleCount, 0);
    return Math.round(total / sampleCount);
  });
  protected readonly sortedAggregates = computed(() =>
    [...(this.summary()?.aggregates ?? [])].sort(
      (left, right) => right.sampleCount - left.sampleCount || right.conversionRate - left.conversionRate,
    ),
  );

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const serviceType = params.get('serviceType')?.trim() ?? '';
      const postcodePrefix = derivePostcodePrefixZip4(params.get('postcodePrefix'));

      this.serviceTypeInput.set(serviceType);
      this.postcodePrefixInput.set(postcodePrefix);

      if (!serviceType) {
        this.summary.set(null);
        this.records.set(null);
        this.error.set(null);
        this.loading.set(false);
        return;
      }

      this.loadReport(serviceType, postcodePrefix);
    });
  }

  protected applyFilters(): void {
    const serviceType = this.serviceTypeInput().trim();
    const postcodePrefix = derivePostcodePrefixZip4(this.postcodePrefixInput());

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        serviceType: serviceType || null,
        postcodePrefix: postcodePrefix || null,
      },
      queryParamsHandling: 'replace',
    });
  }

  protected clearFilters(): void {
    this.serviceTypeInput.set('');
    this.postcodePrefixInput.set('');
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        serviceType: null,
        postcodePrefix: null,
      },
      queryParamsHandling: 'replace',
    });
  }

  protected refresh(): void {
    const serviceType = this.appliedServiceType().trim();
    const postcodePrefix = derivePostcodePrefixZip4(this.appliedRegionPrefix());
    if (!serviceType) {
      return;
    }

    this.loadReport(serviceType, postcodePrefix);
  }

  protected goBack(): void {
    this.router.navigate(['/app/offertes']);
  }

  protected openQuote(quoteId: string): void {
    this.router.navigate(['/app/offertes', quoteId]);
  }

  protected formatCurrency(cents: number): string {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
    }).format(centsToEuros(cents));
  }

  protected formatOptionalCurrency(cents: number | null | undefined): string {
    return typeof cents === 'number' ? this.formatCurrency(cents) : '—';
  }

  protected formatPercent(value: number): string {
    return new Intl.NumberFormat('nl-NL', {
      style: 'percent',
      maximumFractionDigits: 1,
    }).format(value);
  }

  protected formatDelta(correction: PricingIntelligenceCorrectionResponse): string {
    if (typeof correction.deltaCents === 'number') {
      const prefix = correction.deltaCents > 0 ? '+' : '';
      return `${prefix}${this.formatCurrency(correction.deltaCents)}`;
    }

    if (typeof correction.deltaPercentage === 'number') {
      const formatted = new Intl.NumberFormat('nl-NL', {
        style: 'percent',
        maximumFractionDigits: 1,
        signDisplay: 'exceptZero',
      }).format(correction.deltaPercentage / 100);
      return formatted;
    }

    return '—';
  }

  protected trackAggregate(_: number, aggregate: PricingIntelligenceAggregateResponse): string {
    return `${aggregate.regionPrefix}:${aggregate.priceBand}`;
  }

  protected trackSnapshot(_: number, snapshot: PricingIntelligenceSnapshotResponse): string {
    return `${snapshot.quoteId}:${snapshot.quoteRevision}:${snapshot.createdAt}`;
  }

  protected trackOutcome(_: number, outcome: PricingIntelligenceOutcomeResponse): string {
    return `${outcome.quoteId}:${outcome.outcomeType}:${outcome.createdAt}`;
  }

  protected trackCorrection(_: number, correction: PricingIntelligenceCorrectionResponse): string {
    return `${correction.quoteId}:${correction.fieldName}:${correction.createdAt}`;
  }

  private buildQuery(serviceType: string, postcodePrefix: string): { serviceType: string; postcodePrefix?: string } {
    return {
      serviceType,
      ...(postcodePrefix ? { postcodePrefix } : {}),
    };
  }

  private loadReport(serviceType: string, postcodePrefix: string): void {
    this.loading.set(true);
    this.error.set(null);

    forkJoin({
      summary: this.quotesService.getPricingIntelligenceSummary(this.buildQuery(serviceType, postcodePrefix)),
      records: this.quotesService.getPricingIntelligenceRecords(this.buildQuery(serviceType, postcodePrefix)),
    }).subscribe({
      next: result => {
        this.summary.set(result.summary);
        this.records.set(result.records);
        this.loading.set(false);
      },
      error: error => {
        this.summary.set(null);
        this.records.set(null);
        this.error.set(
          extractErrorMessage(error, 'Unable to load pricing intelligence.', {
            allowErrorMessage: true,
            allowMessageField: true,
          }),
        );
        this.loading.set(false);
      },
    });
  }
}