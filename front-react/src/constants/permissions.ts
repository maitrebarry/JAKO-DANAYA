export const PERMISSION_EQUIVALENCE: Record<string, string[]> = {
  // Reports alias mapping — central source of truth for permission name equivalences
  RAPPORTS_VOIR: ['RAPPORTS_VOIR', 'RAPPORT_LECTURE', 'RAPPORT_CREER'],
  RAPPORT_LECTURE: ['RAPPORT_LECTURE', 'RAPPORTS_VOIR', 'RAPPORT_CREER'],
  RAPPORT_CREER: ['RAPPORT_CREER', 'RAPPORTS_VOIR', 'RAPPORT_LECTURE']
};

export function expandPermission(p: string): string[] {
  return PERMISSION_EQUIVALENCE[p] || [p];
}
