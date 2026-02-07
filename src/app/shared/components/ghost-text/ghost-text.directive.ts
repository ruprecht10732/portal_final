import {
  Directive,
  ElementRef,
  Renderer2,
  inject,
  input,
  output,
  OnInit,
  OnDestroy,
  DestroyRef,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, distinctUntilChanged, filter, switchMap, EMPTY } from 'rxjs';

/**
 * Represents a single autocomplete suggestion from the catalog.
 * The consumer decides what data to act on when accepted.
 */
export interface GhostSuggestion {
  /** The display text to show as ghost text (title or description). */
  displayText: string;
  /** Arbitrary payload passed back on accept. */
  payload: unknown;
}

/**
 * A directive that provides inline ghost-text autocomplete for textareas.
 *
 * Usage:
 * ```html
 * <textarea
 *   appGhostText
 *   [ghostSearchFn]="searchFn"
 *   (ghostAccepted)="onAccept($event)"
 * ></textarea>
 * ```
 *
 * The directive overlays a transparent ghost suggestion after the typed text.
 * Press `Tab` to accept the suggestion, `Escape` to dismiss.
 */
@Directive({
  selector: 'textarea[appGhostText]',
  host: {
    '(input)': 'onInput($event)',
    '(keydown)': 'onKeydown($event)',
    '(blur)': 'dismissSuggestion()',
    '[style.position]': '"relative"',
    '[style.caretColor]': '"black"',
  },
})
export class GhostTextDirective implements OnInit, OnDestroy {
  private readonly el = inject<ElementRef<HTMLTextAreaElement>>(ElementRef);
  private readonly renderer = inject(Renderer2);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * A function that returns an Observable of suggestions for a given query string.
   * The consumer is responsible for calling the API (e.g., CatalogService.searchForAutocomplete).
   */
  ghostSearchFn = input.required<(query: string) => import('rxjs').Observable<GhostSuggestion[]>>();

  /** Minimum characters before triggering a search. */
  ghostMinChars = input(3);

  /** Debounce time in ms for the search input. */
  ghostDebounce = input(250);

  /** Emitted when the user accepts a ghost suggestion (Tab key). */
  ghostAccepted = output<GhostSuggestion>();

  private readonly input$ = new Subject<string>();
  private readonly currentSuggestion = signal<GhostSuggestion | null>(null);
  private overlayEl: HTMLDivElement | null = null;

  ngOnInit(): void {
    this.createOverlay();

    this.input$
      .pipe(
        debounceTime(this.ghostDebounce()),
        distinctUntilChanged(),
        filter(q => q.trim().length >= this.ghostMinChars()),
        switchMap(query => {
          const fn = this.ghostSearchFn();
          if (!fn) return EMPTY;
          return fn(query);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(suggestions => {
        if (suggestions.length > 0) {
          this.currentSuggestion.set(suggestions[0]!);
          this.updateOverlay();
        } else {
          this.dismissSuggestion();
        }
      });
  }

  ngOnDestroy(): void {
    this.removeOverlay();
  }

  protected onInput(event: Event): void {
    const value = (event.target as HTMLTextAreaElement).value;
    this.input$.next(value);

    // If typing diverged from current ghost, dismiss
    const suggestion = this.currentSuggestion();
    if (suggestion && !suggestion.displayText.toLowerCase().startsWith(value.toLowerCase())) {
      this.dismissSuggestion();
    } else if (suggestion) {
      this.updateOverlay();
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    const suggestion = this.currentSuggestion();
    if (!suggestion) return;

    if (event.key === 'Tab') {
      event.preventDefault();
      this.acceptSuggestion(suggestion);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.dismissSuggestion();
    }
  }

  private acceptSuggestion(suggestion: GhostSuggestion): void {
    const textarea = this.el.nativeElement;
    textarea.value = suggestion.displayText;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    this.ghostAccepted.emit(suggestion);
    this.currentSuggestion.set(null);
    this.updateOverlay();
  }

  protected dismissSuggestion(): void {
    this.currentSuggestion.set(null);
    this.updateOverlay();
  }

  // ── Overlay Management ──────────────────────────────────────────────────────

  private createOverlay(): void {
    const textarea = this.el.nativeElement;
    const parent = textarea.parentElement;
    if (!parent) return;

    // Ensure parent is positioned so overlay can be absolute-positioned
    const parentPosition = getComputedStyle(parent).position;
    if (parentPosition === 'static') {
      this.renderer.setStyle(parent, 'position', 'relative');
    }

    this.overlayEl = this.renderer.createElement('div') as HTMLDivElement;
    this.renderer.setStyle(this.overlayEl, 'position', 'absolute');
    this.renderer.setStyle(this.overlayEl, 'top', '0');
    this.renderer.setStyle(this.overlayEl, 'left', '0');
    this.renderer.setStyle(this.overlayEl, 'right', '0');
    this.renderer.setStyle(this.overlayEl, 'bottom', '0');
    this.renderer.setStyle(this.overlayEl, 'pointer-events', 'none');
    this.renderer.setStyle(this.overlayEl, 'overflow', 'hidden');
    this.renderer.setStyle(this.overlayEl, 'white-space', 'pre-wrap');
    this.renderer.setStyle(this.overlayEl, 'word-wrap', 'break-word');
    this.renderer.setStyle(this.overlayEl, 'color', 'transparent');
    this.renderer.setStyle(this.overlayEl, 'z-index', '1');

    // Copy font styles from textarea
    this.copyFontStyles(textarea);

    this.renderer.appendChild(parent, this.overlayEl);
  }

  private copyFontStyles(textarea: HTMLTextAreaElement): void {
    if (!this.overlayEl) return;
    const computed = getComputedStyle(textarea);
    const props = [
      'fontFamily', 'fontSize', 'fontWeight', 'fontStyle',
      'letterSpacing', 'lineHeight', 'textTransform',
      'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
      'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
      'boxSizing',
    ];
    for (const prop of props) {
      this.renderer.setStyle(this.overlayEl, prop, computed.getPropertyValue(this.camelToKebab(prop)));
    }
  }

  private updateOverlay(): void {
    if (!this.overlayEl) return;

    const suggestion = this.currentSuggestion();
    const textarea = this.el.nativeElement;
    const typed = textarea.value;

    if (!suggestion || !typed.trim()) {
      this.overlayEl.innerHTML = '';
      return;
    }

    const ghostText = suggestion.displayText;
    // Only show if the ghost text starts with what's typed
    if (!ghostText.toLowerCase().startsWith(typed.toLowerCase())) {
      this.overlayEl.innerHTML = '';
      return;
    }

    const remaining = ghostText.substring(typed.length);
    if (!remaining) {
      this.overlayEl.innerHTML = '';
      return;
    }

    // Build: invisible typed part + visible ghost remainder
    const invisiblePart = document.createElement('span');
    invisiblePart.style.visibility = 'hidden';
    invisiblePart.textContent = typed;

    const ghostPart = document.createElement('span');
    ghostPart.style.color = 'var(--ghost-text-color, #a1a1aa)';
    ghostPart.textContent = remaining;

    this.overlayEl.innerHTML = '';
    this.overlayEl.appendChild(invisiblePart);
    this.overlayEl.appendChild(ghostPart);
  }

  private removeOverlay(): void {
    if (this.overlayEl?.parentElement) {
      this.overlayEl.remove();
    }
    this.overlayEl = null;
  }

  private camelToKebab(str: string): string {
    return str.replaceAll(/[A-Z]/g, m => '-' + m.toLowerCase());
  }
}
