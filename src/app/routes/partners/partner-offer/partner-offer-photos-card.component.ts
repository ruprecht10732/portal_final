import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

type PhotoItem = {
  id: string;
  url: string;
  label: string;
};

@Component({
  selector: 'app-partner-offer-photos-card',
  imports: [TranslatePipe],
  host: {
    '(document:keydown)': 'onDocumentKeydown($event)',
  },
  template: `
    @if (layout() === 'mobile') {
      <div class="flex items-center justify-between px-5 py-4 mt-2">
        <h3 class="text-xs font-extrabold uppercase tracking-[0.15em] text-slate-400">{{ 'partners.offer.photosTitle' | translate }}</h3>
      </div>
      <div class="mx-5 rounded-2xl bg-white p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)]">
        <div class="grid grid-cols-2 gap-3">
          @for (photo of photos(); track photo.id; let index = $index) {
            <button type="button" class="block overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 text-left transition-transform active:scale-[0.98]" (click)="openLightbox(index)" [attr.aria-label]="('partners.offer.photosOpen' | translate) + ' ' + photo.label">
              <img [src]="photo.url" [alt]="photo.label" class="h-32 w-full object-cover" loading="lazy" />
            </button>
          }
        </div>
      </div>
    } @else {
      <div class="rounded-xl bg-white p-6 shadow-sm">
        <div class="border-b border-zinc-100 pb-4">
          <h2 class="text-lg font-semibold text-zinc-900">{{ 'partners.offer.photosTitle' | translate }}</h2>
        </div>
        <div class="mt-4 grid grid-cols-2 gap-4">
          @for (photo of photos(); track photo.id; let index = $index) {
            <button type="button" class="block overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 text-left transition-transform hover:scale-[1.01]" (click)="openLightbox(index)" [attr.aria-label]="('partners.offer.photosOpen' | translate) + ' ' + photo.label">
              <img [src]="photo.url" [alt]="photo.label" class="h-40 w-full object-cover" loading="lazy" />
            </button>
          }
        </div>
      </div>
    }

    @if (activePhoto(); as photo) {
      <div class="fixed inset-0 z-[70] bg-slate-950/92 backdrop-blur-sm" role="dialog" aria-modal="true" [attr.aria-label]="'partners.offer.photosLightbox' | translate" (click)="closeLightbox()">
        <div class="flex h-full flex-col" (click)="$event.stopPropagation()">
          <div class="flex items-center justify-between px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))] text-white sm:px-6">
            <div>
              <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-300">{{ 'partners.offer.photosTitle' | translate }}</p>
              <p class="mt-1 text-sm font-medium text-slate-100">{{ photo.label }}</p>
            </div>
            <div class="flex items-center gap-2">
              <span class="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-slate-100">
                {{ activePhotoIndex()! + 1 }} / {{ photos().length }}
              </span>
              <button type="button" class="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20" (click)="closeLightbox()" [attr.aria-label]="'partners.offer.photosClose' | translate">
                <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
              </button>
            </div>
          </div>

          <div class="flex min-h-0 flex-1 items-center justify-center px-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6" (touchstart)="onTouchStart($event)" (touchend)="onTouchEnd($event)">
            <div class="relative flex h-full w-full max-w-5xl items-center justify-center">
              @if (hasMultiplePhotos()) {
                <button type="button" class="absolute left-0 z-10 hidden h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:inline-flex" (click)="showPreviousPhoto()" [attr.aria-label]="'partners.offer.photosPrevious' | translate">
                  <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M12.707 15.707a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5a1 1 0 111.414 1.414L8.414 10l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd"/></svg>
                </button>
              }

              <img [src]="photo.url" [alt]="photo.label" class="max-h-full max-w-full rounded-2xl object-contain shadow-[0_30px_80px_-40px_rgba(15,23,42,0.9)]" />

              @if (hasMultiplePhotos()) {
                <button type="button" class="absolute right-0 z-10 hidden h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:inline-flex" (click)="showNextPhoto()" [attr.aria-label]="'partners.offer.photosNext' | translate">
                  <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M7.293 4.293a1 1 0 011.414 0l5 5a1 1 0 010 1.414l-5 5a1 1 0 11-1.414-1.414L11.586 10 7.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
                </button>
              }
            </div>
          </div>

          @if (hasMultiplePhotos()) {
            <div class="flex justify-center gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:hidden">
              <button type="button" class="inline-flex min-w-28 items-center justify-center rounded-full bg-white/10 px-4 py-3 text-sm font-semibold text-white" (click)="showPreviousPhoto()">
                {{ 'partners.offer.photosPrevious' | translate }}
              </button>
              <button type="button" class="inline-flex min-w-28 items-center justify-center rounded-full bg-white/10 px-4 py-3 text-sm font-semibold text-white" (click)="showNextPhoto()">
                {{ 'partners.offer.photosNext' | translate }}
              </button>
            </div>
          }
        </div>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartnerOfferPhotosCardComponent {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  readonly layout = input<'mobile' | 'desktop'>('desktop');
  readonly photos = input.required<readonly PhotoItem[]>();
  protected readonly activePhotoIndex = signal<number | null>(null);
  private readonly touchStartX = signal<number | null>(null);
  protected readonly activePhoto = computed(() => {
    const index = this.activePhotoIndex();
    if (index === null) return null;
    return this.photos()[index] ?? null;
  });
  protected readonly hasMultiplePhotos = computed(() => this.photos().length > 1);

  constructor() {
    effect(() => {
      this.document.body.style.overflow = this.activePhotoIndex() === null ? '' : 'hidden';
    });

    this.destroyRef.onDestroy(() => {
      this.document.body.style.overflow = '';
    });
  }

  protected openLightbox(index: number): void {
    this.activePhotoIndex.set(index);
  }

  protected closeLightbox(): void {
    this.activePhotoIndex.set(null);
    this.touchStartX.set(null);
  }

  protected showPreviousPhoto(): void {
    const total = this.photos().length;
    const index = this.activePhotoIndex();
    if (index === null || total <= 1) return;
    this.activePhotoIndex.set((index - 1 + total) % total);
  }

  protected showNextPhoto(): void {
    const total = this.photos().length;
    const index = this.activePhotoIndex();
    if (index === null || total <= 1) return;
    this.activePhotoIndex.set((index + 1) % total);
  }

  protected onTouchStart(event: TouchEvent): void {
    this.touchStartX.set(event.changedTouches[0]?.clientX ?? null);
  }

  protected onTouchEnd(event: TouchEvent): void {
    const startX = this.touchStartX();
    const endX = event.changedTouches[0]?.clientX;
    this.touchStartX.set(null);

    if (startX === null || endX === undefined) return;
    const delta = endX - startX;
    if (Math.abs(delta) < 40) return;
    if (delta > 0) {
      this.showPreviousPhoto();
      return;
    }
    this.showNextPhoto();
  }

  protected onDocumentKeydown(event: KeyboardEvent): void {
    if (this.activePhotoIndex() === null) return;
    if (event.key === 'Escape') {
      this.closeLightbox();
      return;
    }
    if (event.key === 'ArrowLeft') {
      this.showPreviousPhoto();
      return;
    }
    if (event.key === 'ArrowRight') {
      this.showNextPhoto();
    }
  }
}