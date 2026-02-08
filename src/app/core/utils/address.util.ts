export interface AddressParts {
  street?: string;
  houseNumber?: string;
  addressLine1?: string;
  addressLine2?: string;
  zipCode?: string;
  postalCode?: string;
  city?: string;
  country?: string;
}

export function formatFullAddress(address: AddressParts): string {
  const line1 = (address.street || address.addressLine1 || '').trim();
  const houseNumber = (address.houseNumber || '').trim();
  const zipCode = (address.zipCode || address.postalCode || '').trim();
  const city = (address.city || '').trim();
  const country = (address.country || '').trim();

  const containsPostal = zipCode ? line1.includes(zipCode) : false;
  const containsCity = city ? line1.includes(city) : false;

  if (!houseNumber && line1 && (containsPostal || containsCity)) {
    return [line1, country].filter(Boolean).join(', ');
  }

  const line1WithNumber = [line1, houseNumber].filter(Boolean).join(' ').trim();
  const cityLine = [zipCode, city].filter(Boolean).join(' ').trim();
  const parts = [
    line1WithNumber,
    (address.addressLine2 || '').trim(),
    cityLine,
    country,
  ].filter(Boolean);

  return parts.join(', ');
}
