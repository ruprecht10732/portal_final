import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

type PartnerOfferLayout = 'mobile' | 'desktop';

type TimeRemaining = {
  hours: number;
  minutes: number;
} | null;

@Component({
  selector: 'app-partner-offer-hero-card',
  imports: [DatePipe, TranslatePipe],
  template: `
    @if (layout() === 'mobile') {
      <div class="border-b border-gray-100 bg-white px-5 pb-6 pt-6">
        <div class="overflow-hidden rounded-[28px] bg-slate-950 text-white shadow-[0_18px_40px_-18px_rgba(15,23,42,0.7)]">
          <div class="h-1.5 w-full bg-white/10">
            <div class="h-full rounded-full transition-all duration-500" [class]="deadlineProgressBarClass()" [style.width.%]="deadlineProgressPercent()"></div>
          </div>

          <div class="p-5">
            <div class="flex items-start justify-between gap-4">
              <div class="min-w-0">
                <p class="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-300">{{ 'partners.offer.snapshotTitle' | translate }}</p>
                <h1 class="mt-3 line-clamp-3 text-[1.45rem] font-extrabold leading-tight text-white">{{ summaryHeadline() }}</h1>
              </div>

              <div class="shrink-0 rounded-2xl bg-emerald-400/12 px-4 py-3 text-right ring-1 ring-emerald-300/20">
                <p class="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-100">{{ 'partners.offer.snapshotFee' | translate }}</p>
                <div class="mt-2 flex items-center justify-end gap-2 text-emerald-200">
                  <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.707a1 1 0 00-1.414-1.414L9 10.172 7.707 8.879a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
                  <span class="text-3xl font-black tracking-tight text-white">{{ priceDisplay() }}</span>
                </div>
              </div>
            </div>

            <div class="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div class="rounded-2xl bg-white/8 px-4 py-3">
                <div class="flex items-center gap-2 text-slate-300">
                  <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"/></svg>
                  <p class="text-[11px] font-bold uppercase tracking-[0.18em]">{{ 'partners.offer.details.location' | translate }}</p>
                </div>
                <p class="mt-2 text-sm font-semibold text-white">{{ locationLabel() }}</p>
              </div>

              <div class="rounded-2xl bg-white/8 px-4 py-3">
                <div class="flex items-center gap-2 text-slate-300">
                  <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10 2a1 1 0 011 1v6.382l3.447 1.724a1 1 0 11-.894 1.788l-4-2A1 1 0 019 10V3a1 1 0 011-1z"/><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM4 10a6 6 0 1112 0A6 6 0 014 10z" clip-rule="evenodd"/></svg>
                  <p class="text-[11px] font-bold uppercase tracking-[0.18em]">{{ 'partners.offer.snapshotDeadline' | translate }}</p>
                </div>
                <p class="mt-2 text-sm font-semibold text-white">
                  @if (timeRemaining(); as tr) {
                    {{ 'partners.offer.deadline.remaining' | translate: tr }}
                  } @else {
                    {{ expiresAt() | date:'d MMM, HH:mm':'':'nl-NL' }}
                  }
                </p>
                @if (urgencyDisplay()) {
                  <p class="mt-2 inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold" [class]="urgencyBadgeClass()">
                    <span class="h-2 w-2 rounded-full" [class]="urgencyDotClass()"></span>
                    {{ urgencyDisplay() }}
                  </p>
                }
              </div>

              <div class="rounded-2xl bg-white/8 px-4 py-3">
                <div class="flex items-center gap-2 text-slate-300">
                  <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clip-rule="evenodd"/></svg>
                  <p class="text-[11px] font-bold uppercase tracking-[0.18em]">{{ snapshotThirdMetricLabel() | translate }}</p>
                </div>
                <p class="mt-2 text-sm font-semibold text-white">
                  @if (inspectionRequirementKey()) {
                    {{ inspectionRequirementKey() | translate }}
                  } @else {
                    {{ snapshotThirdMetricValue() }}
                  }
                </p>
              </div>
            </div>

          </div>
        </div>
      </div>
    } @else {
      <div class="mb-8 overflow-hidden rounded-[28px] bg-white shadow-[0_16px_40px_-24px_rgba(15,23,42,0.35)] ring-1 ring-slate-200">
        <div class="h-1.5 w-full bg-slate-100">
          <div class="h-full rounded-full transition-all duration-500" [class]="deadlineProgressBarClass()" [style.width.%]="deadlineProgressPercent()"></div>
        </div>

        <div class="p-7">
          <div class="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.9fr)] xl:items-start">
            <div class="min-w-0">
              <p class="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">{{ 'partners.offer.snapshotTitle' | translate }}</p>
              <h1 class="mt-3 text-3xl font-black leading-tight tracking-tight text-slate-950">{{ summaryHeadline() }}</h1>
            </div>

            <div class="grid gap-4">
              <div class="rounded-3xl bg-emerald-50 px-5 py-5 text-left ring-1 ring-emerald-100 xl:text-right">
                <p class="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-700">{{ 'partners.offer.snapshotFee' | translate }}</p>
                <div class="mt-3 flex items-center gap-2 text-emerald-700 xl:justify-end">
                  <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.707a1 1 0 00-1.414-1.414L9 10.172 7.707 8.879a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
                  <span class="text-4xl font-black tracking-tight text-emerald-700">{{ priceDisplay() }}</span>
                </div>
                <p class="mt-2 text-xs font-medium text-emerald-800/80">{{ organizationName() }}</p>
              </div>
            </div>
          </div>

          <div class="mt-6 grid gap-4 md:grid-cols-3">
            <div class="rounded-2xl bg-slate-50 px-4 py-4 ring-1 ring-slate-200">
              <div class="flex items-center gap-2 text-slate-400">
                <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"/></svg>
                <p class="text-[11px] font-bold uppercase tracking-[0.18em]">{{ 'partners.offer.details.location' | translate }}</p>
              </div>
              <p class="mt-2 text-base font-semibold text-slate-900">{{ locationLabel() }}</p>
            </div>

            <div class="rounded-2xl bg-slate-50 px-4 py-4 ring-1 ring-slate-200">
              <div class="flex items-center gap-2 text-slate-400">
                <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10 2a1 1 0 011 1v6.382l3.447 1.724a1 1 0 11-.894 1.788l-4-2A1 1 0 019 10V3a1 1 0 011-1z"/><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM4 10a6 6 0 1112 0A6 6 0 014 10z" clip-rule="evenodd"/></svg>
                <p class="text-[11px] font-bold uppercase tracking-[0.18em]">{{ 'partners.offer.snapshotDeadline' | translate }}</p>
              </div>
              <p class="mt-2 text-base font-semibold text-slate-900">
                @if (timeRemaining(); as tr) {
                  {{ 'partners.offer.deadline.remaining' | translate: tr }}
                } @else {
                  {{ expiresAt() | date:'d MMMM yyyy, HH:mm':'':'nl-NL' }}
                }
              </p>
              @if (urgencyDisplay()) {
                <p class="mt-2 inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold" [class]="urgencyBadgeClass()">
                  <span class="h-2 w-2 rounded-full" [class]="urgencyDotClass()"></span>
                  {{ urgencyDisplay() }}
                </p>
              }
            </div>

            <div class="rounded-2xl bg-slate-50 px-4 py-4 ring-1 ring-slate-200">
              <div class="flex items-center gap-2 text-slate-400">
                <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M4 3a1 1 0 000 2h1v9a2 2 0 002 2h6a2 2 0 002-2V5h1a1 1 0 100-2H4z"/><path d="M8 7a1 1 0 012 0v5a1 1 0 11-2 0V7zM12 7a1 1 0 112 0v5a1 1 0 11-2 0V7z"/></svg>
                <p class="text-[11px] font-bold uppercase tracking-[0.18em]">{{ snapshotThirdMetricLabel() | translate }}</p>
              </div>
              <p class="mt-2 text-base font-semibold text-slate-900">
                @if (inspectionRequirementKey()) {
                  {{ inspectionRequirementKey() | translate }}
                } @else {
                  {{ snapshotThirdMetricValue() }}
                }
              </p>
            </div>
          </div>
        </div>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartnerOfferHeroCardComponent {
  readonly layout = input<PartnerOfferLayout>('desktop');
  readonly organizationName = input.required<string>();
  readonly summaryHeadline = input.required<string>();
  readonly summaryIntro = input.required<string>();
  readonly metaLine = input('');
  readonly locationLabel = input.required<string>();
  readonly priceDisplay = input.required<string>();
  readonly inspectionRequirementKey = input('');
  readonly scopeDisplay = input('');
  readonly constructionYearDisplay = input('');
  readonly urgencyDisplay = input('');
  readonly urgencyTone = input<'critical' | 'warning' | 'neutral'>('neutral');
  readonly expiresAt = input.required<string>();
  readonly statusLabelKey = input.required<string>();
  readonly deadlineBadgeClass = input.required<string>();
  readonly deadlineProgressPercent = input.required<number>();
  readonly deadlineProgressBarClass = input.required<string>();
  readonly mobileStatusBadge = input('');
  readonly statusBadgeClass = input('');
  readonly timeRemaining = input<TimeRemaining>(null);

  protected readonly urgencyBadgeClass = computed(() => {
    switch (this.urgencyTone()) {
      case 'critical':
        return 'bg-rose-50 text-rose-700';
      case 'warning':
        return 'bg-amber-50 text-amber-800';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  });

  protected readonly urgencyDotClass = computed(() => {
    switch (this.urgencyTone()) {
      case 'critical':
        return 'bg-rose-500';
      case 'warning':
        return 'bg-amber-500';
      default:
        return 'bg-slate-400';
    }
  });

  protected readonly snapshotThirdMetricLabel = computed(() => {
    return this.inspectionRequirementKey()
      ? 'partners.offer.details.inspection'
      : 'partners.offer.meta.scope';
  });

  protected readonly snapshotThirdMetricValue = computed(() => {
    return this.scopeDisplay() || '—';
  });
}