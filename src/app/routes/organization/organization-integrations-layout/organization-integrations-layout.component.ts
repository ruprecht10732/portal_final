import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-organization-integrations-layout',
  imports: [RouterOutlet],
  templateUrl: './organization-integrations-layout.component.html',
  styleUrl: './organization-integrations-layout.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganizationIntegrationsLayoutComponent {}
