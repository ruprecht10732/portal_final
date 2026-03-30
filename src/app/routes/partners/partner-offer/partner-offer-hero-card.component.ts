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
                <p class="mt-3 line-clamp-3 text-sm leading-6 text-slate-200">{{ summaryIntro() }}</p>
              </div>

              <div class="shrink-0 rounded-2xl bg-emerald-400/12 px-4 py-3 text-right ring-1 ring-emerald-300/20">
                <p class="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-100">{{ 'partners.offer.snapshotFee' | translate }}</p>
                <div class="mt-2 flex items-center justify-end gap-2 text-emerald-200">
                  <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.707a1 1 0 00-1.414-1.414L9 10.172 7.707 8.879a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
                  <span class="text-3xl font-black tracking-tight text-white">{{ priceDisplay() }}</span>
                </div>
              </div>
            </div>

            <div class="mt-4 flex flex-wrap items-center gap-2">
              <span class="rounded-full px-3 py-1.5 text-[12px] font-bold text-white shadow-lg ring-4" [class]="mobileStatusBadge()">
                {{ statusLabelKey() | translate }}
              </span>
              @if (timeRemaining(); as tr) {
                <span class="rounded-full px-3 py-1.5 text-[12px] font-semibold" [class]="deadlineBadgeClass()">
                  {{ 'partners.offer.deadline.remaining' | translate: tr }}
                </span>
              }
              @if (urgencyDisplay()) {
                <span class="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-semibold" [class]="urgencyBadgeClass()">
                  <span class="h-2 w-2 rounded-full" [class]="urgencyDotClass()"></span>
                  {{ urgencyDisplay() }}
                </span>
              }
            </div>

            <div class="mt-5 grid gap-3 sm:grid-cols-3">
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

            @if (metaLine() || constructionYearDisplay() || scopeDisplay()) {
              <div class="mt-4 flex flex-wrap gap-2">
                @if (metaLine()) {
                  <span class="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-slate-100">{{ metaLine() }}</span>
                }
                @if (constructionYearDisplay()) {
                  <span class="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-slate-100">
                    {{ 'partners.offer.meta.constructionYear' | translate }} {{ constructionYearDisplay() }}
                  </span>
                }
                @if (scopeDisplay()) {
                  <span class="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-slate-100">
                    {{ 'partners.offer.meta.scope' | translate }} {{ scopeDisplay() }}
                  </span>
                }
              </div>
            }
          </div>
        </div>
      </div>
    } @else {
      <div class="mb-8 overflow-hidden rounded-[28px] bg-white shadow-[0_16px_40px_-24px_rgba(15,23,42,0.35)] ring-1 ring-slate-200">
        <div class="h-1.5 w-full bg-slate-100">
          <div class="h-full rounded-full transition-all duration-500" [class]="deadlineProgressBarClass()" [style.width.%]="deadlineProgressPercent()"></div>
        </div>

        <div class="p-7">
          <div class="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div class="max-w-3xl">
              <p class="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">{{ 'partners.offer.snapshotTitle' | translate }}</p>
              <h1 class="mt-3 text-3xl font-black leading-tight tracking-tight text-slate-950">{{ summaryHeadline() }}</h1>
              <p class="mt-3 text-base leading-7 text-slate-600">{{ summaryIntro() }}</p>
              @if (metaLine()) {
                <p class="mt-3 text-sm font-semibold text-slate-500">{{ metaLine() }}</p>
              }
            </div>

            <div class="min-w-[220px] rounded-3xl bg-emerald-50 px-5 py-4 text-right ring-1 ring-emerald-100">
              <p class="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-700">{{ 'partners.offer.snapshotFee' | translate }}</p>
              <div class="mt-3 flex items-center justify-end gap-2 text-emerald-700">
                <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.707a1 1 0 00-1.414-1.414L9 10.172 7.707 8.879a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
                <span class="text-4xl font-black tracking-tight text-emerald-700">{{ priceDisplay() }}</span>
              </div>
              <p class="mt-2 text-xs font-medium text-emerald-800/80">{{ organizationName() }}</p>
            </div>
          </div>

          <div class="mt-5 flex flex-wrap items-center gap-3">
            <span class="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium" [class]="statusBadgeClass()">
              {{ statusLabelKey() | translate }}
            </span>
            @if (timeRemaining(); as tr) {
              <span class="rounded-full px-3 py-1 text-sm font-semibold" [class]="deadlineBadgeClass()">
                {{ 'partners.offer.deadline.remaining' | translate: tr }}
              </span>
            }
            @if (urgencyDisplay()) {
              <span class="inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold" [class]="urgencyBadgeClass()">
                <span class="h-2.5 w-2.5 rounded-full" [class]="urgencyDotClass()"></span>
                {{ urgencyDisplay() }}
              </span>
            }
          </div>

          <div class="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div class="rounded-2xl bg-slate-50 px-4 py-4">
              <div class="flex items-center gap-2 text-slate-400">
                <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"/></svg>
                <p class="text-[11px] font-bold uppercase tracking-[0.18em]">{{ 'partners.offer.details.location' | translate }}</p>
              </div>
              <p class="mt-2 text-base font-semibold text-slate-900">{{ locationLabel() }}</p>
            </div>

            <div class="rounded-2xl bg-slate-50 px-4 py-4">
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
            </div>

            <div class="rounded-2xl bg-slate-50 px-4 py-4">
              <div class="flex items-center gap-2 text-slate-400">
                <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clip-rule="evenodd"/></svg>
                <p class="text-[11px] font-bold uppercase tracking-[0.18em]">{{ 'partners.offer.snapshotUrgency' | translate }}</p>
              </div>
              <p class="mt-2 text-base font-semibold text-slate-900">{{ urgencyDisplay() || ('partners.offer.urgency.low' | translate) }}</p>
            </div>

            <div class="rounded-2xl bg-slate-50 px-4 py-4">
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

          @if (constructionYearDisplay() || scopeDisplay()) {
            <div class="mt-4 flex flex-wrap gap-2">
              @if (constructionYearDisplay()) {
                <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  {{ 'partners.offer.meta.constructionYear' | translate }} {{ constructionYearDisplay() }}
                </span>
              }
              @if (scopeDisplay()) {
                <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  {{ 'partners.offer.meta.scope' | translate }} {{ scopeDisplay() }}
                </span>
              }
            </div>
          }
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