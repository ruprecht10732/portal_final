import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-home',
  templateUrl: './app-home.component.html',
  styleUrl: './app-home.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppHomeComponent {}
