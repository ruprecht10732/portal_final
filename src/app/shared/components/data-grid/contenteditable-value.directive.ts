import { Directive, ElementRef, effect, input } from '@angular/core';

@Directive({
  selector: '[contentEditableValue]',
})
export class ContentEditableValueDirective {
  readonly contentEditableValue = input<string | number | null | undefined>('');
  readonly contentEditableFocused = input<boolean>(false);

  constructor(private readonly elementRef: ElementRef<HTMLElement>) {
    effect(() => {
      this.updateValue();
    });
  }

  protected updateValue(): void {
    if (this.contentEditableFocused()) return;

    const value = this.contentEditableValue();
    const next = value === null || value === undefined ? '' : String(value);
    const element = this.elementRef.nativeElement;

    if (element.textContent !== next) {
      element.textContent = next;
    }
  }

}