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
        <div class="grid grid-cols-2 gap-3">
          <div class="col-span-2 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
            <p class="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700">{{ 'partners.offer.practicalJobLabel' | translate }}</p>
            <p class="mt-2 text-sm font-semibold leading-6 text-zinc-900">{{ jobSummary() }}</p>
          </div>

          <div class="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <p class="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">{{ 'partners.offer.details.location' | translate }}</p>
            <p class="mt-2 text-sm font-semibold leading-6 text-zinc-900">{{ locationLabel() }}</p>
          </div>

          <div class="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <p class="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">{{ 'partners.offer.details.fee' | translate }}</p>
            <p class="mt-2 text-lg font-black text-emerald-600">{{ priceDisplay() }}</p>
          </div>

          <div class="rounded-2xl border border-zinc-200 bg-white p-4">
            <p class="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">{{ 'partners.offer.details.source' | translate }}</p>
            <p class="mt-2 text-sm font-semibold text-zinc-900">
              {{ pricingSource() === 'quote'
                ? ('partners.offer.pricingSource.quote' | translate)
                : ('partners.offer.pricingSource.estimate' | translate) }}
            </p>
          </div>

          @if (inspectionRequirementKey()) {
            <div class="rounded-2xl border border-zinc-200 bg-white p-4">
              <p class="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">{{ 'partners.offer.details.inspection' | translate }}</p>
              <p class="mt-2 text-sm font-semibold leading-6 text-zinc-900">{{ inspectionRequirementKey() | translate }}</p>
            </div>
          }
        </div>
      </div>
    } @else {
      <div class="rounded-xl bg-white p-6 shadow-sm">
        <div class="border-b border-zinc-100 pb-4">
          <h2 class="text-lg font-semibold text-zinc-900">{{ 'partners.offer.practicalTitle' | translate }}</h2>
          <p class="mt-1 text-sm text-zinc-500">{{ 'partners.offer.practicalBody' | translate }}</p>
        </div>
        <div class="mt-5 grid gap-4 sm:grid-cols-2">
          <div class="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-5 sm:col-span-2">
            <p class="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700">{{ 'partners.offer.practicalJobLabel' | translate }}</p>
            <p class="mt-2 text-base font-semibold leading-7 text-zinc-900">{{ jobSummary() }}</p>
          </div>

          <div class="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
            <p class="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">{{ 'partners.offer.details.location' | translate }}</p>
            <p class="mt-2 text-sm font-semibold leading-6 text-zinc-900">{{ locationLabel() }}</p>
          </div>

          <div class="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
            <p class="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">{{ 'partners.offer.details.fee' | translate }}</p>
            <p class="mt-2 text-2xl font-black text-emerald-600">{{ priceDisplay() }}</p>
          </div>

          <div class="rounded-2xl border border-zinc-200 bg-white p-5">
            <p class="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">{{ 'partners.offer.details.source' | translate }}</p>
            <p class="mt-2 text-sm font-semibold text-zinc-900">
              {{ pricingSource() === 'quote'
                ? ('partners.offer.pricingSource.quote' | translate)
                : ('partners.offer.pricingSource.estimate' | translate) }}
            </p>
          </div>

          @if (inspectionRequirementKey()) {
            <div class="rounded-2xl border border-zinc-200 bg-white p-5">
              <p class="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">{{ 'partners.offer.details.inspection' | translate }}</p>
              <p class="mt-2 text-sm font-semibold leading-6 text-zinc-900">{{ inspectionRequirementKey() | translate }}</p>
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