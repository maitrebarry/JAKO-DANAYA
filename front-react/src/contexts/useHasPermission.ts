import { useMemo } from 'react';
import { useUser } from './UserContext';
import { expandPermission } from '../constants/permissions';

export const useHasPermission = (permission: string | string[], mode: 'any' | 'all' = 'any') => {
  const { permissions = [] } = useUser();
  const permArray = Array.isArray(permission) ? permission : [permission];

  return useMemo(() => {
    if (!permissions || permissions.length === 0) return false;
    // expand aliases
    const expanded = permArray.map(p => expandPermission(p)).flat();
    if (mode === 'any') {
      return expanded.some(p => permissions.includes(p));
    }
    return expanded.every(p => permissions.includes(p));
  }, [permissions.join(','), permArray.join(','), mode]);
};

export default useHasPermission;
