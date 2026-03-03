import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule } from '@ngx-translate/core';
import { DashboardMetricsService } from '../../../../core/services/dashboard-metrics.service';
import type { DashboardMetricsResponse } from '../../../../core/services/dashboard.types';
import { KpiCardComponent } from '../../../../shared/components/kpi-card/kpi-card.component';

interface KpiCardViewModel {
  id: 'activeLeads' | 'quotePipeline' | 'conversionRate' | 'avgQuoteValue';
  labelKey: string;
  value: string;
  trend: number[];
  hintKey: string;
  isLoading: boolean;
}

@Component({
  selector: 'app-dashboard-kpi-row',
  imports: [KpiCardComponent, TranslateModule],
  templateUrl: './dashboard-kpi-row.component.html',
  styleUrl: './dashboard-kpi-row.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardKpiRowComponent {
  private readonly metricsService = inject(DashboardMetricsService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly metrics = signal<DashboardMetricsResponse | null>(null);
  private readonly isLoading = signal(true);
  private readonly hasError = signal(false);

  private readonly currencyFormatter = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  });
  private readonly numberFormatter = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 1,
  });
  private readonly percentFormatter = new Intl.NumberFormat(undefined, {
    style: 'percent',
    maximumFractionDigits: 1,
  });

  protected readonly cards = computed<KpiCardViewModel[]>(() => {
    const loading = this.isLoading();
    const metrics = this.metrics();
    const hasError = this.hasError();

    return [
      {
        id: 'activeLeads',
        labelKey: 'dashboard.kpis.activeLeads',
        value: loading ? '' : this.formatNumber(metrics?.activeLeads ?? 0, hasError),
        trend: loading ? [] : this.resolveTrend(metrics?.activeLeadsTrend, metrics?.activeLeads ?? 0),
        hintKey: hasError ? 'dashboard.kpis.unavailable' : 'dashboard.kpis.activeLeadsHint',
        isLoading: loading,
      },
      {
        id: 'quotePipeline',
        labelKey: 'dashboard.kpis.quotePipeline',
        value: loading ? '' : this.formatCurrency(metrics?.quotePipelineCents ?? 0, hasError),
        trend: loading ? [] : this.resolveTrend(
          metrics?.quotePipelineTrendCents?.map(value => value / 100),
          (metrics?.quotePipelineCents ?? 0) / 100,
        ),
        hintKey: hasError ? 'dashboard.kpis.unavailable' : 'dashboard.kpis.quotePipelineHint',
        isLoading: loading,
      },
      {
        id: 'conversionRate',
        labelKey: 'dashboard.kpis.conversionRate',
        value: loading ? '' : this.formatPercent(metrics?.conversionRate ?? 0, hasError),
        trend: loading ? [] : this.resolveTrend(metrics?.conversionRateTrend, metrics?.conversionRate ?? 0),
        hintKey: hasError ? 'dashboard.kpis.unavailable' : 'dashboard.kpis.conversionRateHint',
        isLoading: loading,
      },
      {
        id: 'avgQuoteValue',
        labelKey: 'dashboard.kpis.avgQuoteValue',
        value: loading ? '' : this.formatCurrency(metrics?.avgQuoteValueCents ?? 0, hasError),
        trend: loading ? [] : this.resolveTrend(
          metrics?.avgQuoteValueTrendCents?.map(value => value / 100),
          (metrics?.avgQuoteValueCents ?? 0) / 100,
        ),
        hintKey: hasError ? 'dashboard.kpis.unavailable' : 'dashboard.kpis.avgQuoteValueHint',
        isLoading: loading,
      },
    ];
  });

  constructor() {
    this.metricsService
      .getMetrics()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (metrics) => {
          this.metrics.set(metrics);
          this.hasError.set(false);
          this.isLoading.set(false);
        },
        error: () => {
          this.hasError.set(true);
          this.isLoading.set(false);
        },
      });
  }

  private formatCurrency(valueCents: number, hasError: boolean): string {
    if (hasError) {
      return '—';
    }
    return this.currencyFormatter.format(valueCents / 100);
  }

  private formatNumber(value: number, hasError: boolean): string {
    if (hasError) {
      return '—';
    }
    return this.numberFormatter.format(value);
  }

  private formatPercent(valuePercent: number, hasError: boolean): string {
    if (hasError) {
      return '—';
    }
    return this.percentFormatter.format(valuePercent / 100);
  }

  private resolveTrend(trend: number[] | undefined, currentValue: number): number[] {
    if (Array.isArray(trend) && trend.length >= 2) {
      return trend;
    }

    return [currentValue, currentValue, currentValue, currentValue, currentValue, currentValue];
  }
}
