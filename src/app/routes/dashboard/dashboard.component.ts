import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ActionItemsComponent } from './components/action-items/action-items.component';
import { ActivityFeedComponent } from './components/activity-feed/activity-feed.component';
import { DraftApprovalsComponent } from './components/draft-approvals/draft-approvals.component';
import { LeadHeatmapComponent } from './components/lead-heatmap/lead-heatmap.component';
import { DashboardKpiRowComponent } from './components/kpi-row/dashboard-kpi-row.component';
import { UpcomingScheduleComponent } from './components/upcoming-schedule/upcoming-schedule.component';

@Component({
  selector: 'app-dashboard',
  imports: [DashboardKpiRowComponent, LeadHeatmapComponent, ActionItemsComponent, DraftApprovalsComponent, ActivityFeedComponent, UpcomingScheduleComponent, TranslatePipe],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent {
}
