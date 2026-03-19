import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { ConnectedPosition, OverlayModule } from '@angular/cdk/overlay';
import { TranslatePipe } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { firstValueFrom } from 'rxjs';

import type { AutocompleteItemResponse } from '../../../core/services/catalog.service';
import type { TaxRateDisplay } from '../../../core/services/quotes.types';
import type { GhostSuggestion } from '../../../shared/components/ghost-text/ghost-text.directive';
import { CheckboxComponent } from '../../../shared/components/checkbox/checkbox.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { NumberInputComponent } from '../../../shared/components/number-input/number-input.component';
import { RichTextEditorComponent } from '../../../shared/components/rich-text-editor/rich-text-editor.component';
import { SelectComponent, type SelectOption } from '../../../shared/components/select/select.component';

interface QuoteLineItemRowData {
  id: string;
  description: string;
  quantity: string;
  unitPrice: number;
  taxRate: TaxRateDisplay;
  optional: boolean;
}

@Component({
  selector: 'app-quote-line-item-row',
  imports: [
    DragDropModule,
    OverlayModule,
    TranslatePipe,
    LucideAngularModule,
    CheckboxComponent,
    InputComponent,
    NumberInputComponent,
    RichTextEditorComponent,
    SelectComponent,
  ],
  templateUrl: './quote-line-item-row.component.html',
  styleUrl: './quote-line-item-row.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuoteLineItemRowComponent implements AfterViewInit, OnDestroy {
  readonly item = input.required<QuoteLineItemRowData>();
  readonly totalDisplay = input.required<string>();
  readonly taxRateOptions = input<readonly SelectOption<TaxRateDisplay>[]>([]);
  readonly ghostSearchFn = input.required<(query: string) => import('rxjs').Observable<GhostSuggestion[]>>();

  readonly quantityChange = output<string>();
  readonly descriptionChange = output<string>();
  readonly unitPriceChange = output<number | null>();
  readonly taxRateChange = output<TaxRateDisplay | null>();
  readonly optionalChange = output<boolean | null>();
  readonly remove = output<void>();
  readonly ghostAccepted = output<GhostSuggestion>();
  protected readonly ghostSuggestions = signal<GhostSuggestion[]>([]);
  protected readonly ghostSelectedIndex = signal(0);
  protected readonly ghostLoading = signal(false);
  protected readonly ghostOverlayWidth = signal(320);
  protected readonly ghostOverlayPositions: ConnectedPosition[] = [
    {
      originX: 'start',
      originY: 'bottom',
      overlayX: 'start',
      overlayY: 'top',
      offsetY: 4,
    },
    {
      originX: 'start',
      originY: 'top',
      overlayX: 'start',
      overlayY: 'bottom',
      offsetY: -4,
    },
  ];

  private ghostRequestSequence = 0;
  private ghostDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private ghostSuppressNext = false;
  private ghostDismissedQuery: string | null = null;
  private resizeObserver?: ResizeObserver;

  private readonly ghostOrigin = viewChild.required<ElementRef<HTMLElement>>('ghostOrigin');

  ngAfterViewInit(): void {
    this.syncGhostOverlayWidth();
    const origin = this.ghostOrigin().nativeElement;
    this.resizeObserver = new ResizeObserver(() => this.syncGhostOverlayWidth());
    this.resizeObserver.observe(origin);
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    if (this.ghostDebounceTimer !== null) {
      clearTimeout(this.ghostDebounceTimer);
      this.ghostDebounceTimer = null;
    }
  }

  protected ghostSourceLabel(suggestion: GhostSuggestion): string {
    const item = suggestion.payload as AutocompleteItemResponse;
    return item.sourceLabel?.trim() || (item.sourceType === 'catalog' ? 'Catalog' : 'Referentie');
  }

  protected ghostDetail(suggestion: GhostSuggestion): string {
    const item = suggestion.payload as AutocompleteItemResponse;
    const details: string[] = [];
    const description = this.stripHtml(item.description ?? '');
    if (description) {
      details.push(description);
    }
    const priceCents = item.unitPriceCents || item.priceCents;
    if (priceCents > 0) {
      details.push(this.formatCurrency(priceCents / 100));
    }
    return details.join(' · ');
  }

  protected onDescriptionInput(value: string): void {
    this.descriptionChange.emit(value);
    const query = this.extractPlainText(value);

    if (this.ghostSuppressNext) {
      this.ghostSuppressNext = false;
      if (this.ghostDebounceTimer !== null) {
        clearTimeout(this.ghostDebounceTimer);
        this.ghostDebounceTimer = null;
      }
      return;
    }

    if (query !== this.ghostDismissedQuery) {
      this.ghostDismissedQuery = null;
    }

    if (query !== '' && query === this.ghostDismissedQuery) {
      this.cancelGhostLookup();
      return;
    }

    if (this.ghostDebounceTimer !== null) {
      clearTimeout(this.ghostDebounceTimer);
    }
    this.ghostDebounceTimer = setTimeout(() => {
      void this.lookupGhostSuggestion(value);
    }, 300);
  }

  protected onDescriptionKeydown(event: KeyboardEvent): void {
    const suggestions = this.ghostSuggestions();
    if (suggestions.length === 0) return;

    if (event.key === 'Tab') {
      const suggestion = suggestions[this.ghostSelectedIndex()];
      if (!suggestion) return;
      event.preventDefault();
      this.acceptGhostSuggestion(suggestion);
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const nextIndex = (this.ghostSelectedIndex() + 1) % suggestions.length;
      this.ghostSelectedIndex.set(nextIndex);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      const nextIndex = (this.ghostSelectedIndex() - 1 + suggestions.length) % suggestions.length;
      this.ghostSelectedIndex.set(nextIndex);
      return;
    }

    if (event.key === 'Enter') {
      const suggestion = suggestions[this.ghostSelectedIndex()];
      if (!suggestion) return;
      event.preventDefault();
      this.acceptGhostSuggestion(suggestion);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeGhostSuggestions();
    }
  }

  protected onGhostMouseEnter(index: number): void {
    this.ghostSelectedIndex.set(index);
  }

  protected onGhostSuggestionClick(suggestion: GhostSuggestion): void {
    this.acceptGhostSuggestion(suggestion);
  }

  protected closeGhostSuggestions(): void {
    this.ghostDismissedQuery = this.extractPlainText(this.item().description);
    this.cancelGhostLookup();
    this.ghostSuggestions.set([]);
    this.ghostSelectedIndex.set(0);
  }

  private async lookupGhostSuggestion(value: string): Promise<void> {
    const query = this.extractPlainText(value);
    if (query.length < 2) {
      this.ghostSuggestions.set([]);
      this.ghostSelectedIndex.set(0);
      this.ghostLoading.set(false);
      return;
    }

    const requestId = ++this.ghostRequestSequence;
    this.ghostLoading.set(true);

    try {
      const suggestions = await firstValueFrom(this.ghostSearchFn()(query));
      if (requestId !== this.ghostRequestSequence) return;
      this.ghostSuggestions.set(suggestions.slice(0, 10));
      this.ghostSelectedIndex.set(0);
    } catch {
      if (requestId !== this.ghostRequestSequence) return;
      this.ghostSuggestions.set([]);
      this.ghostSelectedIndex.set(0);
    } finally {
      if (requestId === this.ghostRequestSequence) {
        this.ghostLoading.set(false);
      }
    }
  }

  private acceptGhostSuggestion(suggestion: GhostSuggestion): void {
    this.cancelGhostLookup();
    this.ghostDismissedQuery = null;
    this.ghostSuppressNext = true;
    this.ghostAccepted.emit(suggestion);
    this.ghostSuggestions.set([]);
    this.ghostSelectedIndex.set(0);
  }

  private cancelGhostLookup(): void {
    if (this.ghostDebounceTimer !== null) {
      clearTimeout(this.ghostDebounceTimer);
      this.ghostDebounceTimer = null;
    }
    this.ghostRequestSequence++;
    this.ghostLoading.set(false);
  }

  private syncGhostOverlayWidth(): void {
    const originWidth = this.ghostOrigin().nativeElement.getBoundingClientRect().width;
    if (!originWidth) {
      return;
    }
    this.ghostOverlayWidth.set(Math.min(Math.round(originWidth), 448));
  }

  private extractPlainText(value: string): string {
    const source = (value ?? '').trim();
    if (!source) return '';
    const tmp = document.createElement('div');
    tmp.innerHTML = source;
    return (tmp.textContent ?? '').replaceAll(/\s+/g, ' ').trim();
  }

  private stripHtml(value: string): string {
    const source = value.trim();
    if (!source) return '';
    const tmp = document.createElement('div');
    tmp.innerHTML = source;
    return (tmp.textContent ?? '').replaceAll(/\s+/g, ' ').trim();
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  }
}
