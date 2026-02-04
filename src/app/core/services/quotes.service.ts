import { Injectable, signal, computed } from '@angular/core';
import { Observable, of, delay, tap } from 'rxjs';
import type {
  Quote,
  QuoteLineItem,
  QuoteStatus,
  CreateQuoteRequest,
  UpdateQuoteRequest,
  QuoteListResponse,
  DiscountType,
  PricingMode,
  TaxRate,
} from './quotes.types';
import { parseQuantityNumber } from './quotes.types';

/**
 * Stub service for quotes - logs operations, ready for backend integration.
 * Replace Observable.of() calls with HTTP calls when backend is ready.
 */
@Injectable({ providedIn: 'root' })
export class QuotesService {
  // In-memory store for demo purposes
  private readonly quotesStore = signal<Quote[]>([]);

  // Exposed as readonly for components
  readonly quotes = this.quotesStore.asReadonly();
  readonly quotesCount = computed(() => this.quotesStore().length);

  private quoteCounter = 1;

  /**
   * Get all quotes
   * TODO: Replace with HTTP call to GET /api/quotes
   */
  list(): Observable<QuoteListResponse> {
    console.log('[QuotesService] list() called');
    // TODO: Replace with this.http.get<QuoteListResponse>(`${this.baseUrl}`)
    return of({
      items: this.quotesStore(),
      total: this.quotesStore().length,
    }).pipe(delay(100));
  }

  /**
   * Get a single quote by ID
   * TODO: Replace with HTTP call to GET /api/quotes/:id
   */
  getById(id: string): Observable<Quote | undefined> {
    console.log('[QuotesService] getById() called with id:', id);
    // TODO: Replace with this.http.get<Quote>(`${this.baseUrl}/${id}`)
    const quote = this.quotesStore().find(q => q.id === id);
    return of(quote).pipe(delay(100));
  }

  /**
   * Create a new quote
   * TODO: Replace with HTTP call to POST /api/quotes
   */
  create(data: CreateQuoteRequest): Observable<Quote> {
    console.log('[QuotesService] create() called with:', data);

    const lineItems: QuoteLineItem[] = data.lineItems.map(item => ({
      ...item,
      taxRate: item.taxRate ?? 21,
      optional: item.optional ?? false,
      id: this.generateId(),
      total: this.calculateLineSubtotal(item.quantity, item.unitPrice),
    }));

    const pricingMode = data.pricingMode ?? 'exclusive';
    const subtotal = this.calculateSubtotal(lineItems, pricingMode);
    const discountType = data.discountType ?? 'percentage';
    const discountValue = data.discountValue ?? 0;
    const discountAmount = this.calculateDiscount(subtotal, discountType, discountValue);
    const discountRatio = this.calculateDiscountRatio(subtotal, discountAmount);
    const taxAmount = this.calculateLineTaxAmount(lineItems, discountRatio, pricingMode);
    const total = subtotal - discountAmount + taxAmount;

    const now = new Date().toISOString();
    const quote: Quote = {
      id: this.generateId(),
      quoteNumber: this.generateQuoteNumber(),
      leadId: data.leadId,
      status: 'draft',
      lineItems,
      subtotal,
      discountType,
      discountValue,
      discountAmount,
      taxAmount,
      total,
      pricingMode,
      ...(data.validUntil !== undefined && { validUntil: data.validUntil }),
      ...(data.notes !== undefined && { notes: data.notes }),
      createdAt: now,
      updatedAt: now,
    };

    // TODO: Replace with this.http.post<Quote>(`${this.baseUrl}`, data)
    return of(quote).pipe(
      delay(200),
      tap(created => {
        this.quotesStore.update(quotes => [...quotes, created]);
        console.log('[QuotesService] Quote created:', created);
      })
    );
  }

