import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, type SafeResourceUrl } from '@angular/platform-browser';
import { ErrorReportingService } from '../../../core/services/error-reporting.service';

interface NominatimResult {
  lat: string;
  lon: string;
}

@Component({
  selector: 'shared-map-preview',
  templateUrl: './map-preview.component.html',
  styleUrl: './map-preview.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapPreviewComponent {
  private readonly http = inject(HttpClient);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly reporter = inject(ErrorReportingService);

  address = input<string>('');
  height = input(180);
  zoom = input(16);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly coords = signal<{ lat: number; lon: number } | null>(null);
  private readonly lastQuery = signal('');

  protected readonly iframeSrc = computed<SafeResourceUrl | null>(() => {
    const coords = this.coords();
    if (!coords) return null;
    const delta = 0.005;
    const bbox = `${coords.lon - delta},${coords.lat - delta},${coords.lon + delta},${coords.lat + delta}`;
    const url = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${coords.lat},${coords.lon}`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  });

  constructor() {
    effect(() => {
      const address = this.address().trim();
      if (!address) {
        this.coords.set(null);
        this.error.set('Missing address');
        return;
      }
      if (address === this.lastQuery()) return;

      this.lastQuery.set(address);
      this.loading.set(true);
      this.error.set(null);

      this.http
        .get<NominatimResult[]>('https://nominatim.openstreetmap.org/search', {
          params: {
            format: 'json',
            q: address,
            limit: '1',
          },
        })
        .subscribe({
          next: results => {
            if (results.length) {
              const lat = Number(results[0].lat);
              const lon = Number(results[0].lon);
              if (Number.isFinite(lat) && Number.isFinite(lon)) {
                this.coords.set({ lat, lon });
                this.error.set(null);
              } else {
                this.coords.set(null);
                this.error.set('Map preview unavailable');
              }
            } else {
              this.coords.set(null);
              this.error.set('Map preview unavailable');
            }
            this.loading.set(false);
          },
          error: (err) => {
            this.coords.set(null);
            this.error.set('Map preview unavailable');
            this.loading.set(false);
            this.reporter.report(err, {
              source: 'http',
              userMessage: 'Map preview unavailable',
            });
          },
        });
    });
  }
}
