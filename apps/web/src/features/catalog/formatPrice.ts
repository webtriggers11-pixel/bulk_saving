/**
 * Format an indicative price (integer rupees) as Indian-locale currency, e.g.
 * 15000 -> "₹15,000". Returns null when no price is set so the caller can omit
 * the price line entirely.
 */
export function formatIndicativePrice(price: number | undefined): string | null {
  if (price === undefined) {
    return null;
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(price);
}
