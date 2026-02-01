import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-organization-layout',
  imports: [RouterOutlet],
  templateUrl: './organization-layout.component.html',
  styleUrl: './organization-layout.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganizationLayoutComponent {}
