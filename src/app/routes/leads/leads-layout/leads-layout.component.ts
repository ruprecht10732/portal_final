import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-leads-layout',
  imports: [RouterOutlet],
  template: '<router-outlet />',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block min-h-full xl:flex xl:h-full xl:min-h-0 xl:flex-1 xl:flex-col xl:overflow-hidden',
  },
})
export class LeadsLayoutComponent {}
