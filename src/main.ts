import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

const patchFirefoxMouseEvent = (): void => {
  if (typeof navigator === 'undefined' || !/Firefox\//.test(navigator.userAgent)) {
    return;
  }

  if (!('mozPressure' in MouseEvent.prototype) && !('mozInputSource' in MouseEvent.prototype)) {
    return;
  }

  try {
    const mozPressureDescriptor = Object.getOwnPropertyDescriptor(MouseEvent.prototype, 'mozPressure');
    if (mozPressureDescriptor?.configurable) {
      Object.defineProperty(MouseEvent.prototype, 'mozPressure', {
        configurable: true,
        get() {
          const event = this as PointerEvent;
          return typeof event.pressure === 'number' ? event.pressure : 0;
        },
      });
    }

    const mozInputSourceDescriptor = Object.getOwnPropertyDescriptor(MouseEvent.prototype, 'mozInputSource');
    if (mozInputSourceDescriptor?.configurable) {
      Object.defineProperty(MouseEvent.prototype, 'mozInputSource', {
        configurable: true,
        get() {
          const event = this as PointerEvent;
          if (event.pointerType === 'mouse') return 1;
          if (event.pointerType === 'pen') return 2;
          if (event.pointerType === 'touch') return 3;
          return 0;
        },
      });
    }
  } catch {
    // Ignore failures and continue bootstrap.
  }
};

patchFirefoxMouseEvent();

try {
  await bootstrapApplication(App, appConfig);
} catch (err) {
  console.error(err);
}
