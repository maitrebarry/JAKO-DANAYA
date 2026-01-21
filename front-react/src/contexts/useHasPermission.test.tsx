import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import useHasPermission from './useHasPermission';
import { UserProvider, UserContext } from './UserContext';
import { MemoryRouter } from 'react-router-dom';

function Harness({ check }: { check: (v: boolean) => void }) {
  const ok = useHasPermission('PRODUIT_CREER');
  check(ok);
  return <div />;
}

describe('useHasPermission', () => {
  it('returns false and does not throw when used without UserProvider', () => {
    const checks: boolean[] = [];
    expect(() => render(<Harness check={v => checks.push(v)} />)).not.toThrow();
    expect(checks[0]).toBe(false);
  });

  it('works when used inside UserProvider with permissions', () => {
    const checks: boolean[] = [];
    const userData = { user: { id: 1, email: 'sidicamara@gmail.com' }, permissions: ['PRODUIT_CREER'] };
    // preload localStorage similarly to app behaviour
    localStorage.setItem('smb_user_data', JSON.stringify(userData));

    render(
      <MemoryRouter>
        <UserContext.Provider value={{ user: { id: 1, email: 'sidicamara@gmail.com' }, permissions: ['PRODUIT_CREER'], roles: [], currentBoutique: null, setUserData: () => {}, logout: () => {} }}>
          <Harness check={v => checks.push(v)} />
        </UserContext.Provider>
      </MemoryRouter>
    );
    expect(checks[0]).toBe(true);
  });
});
