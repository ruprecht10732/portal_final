import { Component, signal } from '@angular/core';
import { ButtonComponent } from './shared/components/button/button.component';
import { InputComponent } from './shared/components/input/input.component';
import { TabsComponent } from './shared/components/tabs/tabs.component';
import { TabList, Tab, TabPanel } from '@angular/aria/tabs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ButtonComponent, InputComponent, TabsComponent, TabList, Tab, TabPanel],
  templateUrl: './app.html'
})
export class App {
  email = signal('');
  password = signal('');
  activeTab = signal('profile');
}
