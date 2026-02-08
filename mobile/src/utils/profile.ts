// Helper to normalize/merge the `/api/auth/me` payload.
// Backend may return either:
// - { user: {...}, roles: [...], permissions: [...] }
// - or directly the user object

export function mergeAuthMeResponse(payload: any) {
  const u = payload?.user || payload || null;
  if (!u) return null;

  return {
    ...u,
    roles: (payload?.roles ?? u?.roles) || [],
    permissions: (payload?.permissions ?? u?.permissions) || [],
    currentBoutique: payload?.currentBoutique ?? u?.currentBoutique,
  };
}
