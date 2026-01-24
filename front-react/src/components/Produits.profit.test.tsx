import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Produits from './Produits';
import { UserContext } from '../contexts/UserContext';
import { MemoryRouter } from 'react-router-dom';

const mockMagasins = [{ id: 1, nom: 'Magasin A' }];
const mockUnites: any[] = [];
const mockProduits = [
  {
    id: 1,
    nomProduit: 'P1',
    quantiteInitiale: 2,
    prixAchat: 100,
    prixDetail: 150,
    prixEnGros: 120
  },
  {
    id: 2,
    nomProduit: 'P2',
    quantiteInitiale: 1,
    prixAchat: 50,
    prixDetail: 80,
    prixEnGros: 70
  }
];

describe('Produits — modal Bénéfice boutique', () => {
  beforeEach(() => {
    // produits, unites, magasins
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => mockProduits })
      .mockResolvedValueOnce({ ok: true, json: async () => mockUnites })
      .mockResolvedValueOnce({ ok: true, json: async () => mockMagasins })
    );
    localStorage.setItem('smb_token', 'fake-token');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('ouvre le modal et affiche les totaux et bénéfices estimés', async () => {
    const userValue = { currentBoutique: { id: 10, nom: 'Boutique X' }, permissions: ['PRODUIT_LECTURE'], roles: [], setUserData: () => {}, logout: () => {} } as any;

    render(
      <MemoryRouter>
        <UserContext.Provider value={userValue}>
          <Produits />
        </UserContext.Provider>
      </MemoryRouter>
    );

    // attendre l'affichage d'un produit
    await screen.findByText('P1');

    const btn = screen.getByRole('button', { name: /Bénéfice boutique/i });
    fireEvent.click(btn);

    const modal = await screen.findByTestId('profit-modal');
    expect(modal).toBeTruthy();

    // calculs attendus:
    // total achat = 2*100 + 1*50 = 250
    // total detail = 2*150 + 1*80 = 380
    // bénéfice détail = 380 - 250 = 130
    await waitFor(() => {
      expect(screen.getByTestId('profit-total-achat').textContent).toMatch(/250/);
      expect(screen.getByTestId('profit-total-detail').textContent).toMatch(/380/);
      expect(screen.getByTestId('profit-estime-detail').textContent).toMatch(/130/);
    });
  });
});
