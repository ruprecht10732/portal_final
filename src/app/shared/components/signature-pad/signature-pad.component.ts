import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  output,
  signal,
  viewChild,
} from '@angular/core';

/**
 * A canvas-based signature pad component.
 *
 * Emits `signatureChange` whenever the user finishes a stroke,
 * providing a base64 PNG data URL.  Emits `null` when cleared.
 */
@Component({
  selector: 'app-signature-pad',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="signature-pad-wrapper">
      <canvas
        #canvas
        class="signature-canvas"
        (pointerdown)="onPointerDown($event)"
        (pointermove)="onPointerMove($event)"
        (pointerup)="onPointerUp()"
        (pointerleave)="onPointerUp()"
      ></canvas>

      @if (!hasStrokes()) {
        <p class="signature-placeholder">Teken uw handtekening hierboven</p>
      }

      <button
        type="button"
        class="clear-btn"
        (click)="clear()"
        [class.invisible]="!hasStrokes()"
      >
        Wissen
      </button>
    </div>
  `,
  styles: `
    .signature-pad-wrapper {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 0.5rem;
    }

    .signature-canvas {
      width: 100%;
      height: 160px;
      border: 1px solid #e4e4e7;
      border-radius: 0.5rem;
      cursor: crosshair;
      touch-action: none;
      background: #fafafa;
    }

    .signature-placeholder {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      pointer-events: none;
      color: #a1a1aa;
      font-size: 0.875rem;
      user-select: none;
    }

    .clear-btn {
      font-size: 0.75rem;
      color: #71717a;
      cursor: pointer;
      transition: color 0.15s;
      background: none;
      border: none;
      padding: 0;
    }
    .clear-btn:hover {
      color: #ef4444;
    }
    .invisible {
      visibility: hidden;
    }
  `,
})
export class SignaturePadComponent implements AfterViewInit, OnDestroy {
  /** Emits the base64 PNG data URL on each stroke end, or `null` when cleared. */
  readonly signatureChange = output<string | null>();

  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  protected readonly hasStrokes = signal(false);

  private ctx!: CanvasRenderingContext2D;
  private drawing = false;
  private resizeObserver?: ResizeObserver;

  ngAfterViewInit(): void {
    const canvas = this.canvasRef().nativeElement;
    this.ctx = canvas.getContext('2d')!;

    // Size the canvas bitmap to match CSS size (retina-aware)
    this.resizeCanvas();
    this.resizeObserver = new ResizeObserver(() => this.resizeCanvas());
    this.resizeObserver.observe(canvas);

    this.ctx.strokeStyle = '#111827';
    this.ctx.lineWidth = 2;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  /* ── Canvas helpers ──────────────────────────────────── */

  private resizeCanvas(): void {
    const canvas = this.canvasRef().nativeElement;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // Only resize if dimensions actually changed
    const w = Math.round(rect.width * dpr);
    const h = Math.round(rect.height * dpr);
    if (canvas.width === w && canvas.height === h) return;

    // Save current image before resize
    const imgData = this.hasStrokes() ? canvas.toDataURL() : null;

    canvas.width = w;
    canvas.height = h;
    this.ctx.scale(dpr, dpr);
    this.ctx.strokeStyle = '#111827';
    this.ctx.lineWidth = 2;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    // Restore previous drawing after resize
    if (imgData) {
      const img = new Image();
      img.onload = () => {
        this.ctx.drawImage(img, 0, 0, rect.width, rect.height);
      };
      img.src = imgData;
    }
  }

  private getPos(e: PointerEvent): { x: number; y: number } {
    const rect = this.canvasRef().nativeElement.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  /* ── Pointer events ─────────────────────────────────── */

  protected onPointerDown(e: PointerEvent): void {
    this.drawing = true;
    const { x, y } = this.getPos(e);
    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
    // Capture pointer so strokes continue outside canvas bounds
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  protected onPointerMove(e: PointerEvent): void {
    if (!this.drawing) return;
    const { x, y } = this.getPos(e);
    this.ctx.lineTo(x, y);
    this.ctx.stroke();
  }

  protected onPointerUp(): void {
    if (!this.drawing) return;
    this.drawing = false;
    this.hasStrokes.set(true);
    this.signatureChange.emit(this.canvasRef().nativeElement.toDataURL('image/png'));
  }

  /* ── Public API ─────────────────────────────────────── */

  clear(): void {
    const canvas = this.canvasRef().nativeElement;
    const rect = canvas.getBoundingClientRect();
    this.ctx.clearRect(0, 0, rect.width, rect.height);
    this.hasStrokes.set(false);
    this.signatureChange.emit(null);
  }

  /** Returns the current signature as a base64 PNG data URL, or `null` if empty. */
  toDataURL(): string | null {
    return this.hasStrokes() ? this.canvasRef().nativeElement.toDataURL('image/png') : null;
  }
}
