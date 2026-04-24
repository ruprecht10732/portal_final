import { DecimalPipe } from '@angular/common';
import { AfterViewInit, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnDestroy, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Chart, registerables } from 'chart.js';
import { DashboardMetricsService } from '../../../../core/services/dashboard-metrics.service';
import type { DashboardMetricsResponse } from '../../../../core/services/dashboard.types';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { themeColor } from '../../dashboard.utils';

Chart.register(...registerables);

@Component({
  selector: 'app-dashboard-pipeline-overview',
  imports: [ButtonComponent, TranslatePipe, DecimalPipe],
  templateUrl: './pipeline-overview.component.html',
  styleUrl: './pipeline-overview.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PipelineOverviewComponent implements AfterViewInit, OnDestroy {
  private readonly metricsService = inject(DashboardMetricsService);
  private readonly translateService = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly metrics = signal<DashboardMetricsResponse | null>(null);

  protected readonly conversionRate = computed(() => this.metrics()?.conversionRate ?? 0);

  protected readonly chartCanvas = viewChild<ElementRef<HTMLCanvasElement>>('chartCanvas');

  private chart: Chart | null = null;

  ngAfterViewInit(): void {
    this.loadMetrics();
  }

  ngOnDestroy(): void {
    this.destroyChart();
  }

  protected retry(): void {
    this.loadMetrics();
  }

  private loadMetrics(): void {
    this.loading.set(true);
    this.error.set(null);

    this.metricsService
      .getMetrics()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (metrics) => {
          this.metrics.set(metrics);
          this.loading.set(false);
          setTimeout(() => this.renderChart(metrics), 0);
        },
        error: () => {
          this.error.set('dashboard.pipeline.error');
          this.loading.set(false);
          this.destroyChart();
        },
      });
  }

  private renderChart(metrics: DashboardMetricsResponse): void {
    const canvas = this.chartCanvas()?.nativeElement;
    if (!canvas) {
      return;
    }

    if (canvas.clientWidth === 0 || canvas.clientHeight === 0) {
      setTimeout(() => this.renderChart(metrics), 50);
      return;
    }

    this.destroyChart();

    const quotePipelineTrend = this.toEuroTrend(metrics.quotePipelineTrendCents, metrics.quotePipelineCents);
    const avgQuoteValueTrend = this.toEuroTrend(metrics.avgQuoteValueTrendCents, metrics.avgQuoteValueCents);
    const trendLength = Math.max(quotePipelineTrend.length, avgQuoteValueTrend.length);
    const labels = Array.from({ length: trendLength }, (_, index) => `${index + 1}`);
    const allValues = [...quotePipelineTrend, ...avgQuoteValueTrend];
    const maxValue = Math.max(...allValues, 0);
    const minValue = Math.min(...allValues, 0);
    const sameValue = maxValue === minValue;

    const yMin = sameValue ? Math.max(0, minValue - Math.max(1, Math.round(maxValue * 0.1))) : Math.max(0, Math.floor(minValue * 0.9));
    const yMax = sameValue ? maxValue + Math.max(1, Math.round((maxValue || 1) * 0.2)) : Math.ceil(maxValue * 1.15);
    const pipelineColor = themeColor('--color-blue-600');
    const avgValueColor = themeColor('--color-emerald-500');
    const axisTextColor = themeColor('--color-zinc-700');
    const subtleGridColor = themeColor('--color-zinc-200');
    const mediumGridColor = themeColor('--color-zinc-300');

    this.chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: this.translateService.instant('dashboard.pipeline.quotePipeline'),
            data: quotePipelineTrend,
            borderColor: pipelineColor,
            backgroundColor: pipelineColor,
            borderWidth: 2,
            pointRadius: 2,
            pointHoverRadius: 3,
            tension: 0.35,
            fill: false,
          },
          {
            label: this.translateService.instant('dashboard.pipeline.avgQuoteValue'),
            data: avgQuoteValueTrend,
            borderColor: avgValueColor,
            backgroundColor: avgValueColor,
            borderWidth: 2,
            pointRadius: 2,
            pointHoverRadius: 3,
            tension: 0.35,
            fill: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: {
              boxWidth: 10,
              boxHeight: 10,
              usePointStyle: true,
              pointStyle: 'line',
              color: axisTextColor,
            },
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const value = typeof context.parsed.y === 'number' ? context.parsed.y : 0;
                const datasetLabel = context.dataset.label ? `${context.dataset.label}: ` : '';
                const formatted = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
                return `${datasetLabel}${formatted}`;
              },
            },
          },
        },
        scales: {
          x: {
            ticks: {
              callback: (_value, index) => this.translateService.instant('dashboard.pipeline.weekShort', { week: index + 1 }),
            },
            grid: { color: subtleGridColor },
          },
          y: {
            ticks: {
              callback: (value) => new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 1 }).format(Number(value)),
            },
            grid: { color: mediumGridColor },
            min: yMin,
            max: yMax,
          },
        },
      },
    });

    setTimeout(() => this.chart?.resize(), 0);
  }

  private toEuroTrend(valuesCents: number[] | undefined, currentCents: number): number[] {
    const fallback = Math.round(currentCents / 100);

    if (Array.isArray(valuesCents) && valuesCents.length > 1) {
      const trend = valuesCents.map(value => Math.round(value / 100));
      const hasNonZero = trend.some(value => value !== 0);
      if (hasNonZero || fallback === 0) {
        return trend;
      }

      return [fallback, fallback, fallback, fallback, fallback, fallback];
    }

    return [fallback, fallback, fallback, fallback, fallback, fallback];
  }

  private destroyChart(): void {
    if (!this.chart) {
      return;
    }
    this.chart.destroy();
    this.chart = null;
  }


}
