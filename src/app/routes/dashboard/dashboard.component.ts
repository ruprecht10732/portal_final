import { ChangeDetectionStrategy, Component } from '@angular/core';
import { LeadHeatmapComponent } from './components/lead-heatmap/lead-heatmap.component';
import { DashboardKpiRowComponent } from './components/kpi-row/dashboard-kpi-row.component';

@Component({
  selector: 'app-dashboard',
  imports: [DashboardKpiRowComponent, LeadHeatmapComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent {
}
