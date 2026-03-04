import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { TranslatePipe } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { firstValueFrom } from 'rxjs';

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
export class QuoteLineItemRowComponent {
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

  private ghostRequestSequence = 0;

  protected async onDescriptionInput(value: string): Promise<void> {
    this.descriptionChange.emit(value);
    await this.lookupGhostSuggestion(value);
  }

  protected onDescriptionKeydown(event: KeyboardEvent): void {
    const suggestions = this.ghostSuggestions();
    if (suggestions.length === 0) return;

    if (event.key === 'Tab') {
      const suggestion = suggestions[0];
      if (!suggestion) return;
      event.preventDefault();
      this.ghostAccepted.emit(suggestion);
      this.ghostSuggestions.set([]);
      this.ghostSelectedIndex.set(0);
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
      this.ghostAccepted.emit(suggestion);
      this.ghostSuggestions.set([]);
      this.ghostSelectedIndex.set(0);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      this.ghostSuggestions.set([]);
      this.ghostSelectedIndex.set(0);
    }
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

  private extractPlainText(value: string): string {
    const source = (value ?? '').trim();
    if (!source) return '';
    const tmp = document.createElement('div');
    tmp.innerHTML = source;
    return (tmp.textContent ?? '').replaceAll(/\s+/g, ' ').trim();
  }
}
