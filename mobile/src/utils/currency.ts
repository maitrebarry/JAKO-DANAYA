import { useApp } from '../store/AppContext';

const ZERO_DECIMAL_CODES = new Set([
  'XOF', // West African CFA franc
  'XAF', // Central African CFA franc
  'GNF', // Guinean franc
]);

function fractionDigitsFor(code?: string | null): number {
  const c = (code || '').toUpperCase();
  if (ZERO_DECIMAL_CODES.has(c)) return 0;
  // Keep mobile behavior consistent: amounts are generally integer-based.
  return 0;
}

export function getCurrencyFromBoutique(boutique?: any): { symbol: string; code?: string | null } {
  const symbol = boutique?.pays?.deviseSymbole || 'FCFA';
  const code = boutique?.pays?.deviseCode || null;
  return { symbol, code };
}

export function formatMoney(value?: number | null, boutique?: any): string {
  if (value == null) return '—';
  const { symbol, code } = getCurrencyFromBoutique(boutique);
  const digits = fractionDigitsFor(code);
  const formatted = Number(value).toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return `${formatted} ${symbol}`;
}

export function useCurrencySymbol(): string {
  const { currentBoutique } = useApp();
  return getCurrencyFromBoutique(currentBoutique).symbol;
}

export function useFormatMoney() {
  const { currentBoutique } = useApp();
  return (value?: number | null) => formatMoney(value, currentBoutique);
}
