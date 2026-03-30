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
        <shared-map-preview [address]="mapQuery()" [height]="180" />
        <p class="px-4 py-3 text-[11px] text-zinc-400">{{ 'partners.offer.locationHint' | translate }}</p>
      </div>
    } @else {
      <div class="overflow-hidden rounded-xl bg-white shadow-sm">
        <div class="border-b border-zinc-100 px-6 py-4">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold text-zinc-900">{{ 'partners.offer.locationTitle' | translate }}</h2>
            <span class="text-xs font-semibold text-zinc-500">{{ locationLabel() }}</span>
          </div>
        </div>
        <shared-map-preview [address]="mapQuery()" [height]="200" />
        <p class="px-6 py-3 text-xs text-zinc-400">{{ 'partners.offer.locationHint' | translate }}</p>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartnerOfferLocationCardComponent {
  readonly layout = input<'mobile' | 'desktop'>('desktop');
  readonly locationLabel = input.required<string>();
  readonly mapQuery = input.required<string>();
}