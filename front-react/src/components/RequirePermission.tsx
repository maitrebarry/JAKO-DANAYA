import React from 'react';
import useHasPermission from '../contexts/useHasPermission';

type Props = {
  permission: string | string[];
  mode?: 'any' | 'all';
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

const RequirePermission: React.FC<Props> = ({ permission, mode = 'any', children, fallback = null }) => {
  const has = useHasPermission(permission, mode);
  return <>{has ? children : fallback}</>;
};

export default RequirePermission;
