/**
 * Data Grid Thumbnail Cell Component
 * Read-only image thumbnail cell for the data grid
 */

import {
  ChangeDetectionStrategy,
  Component,
  input,
  signal,
} from '@angular/core';

/** Configuration for thumbnail rendering */
export interface ThumbnailConfig {
  /** Display width in pixels (default 40) */
  width?: number;
  /** Display height in pixels (default 40) */
  height?: number;
  /** CSS object-fit value (default 'cover') */
  objectFit?: 'cover' | 'contain' | 'fill';
}

@Component({
  selector: 'data-grid-thumbnail-cell',
  template: `
    @if (value() && !hasError()) {
      <img
        [src]="value()!"
        [alt]="alt()"
        class="shrink-0 rounded-md border border-zinc-200 bg-zinc-50 object-cover shadow-sm"
        [style.width.px]="config()?.width ?? 40"
        [style.height.px]="config()?.height ?? 40"
        [style.object-fit]="config()?.objectFit ?? 'cover'"
        (error)="onImageError()"
      />
    } @else {
      <div
        class="flex shrink-0 items-center justify-center rounded-md border border-dashed border-zinc-200 bg-zinc-50 text-zinc-300"
        [style.width.px]="config()?.width ?? 40"
        [style.height.px]="config()?.height ?? 40"
      >
        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
        </svg>
      </div>
    }
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataGridThumbnailCellComponent {
  /** Image URL to display */
  readonly value = input<string | null>(null);

  /** Alt text for the image */
  readonly alt = input<string>('');

  /** Optional configuration for sizing and fit */
  readonly config = input<ThumbnailConfig | undefined>(undefined);

  /** Whether the image failed to load */
  protected readonly hasError = signal(false);

  protected onImageError(): void {
    this.hasError.set(true);
  }
}