  /**
   * Update an existing quote
   * TODO: Replace with HTTP call to PUT /api/quotes/:id
   */
  update(id: string, data: UpdateQuoteRequest): Observable<Quote | undefined> {
    console.log('[QuotesService] update() called with id:', id, 'data:', data);

    const existing = this.quotesStore().find(q => q.id === id);
    if (!existing) {
      console.warn('[QuotesService] Quote not found:', id);
      return of(undefined);
    }

    let lineItems = existing.lineItems;
    if (data.lineItems) {
      lineItems = data.lineItems.map(item => ({
        ...item,
        taxRate: item.taxRate ?? 21,
        optional: item.optional ?? false,
        id: this.generateId(),
        total: this.calculateLineSubtotal(item.quantity, item.unitPrice),
      }));
    }

    const pricingMode = data.pricingMode ?? existing.pricingMode ?? 'exclusive';
    const subtotal = this.calculateSubtotal(lineItems, pricingMode);
    const discountType = data.discountType ?? existing.discountType;
    const discountValue = data.discountValue ?? existing.discountValue;
    const discountAmount = this.calculateDiscount(subtotal, discountType, discountValue);
    const discountRatio = this.calculateDiscountRatio(subtotal, discountAmount);
    const taxAmount = this.calculateLineTaxAmount(lineItems, discountRatio, pricingMode);
    const total = subtotal - discountAmount + taxAmount;

    const validUntil = data.validUntil ?? existing.validUntil;
    const notes = data.notes ?? existing.notes;

    const updated: Quote = {
      ...existing,
      lineItems,
      subtotal,
      discountType,
      discountValue,
      discountAmount,
      taxAmount,
      total,
      pricingMode,
      ...(validUntil !== undefined && { validUntil }),
      ...(notes !== undefined && { notes }),
      updatedAt: new Date().toISOString(),
    };

    // TODO: Replace with this.http.put<Quote>(`${this.baseUrl}/${id}`, data)
    return of(updated).pipe(
      delay(200),
      tap(result => {
        this.quotesStore.update(quotes => quotes.map(q => (q.id === id ? result : q)));
        console.log('[QuotesService] Quote updated:', result);
      })
    );
  }

  /**
   * Update quote status
   * TODO: Replace with HTTP call to PATCH /api/quotes/:id/status
   */
  updateStatus(id: string, status: QuoteStatus): Observable<Quote | undefined> {
    console.log('[QuotesService] updateStatus() called with id:', id, 'status:', status);

    const existing = this.quotesStore().find(q => q.id === id);
    if (!existing) {
      console.warn('[QuotesService] Quote not found:', id);
      return of(undefined);
    }

    const updated: Quote = {
      ...existing,
      status,
      updatedAt: new Date().toISOString(),
    };

    // TODO: Replace with this.http.patch<Quote>(`${this.baseUrl}/${id}/status`, { status })
    return of(updated).pipe(
      delay(100),
      tap(result => {
        this.quotesStore.update(quotes => quotes.map(q => (q.id === id ? result : q)));
        console.log('[QuotesService] Quote status updated:', result);
      })
    );
  }

  /**
   * Delete a quote
   * TODO: Replace with HTTP call to DELETE /api/quotes/:id
   */
  delete(id: string): Observable<{ success: boolean }> {
    console.log('[QuotesService] delete() called with id:', id);

    // TODO: Replace with this.http.delete<{ success: boolean }>(`${this.baseUrl}/${id}`)
    return of({ success: true }).pipe(
      delay(100),
      tap(() => {
        this.quotesStore.update(quotes => quotes.filter(q => q.id !== id));
        console.log('[QuotesService] Quote deleted:', id);
      })
    );
  }

  /**
   * Calculate totals from line items and discount
   */
  calculateTotals(
    lineItems: Omit<QuoteLineItem, 'id' | 'total'>[],
    discountType: DiscountType,
    discountValue: number,
    pricingMode: PricingMode
  ): { subtotal: number; discountAmount: number; taxAmount: number; total: number } {
    const subtotal = this.calculateSubtotal(lineItems, pricingMode);
    const discountAmount = this.calculateDiscount(subtotal, discountType, discountValue);
    const discountRatio = this.calculateDiscountRatio(subtotal, discountAmount);
    const taxAmount = this.calculateLineTaxAmount(lineItems, discountRatio, pricingMode);
    const total = subtotal - discountAmount + taxAmount;

    return { subtotal, discountAmount, taxAmount, total };
  }

