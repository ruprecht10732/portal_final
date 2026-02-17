export function formatDateValue(
  value: string | Date | null | undefined,
  locale: string,
  options: Intl.DateTimeFormatOptions,
  fallback = '-'
): string {
  if (!value) return fallback;

  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return typeof value === 'string' ? value : fallback;
  }

  return new Intl.DateTimeFormat(locale, options).format(date);
}