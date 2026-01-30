import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, debounceTime, distinctUntilChanged, filter, map, of, switchMap } from 'rxjs';
import { toObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AddressService, type AddressSuggestion } from '../../../core/services/address.service';
import { LeadsService } from '../../../core/services/leads.service';
import type { Lead, ServiceType, ConsumerRole, CreateLeadRequest, UpdateLeadRequest } from '../../../core/services/leads.types';
import { SERVICE_TYPE_OPTIONS, CONSUMER_ROLE_OPTIONS } from '../../../core/services/leads.types';
import { AutocompleteComponent, type AutocompleteOption } from '../../../shared/components/autocomplete/autocomplete.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { SelectComponent, type SelectOption } from '../../../shared/components/select/select.component';

@Component({
  selector: 'app-lead-form',
  templateUrl: './lead-form.component.html',
  styleUrl: './lead-form.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ButtonComponent, InputComponent, SelectComponent, AutocompleteComponent],
})
export class LeadFormComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly leadsService = inject(LeadsService);
  private readonly addressService = inject(AddressService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly lead = signal<Lead | null>(null);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly isNew = signal(true);
  protected readonly duplicateWarning = signal<Lead | null>(null);

  // Form fields
  protected readonly firstName = signal('');
  protected readonly lastName = signal('');
  protected readonly phone = signal('');
  protected readonly email = signal('');
  protected readonly consumerRole = signal<ConsumerRole>('Owner');
  protected readonly street = signal('');
  protected readonly houseNumber = signal('');
  protected readonly zipCode = signal('');
  protected readonly city = signal('');
  protected readonly serviceType = signal<ServiceType>('Windows');

  protected readonly addressOptions = signal<AutocompleteOption[]>([]);
  private readonly addressSuggestions = signal<AddressSuggestion[]>([]);

  protected readonly serviceTypeOptions = computed<SelectOption<ServiceType>[]>(() => SERVICE_TYPE_OPTIONS);
  protected readonly consumerRoleOptions = computed<SelectOption<ConsumerRole>[]>(() => CONSUMER_ROLE_OPTIONS);

  protected setConsumerRole(value: ConsumerRole | null): void {
    if (value) this.consumerRole.set(value);
  }

  protected setServiceType(value: ServiceType | null): void {
    if (value) this.serviceType.set(value);
  }

  protected readonly isValid = computed(() => {
    return (
      this.firstName().trim() &&
      this.lastName().trim() &&
      this.phone().trim() &&
      this.street().trim() &&
      this.houseNumber().trim() &&
      this.zipCode().trim() &&
      this.city().trim()
    );
  });

  constructor() {
    this.setupAddressSearch();
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      this.isNew.set(false);
      this.loadLead(id);
    }
  }

  private loadLead(id: string): void {
    this.loading.set(true);
    this.leadsService.getById(id).subscribe({
      next: (lead) => {
        this.lead.set(lead);
        this.populateForm(lead);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Failed to load lead');
        this.loading.set(false);
      },
    });
  }

  private populateForm(lead: Lead): void {
    this.firstName.set(lead.consumer.firstName);
    this.lastName.set(lead.consumer.lastName);
    this.phone.set(lead.consumer.phone);
    this.email.set(lead.consumer.email ?? '');
    this.consumerRole.set(lead.consumer.role);
    this.street.set(lead.address.street);
    this.houseNumber.set(lead.address.houseNumber);
    this.zipCode.set(lead.address.zipCode);
    this.city.set(lead.address.city);
    this.serviceType.set(lead.currentService?.serviceType ?? 'Windows');
  }

  private setupAddressSearch(): void {
    toObservable(this.street).pipe(
      map(value => value.trim()),
      filter(value => value.length >= 3),
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(query => this.addressService.search(query).pipe(
        catchError(() => of([]))
      )),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(results => {
      this.addressSuggestions.set(results);
      this.addressOptions.set(results.map(addr => ({
        label: addr.label,
        value: addr.label,
      })));
    });
  }

  protected onStreetChange(value: string): void {
    this.street.set(value);

    const match = this.addressSuggestions().find(suggestion => suggestion.label === value);
    if (match) {
      this.applyAddressSuggestion(match);
    }
  }

  private applyAddressSuggestion(suggestion: AddressSuggestion): void {
    this.street.set(suggestion.street ?? '');
    this.houseNumber.set(suggestion.houseNumber ?? '');
    this.zipCode.set(suggestion.zipCode ?? '');
    this.city.set(suggestion.city ?? '');
  }

  protected checkDuplicate(): void {
    const phoneValue = this.phone().trim();

    this.leadsService.checkDuplicate(phoneValue).subscribe({
      next: (result) => {
        if (result.isDuplicate && result.existingLead) {
          this.duplicateWarning.set(result.existingLead);
        } else {
          this.duplicateWarning.set(null);
        }
      },
    });
  }

  protected dismissDuplicateWarning(): void {
    this.duplicateWarning.set(null);
  }

  protected save(): void {
    if (!this.isValid() || this.saving()) return;

    this.saving.set(true);
    this.error.set(null);

    if (this.isNew()) {
      const request: CreateLeadRequest = {
        firstName: this.firstName().trim(),
        lastName: this.lastName().trim(),
        phone: this.phone().trim(),
        email: this.email().trim() || undefined,
        consumerRole: this.consumerRole(),
        street: this.street().trim(),
        houseNumber: this.houseNumber().trim(),
        zipCode: this.zipCode().trim(),
        city: this.city().trim(),
        serviceType: this.serviceType(),
      };

      this.leadsService.create(request).subscribe({
        next: (created) => {
          this.router.navigate(['/app/leads', created.id]);
        },
        error: (err) => {
          this.error.set(err.error?.error || 'Failed to create lead');
          this.saving.set(false);
        },
      });
    } else {
      const lead = this.lead();
      if (!lead) return;

      // Note: serviceType is no longer updated here - services are managed per-service in detail view
      const request: UpdateLeadRequest = {
        firstName: this.firstName().trim(),
        lastName: this.lastName().trim(),
        phone: this.phone().trim(),
        email: this.email().trim() || undefined,
        consumerRole: this.consumerRole(),
        street: this.street().trim(),
        houseNumber: this.houseNumber().trim(),
        zipCode: this.zipCode().trim(),
        city: this.city().trim(),
      };

      this.leadsService.update(lead.id, request).subscribe({
        next: (updated) => {
          this.router.navigate(['/app/leads', updated.id]);
        },
        error: (err) => {
          this.error.set(err.error?.error || 'Failed to update lead');
          this.saving.set(false);
        },
      });
    }
  }

  protected cancel(): void {
    if (this.isNew()) {
      this.router.navigate(['/app/leads']);
    } else {
      const lead = this.lead();
      if (lead) {
        this.router.navigate(['/app/leads', lead.id]);
      } else {
        this.router.navigate(['/app/leads']);
      }
    }
  }
}
