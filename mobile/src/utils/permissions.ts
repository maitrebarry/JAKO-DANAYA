type PermissionLike = string | { name?: string | null } | null | undefined;
type RoleLike = string | { name?: string | null } | null | undefined;

function normalizeName(v: any): string {
  return String(v || '')
    .replace(/^ROLE_/i, '')
    .trim()
    .toUpperCase();
}

export function getPermissionNames(profile: any): string[] {
  const perms: PermissionLike[] = (profile?.permissions || []) as any;
  if (!Array.isArray(perms)) return [];
  return perms
    .map((p) => (typeof p === 'string' ? p : p?.name))
    .map(normalizeName)
    .filter(Boolean);
}

export function getRoleNames(profile: any): string[] {
  const roles: RoleLike[] = (profile?.roles || []) as any;
  const list = (Array.isArray(roles) ? roles : [])
    .map((r) => (typeof r === 'string' ? r : r?.name))
    .map(normalizeName)
    .filter(Boolean);

  const tu = profile?.typeUtilisateur;
  if (tu && typeof tu === 'string') {
    const t = normalizeName(tu);
    if (t && !list.includes(t)) list.push(t);
  }
  return list;
}

export const PERMISSION_EQUIVALENCE: Record<string, string[]> = {
  // Keep aligned with web: front-react/src/constants/permissions.ts
  RAPPORTS_VOIR: ['RAPPORTS_VOIR', 'RAPPORT_LECTURE', 'RAPPORT_CREER'],
  RAPPORT_LECTURE: ['RAPPORT_LECTURE', 'RAPPORTS_VOIR', 'RAPPORT_CREER'],
  RAPPORT_CREER: ['RAPPORT_CREER', 'RAPPORTS_VOIR', 'RAPPORT_LECTURE'],

  // Common VOIR/LECTURE aliases used across the web UI
  TABLEAU_DE_BORD_VOIR: ['TABLEAU_DE_BORD_VOIR', 'TABLEAU_DE_BORD_LECTURE'],
  TABLEAU_DE_BORD_LECTURE: ['TABLEAU_DE_BORD_LECTURE', 'TABLEAU_DE_BORD_VOIR'],

  PRODUIT_VOIR: ['PRODUIT_VOIR', 'PRODUIT_LECTURE'],
  PRODUIT_LECTURE: ['PRODUIT_LECTURE', 'PRODUIT_VOIR'],

  INVENTAIRE_VOIR: ['INVENTAIRE_VOIR', 'INVENTAIRE_LECTURE'],
  INVENTAIRE_LECTURE: ['INVENTAIRE_LECTURE', 'INVENTAIRE_VOIR'],

  FOURNISSEUR_VOIR: ['FOURNISSEUR_VOIR', 'FOURNISSEUR_LECTURE'],
  FOURNISSEUR_LECTURE: ['FOURNISSEUR_LECTURE', 'FOURNISSEUR_VOIR'],

  CAISSE_VOIR: ['CAISSE_VOIR', 'CAISSE_LECTURE'],
  CAISSE_LECTURE: ['CAISSE_LECTURE', 'CAISSE_VOIR'],

  VENTE_ESPECE_VOIR: ['VENTE_ESPECE_VOIR', 'VENTE_LECTURE'],
  VENTE_CREDIT_VOIR: ['VENTE_CREDIT_VOIR', 'VENTE_LECTURE'],
  VENTE_LECTURE: ['VENTE_LECTURE', 'VENTE_ESPECE_VOIR', 'VENTE_CREDIT_VOIR'],

  // Legacy naming: web sometimes checks CAISSE_MODIFIER but backend enforces CAISSE_GERER
  CAISSE_MODIFIER: ['CAISSE_MODIFIER', 'CAISSE_GERER'],
  CAISSE_GERER: ['CAISSE_GERER', 'CAISSE_MODIFIER'],
};

export function expandPermission(p: string): string[] {
  const key = String(p || '').toUpperCase();
  return PERMISSION_EQUIVALENCE[key] || [key];
}

export function isSuperAdmin(profile: any): boolean {
  return getRoleNames(profile).includes('SUPERADMIN');
}

export function hasPermission(profile: any, permission: string | string[], mode: 'any' | 'all' = 'any'): boolean {
  const perms = getPermissionNames(profile);
  if (perms.length === 0) return false;
  const requested = Array.isArray(permission) ? permission.map(String) : [String(permission)];
  const expanded = requested.flatMap((p) => expandPermission(p)).map(normalizeName).filter(Boolean);
  if (mode === 'all') return expanded.every((p) => perms.includes(p));
  return expanded.some((p) => perms.includes(p));
}

export function hasAnyPermission(profile: any, permissionNames: string[]): boolean {
  return hasPermission(profile, permissionNames || [], 'any');
}
