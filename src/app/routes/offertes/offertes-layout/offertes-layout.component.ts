import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-offertes-layout',
  imports: [RouterOutlet],
  templateUrl: './offertes-layout.component.html',
  styleUrl: './offertes-layout.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OffertesLayoutComponent {}
