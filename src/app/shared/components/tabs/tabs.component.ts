import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'shared-tabs',
  imports: [],
  template: `<ng-content />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
      width: 100%;
    }
  `,
})
export class TabsComponent {}
