import { Component, signal } from '@angular/core';
import { ButtonComponent } from './shared/components/button/button.component';
import { InputComponent } from './shared/components/input/input.component';
import { TextareaComponent } from './shared/components/textarea/textarea.component';
import { CheckboxComponent } from './shared/components/checkbox/checkbox.component';
import { SelectComponent } from './shared/components/select/select.component';
import { MultiSelectComponent } from './shared/components/multiselect/multiselect.component';
import { AutocompleteComponent } from './shared/components/autocomplete/autocomplete.component';
import { CalendarGridComponent } from './shared/components/calendar-grid/calendar-grid.component';
import { TabsComponent } from './shared/components/tabs/tabs.component';
import { DataGridComponent, DataGridStore, GridColumn, GridConfig } from './shared/components/data-grid';

interface User extends Record<string, unknown> {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
  department: string;
}

@Component({
  selector: 'app-root',
  imports: [
    ButtonComponent,
    InputComponent,
    TextareaComponent,
    CheckboxComponent,
    SelectComponent,
    MultiSelectComponent,
    AutocompleteComponent,
    CalendarGridComponent,
    TabsComponent,
    DataGridComponent,
  ],
  providers: [DataGridStore],
  templateUrl: './app.html'
})
export class App {
  email = signal('');
  password = signal('');
  bio = signal('');
  country = signal('us');
  resources = signal<string[]>([]);
  framework = signal('');
  calendarView = signal<'day' | 'week' | 'month'>('day');
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

  frameworkOptions = [
    { label: 'Angular', value: 'angular' },
    { label: 'React', value: 'react' },
    { label: 'Vue', value: 'vue' },
    { label: 'Svelte', value: 'svelte' },
    { label: 'Solid', value: 'solid' },
    { label: 'Next.js', value: 'next' },
    { label: 'Nuxt', value: 'nuxt' },
    { label: 'Qwik', value: 'qwik' },
    { label: 'Astro', value: 'astro' },
  ];

  unavailableDates = [
    '2026-01-10',
    '2026-01-14',
    '2026-01-21',
    '2026-01-26',
  ];

  dayViewStartHour = 8;
  dayViewEndHour = 20;
  dayViewHourStep = 1;
  dayViewTimeSlotMinutes = 30;
  dayViewBlockedHours = [12, 13, 17];
  dayViewBlockedRanges = [
    { start: 9, end: 10 },
    { start: 15, end: 16 },
  ];
  dayViewBlockedTimes = [9 * 60 + 30, 14 * 60];
  dayViewBlockedTimeRanges = [
    { start: 11 * 60, end: 12 * 60 },
    { start: 16 * 60, end: 17 * 60 },
  ];

  calendarShowWeekNumbers = true;
  calendarShowHolidays = true;
  calendarHolidays = [
    { iso: '2026-01-01', name: 'New Year\'s Day' },
    { iso: '2026-07-04', name: 'Independence Day' },
    { iso: '2026-12-25', name: 'Christmas Day' },
  ];

  // Data Grid Configuration
  userColumns: GridColumn<User>[] = [
    { id: 'name', field: 'name', header: 'Name', sortable: true, filterable: true, editable: true, minWidth: '150px' },
    { id: 'email', field: 'email', header: 'Email', sortable: true, filterable: true, editable: true, minWidth: '200px' },
    { 
      id: 'role', 
      field: 'role', 
      header: 'Role', 
      sortable: true, 
      filterable: true, 
      editable: true, 
      cellType: 'select',
      selectOptions: [
        { label: 'Admin', value: 'admin' },
        { label: 'Editor', value: 'editor' },
        { label: 'Viewer', value: 'viewer' },
      ],
      minWidth: '120px'
    },
    { 
      id: 'status', 
      field: 'status', 
      header: 'Status', 
      sortable: true, 
      filterable: true, 
      editable: true,
      cellType: 'select',
      selectOptions: [
        { label: 'Active', value: 'active' },
        { label: 'Inactive', value: 'inactive' },
        { label: 'Pending', value: 'pending' },
      ],
      minWidth: '100px'
    },
    { id: 'department', field: 'department', header: 'Department', sortable: true, filterable: true, editable: true, minWidth: '130px' },
  ];

  userGridConfig: Partial<GridConfig<User>> = {
    rowIdField: 'id',
    selectable: true,
    navigationMode: 'pagination',
  };

  sampleUsers = signal<User[]>([
    { id: 1, name: 'Alice Johnson', email: 'alice@example.com', role: 'admin', status: 'active', department: 'Engineering' },
    { id: 2, name: 'Bob Smith', email: 'bob@example.com', role: 'editor', status: 'active', department: 'Marketing' },
    { id: 3, name: 'Carol White', email: 'carol@example.com', role: 'viewer', status: 'inactive', department: 'Sales' },
    { id: 4, name: 'David Brown', email: 'david@example.com', role: 'editor', status: 'active', department: 'Engineering' },
    { id: 5, name: 'Eva Martinez', email: 'eva@example.com', role: 'admin', status: 'pending', department: 'HR' },
    { id: 6, name: 'Frank Wilson', email: 'frank@example.com', role: 'viewer', status: 'active', department: 'Finance' },
    { id: 7, name: 'Grace Lee', email: 'grace@example.com', role: 'editor', status: 'active', department: 'Engineering' },
    { id: 8, name: 'Henry Davis', email: 'henry@example.com', role: 'viewer', status: 'inactive', department: 'Marketing' },
    { id: 9, name: 'Ivy Chen', email: 'ivy@example.com', role: 'admin', status: 'active', department: 'Operations' },
    { id: 10, name: 'Jack Taylor', email: 'jack@example.com', role: 'editor', status: 'pending', department: 'Sales' },
  ]);

  onSaveRows(rows: User[]): void {
    const current = this.sampleUsers();
    const maxId = current.reduce((max, user) => Math.max(max, user.id), 0);
    let nextId = maxId + 1;

    const updated = [...current];
    for (const row of rows) {
      if (!row.id || typeof row.id !== 'number') {
        updated.unshift({ ...row, id: nextId++ });
        continue;
      }
      const index = updated.findIndex(user => user.id === row.id);
      if (index >= 0) {
        updated[index] = { ...updated[index], ...row };
      } else {
        updated.unshift(row);
      }
    }

    this.sampleUsers.set(updated);
  }

  onDeleteRows(rows: User[]): void {
    const ids = new Set(rows.map(row => row.id));
    this.sampleUsers.set(this.sampleUsers().filter(user => !ids.has(user.id)));
  }
}
