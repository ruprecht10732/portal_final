import { Component, signal } from '@angular/core';
import { ButtonComponent } from './shared/components/button/button.component';
import { InputComponent } from './shared/components/input/input.component';
import { TextareaComponent } from './shared/components/textarea/textarea.component';
import { CheckboxComponent } from './shared/components/checkbox/checkbox.component';
import { SelectComponent } from './shared/components/select/select.component';
import { MultiSelectComponent } from './shared/components/multiselect/multiselect.component';
import { TabsComponent } from './shared/components/tabs/tabs.component';

@Component({
  selector: 'app-root',
  imports: [
    ButtonComponent,
    InputComponent,
    TextareaComponent,
    CheckboxComponent,
    SelectComponent,
    MultiSelectComponent,
    TabsComponent,
  ],
  templateUrl: './app.html'
})
export class App {
  email = signal('');
  password = signal('');
  bio = signal('');
  country = signal('us');
  resources = signal<string[]>([]);
  agreeToTerms = signal(false);
  activeTab = signal('profile');

  countryOptions = [
    { label: 'United States', value: 'us' },
    { label: 'United Kingdom', value: 'uk' },
    { label: 'Germany', value: 'de' },
    { label: 'France', value: 'fr' },
    { label: 'Japan', value: 'jp' }
  ];

  resourceOptions = [
    { label: 'Docs', value: 'docs' },
    { label: 'Tutorials', value: 'tutorials' },
    { label: 'Playground', value: 'playground' },
    { label: 'Reference', value: 'reference' },
    { label: 'Introduction — What is Angular?', value: 'intro-what-is-angular' },
    { label: 'Introduction — Installation', value: 'intro-installation' },
    { label: 'Introduction — Start coding! 🚀', value: 'intro-start-coding' },
    { label: 'In-depth Guides — Drag and drop', value: 'guides-drag-drop' },
    { label: 'Build with AI (New) — Get Started', value: 'ai-get-started' },
    { label: 'Build with AI (New) — LLM prompts and AI IDE setup', value: 'ai-llm-prompts' },
    { label: 'Build with AI (New) — Design Patterns', value: 'ai-design-patterns' },
    { label: 'Build with AI (New) — Angular CLI MCP Server setup', value: 'ai-mcp-setup' },
    { label: 'Build with AI (New) — Angular AI Tutor', value: 'ai-tutor' },
    { label: 'Developer Tools — Language Service', value: 'devtools-language-service' },
    { label: 'Best Practices — Style Guide (Updated)', value: 'best-style-guide' },
    { label: 'Best Practices — Security', value: 'best-security' },
    { label: 'Best Practices — Accessibility', value: 'best-accessibility' },
    { label: 'Best Practices — Unhandled errors in Angular', value: 'best-unhandled-errors' },
    { label: 'Best Practices — Keeping up-to-date', value: 'best-keeping-up-to-date' },
    { label: 'Developer Events — Angular v21 Release (New)', value: 'events-v21-release' },
    { label: 'Extended Ecosystem — NgModules', value: 'ecosystem-ngmodules' },
    { label: 'Extended Ecosystem — Web workers', value: 'ecosystem-web-workers' },
    { label: 'Extended Ecosystem — Custom build pipeline', value: 'ecosystem-custom-build' },
    { label: 'Extended Ecosystem — Tailwind (New)', value: 'ecosystem-tailwind' },
    { label: 'Extended Ecosystem — Angular Fire', value: 'ecosystem-angular-fire' },
    { label: 'Extended Ecosystem — Google Maps', value: 'ecosystem-google-maps' },
    { label: 'Extended Ecosystem — Google Pay', value: 'ecosystem-google-pay' },
    { label: 'Extended Ecosystem — YouTube player', value: 'ecosystem-youtube-player' },
    { label: 'Extended Ecosystem — Angular CDK', value: 'ecosystem-angular-cdk' },
    { label: 'Extended Ecosystem — Angular Material', value: 'ecosystem-angular-material' },
    { label: 'Aria Patterns — Overview', value: 'aria-overview' },
    { label: 'Aria Patterns — Accordion', value: 'aria-accordion' },
    { label: 'Aria Patterns — Autocomplete', value: 'aria-autocomplete' },
    { label: 'Aria Patterns — Combobox', value: 'aria-combobox' },
    { label: 'Aria Patterns — Grid', value: 'aria-grid' },
    { label: 'Aria Patterns — Listbox', value: 'aria-listbox' },
    { label: 'Aria Patterns — Menu', value: 'aria-menu' },
    { label: 'Aria Patterns — Menubar', value: 'aria-menubar' },
    { label: 'Aria Patterns — Multiselect', value: 'aria-multiselect' },
    { label: 'Aria Patterns — Select', value: 'aria-select' },
    { label: 'Aria Patterns — Tabs', value: 'aria-tabs' },
    { label: 'Aria Patterns — Toolbar', value: 'aria-toolbar' },
    { label: 'Aria Patterns — Tree', value: 'aria-tree' }
  ];
}
