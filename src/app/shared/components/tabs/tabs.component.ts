import { Component, ChangeDetectionStrategy } from '@angular/core';
import { Tabs } from '@angular/aria/tabs';

@Component({
  selector: 'shared-tabs',
  standalone: true,
  imports: [],
  hostDirectives: [Tabs],
  template: `
    <ng-content />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
      width: 100%;
    }
  `,
})
export class TabsComponent {}
