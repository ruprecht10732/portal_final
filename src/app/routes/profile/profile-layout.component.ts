import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-profile-layout',
  imports: [RouterOutlet],
  templateUrl: './profile-layout.component.html',
  styleUrl: './profile-layout.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileLayoutComponent {}
