import { AfterViewInit, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, OnDestroy, signal, viewChild, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import * as L from 'leaflet';
import { DashboardHeatmapService } from '../../../../core/services/dashboard-heatmap.service';
import type { LeadHeatmapPoint } from '../../../../core/services/dashboard.types';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { InputComponent } from '../../../../shared/components/input/input.component';

@Component({
  selector: 'app-dashboard-lead-heatmap',
  templateUrl: './lead-heatmap.component.html',
  styleUrl: './lead-heatmap.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [InputComponent, ButtonComponent, TranslatePipe],
})
export class LeadHeatmapComponent implements AfterViewInit, OnDestroy {
  private readonly heatmapService = inject(DashboardHeatmapService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly startDate = signal('');
  protected readonly endDate = signal('');
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly points = signal<LeadHeatmapPoint[]>([]);
  protected readonly dateRangeInvalid = computed(() => {
    const startDate = this.startDate();
    const endDate = this.endDate();
    if (!startDate || !endDate) return false;
    return startDate > endDate;
  });
  protected readonly canApply = computed(() => !this.loading() && !this.dateRangeInvalid());

  protected readonly mapContainer = viewChild<ElementRef<HTMLDivElement>>('mapContainer');

  private map: L.Map | null = null;
  private heatLayer: L.HeatLayer | null = null;
  private heatPluginLoaded = false;
  private resizeHandler: (() => void) | null = null;

  ngAfterViewInit(): void {
    this.initMap();
    this.loadHeatmap();
  }

  ngOnDestroy(): void {
    if (this.resizeHandler && globalThis.window) {
      globalThis.window.removeEventListener('resize', this.resizeHandler);
    }
    this.heatLayer?.remove();
    this.map?.remove();
    this.heatLayer = null;
    this.map = null;
    this.resizeHandler = null;
  }

  protected applyFilter(): void {
    if (this.dateRangeInvalid()) {
      this.error.set('dashboard.heatmap.dateError');
      return;
    }
    this.loadHeatmap();
  }

  protected clearFilter(): void {
    this.startDate.set('');
    this.endDate.set('');
    this.error.set(null);
    this.loadHeatmap();
  }

  private initMap(): void {
    const container = this.mapContainer()?.nativeElement;
    if (!container) return;

    this.map = L.map(container, {
      center: [52.1326, 5.2913],
      zoom: 7,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(this.map);

    setTimeout(() => this.map?.invalidateSize(), 0);

    if (globalThis.window) {
      this.resizeHandler = () => this.map?.invalidateSize();
      globalThis.window.addEventListener('resize', this.resizeHandler);
    }
  }

  private loadHeatmap(): void {
    this.loading.set(true);
    this.error.set(null);

    const startDate = this.startDate() || undefined;
    const endDate = this.endDate() || undefined;

    this.heatmapService
      .getHeatmap(startDate, endDate)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.points.set(response.points ?? []);
          this.loading.set(false);
          this.updateHeatLayer();
        },
        error: () => {
          this.error.set('dashboard.heatmap.error');
          this.loading.set(false);
        },
      });
  }

  private updateHeatLayer(): void {
    void this.updateHeatLayerAsync();
  }

  private async updateHeatLayerAsync(): Promise<void> {
    if (this.map === null) return;

    const container = this.mapContainer()?.nativeElement;
    if (!container || container.clientWidth === 0 || container.clientHeight === 0) {
      // Container not yet laid out — retry after a short delay
      setTimeout(() => this.updateHeatLayer(), 100);
      return;
    }

    if (!this.heatPluginLoaded) {
      (globalThis as { L?: typeof L }).L = L;
      await import('leaflet.heat');
      this.heatPluginLoaded = true;
    }

    this.map.invalidateSize();

    const points = this.points();
    const heatData: [number, number, number][] = points.map(point => [point.latitude, point.longitude, 0.7]);
    const heatGradient: Record<number, string> = {
      0.2: this.themeColor('--color-cyan-400'),
      0.45: this.themeColor('--color-blue-500'),
      0.7: this.themeColor('--color-indigo-500'),
      1: this.themeColor('--color-red-500'),
    };
    const heatLayerOptions = {
      radius: 25,
      blur: 18,
      maxZoom: 12,
      minOpacity: 0.35,
      gradient: heatGradient,
    } as L.HeatLayerOptions & { gradient: Record<number, string> };

    if (this.heatLayer === null) {
      this.heatLayer = L.heatLayer(heatData, heatLayerOptions).addTo(this.map);
    } else {
      this.heatLayer.remove();
      this.heatLayer = L.heatLayer(heatData, heatLayerOptions).addTo(this.map);
    }

    if (points.length > 0) {
      const bounds = L.latLngBounds(points.map(point => [point.latitude, point.longitude] as [number, number]));
      this.map.fitBounds(bounds, { padding: [24, 24], maxZoom: 12 });
    }
  }

  private themeColor(variableName: string): string {
    if (typeof document === 'undefined') {
      return 'currentColor';
    }

    const value = getComputedStyle(document.documentElement).getPropertyValue(variableName).trim();
    return value || 'currentColor';
  }
}
