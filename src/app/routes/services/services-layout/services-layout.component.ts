import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-services-layout',
  imports: [RouterOutlet],
  template: '<div class="px-4"><router-outlet /></div>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServicesLayoutComponent {}
