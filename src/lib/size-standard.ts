/** Format a receipts standard read from the SBA table, not a regulatory fallback. */
export function receiptsSizeStandard(receipts: number): string {
  return `$${(receipts / 1_000_000).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} million in average annual receipts`;
}