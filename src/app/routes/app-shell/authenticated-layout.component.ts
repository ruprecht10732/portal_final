import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { ButtonComponent } from '../../shared/components/button/button.component';

@Component({
  selector: 'app-authenticated-layout',
  imports: [RouterLink, RouterOutlet, ButtonComponent],
  templateUrl: './authenticated-layout.component.html',
  styleUrl: './authenticated-layout.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthenticatedLayoutComponent {
  protected readonly showTimeoutWarning = signal(false);

  protected openTimeoutWarning(): void {
    this.showTimeoutWarning.set(true);
  }

  protected closeTimeoutWarning(): void {
    this.showTimeoutWarning.set(false);
  }
}
