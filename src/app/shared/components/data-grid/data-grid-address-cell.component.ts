import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { toObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  filter,
  map,
  of,
  switchMap,
} from 'rxjs';
import { AddressService, AddressSuggestion } from '../../../core/services/address.service';
import { AutocompleteComponent, AutocompleteOption } from '../autocomplete/autocomplete.component';

@Component({
  selector: 'data-grid-address-cell',
  imports: [AutocompleteComponent],
  templateUrl: './data-grid-address-cell.component.html',
  styleUrl: './data-grid-address-cell.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataGridAddressCellComponent {
  private readonly addressService = inject(AddressService);
  private readonly destroyRef = inject(DestroyRef);

  readonly value = input<string>('');
  readonly placeholder = input<string>('Search address...');

  readonly valueChange = output<string>();
  readonly addressSelect = output<AddressSuggestion>();

  protected readonly options = signal<AutocompleteOption[]>([]);
  private readonly suggestions = signal<AddressSuggestion[]>([]);
  protected readonly inputValue = signal('');

  constructor() {
    effect(() => {
      const next = this.value();
      if (this.inputValue() !== next) {
        this.inputValue.set(next);
      }
    });

    effect(() => {
      if (this.inputValue().trim().length < 3) {
        this.options.set([]);
        this.suggestions.set([]);
      }
    });

    toObservable(this.inputValue)
      .pipe(
        map(value => value.trim()),
        filter(value => value.length >= 3),
        debounceTime(300),
        distinctUntilChanged(),
        switchMap(query => this.addressService.search(query).pipe(
          catchError(() => of([]))
        )),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(results => {
        this.suggestions.set(results);
        this.options.set(
          results.map(addr => ({
            label: addr.label,
            value: addr.label,
          }))
        );
      });
  }

  protected onValueChange(value: string): void {
    this.inputValue.set(value);
    this.valueChange.emit(value);

    const match = this.suggestions().find(suggestion => suggestion.label === value);
    if (match) {
      this.addressSelect.emit(match);
    }
  }
}
