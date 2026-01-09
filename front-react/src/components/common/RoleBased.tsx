import React from 'react';
import { useUser } from '../../contexts/UserContext';

type Props = {
  allowedRoles: string[];
  children: React.ReactNode;
};

const RoleBased = ({ allowedRoles, children }: Props) => {
  const { roles = [] } = useUser();
  const has = roles.some(r => allowedRoles.includes(r));
  return <>{has ? children : null}</>;
};

export default RoleBased;
