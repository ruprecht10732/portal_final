import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { MapPreviewComponent } from '../../../shared/components/map-preview/map-preview.component';

@Component({
  selector: 'app-partner-offer-location-card',
  imports: [TranslatePipe, MapPreviewComponent],
  template: `
    @if (layout() === 'mobile') {
      <div class="flex items-center justify-between px-5 py-4 mt-2">
        <h3 class="text-xs font-extrabold uppercase tracking-[0.15em] text-slate-400">{{ 'partners.offer.locationTitle' | translate }}</h3>
        <span class="text-xs font-semibold text-zinc-500">{{ locationLabel() }}</span>
      </div>
      <div class="mx-5 overflow-hidden rounded-2xl bg-white shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)]">
        <div class="relative">
          <shared-map-preview [address]="mapQuery()" [height]="190" />
          <a
            class="absolute bottom-3 right-3 inline-flex items-center rounded-full bg-white/95 px-4 py-2 text-xs font-bold text-zinc-900 shadow-lg ring-1 ring-black/5 transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
            [href]="mapsHref()"
            target="_blank"
            rel="noopener noreferrer"
          >
            {{ 'partners.offer.locationAction' | translate }}
          </a>
        </div>
        <div class="px-4 py-4">
          <p class="text-sm font-semibold text-zinc-900">{{ locationLabel() }}</p>
          <p class="mt-1 text-[11px] leading-5 text-zinc-500">{{ 'partners.offer.locationHint' | translate }}</p>
        </div>
      </div>
    } @else {
      <div class="overflow-hidden rounded-xl bg-white shadow-sm">
        <div class="border-b border-zinc-100 px-6 py-4">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold text-zinc-900">{{ 'partners.offer.locationTitle' | translate }}</h2>
            <span class="text-xs font-semibold text-zinc-500">{{ locationLabel() }}</span>
          </div>
          <p class="mt-1 text-sm text-zinc-500">{{ 'partners.offer.locationBody' | translate }}</p>
        </div>
        <div class="relative">
          <shared-map-preview [address]="mapQuery()" [height]="220" />
          <a
            class="absolute bottom-4 right-4 inline-flex items-center rounded-full bg-white/95 px-4 py-2 text-sm font-bold text-zinc-900 shadow-lg ring-1 ring-black/5 transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
            [href]="mapsHref()"
            target="_blank"
            rel="noopener noreferrer"
          >
            {{ 'partners.offer.locationAction' | translate }}
          </a>
        </div>
        <div class="px-6 py-4">
          <p class="text-sm font-semibold text-zinc-900">{{ locationLabel() }}</p>
          <p class="mt-1 text-xs leading-5 text-zinc-500">{{ 'partners.offer.locationHint' | translate }}</p>
        </div>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartnerOfferLocationCardComponent {
  readonly layout = input<'mobile' | 'desktop'>('desktop');
  readonly locationLabel = input.required<string>();
  readonly mapQuery = input.required<string>();

  protected mapsHref(): string {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(this.mapQuery())}`;
  }
}