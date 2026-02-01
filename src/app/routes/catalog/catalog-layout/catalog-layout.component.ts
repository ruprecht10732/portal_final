import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-catalog-layout',
  imports: [RouterOutlet],
  templateUrl: './catalog-layout.component.html',
  styleUrl: './catalog-layout.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogLayoutComponent {}
