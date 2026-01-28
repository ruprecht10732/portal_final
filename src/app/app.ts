import { Component, signal } from '@angular/core';
import { ButtonComponent } from './shared/components/button/button.component';
import { InputComponent } from './shared/components/input/input.component';
import { TextareaComponent } from './shared/components/textarea/textarea.component';
import { CheckboxComponent } from './shared/components/checkbox/checkbox.component';
import { TabsComponent } from './shared/components/tabs/tabs.component';
import { TabList, Tab, TabPanel } from '@angular/aria/tabs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ButtonComponent, InputComponent, TextareaComponent, CheckboxComponent, TabsComponent, TabList, Tab, TabPanel],
  templateUrl: './app.html'
})
export class App {
  email = signal('');
  password = signal('');
  bio = signal('');
  agreeToTerms = signal(false);
  activeTab = signal('profile');
}
