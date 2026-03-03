import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-partners-offers-layout',
  imports: [RouterOutlet],
  templateUrl: './partners-offers-layout.component.html',
  styleUrl: './partners-offers-layout.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartnersOffersLayoutComponent {}
