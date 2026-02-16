import { ChangeDetectionStrategy, Component, OnDestroy, effect, input, output, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-right-sidebar',
  imports: [LucideAngularModule],
  templateUrl: './right-sidebar.component.html',
  styleUrl: './right-sidebar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.display]': "'contents'",
    '(document:keydown.escape)': 'onEscape()',
  },
})
export class RightSidebarComponent implements OnDestroy {
  readonly isOpen = input<boolean>(false);
  readonly title = input<string>('');
  readonly closeOnBackdrop = input<boolean>(true);

  readonly closed = output<void>();

  protected readonly rendered = signal(false);
  protected readonly entered = signal(false);

  private closeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      if (this.isOpen()) {
        this.clearCloseTimer();
        this.rendered.set(true);
        requestAnimationFrame(() => {
          this.entered.set(true);
        });
        return;
      }

      this.entered.set(false);
      if (!this.rendered()) {
        return;
      }

      this.clearCloseTimer();
      this.closeTimer = setTimeout(() => {
        this.rendered.set(false);
      }, 220);
    });
  }

  ngOnDestroy(): void {
    this.clearCloseTimer();
  }

  protected onBackdropClick(): void {
    if (!this.closeOnBackdrop()) {
      return;
    }

    this.closed.emit();
  }

  protected onCloseClick(): void {
    this.closed.emit();
  }

  protected onEscape(): void {
    if (!this.isOpen()) {
      return;
    }

    this.closed.emit();
  }

  private clearCloseTimer(): void {
    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
  }
}
