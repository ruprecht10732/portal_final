---
title: "ADR-0003: Rich Text Integration & Quote Editor Enhancements"
status: "Proposed"
date: "2026-02-16"
authors: "Portal Development Team"
tags: ["frontend", "ux", "quill", "refactor"]
supersedes: ""
superseded_by: ""
---

# ADR-0003: Rich Text Integration & Quote Editor Enhancements

## Status
**Proposed**

## Context
The application currently relies on standard HTML `<textarea>` elements for all multi-line input. While functional, this limits the user's ability to create professional-looking content in critical areas:
1.  **Workflows (Email/WhatsApp templates):** Users cannot bold text, add links, or structure lists.
2.  **Catalog Descriptions:** Products cannot have structured technical specifications.
3.  **Quote Notes:** Legal disclaimers or introductions cannot be formatted.

Additionally, the **Quote Creation Table** (`offertes-create`) uses a traditional HTML `<table>` structure. This presents several limitations:
1.  **Responsiveness:** Tables behave poorly on mobile devices, requiring a separate DOM structure (currently implemented as a separate mobile div stack).
2.  **Information Density:** As we add more fields (e.g., product images, extended descriptions, internal metadata), the table becomes cramped.
3.  **HTML Rendering:** If we allow Rich Text in catalog items, the current textareas in the quote editor will display raw HTML tags instead of formatted text.

## Decision

We will implement a two-phased improvement strategy.

### Phase 1: Rich Text Integration (`ngx-quill`)

We will introduce `ngx-quill` to specific "Block Text" areas of the application.

1.  **Wrapper Component:** Create `SharedRichTextEditorComponent` to encapsulate `ngx-quill` configuration, styling (Tailwind typography), and sanitation.
2.  **Target Areas for immediate adoption:**
    *   **Organization Settings > Workflows:** Email templates and WhatsApp templates.
    *   **Catalog > Product Form:** `description` and `intakeGuidelines`.
    *   **Quote > Summary Form:** `notes` field.
3.  **Exclusion (for now):** We will **NOT** replace the *Quote Line Item Description* textarea with Quill immediately.
    *   *Reasoning:* That specific field uses the `appGhostText` directive for AI/Catalog autocomplete. Quill intercepts DOM events, which would break the current lightweight autocomplete implementation.
    *   *Alternative:* Line items will remain textareas for input, but we will update the *render* logic to parse HTML if the data comes from a Catalog item that contains HTML.

### Phase 2: Quote Editor Refactor (CSS Grid)

We will refactor `src/app/routes/offertes/offertes-create` to move away from `<table>`.

1.  **CSS Grid Layout:** Replace `<table>` with a CSS Grid structure.
    *   **Desktop:** `grid-template-columns: 80px 1fr 120px 120px 120px 100px 50px` (Qty | Desc | Price | Tax | Total | Opt | Actions).
    *   **Mobile:** Single column stack (using the same components, just different CSS classes via Tailwind).
2.  **Componentization:** Extract the row logic into a sub-component `app-quote-line-item-row`.
    *   This isolates the complex logic of ghost-text, price calculation, and responsive shifting.
3.  **HTML Parsing:** Implement a toggle view for the Description field.
    *   *Edit Mode:* Textarea (supports Markdown-style input and Ghost Text).
    *   *View Mode:* Rendered HTML (using `[innerHTML]` with DomSanitizer).

## Technical Implementation

### 1. Dependencies
```bash
npm install ngx-quill quill
npm install --save-dev @types/quill
```

### 2. Shared Rich Text Component
Create `src/app/shared/components/rich-text-editor/rich-text-editor.component.ts`.
*   **Input:** `ngModel` (ControlValueAccessor).
*   **Config:** Minimal toolbar (Bold, Italic, List, Link, Clean).
*   **Styling:** Use `.ql-container { @apply rounded-lg border-zinc-200 ... }` to match existing input styles.

### 3. Quote Editor Refactor

**Current Structure:**
```html
<!-- Mobile -->
<div class="sm:hidden">...</div>
<!-- Desktop -->
<table class="hidden sm:block">...</table>
```

**New Structure (Unified):**
```html
<div class="quote-editor-grid" role="grid">
  <!-- Headers (Hidden on Mobile) -->
  <div class="grid-header hidden lg:grid">...</div>

  <!-- Rows -->
  @for (item of lineItems(); track item.id) {
    <app-quote-line-item
      [item]="item"
      (change)="update($event)"
      (remove)="remove($event)"
    />
  }
</div>
```

**Row Layout (CSS Grid):**
```css
/* lg: breakpoint */
.quote-row {
  display: grid;
  grid-template-columns: min-content 1fr min-content min-content min-content min-content auto;
  align-items: start;
}
```

### 4. HTML Parsing in Quote Rows
Since we aren't using Quill for the line item input (to preserve Ghost Text), we will support **basic HTML rendering** for Catalog items that *already* have HTML descriptions.

*   In `app-quote-line-item`:
    *   Use `[innerHTML]="item.description | markdown"` (Reuse/Extend existing Markdown pipe or create `SafeHtmlPipe`).
    *   If the user clicks to edit, swap to `<textarea>` to allow modification of the raw text.

## Consequences

### Positive
*   **Professional Output:** Emails and Quote Notes will look significantly more professional.
*   **Maintainability:** Removing the duplicate Mobile/Desktop DOM structures in the Quote Editor reduces code size and bugs.
*   **Responsiveness:** CSS Grid handles complex, multi-line content (like long descriptions) better than `<table>` without breaking layout.
*   **Extensibility:** Easier to add columns (e.g., "Discount % per line") in the future using Grid than Table.

### Negative
*   **Bundle Size:** Quill adds weight to the main bundle. We should lazy load `QuillModule` or the routes using it.
*   **Complexity:** Mixing "Textarea for editing" and "HTML for viewing" in line items adds state management (edit vs view mode) to the row component.
*   **Migration:** Existing plain-text descriptions will need to be treated as such; new rich-text descriptions need to be sanitized to prevent XSS.

## Roadmap
1.  Install Quill & create Shared Component.
2.  Apply Quill to Workflow Email Templates (highest value).
3.  Refactor Quote Editor to CSS Grid.
4.  Apply Quill to Catalog Descriptions.
