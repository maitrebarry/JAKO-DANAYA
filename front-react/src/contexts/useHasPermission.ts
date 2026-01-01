import { useMemo } from 'react';
import { useUser } from './UserContext';

export const useHasPermission = (permission: string | string[], mode: 'any' | 'all' = 'any') => {
  const { permissions = [] } = useUser();
  const permArray = Array.isArray(permission) ? permission : [permission];

  return useMemo(() => {
    if (!permissions || permissions.length === 0) return false;
    if (mode === 'any') {
      return permArray.some(p => permissions.includes(p));
    }
    return permArray.every(p => permissions.includes(p));
  }, [permissions.join(','), permArray.join(','), mode]);
};

export default useHasPermission;
