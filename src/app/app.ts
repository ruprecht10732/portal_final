import { Component, signal } from '@angular/core';
import { ButtonComponent } from './shared/components/button/button.component';
import { InputComponent } from './shared/components/input/input.component';
import { TextareaComponent } from './shared/components/textarea/textarea.component';
import { CheckboxComponent } from './shared/components/checkbox/checkbox.component';
import { SelectComponent } from './shared/components/select/select.component';
import { TabsComponent } from './shared/components/tabs/tabs.component';

@Component({
  selector: 'app-root',
  imports: [ButtonComponent, InputComponent, TextareaComponent, CheckboxComponent, SelectComponent, TabsComponent],
  templateUrl: './app.html'
})
export class App {
  email = signal('');
  password = signal('');
  bio = signal('');
  country = signal('us');
  agreeToTerms = signal(false);
  activeTab = signal('profile');

  countryOptions = [
    { label: 'United States', value: 'us' },
    { label: 'United Kingdom', value: 'uk' },
    { label: 'Germany', value: 'de' },
    { label: 'France', value: 'fr' },
    { label: 'Japan', value: 'jp' }
  ];
}
