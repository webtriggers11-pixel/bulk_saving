/**
 * Format an integer-rupee amount as Indian-locale currency, e.g. 900 -> "₹900",
 * 1200 -> "₹1,200". Used for a round's live current price and tier prices, which
 * (unlike the catalog's optional indicative price) are always present.
 */
export function formatRupees(price: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(price);
}
