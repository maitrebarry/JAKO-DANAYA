import React from 'react';
import { useUser } from '../../contexts/UserContext';

type Props = {
  allowedRoles: string[];
  children: React.ReactNode;
};

const normalize = (s?: string) => (s || '').toString().toUpperCase().replace(/^ROLE_/, '');

const RoleBased = ({ allowedRoles, children }: Props) => {
  const { roles = [] } = useUser();
  const normalizedUserRoles = roles.map(normalize);
  const normalizedAllowed = allowedRoles.map(normalize);
  // debug: expose roles to console for troubleshooting
  // eslint-disable-next-line no-console
  console.debug('[RoleBased] userRoles=', normalizedUserRoles, 'allowed=', normalizedAllowed);
  const has = normalizedUserRoles.some(r => normalizedAllowed.includes(r));
  return <>{has ? children : null}</>;
};

export default RoleBased;
