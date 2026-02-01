/**
 * Bottom Sheet Component
 * Mobile-friendly slide-up panel for actions, filters, and selections
 */

import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  input,
  output,
  signal,
  viewChild,
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
  readonly close = output<void>();

  // ============ View Children ============
  
  private readonly sheetRef = viewChild<ElementRef<HTMLDivElement>>('sheet');

  // ============ Internal State ============
  
  /** Track drag state for swipe-to-dismiss */
  protected readonly isDragging = signal<boolean>(false);
  protected readonly dragOffset = signal<number>(0);
  
  /** Animation state */
  protected readonly isAnimating = signal<boolean>(false);

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

  // ============ Lifecycle ============
  
  constructor() {
    // Lock body scroll when open
    effect(() => {
      if (this.isOpen()) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
    });
  }

  // ============ Event Handlers ============
  
  protected onEscape(): void {
    if (this.isOpen() && this.closeOnEscape()) {
      this.close.emit();
    }
  }

  protected onBackdropClick(): void {
    if (this.closeOnBackdrop()) {
      this.close.emit();
    }
  }

  protected onCloseClick(): void {
    this.close.emit();
  }

  // ============ Drag/Swipe Handling ============
  
  protected onDragStart(): void {
    this.isDragging.set(true);
    this.isAnimating.set(false);
  }

  protected onDragMove(event: TouchEvent | MouseEvent): void {
    if (!this.isDragging()) return;
    
    const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;
    const sheet = this.sheetRef()?.nativeElement;
    
    if (sheet) {
      const rect = sheet.getBoundingClientRect();
      const startY = rect.top;
      const deltaY = clientY - startY;
      
      // Only allow dragging down
      if (deltaY > 0) {
        this.dragOffset.set(deltaY);
      }
    }
  }

  protected onDragEnd(): void {
    if (!this.isDragging()) return;
    
    this.isDragging.set(false);
    this.isAnimating.set(true);
    
    const offset = this.dragOffset();
    const threshold = 100;
    
    if (offset > threshold) {
      // Close the sheet
      this.close.emit();
    }
    
    // Reset drag offset
    this.dragOffset.set(0);
  }

  /** Prevent content scroll when at top and trying to scroll up */
  protected onContentScroll(event: Event): void {
    const target = event.target as HTMLElement;
    if (target.scrollTop === 0) {
      // Allow drag gesture
    }
  }
}
