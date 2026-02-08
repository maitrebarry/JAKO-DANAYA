import { useMemo } from 'react';
import { useApp } from '../store/AppContext';
import { hasPermission, isSuperAdmin } from './permissions';

export type Access = {
  dashboard: boolean;
  produits: boolean;
  produitsCreate: boolean;
  produitsEdit: boolean;
  ventes: boolean;
  ventesCreate: boolean;
  achats: boolean;
  achatsCreate: boolean;
  commandes: boolean;
  stock: boolean;
  caisse: boolean;
  caisseMovements: boolean;
  caisseManage: boolean;
  depenses: boolean;
  depensesCreate: boolean;
  depensesValidation: boolean;
  depensesAnnulation: boolean;
  utilisationPertes: boolean;
  utilisationPertesCreate: boolean;
  utilisationPertesModify: boolean;
  utilisationPertesDelete: boolean;
  clientsCreate: boolean;
};

export function computeAccess(profile: any): Access {
  const superAdmin = !!profile && isSuperAdmin(profile);

  const any = (codes: Array<string | string[]>) => {
    if (superAdmin) return true;
    if (!profile) return false;
    return codes.some((c) => hasPermission(profile, c as any));
  };

  return {
    dashboard: any(['TABLEAU_DE_BORD_VOIR', 'TABLEAU_DE_BORD_LECTURE']),
    produits: any(['PRODUIT_VOIR', 'PRODUIT_LECTURE']),
    produitsCreate: any(['PRODUIT_CREER']),
    produitsEdit: any(['PRODUIT_MODIFIER']),
    ventes: any(['VENTE_ESPECE_VOIR', 'VENTE_CREDIT_VOIR', 'VENTE_LECTURE']),
    ventesCreate: any(['VENTE_CREER']),
    achats: any(['ACHAT_VOIR', 'COMMANDE_LECTURE']),
    achatsCreate: any(['ACHAT_CREER', 'COMMANDE_CREER']),
    commandes: any(['COMMANDE_LECTURE']),
    stock: any(['INVENTAIRE_VOIR', 'INVENTAIRE_LECTURE']),
    // show caisse menu if user can at least view or manage it
    caisse: any(['CAISSE_VOIR', 'CAISSE_LECTURE', 'CAISSE_GERER', 'CAISSE_CREER', 'CAISSE_MOUVEMENT_VIEW', 'PARAMETRES_LECTURE']),
    caisseMovements: any(['CAISSE_MOUVEMENT_VIEW']),
    caisseManage: any(['CAISSE_GERER']),

    depenses: any(['DEPENSE_LECTURE', 'DEPENSE_CREER', 'DEPENSE_VALIDATION', 'DEPENSE_ANNULATION']),
    depensesCreate: any(['DEPENSE_CREER']),
    depensesValidation: any(['DEPENSE_VALIDATION']),
    depensesAnnulation: any(['DEPENSE_ANNULATION']),
    utilisationPertes: any(['UTILISA_PERTE_VOIR', 'UTILISA_PERTE_CREER', 'UTILISA_PERTE_MODIFIER', 'UTILISA_PERTE_SUPPRIMER']),
    utilisationPertesCreate: any(['UTILISA_PERTE_CREER']),
    utilisationPertesModify: any(['UTILISA_PERTE_MODIFIER']),
    utilisationPertesDelete: any(['UTILISA_PERTE_SUPPRIMER']),

    clientsCreate: any(['CLIENT_CREER']),
  };
}

export function useAccess(): Access {
  const { profile } = useApp();
  return useMemo(() => computeAccess(profile), [profile]);
}
