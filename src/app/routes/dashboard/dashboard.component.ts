import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DashboardKpiRowComponent } from './components/kpi-row/dashboard-kpi-row.component';

@Component({
  selector: 'app-dashboard',
  imports: [DashboardKpiRowComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent {
}
