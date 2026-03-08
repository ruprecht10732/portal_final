import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { TranslatePipe } from '@ngx-translate/core';
import { catchError, distinctUntilChanged, map, of, switchMap, tap } from 'rxjs';

import { QuotesService } from '../../../core/services/quotes.service';
import {
  centsToEuros,
  derivePostcodePrefixZip4,
  type PricingIntelligenceAggregateResponse,
  type PricingIntelligenceSummaryResponse,
} from '../../../core/services/quotes.types';
import { extractErrorMessage } from '../../../core/utils/error-utils';
import { ButtonComponent } from '../../../shared/components/button/button.component';

@Component({
  selector: 'app-quote-pricing-intelligence-panel',
  standalone: true,
  imports: [TranslatePipe, LucideAngularModule, ButtonComponent],
  templateUrl: './quote-pricing-intelligence-panel.component.html',
  styleUrl: './quote-pricing-intelligence-panel.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuotePricingIntelligencePanelComponent {
  serviceType = input<string | null>(null);
  postcodePrefix = input<string | null>(null);

  private readonly quotesService = inject(QuotesService);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly summary = signal<PricingIntelligenceSummaryResponse | null>(null);

  protected readonly requestParams = computed(() => {
    const serviceType = this.serviceType()?.trim() ?? '';
    const postcodePrefix = derivePostcodePrefixZip4(this.postcodePrefix());
    return {
      serviceType,
      postcodePrefix: postcodePrefix || undefined,
    };
  });

  protected readonly canInspect = computed(() => this.requestParams().serviceType.length > 0);
  protected readonly hasRegionContext = computed(() => !!this.requestParams().postcodePrefix);
  protected readonly activeRegionPrefix = computed(() => this.requestParams().postcodePrefix ?? '');
  protected readonly visibleAggregates = computed(() => {
    const aggregates = [...(this.summary()?.aggregates ?? [])];
    aggregates.sort(
      (left: PricingIntelligenceAggregateResponse, right: PricingIntelligenceAggregateResponse) =>
        right.sampleCount - left.sampleCount || right.conversionRate - left.conversionRate,
    );
    return aggregates.slice(0, 3);
  });
  protected readonly totalSamples = computed(() =>
    (this.summary()?.aggregates ?? []).reduce((sum, aggregate) => sum + aggregate.sampleCount, 0),
  );
  protected readonly weightedConversionRate = computed(() => {
    const aggregates = this.summary()?.aggregates ?? [];
    const totalSamples = this.totalSamples();
    if (totalSamples === 0) {
      return 0;
    }

    const accepted = aggregates.reduce((sum, aggregate) => sum + aggregate.acceptedCount, 0);
    return accepted / totalSamples;
  });
  protected readonly averageQuotedCents = computed(() => {
    const aggregates = this.summary()?.aggregates ?? [];
    const totalSamples = this.totalSamples();
    if (totalSamples === 0) {
      return 0;
    }

    const weightedTotal = aggregates.reduce((sum, aggregate) => sum + aggregate.averageQuotedCents * aggregate.sampleCount, 0);
    return Math.round(weightedTotal / totalSamples);
  });

  constructor() {
    toObservable(this.requestParams)
      .pipe(
        map(params => ({
          serviceType: params.serviceType,
          postcodePrefix: params.postcodePrefix,
        })),
        distinctUntilChanged(
          (left, right) =>
            left.serviceType === right.serviceType && left.postcodePrefix === right.postcodePrefix,
        ),
        tap(params => {
          this.error.set(null);
          if (!params.serviceType) {
            this.summary.set(null);
            this.loading.set(false);
            return;
          }
          this.loading.set(true);
        }),
        switchMap(params => {
          if (!params.serviceType) {
            return of<PricingIntelligenceSummaryResponse | null>(null);
          }

          return this.quotesService.getPricingIntelligenceSummary(
            this.buildQuery(params.serviceType, params.postcodePrefix),
          ).pipe(
            map(summary => summary),
            catchError(error => {
              this.error.set(
                extractErrorMessage(error, 'Unable to load pricing intelligence.', {
                  allowErrorMessage: true,
                  allowMessageField: true,
                }),
              );
              return of<PricingIntelligenceSummaryResponse | null>(null);
            }),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe(summary => {
        this.summary.set(summary);
        this.loading.set(false);
      });
  }

  protected openInspector(): void {
    const params = this.requestParams();
    if (!params.serviceType) {
      return;
    }

    this.router.navigate(['/app/offertes/pricing-intelligence'], {
      queryParams: {
        serviceType: params.serviceType,
        postcodePrefix: params.postcodePrefix ?? null,
      },
    });
  }

  protected formatCurrency(cents: number): string {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
    }).format(centsToEuros(cents));
  }

  protected formatPercent(value: number): string {
    return new Intl.NumberFormat('nl-NL', {
      style: 'percent',
      maximumFractionDigits: 1,
    }).format(value);
  }

  protected trackAggregate(_: number, aggregate: PricingIntelligenceAggregateResponse): string {
    return `${aggregate.regionPrefix}:${aggregate.priceBand}`;
  }

  private buildQuery(serviceType: string, postcodePrefix?: string): { serviceType: string; postcodePrefix?: string } {
    return {
      serviceType,
      ...(postcodePrefix ? { postcodePrefix } : {}),
    };
  }
}