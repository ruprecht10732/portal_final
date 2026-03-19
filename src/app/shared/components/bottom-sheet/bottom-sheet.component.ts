/**
 * Bottom Sheet Component
 * Mobile-friendly slide-up panel for actions, filters, and selections
 */

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

@Component({
  selector: 'app-bottom-sheet',
  templateUrl: './bottom-sheet.component.html',
  styleUrl: './bottom-sheet.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.pointer-events-none]': '!isOpen()',
    '(document:keydown.escape)': 'onEscape()',
  },
})
export class BottomSheetComponent {
  private readonly destroyRef = inject(DestroyRef);

  // ============ Inputs ============
  
  /** Whether the sheet is open */
  readonly isOpen = input<boolean>(false);
  
  /** Title displayed in the header */
  readonly title = input<string>('');
  
  /** Whether to show close button */
  readonly showCloseButton = input<boolean>(true);
  
  /** Maximum height as percentage of viewport */
  readonly maxHeight = input<number>(85);
  
  /** Whether clicking backdrop closes the sheet */
  readonly closeOnBackdrop = input<boolean>(true);
  
  /** Whether pressing Escape closes the sheet */
  readonly closeOnEscape = input<boolean>(true);

  // ============ Outputs ============
  
  /** Emitted when the sheet should close */
  readonly closed = output<void>();

  // ============ Internal State ============
  
  /** Track drag state for swipe-to-dismiss */
  protected readonly isDragging = signal<boolean>(false);
  protected readonly dragOffset = signal<number>(0);
  private readonly dragStartClientY = signal<number | null>(null);
  
  /** Animation state */
  protected readonly isAnimating = signal<boolean>(false);

  /** Whether the sheet has ever been opened (prevents flash on first render) */
  protected readonly hasBeenOpened = signal<boolean>(false);

  private readonly isBodyScrollLocked = signal<boolean>(false);
  private lockedScrollY = 0;

  // ============ Computed ============
  
  protected readonly transformStyle = computed(() => {
    const offset = this.dragOffset();
    if (offset > 0) {
      return `translateY(${offset}px)`;
    }
    return this.isOpen() ? 'translateY(0)' : 'translateY(100%)';
  });

  protected readonly backdropOpacity = computed(() => {
    const offset = this.dragOffset();
    const maxDrag = 200;
    if (offset > 0) {
      return Math.max(0, 1 - offset / maxDrag);
    }
    return this.isOpen() ? 1 : 0;
  });

  protected readonly maxHeightStyle = computed(
    () => `min(${this.maxHeight()}vh, calc(100dvh - env(safe-area-inset-top, 0px)))`,
  );

  protected readonly accessibleLabel = computed(() => this.title().trim() || 'Bottom sheet');

  // ============ Lifecycle ============
  
  constructor() {
    // Lock body scroll when open, and track first open
    effect(() => {
      if (this.isOpen() && !this.isBodyScrollLocked()) {
        this.hasBeenOpened.set(true);
        this.lockedScrollY = window.scrollY || document.documentElement.scrollTop || 0;
        document.body.style.position = 'fixed';
        document.body.style.top = `-${this.lockedScrollY}px`;
        document.body.style.left = '0';
        document.body.style.right = '0';
        document.body.style.width = '100%';
        document.body.style.overflow = 'hidden';
        this.isBodyScrollLocked.set(true);
      } else if (!this.isOpen() && this.isBodyScrollLocked()) {
        this.unlockBodyScroll();
      }
    });

    this.destroyRef.onDestroy(() => {
      if (this.isBodyScrollLocked()) {
        this.unlockBodyScroll();
      }
    });
  }

  // ============ Event Handlers ============
  
  protected onEscape(): void {
    if (this.isOpen() && this.closeOnEscape()) {
      this.closed.emit();
    }
  }

  protected onBackdropClick(): void {
    if (this.closeOnBackdrop()) {
      this.closed.emit();
    }
  }

  protected onCloseClick(): void {
    this.closed.emit();
  }

  // ============ Drag/Swipe Handling ============
  
  protected onDragStart(event: TouchEvent | MouseEvent): void {
    if (!this.isOpen()) return;

    const clientY = this.getClientY(event);
    if (clientY === null) return;

    this.isDragging.set(true);
    this.isAnimating.set(false);
    this.dragOffset.set(0);
    this.dragStartClientY.set(clientY);
  }

  protected onDragMove(event: TouchEvent | MouseEvent): void {
    if (!this.isDragging()) return;

    const clientY = this.getClientY(event);
    const dragStartClientY = this.dragStartClientY();
    if (clientY === null || dragStartClientY === null) return;

    // Only allow dragging down from the gesture start point.
    this.dragOffset.set(Math.max(0, clientY - dragStartClientY));
  }

  protected onDragEnd(): void {
    if (!this.isDragging()) return;
    
    this.isDragging.set(false);
    this.isAnimating.set(true);
    
    const offset = this.dragOffset();
    const threshold = 100;
    
    if (offset > threshold) {
      // Close the sheet
      this.closed.emit();
    }

    // Reset drag offset
    this.dragOffset.set(0);
    this.dragStartClientY.set(null);
  }

  private getClientY(event: TouchEvent | MouseEvent): number | null {
    if ('touches' in event) {
      return event.touches[0]?.clientY ?? null;
    }

    return event.clientY;
  }

  /** Prevent content scroll when at top and trying to scroll up */
  protected onContentScroll(event: Event): void {
    const target = event.target as HTMLElement;
    if (target.scrollTop === 0) {
      // Allow drag gesture
    }
  }

  private unlockBodyScroll(): void {
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    document.body.style.overflow = '';
    window.scrollTo(0, this.lockedScrollY);
    this.isBodyScrollLocked.set(false);
  }
}
