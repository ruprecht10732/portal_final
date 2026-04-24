---
name: angular-component
description: Generate Angular 21 standalone components following project conventions
compatibility: opencode
metadata:
  audience: frontend-developers
  stack: angular21
---

## What I do

Generate Angular 21 standalone components with modern patterns including signals, `inject()`, and OnPush change detection.

## When to use me

Use this skill when creating new Angular components, directives, pipes, or services. I ensure consistency with Angular 21 best practices and this project's conventions.

## Component Template

```typescript
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-example',
  standalone: true,
  imports: [],
  template: `
    <div>{{ title() }}</div>
    <button (click)="onClick()">Click</button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExampleComponent {
  readonly title = input.required<string>();
  readonly clicked = output<void>();

  onClick(): void {
    this.clicked.emit();
  }
}
```

## Service Template

```typescript
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class ExampleService {
  private readonly http = inject(HttpClient);

  getData() {
    return this.http.get('/api/data');
  }
}
```

## Key Patterns

- **Standalone**: Always use `standalone: true`, no NgModules
- **Signals**: Use `input()`, `output()`, `model()` for component communication
- **inject()**: Use `inject()` instead of constructor injection
- **OnPush**: Use `ChangeDetectionStrategy.OnPush` for performance
- **Required inputs**: Use `input.required<T>()` for mandatory inputs
- **Readonly**: Mark signal-based properties as `readonly`

## File Naming
- Components: `feature-name.component.ts`
- Services: `feature-name.service.ts`
- Directives: `feature-name.directive.ts`
- Pipes: `feature-name.pipe.ts`
