import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule } from '@ngx-translate/core';
import { DashboardMetricsService } from '../../../../core/services/dashboard-metrics.service';
import type { DashboardMetricsResponse } from '../../../../core/services/dashboard.types';
import { KpiCardComponent } from '../../../../shared/components/kpi-card/kpi-card.component';

interface KpiCardViewModel {
  id: 'totalLeads' | 'projectedValue' | 'disqualifiedRate' | 'touchpointsPerLead';
  labelKey: string;
  value: string;
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
        id: 'totalLeads',
        labelKey: 'dashboard.kpis.totalLeads',
        value: loading ? '' : this.formatNumber(metrics?.totalLeads ?? 0, hasError),
        hintKey: hasError ? 'dashboard.kpis.unavailable' : '',
        isLoading: loading,
      },
      {
        id: 'projectedValue',
        labelKey: 'dashboard.kpis.projectedValue',
        value: loading ? '' : this.formatCurrency(metrics?.projectedValueCents ?? 0, hasError),
        hintKey: hasError ? 'dashboard.kpis.unavailable' : '',
        isLoading: loading,
      },
      {
        id: 'disqualifiedRate',
        labelKey: 'dashboard.kpis.disqualifiedRate',
        value: loading ? '' : this.formatPercent(metrics?.disqualifiedRate ?? 0, hasError),
        hintKey: hasError ? 'dashboard.kpis.unavailable' : 'dashboard.kpis.disqualifiedHint',
        isLoading: loading,
      },
      {
        id: 'touchpointsPerLead',
        labelKey: 'dashboard.kpis.touchpointsPerLead',
        value: loading ? '' : this.formatNumber(metrics?.touchpointsPerLead ?? 0, hasError),
        hintKey: hasError ? 'dashboard.kpis.unavailable' : 'dashboard.kpis.touchpointsHint',
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
}
