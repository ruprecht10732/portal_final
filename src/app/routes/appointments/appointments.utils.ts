import { TranslateService } from '@ngx-translate/core';
import { ErrorReportingService } from '../../core/services/error-reporting.service';
import { extractErrorMessage } from '../../core/utils/error-utils';

export function formatDateTimeLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function formatDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function reportHttpError(
  err: unknown,
  reporter: ErrorReportingService,
  translate: TranslateService,
  fallbackKey: string,
): string {
  const message = extractErrorMessage(err, translate.instant(fallbackKey), {
    allowErrorMessage: true,
    allowMessageField: true,
  });
  reporter.report(err, { source: 'http', silent: true, userMessage: message });
  return message;
}
