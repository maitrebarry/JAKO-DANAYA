import { useUser } from '../contexts/UserContext';

export function formatMoney(value?: number | null, boutique?: any): string {
  if (value == null) return '—';
  const sym = boutique && boutique.pays && boutique.pays.deviseSymbole ? boutique.pays.deviseSymbole : 'FCFA';
  // format with fr-FR thousands separator, no decimals (montants toujours entiers, pas de virgule)
  const formatted = Number(value).toLocaleString('fr-FR', { maximumFractionDigits: 0 });
  return `${formatted} ${sym}`;
}

export function useFormatMoney() {
  const { currentBoutique } = useUser();
  return (value?: number | null) => formatMoney(value, currentBoutique);
}