  calculateTaxBreakdown(
    lineItems: Omit<QuoteLineItem, 'id' | 'total'>[],
    discountType: DiscountType,
    discountValue: number,
    pricingMode: PricingMode
  ): { rate: TaxRate; amount: number }[] {
    const subtotal = this.calculateSubtotal(lineItems, pricingMode);
    const discountAmount = this.calculateDiscount(subtotal, discountType, discountValue);
    const discountRatio = this.calculateDiscountRatio(subtotal, discountAmount);
    const byRate = new Map<TaxRate, number>();

    lineItems.forEach(item => {
      const taxRate = this.normalizeTaxRate(item.taxRate);
      const netUnitPrice = this.calculateNetUnitPrice(item.unitPrice, taxRate, pricingMode);
      const lineSubtotal = this.calculateLineSubtotal(item.quantity, netUnitPrice);
      const discountedSubtotal = lineSubtotal * (1 - discountRatio);
      const lineTax = (discountedSubtotal * taxRate) / 100;
      byRate.set(taxRate, (byRate.get(taxRate) ?? 0) + lineTax);
    });

    return Array.from(byRate.entries())
      .map(([rate, amount]) => ({ rate, amount }))
      .sort((a, b) => b.rate - a.rate);
  }

  private calculateLineSubtotal(quantity: string, unitPrice: number): number {
    return parseQuantityNumber(quantity) * unitPrice;
  }

  private normalizeTaxRate(rate: TaxRate | undefined): TaxRate {
    return rate ?? 21;
  }

  private calculateNetUnitPrice(unitPrice: number, taxRate: TaxRate, pricingMode: PricingMode): number {
    if (pricingMode === 'inclusive' && taxRate > 0) {
      return unitPrice / (1 + taxRate / 100);
    }
    return unitPrice;
  }

  private calculateSubtotal(
    lineItems: Pick<QuoteLineItem, 'quantity' | 'unitPrice' | 'taxRate'>[],
    pricingMode: PricingMode
  ): number {
    return lineItems.reduce((sum, item) => {
      const taxRate = this.normalizeTaxRate(item.taxRate);
      const netUnitPrice = this.calculateNetUnitPrice(item.unitPrice, taxRate, pricingMode);
      return sum + this.calculateLineSubtotal(item.quantity, netUnitPrice);
    }, 0);
  }

  private calculateDiscountRatio(subtotal: number, discountAmount: number): number {
    if (subtotal <= 0 || discountAmount <= 0) return 0;
    return Math.min(discountAmount / subtotal, 1);
  }

  private calculateLineTaxAmount(
    lineItems: Pick<QuoteLineItem, 'quantity' | 'unitPrice' | 'taxRate'>[],
    discountRatio: number,
    pricingMode: PricingMode
  ): number {
    if (lineItems.length === 0) return 0;
    return lineItems.reduce((sum, item) => {
      const taxRate = this.normalizeTaxRate(item.taxRate);
      const netUnitPrice = this.calculateNetUnitPrice(item.unitPrice, taxRate, pricingMode);
      const lineSubtotal = this.calculateLineSubtotal(item.quantity, netUnitPrice);
      const discountedSubtotal = lineSubtotal * (1 - discountRatio);
      const lineTax = (discountedSubtotal * taxRate) / 100;
      return sum + lineTax;
    }, 0);
  }

  private calculateDiscount(subtotal: number, type: DiscountType, value: number): number {
    if (value <= 0) return 0;
    if (type === 'percentage') {
      return Math.min((subtotal * value) / 100, subtotal);
    }
    return Math.min(value, subtotal);
  }

  private generateId(): string {
    return crypto.randomUUID();
  }

  private generateQuoteNumber(): string {
    const year = new Date().getFullYear();
    const number = String(this.quoteCounter++).padStart(4, '0');
    return `OFF-${year}-${number}`;
  }
}
