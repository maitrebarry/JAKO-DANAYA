import { useUser } from '../contexts/UserContext';

export function formatMoney(value?: number | null, boutique?: any): string {
  if (value == null) return '—';
  const sym = boutique && boutique.pays && boutique.pays.deviseSymbole ? boutique.pays.deviseSymbole : 'FCFA';
  // format with fr-FR thousands separator and 2 decimals
  const formatted = Number(value).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${formatted} ${sym}`;
}

export function useFormatMoney() {
  const { currentBoutique } = useUser();
  return (value?: number | null) => formatMoney(value, currentBoutique);
}
