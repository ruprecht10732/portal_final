import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

type PartnerOfferLayout = 'mobile' | 'desktop';
type QuickRejectReasonKey = 'tooBusy' | 'tooFarAway' | 'priceTooLow' | 'notMyExpertise' | 'other';

@Component({
  selector: 'app-partner-offer-reject-form',
  imports: [TranslatePipe],
  template: `
    @if (layout() === 'mobile') {
      <div class="px-6 pb-6 pt-4">
        <p class="text-sm font-semibold text-zinc-900">{{ 'partners.offer.reject.quickTitle' | translate }}</p>
        <p class="mt-1 text-sm text-zinc-500">{{ 'partners.offer.reject.quickBody' | translate }}</p>

        <div class="mt-4 grid grid-cols-1 gap-2.5">
          @for (quickReason of quickReasonKeys; track quickReason) {
            <button
              type="button"
              class="flex min-h-12 items-center justify-start rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition-colors"
              [class]="isQuickReasonSelected(quickReason)
                ? 'border-red-300 bg-red-50 text-red-700 shadow-sm shadow-red-100/60'
                : 'border-zinc-200 bg-white text-zinc-700 active:bg-zinc-50'"
              [attr.aria-pressed]="isQuickReasonSelected(quickReason)"
              (click)="selectQuickReason(quickReason)"
            >
              {{ quickReasonLabel(quickReason) }}
            </button>
          }
        </div>

        @if (showCustomReason()) {
          <div class="mt-4">
            <label for="reject-reason-mobile" class="block text-xs font-bold uppercase tracking-widest text-zinc-500">{{ 'partners.offer.reject.reasonLabel' | translate }}</label>
            <textarea
              id="reject-reason-mobile"
              rows="3"
              maxlength="500"
              class="mt-2 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
              [value]="reason()"
              [placeholder]="'partners.offer.reject.placeholder' | translate"
              (input)="onReasonInput($event)"
            ></textarea>
          </div>
        }

        @if (!showCustomReason()) {
          <p class="mt-3 text-xs text-zinc-500">{{ 'partners.offer.reject.tapHint' | translate }}</p>
        }
      </div>

      <div class="border-t border-zinc-100 bg-white/90 px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-4 backdrop-blur">
        <div class="flex flex-col gap-3">
          <button type="button" class="h-14 w-full rounded-[18px] bg-red-600 text-base font-extrabold text-white shadow-lg shadow-red-500/20 transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50" (click)="submitRequested.emit()" [disabled]="rejecting()">
            @if (rejecting()) {
              <span class="flex items-center justify-center gap-2">
                <div class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                {{ 'partners.offer.actions.busy' | translate }}
              </span>
            } @else {
              {{ 'partners.offer.actions.confirmReject' | translate }}
            }
          </button>
          <button type="button" class="h-12 w-full rounded-[18px] border border-zinc-200 text-sm font-semibold text-zinc-500" (click)="cancelRequested.emit()" [disabled]="rejecting()">
            {{ 'partners.offer.actions.cancel' | translate }}
          </button>
        </div>
      </div>
    } @else {
      <div class="mt-6 overflow-hidden rounded-xl bg-white shadow-sm">
        <div class="border-b border-zinc-100 px-6 py-4">
          <h2 class="text-lg font-semibold text-zinc-900">{{ 'partners.offer.reject.title' | translate }}</h2>
          <p class="mt-1 text-sm text-zinc-500">{{ 'partners.offer.reject.quickBody' | translate }}</p>
        </div>
        <div class="p-6">
          <div class="grid grid-cols-2 gap-3">
            @for (quickReason of quickReasonKeys; track quickReason) {
              <button
                type="button"
                class="flex min-h-12 items-center justify-start rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition-colors"
                [class]="isQuickReasonSelected(quickReason)
                  ? 'border-red-300 bg-red-50 text-red-700 shadow-sm shadow-red-100/60'
                  : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'"
                [attr.aria-pressed]="isQuickReasonSelected(quickReason)"
                (click)="selectQuickReason(quickReason)"
              >
                {{ quickReasonLabel(quickReason) }}
              </button>
            }
          </div>

          @if (showCustomReason()) {
            <div class="mt-5">
              <label for="reject-reason-desktop" class="block text-xs font-bold uppercase tracking-widest text-zinc-500">{{ 'partners.offer.reject.reasonLabel' | translate }}</label>
              <textarea
                id="reject-reason-desktop"
                rows="3"
                maxlength="500"
                class="mt-2 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                [value]="reason()"
                (input)="onReasonInput($event)"
                [placeholder]="'partners.offer.reject.placeholder' | translate"
              ></textarea>
            </div>
          }

          @if (!showCustomReason()) {
            <p class="mt-4 text-xs text-zinc-500">{{ 'partners.offer.reject.tapHint' | translate }}</p>
          }

          <div class="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button type="button" class="rounded-xl border border-zinc-200 bg-white px-6 py-3 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50" (click)="cancelRequested.emit()" [disabled]="rejecting()">
              {{ 'partners.offer.actions.cancel' | translate }}
            </button>
            <button type="button" class="rounded-xl bg-red-600 px-8 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50" (click)="submitRequested.emit()" [disabled]="rejecting()">
              @if (rejecting()) {
                {{ 'partners.offer.actions.busy' | translate }}
              } @else {
                {{ 'partners.offer.actions.confirmReject' | translate }}
              }
            </button>
          </div>
        </div>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartnerOfferRejectFormComponent {
  private readonly translate = inject(TranslateService);

  protected readonly quickReasonKeys: QuickRejectReasonKey[] = [
    'tooBusy',
    'tooFarAway',
    'priceTooLow',
    'notMyExpertise',
    'other',
  ];

  private readonly customReasonOpened = signal(false);

  readonly layout = input<PartnerOfferLayout>('desktop');
  readonly reason = input('');
  readonly rejecting = input(false);

  protected readonly activeQuickReason = computed<QuickRejectReasonKey | null>(() => {
    const currentReason = this.reason().trim();
    if (!currentReason) {
      return this.customReasonOpened() ? 'other' : null;
    }

    const matchedQuickReason = this.quickReasonKeys.find((quickReason) => {
      if (quickReason === 'other') return false;
      return currentReason === this.quickReasonValue(quickReason);
    });

    return matchedQuickReason ?? 'other';
  });

  protected readonly showCustomReason = computed(() => this.activeQuickReason() === 'other');

  readonly reasonUpdated = output<string>();
  readonly cancelRequested = output<void>();
  readonly submitRequested = output<void>();

  protected selectQuickReason(quickReason: QuickRejectReasonKey): void {
    if (quickReason === 'other') {
      this.customReasonOpened.set(true);
      if (this.activeQuickReason() !== 'other') {
        this.reasonUpdated.emit('');
      }
      return;
    }

    this.customReasonOpened.set(false);
    this.reasonUpdated.emit(this.quickReasonValue(quickReason));
  }

  protected quickReasonLabel(quickReason: QuickRejectReasonKey): string {
    return this.translate.instant(`partners.offer.reject.quickReasons.${quickReason}.label`);
  }

  protected isQuickReasonSelected(quickReason: QuickRejectReasonKey): boolean {
    return this.activeQuickReason() === quickReason;
  }

  protected onReasonInput(event: Event): void {
    this.customReasonOpened.set(true);
    const value = (event.target as HTMLTextAreaElement | null)?.value ?? '';
    this.reasonUpdated.emit(value);
  }

  private quickReasonValue(quickReason: Exclude<QuickRejectReasonKey, 'other'>): string {
    return this.translate.instant(`partners.offer.reject.quickReasons.${quickReason}.value`);
  }
}