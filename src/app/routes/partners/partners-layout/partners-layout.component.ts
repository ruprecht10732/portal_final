import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-partners-layout',
  imports: [RouterOutlet],
  templateUrl: './partners-layout.component.html',
  styleUrl: './partners-layout.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartnersLayoutComponent {}
