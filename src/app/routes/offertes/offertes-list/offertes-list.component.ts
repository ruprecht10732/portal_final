import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-offertes-list',
  imports: [TranslateModule],
  templateUrl: './offertes-list.component.html',
  styleUrl: './offertes-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OffertesListComponent {}
