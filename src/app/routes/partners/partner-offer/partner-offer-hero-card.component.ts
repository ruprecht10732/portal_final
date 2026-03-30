import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
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
        <div class="mb-6 flex items-start justify-between">
          <div class="flex items-center gap-4">
            <div class="h-16 w-16 overflow-hidden rounded-2xl border border-gray-100 bg-gray-50 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.04),0_2px_8px_-2px_rgba(0,0,0,0.02)]">
              <div class="flex h-full w-full items-center justify-center bg-zinc-100 text-xl font-extrabold text-zinc-700">
                {{ organizationInitial() }}
              </div>
            </div>
            <div>
              <h1 class="line-clamp-2 text-xl font-extrabold tracking-tight text-slate-900">{{ organizationName() }}</h1>
              <p class="mt-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">{{ 'partners.offer.scanTitle' | translate }}</p>
              <p class="mt-1 line-clamp-3 text-sm font-semibold leading-6 text-slate-700">{{ summaryHeadline() }}</p>
            </div>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <div class="rounded-full px-4 py-1.5 text-[13px] font-bold text-white shadow-lg ring-4" [class]="mobileStatusBadge()">
            {{ statusLabelKey() | translate }}
          </div>
          @if (timeRemaining(); as tr) {
            <div class="rounded-full px-4 py-1.5 text-[13px] font-semibold" [class]="deadlineBadgeClass()">
              {{ 'partners.offer.deadline.remaining' | translate: tr }}
            </div>
          } @else {
            <div class="rounded-full bg-gray-100 px-4 py-1.5 text-[13px] font-semibold text-slate-500">
              {{ 'partners.offer.details.validUntil' | translate }} {{ expiresAt() | date:'d MMM':'':'nl' }}
            </div>
          }
        </div>
      </div>

      <div class="mx-5 mt-4 flex items-center justify-between rounded-2xl bg-white p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)]">
        <span class="text-sm font-medium text-zinc-500">{{ 'partners.offer.details.fee' | translate }}</span>
        <span class="text-2xl font-extrabold text-emerald-600">{{ priceDisplay() }}</span>
      </div>

      <div class="mx-5 mt-4 rounded-3xl bg-slate-950 p-5 text-white shadow-[0_14px_40px_-18px_rgba(15,23,42,0.8)]">
        <p class="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-300">{{ 'partners.offer.scanTitle' | translate }}</p>
        <h2 class="mt-3 text-xl font-extrabold leading-tight text-white">{{ summaryHeadline() }}</h2>
        <p class="mt-3 text-sm leading-6 text-slate-200">{{ summaryIntro() }}</p>

        @if (metaLine()) {
          <p class="mt-3 text-xs font-semibold text-slate-300">{{ metaLine() }}</p>
        }

        <div class="mt-4 grid grid-cols-2 gap-3">
          <div class="rounded-2xl bg-white/8 px-4 py-3">
            <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-300">{{ 'partners.offer.details.location' | translate }}</p>
            <p class="mt-2 text-sm font-semibold text-white">{{ locationLabel() }}</p>
          </div>
          <div class="rounded-2xl bg-white/8 px-4 py-3">
            <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-300">{{ 'partners.offer.practicalTitle' | translate }}</p>
            <p class="mt-2 text-sm font-semibold text-white">
              @if (inspectionRequirementKey()) {
                {{ inspectionRequirementKey() | translate }}
              } @else {
                {{ 'partners.offer.meta.scope' | translate }} {{ scopeDisplay() || '—' }}
              }
            </p>
          </div>
        </div>

        @if (constructionYearDisplay() || scopeDisplay() || urgencyDisplay()) {
          <div class="mt-4 flex flex-wrap gap-2">
            @if (constructionYearDisplay()) {
              <span class="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-slate-100">
                {{ 'partners.offer.meta.constructionYear' | translate }} {{ constructionYearDisplay() }}
              </span>
            }
            @if (scopeDisplay()) {
              <span class="rounded-full bg-amber-400/15 px-3 py-1 text-xs font-semibold text-amber-100">
                {{ 'partners.offer.meta.scope' | translate }} {{ scopeDisplay() }}
              </span>
            }
            @if (urgencyDisplay()) {
              <span class="rounded-full bg-rose-400/15 px-3 py-1 text-xs font-semibold text-rose-100">
                {{ 'partners.offer.meta.urgency' | translate }} {{ urgencyDisplay() }}
              </span>
            }
          </div>
        }
      </div>
    } @else {
      <div class="mb-8 rounded-xl bg-white p-6 shadow-sm">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 class="text-2xl font-bold text-zinc-900">{{ 'partners.offer.title' | translate }}</h1>
            <p class="mt-1 text-sm text-zinc-500">{{ 'partners.offer.fromOrg' | translate }} {{ organizationName() }}</p>
            <p class="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{{ 'partners.offer.scanTitle' | translate }}</p>
            <p class="mt-2 max-w-2xl text-2xl font-extrabold leading-tight text-slate-900">{{ summaryHeadline() }}</p>
            <p class="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">{{ summaryIntro() }}</p>
            @if (metaLine()) {
              <p class="mt-3 text-xs font-semibold text-zinc-500">{{ metaLine() }}</p>
            }
          </div>
          <div class="text-right">
            <span class="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium" [class]="statusBadgeClass()">
              {{ statusLabelKey() | translate }}
            </span>
            @if (timeRemaining(); as tr) {
              <p class="mt-2 text-xs font-medium" [class]="deadlineBadgeClass()">
                {{ 'partners.offer.deadline.remaining' | translate: tr }}
              </p>
              <p class="mt-1 text-xs text-zinc-400">
                {{ 'partners.offer.details.validUntil' | translate }} {{ expiresAt() | date:'d MMMM yyyy, HH:mm':'':'nl-NL' }}
              </p>
            } @else {
              <p class="mt-2 text-xs text-zinc-500">
                {{ 'partners.offer.details.validUntil' | translate }} {{ expiresAt() | date:'d MMMM yyyy, HH:mm':'':'nl-NL' }}
              </p>
            }
          </div>
        </div>

        <div class="mt-6 grid gap-3 md:grid-cols-3">
          <div class="rounded-2xl bg-slate-50 px-4 py-4">
            <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">{{ 'partners.offer.details.fee' | translate }}</p>
            <p class="mt-2 text-2xl font-extrabold text-emerald-600">{{ priceDisplay() }}</p>
          </div>
          <div class="rounded-2xl bg-slate-50 px-4 py-4">
            <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">{{ 'partners.offer.details.location' | translate }}</p>
            <p class="mt-2 text-base font-semibold text-zinc-900">{{ locationLabel() }}</p>
          </div>
          <div class="rounded-2xl bg-slate-50 px-4 py-4">
            <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">{{ 'partners.offer.details.inspection' | translate }}</p>
            <p class="mt-2 text-base font-semibold text-zinc-900">
              @if (inspectionRequirementKey()) {
                {{ inspectionRequirementKey() | translate }}
              } @else {
                {{ 'partners.offer.meta.scope' | translate }} {{ scopeDisplay() || '—' }}
              }
            </p>
          </div>
        </div>

        @if (constructionYearDisplay() || scopeDisplay() || urgencyDisplay()) {
          <div class="mt-4 flex flex-wrap gap-2">
            @if (constructionYearDisplay()) {
              <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                {{ 'partners.offer.meta.constructionYear' | translate }} {{ constructionYearDisplay() }}
              </span>
            }
            @if (scopeDisplay()) {
              <span class="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                {{ 'partners.offer.meta.scope' | translate }} {{ scopeDisplay() }}
              </span>
            }
            @if (urgencyDisplay()) {
              <span class="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
                {{ 'partners.offer.meta.urgency' | translate }} {{ urgencyDisplay() }}
              </span>
            }
          </div>
        }
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
  readonly expiresAt = input.required<string>();
  readonly statusLabelKey = input.required<string>();
  readonly deadlineBadgeClass = input.required<string>();
  readonly mobileStatusBadge = input('');
  readonly statusBadgeClass = input('');
  readonly timeRemaining = input<TimeRemaining>(null);

  protected organizationInitial(): string {
    return this.organizationName()[0] ?? 'O';
  }
}