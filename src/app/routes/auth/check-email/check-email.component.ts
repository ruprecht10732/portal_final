import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonComponent } from '../../../shared/components/button/button.component';

@Component({
  selector: 'auth-check-email',
  imports: [RouterLink, TranslatePipe, ButtonComponent],
  templateUrl: './check-email.component.html',
  styleUrl: './check-email.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckEmailComponent {
  protected readonly cooldown = signal(0);

  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly translate = inject(TranslateService);
  private intervalId: number | null = null;

  protected readonly mode = toSignal(
    this.route.queryParamMap.pipe(map(params => params.get('mode'))),
    { initialValue: 'signup' }
  );

  protected readonly title = computed(() =>
    this.mode() === 'reset'
      ? this.translate.instant('auth.checkEmail.titleReset')
      : this.translate.instant('auth.checkEmail.titleSignup')
  );

  protected readonly message = computed(() =>
    this.mode() === 'reset'
      ? this.translate.instant('auth.checkEmail.messageReset')
      : this.translate.instant('auth.checkEmail.messageSignup')
  );

  protected readonly resendLabel = computed(() => {
    if (this.cooldown() === 0) return this.translate.instant('auth.checkEmail.resend');
    const seconds = this.cooldown().toString().padStart(2, '0');
    return this.translate.instant('auth.checkEmail.resendCooldown', { seconds });
  });

  constructor() {
    this.destroyRef.onDestroy(() => this.clearInterval());
  }

  protected resend(): void {
    if (this.cooldown() > 0) return;
    this.cooldown.set(30);
    this.clearInterval();
    this.intervalId = globalThis.setInterval(() => {
      this.cooldown.update(value => Math.max(0, value - 1));
      if (this.cooldown() === 0) {
        this.clearInterval();
      }
    }, 1000);
  }

  private clearInterval(): void {
    if (this.intervalId !== null) {
      globalThis.clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
