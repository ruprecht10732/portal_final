import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'shared-toast-container',
  templateUrl: './toast-container.component.html',
  styleUrl: './toast-container.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToastContainerComponent {
  private readonly toastService = inject(ToastService);
  protected readonly toasts = computed(() => this.toastService.toasts());

  protected dismiss(id: string): void {
    this.toastService.dismiss(id);
  }
}
