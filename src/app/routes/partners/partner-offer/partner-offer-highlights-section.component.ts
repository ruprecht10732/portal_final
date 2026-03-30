import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-partner-offer-highlights-section',
  imports: [TranslatePipe],
  template: `
    @if (layout() === 'mobile') {
      <div class="mx-5 mt-4 grid gap-4">
        <div class="rounded-2xl bg-white p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)]">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">{{ 'partners.offer.highlightsTitle' | translate }}</p>
              <h3 class="mt-2 text-base font-extrabold text-slate-900">{{ 'partners.offer.workItemsTitle' | translate }}</h3>
            </div>
          </div>
          <div class="mt-4 space-y-3">
            @for (item of workItems(); track item) {
              <div class="rounded-2xl bg-slate-50 px-4 py-3">
                <p class="text-sm font-semibold leading-6 text-slate-800">{{ item }}</p>
              </div>
            }
          </div>
        </div>

        @if (attentionPoints().length > 0) {
          <div class="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.05)]">
            <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-700">{{ 'partners.offer.attentionTitle' | translate }}</p>
            <div class="mt-4 space-y-3">
              @for (point of attentionPoints(); track point) {
                <div class="flex gap-3 rounded-2xl bg-white/80 px-4 py-3">
                  <span class="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-amber-500"></span>
                  <p class="text-sm leading-6 text-amber-950">{{ point }}</p>
                </div>
              }
            </div>
          </div>
        }
      </div>
    } @else {
      <div class="mb-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div class="rounded-xl bg-white p-6 shadow-sm">
          <div class="border-b border-zinc-100 pb-4">
            <p class="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{{ 'partners.offer.highlightsTitle' | translate }}</p>
            <h2 class="mt-2 text-lg font-semibold text-zinc-900">{{ 'partners.offer.workItemsTitle' | translate }}</h2>
            <p class="mt-1 text-sm text-zinc-500">{{ 'partners.offer.workItemsBody' | translate }}</p>
          </div>
          <div class="mt-4 grid gap-3">
            @for (item of workItems(); track item) {
              <div class="rounded-2xl bg-slate-50 px-4 py-4">
                <p class="text-sm font-semibold leading-6 text-slate-900">{{ item }}</p>
              </div>
            }
          </div>
        </div>

        @if (attentionPoints().length > 0) {
          <div class="rounded-xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
            <div class="border-b border-amber-200 pb-4">
              <p class="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">{{ 'partners.offer.attentionTitle' | translate }}</p>
              <h2 class="mt-2 text-lg font-semibold text-amber-950">{{ 'partners.offer.attentionHeading' | translate }}</h2>
              <p class="mt-1 text-sm text-amber-800/80">{{ 'partners.offer.attentionBody' | translate }}</p>
            </div>
            <div class="mt-4 space-y-3">
              @for (point of attentionPoints(); track point) {
                <div class="flex gap-3 rounded-2xl bg-white/75 px-4 py-4">
                  <span class="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-amber-500"></span>
                  <p class="text-sm leading-6 text-amber-950">{{ point }}</p>
                </div>
              }
            </div>
          </div>
        }
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartnerOfferHighlightsSectionComponent {
  readonly layout = input<'mobile' | 'desktop'>('desktop');
  readonly workItems = input.required<readonly string[]>();
  readonly attentionPoints = input<readonly string[]>([]);
}