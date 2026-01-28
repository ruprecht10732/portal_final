import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { ButtonComponent } from '../../../shared/components/button/button.component';

@Component({
  selector: 'auth-verify-email',
  imports: [RouterLink, ButtonComponent],
  templateUrl: './verify-email.component.html',
  styleUrl: './verify-email.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VerifyEmailComponent {
  private readonly route = inject(ActivatedRoute);

  protected readonly token = toSignal(
    this.route.queryParamMap.pipe(map(params => params.get('token'))),
    { initialValue: null }
  );

  protected readonly isExpired = computed(() => this.token() === 'expired');
  protected readonly isMissing = computed(() => !this.token());
  protected readonly isSuccess = computed(() => !!this.token() && !this.isExpired());
}
