import { useMemo, useContext } from 'react';
import { UserContext } from './UserContext';
import { expandPermission } from '../constants/permissions';

export const useHasPermission = (permission: string | string[], mode: 'any' | 'all' = 'any') => {
  // Read the context *without* the throwing wrapper; useContext returns
  // undefined when provider is missing which is safe for hook ordering.
  const ctx = useContext(UserContext);
  const ctxPermissions = Array.isArray(ctx?.permissions) ? ctx.permissions : [];
  const permArray = Array.isArray(permission) ? permission.map(String) : [String(permission)];

  return useMemo(() => {
    if (ctxPermissions.length === 0) return false;
    const expanded = permArray.map(p => expandPermission(String(p))).flat();
    if (mode === 'any') {
      return expanded.some(p => ctxPermissions.includes(String(p)));
    }
    return expanded.every(p => ctxPermissions.includes(String(p)));
  }, [ctxPermissions.join(','), permArray.join(','), mode]);
};

export default useHasPermission;
