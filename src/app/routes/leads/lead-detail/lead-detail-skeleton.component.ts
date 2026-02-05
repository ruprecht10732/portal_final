import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CardComponent } from '../../../shared/components/card/card.component';
import { SkeletonComponent } from '../../../shared/components/skeleton/skeleton.component';

@Component({
  selector: 'app-lead-detail-skeleton',
  templateUrl: './lead-detail-skeleton.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardComponent, SkeletonComponent],
})
export class LeadDetailSkeletonComponent {}
