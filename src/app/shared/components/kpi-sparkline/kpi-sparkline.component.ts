import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, effect, input, viewChild } from '@angular/core';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'shared-kpi-sparkline',
  templateUrl: './kpi-sparkline.component.html',
  styleUrl: './kpi-sparkline.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KpiSparklineComponent implements OnDestroy {
  points = input<number[]>([]);
  isLoading = input(false);

  protected readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('canvasRef');

  private chart: Chart | null = null;

  constructor() {
    effect(() => {
      const canvas = this.canvasRef()?.nativeElement;
      const loading = this.isLoading();
      const points = this.points();

      if (!canvas || loading || points.length < 2) {
        this.destroyChart();
        return;
      }

      this.renderChart(canvas, points);
    });
  }

  ngOnDestroy(): void {
    this.destroyChart();
  }

  private renderChart(canvas: HTMLCanvasElement, points: number[]): void {
    this.destroyChart();
    const sparklineColor = this.themeColor('--color-blue-600');

    this.chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: points.map((_, index) => `${index + 1}`),
        datasets: [
          {
            data: points,
            borderColor: sparklineColor,
            borderWidth: 1.5,
            pointRadius: 0,
            pointHoverRadius: 0,
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
          legend: { display: false },
          tooltip: { enabled: false },
        },
        elements: {
          line: { capBezierPoints: true },
        },
        scales: {
          x: { display: false },
          y: { display: false },
        },
      },
    });
  }

  private destroyChart(): void {
    if (!this.chart) {
      return;
    }

    this.chart.destroy();
    this.chart = null;
  }

  private themeColor(variableName: string): string {
    if (typeof document === 'undefined') {
      return 'currentColor';
    }

    const value = getComputedStyle(document.documentElement).getPropertyValue(variableName).trim();
    return value || 'currentColor';
  }
}
