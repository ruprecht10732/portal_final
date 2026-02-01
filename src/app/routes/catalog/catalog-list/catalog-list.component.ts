import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-catalog-list',
  imports: [TranslateModule],
  templateUrl: './catalog-list.component.html',
  styleUrl: './catalog-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogListComponent {}
