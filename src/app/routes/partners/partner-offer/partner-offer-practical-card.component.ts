import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-partner-offer-practical-card',
  imports: [TranslatePipe],
  template: `
    @if (layout() === 'mobile') {
      <div class="flex items-center justify-between px-5 py-4 mt-2">
        <h3 class="text-xs font-extrabold uppercase tracking-[0.15em] text-slate-400">{{ 'partners.offer.practicalTitle' | translate }}</h3>
      </div>
      <div class="mx-5 rounded-2xl bg-white p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)]">
        <div class="space-y-3 text-sm">
          <div class="flex items-center justify-between">
            <span class="text-zinc-500">{{ 'partners.offer.details.job' | translate }}</span>
            <span class="max-w-[60%] text-right font-semibold text-zinc-900">{{ jobSummary() }}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-zinc-500">{{ 'partners.offer.details.location' | translate }}</span>
            <span class="font-semibold text-zinc-900">{{ locationLabel() }}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-zinc-500">{{ 'partners.offer.details.source' | translate }}</span>
            <span class="font-semibold text-zinc-900">
              {{ pricingSource() === 'quote'
                ? ('partners.offer.pricingSource.quote' | translate)
                : ('partners.offer.pricingSource.estimate' | translate) }}
            </span>
          </div>
          @if (inspectionRequirementKey()) {
            <div class="flex items-center justify-between">
              <span class="text-zinc-500">{{ 'partners.offer.details.inspection' | translate }}</span>
              <span class="max-w-[60%] text-right font-semibold text-zinc-900">{{ inspectionRequirementKey() | translate }}</span>
            </div>
          }
        </div>
      </div>
    } @else {
      <div class="rounded-xl bg-white p-6 shadow-sm">
        <div class="border-b border-zinc-100 pb-4">
          <h2 class="text-lg font-semibold text-zinc-900">{{ 'partners.offer.practicalTitle' | translate }}</h2>
        </div>
        <div class="mt-4 space-y-4 text-sm text-zinc-700">
          <div class="flex items-center justify-between">
            <span class="text-zinc-500">{{ 'partners.offer.details.job' | translate }}</span>
            <span class="max-w-[60%] text-right font-semibold text-zinc-900">{{ jobSummary() }}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-zinc-500">{{ 'partners.offer.details.location' | translate }}</span>
            <span class="font-semibold text-zinc-900">{{ locationLabel() }}</span>
          </div>
          <div class="flex items-center justify-between border-t border-zinc-100 pt-4">
            <span class="text-zinc-500">{{ 'partners.offer.details.fee' | translate }}</span>
            <span class="text-xl font-bold text-emerald-600">{{ priceDisplay() }}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-zinc-500">{{ 'partners.offer.details.source' | translate }}</span>
            <span class="font-semibold text-zinc-900">
              {{ pricingSource() === 'quote'
                ? ('partners.offer.pricingSource.quote' | translate)
                : ('partners.offer.pricingSource.estimate' | translate) }}
            </span>
          </div>
          @if (inspectionRequirementKey()) {
            <div class="flex items-center justify-between">
              <span class="text-zinc-500">{{ 'partners.offer.details.inspection' | translate }}</span>
              <span class="max-w-[60%] text-right font-semibold text-zinc-900">{{ inspectionRequirementKey() | translate }}</span>
            </div>
          }
        </div>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartnerOfferPracticalCardComponent {
  readonly layout = input<'mobile' | 'desktop'>('desktop');
  readonly jobSummary = input.required<string>();
  readonly locationLabel = input.required<string>();
  readonly priceDisplay = input.required<string>();
  readonly pricingSource = input.required<'quote' | 'estimate'>();
  readonly inspectionRequirementKey = input<string>('');
}