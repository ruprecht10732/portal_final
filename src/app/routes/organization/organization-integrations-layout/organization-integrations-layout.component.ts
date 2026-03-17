import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-organization-integrations-layout',
  imports: [RouterOutlet],
  templateUrl: './organization-integrations-layout.component.html',
  styleUrl: './organization-integrations-layout.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'xl:flex xl:flex-col xl:flex-1 xl:min-h-0 xl:overflow-hidden' },
})
export class OrganizationIntegrationsLayoutComponent {}
