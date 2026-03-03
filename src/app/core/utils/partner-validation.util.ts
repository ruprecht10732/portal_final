export const KVK_REGEX = /^\d{8}$/;
export const VAT_REGEX = /^NL\d{9}B\d{2}$/i;

export const isKvkValid = (value: string): boolean => KVK_REGEX.test(value);
export const isVatValid = (value: string): boolean => VAT_REGEX.test(value);
