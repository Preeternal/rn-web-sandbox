import { Big } from 'big.js';

// Display-only estimates. Financial logic retains the original decimal strings.
export function formatUsdEstimate(value: string): string {
  const amount = new Big(value);
  if (amount.gt(0) && amount.lt('0.01')) return '< $0.01';
  const [whole, fraction] = amount.toFixed(2, Big.roundHalfUp).split('.');
  return `$${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${fraction}`;
}
