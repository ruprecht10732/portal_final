import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ActivityFeedComponent } from './components/activity-feed/activity-feed.component';
import { LeadHeatmapComponent } from './components/lead-heatmap/lead-heatmap.component';
import { DashboardKpiRowComponent } from './components/kpi-row/dashboard-kpi-row.component';
import { NeedsAttentionComponent } from './components/needs-attention/needs-attention.component';
import { PipelineOverviewComponent } from './components/pipeline-overview/pipeline-overview.component';
import { UpcomingScheduleComponent } from './components/upcoming-schedule/upcoming-schedule.component';

@Component({
  selector: 'app-dashboard',
  imports: [
    DashboardKpiRowComponent,
    LeadHeatmapComponent,
    NeedsAttentionComponent,
    PipelineOverviewComponent,
    ActivityFeedComponent,
    UpcomingScheduleComponent,
    TranslatePipe,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'lg:flex lg:flex-col lg:flex-1 lg:min-h-0 lg:overflow-y-auto' },
})
export class DashboardComponent {
}
