import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-catalog-create',
  imports: [TranslateModule],
  templateUrl: './catalog-create.component.html',
  styleUrl: './catalog-create.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogCreateComponent {}
