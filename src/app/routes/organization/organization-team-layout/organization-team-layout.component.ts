import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-organization-team-layout',
  imports: [RouterOutlet],
  templateUrl: './organization-team-layout.component.html',
  styleUrl: './organization-team-layout.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganizationTeamLayoutComponent {}
