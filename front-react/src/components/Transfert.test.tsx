import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Transfert from './Transfert';
import { UserContext } from '../contexts/UserContext';
import { MemoryRouter } from 'react-router-dom';
import { API } from '../config/api';

const mockMagasins = [{ id: 1, nom: 'Magasin A' }];
const mockStocks = [
  {
    produitId: 100,
    nomProduit: 'ProdA',
    quantiteDisponible: 50,
    multiplicateur: 1,
    uniteCondLibelle: 'Paquet',
    prixAchat: 10,
    prixDetail: 20,
    // backend uses `prixEnGros` field name for 'gros' price when returned from API
    prixEnGros: 15
  }
];

describe('Transfert — totaux et bénéfices estimés', () => {
  beforeEach(() => {
    // mock fetch: first call -> magasins, second call -> stocks
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => mockMagasins })
      .mockResolvedValueOnce({ ok: true, json: async () => mockStocks })
    );
    // provide a token to avoid auth branches
    localStorage.setItem('smb_token', 'fake-token');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('calcule et affiche les totaux et bénéfices pour la sélection', async () => {
    const userValue = { currentBoutique: { id: 10, nom: 'Boutique X' }, permissions: ['INVENTAIRE_MODIFIER'], roles: [], setUserData: () => {}, logout: () => {} } as any;

    render(
      <MemoryRouter>
        <UserContext.Provider value={userValue}>
          <Transfert />
        </UserContext.Provider>
      </MemoryRouter>
    );

    // attendre que le produit soit affiché
    const prodLabel = await screen.findByText('ProdA');
    expect(prodLabel).toBeTruthy();

    const itemLabel = prodLabel.closest('label');
    expect(itemLabel).toBeTruthy();
    const utils = within(itemLabel as HTMLElement);

    // cocher la ligne (le premier checkbox dans l'étiquette correspond à la sélection)
    const checkbox = utils.getAllByRole('checkbox')[0] as HTMLInputElement;
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);

    // saisir quantité = 2
    const qtyInput = utils.getByRole('spinbutton') as HTMLInputElement;
    fireEvent.change(qtyInput, { target: { value: '2' } });
    expect(qtyInput.value).toBe('2');

    // vérifier les totaux affichés (valeurs et symbole de monnaie)
    await waitFor(() => {
      // rechercher les montants formatés (accept FCFA ou symbole ₵)
      expect(screen.getAllByText(/20,00\s*(?:FCFA|₵)/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/40,00\s*(?:FCFA|₵)/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/30,00\s*(?:FCFA|₵)/).length).toBeGreaterThan(0);
    });

    // bénéfice détail = prixDetail - achat = 40 - 20 = 20
    // titre exact "Bénéfice estimé" (section) — éviter d'attraper "Bénéfice estimé (détail)"
    expect(screen.getByText('Bénéfice estimé')).toBeTruthy();
    expect(screen.getAllByText(/20,00\s*(?:FCFA|₵)/).length).toBeGreaterThan(0);
  });

  it('charge les produits depuis la boutique quand source=BOUTIQUE (ignorer stocks magasin)', async () => {
    const mixedStocks = [
      { produitId: 201, nomProduit: 'ProdMag', quantiteDisponible: 5, magasin: { id: 2, nom: 'M2' }, multiplicateur: 1, prixAchat: 3, prixDetail: 6, prixEnGros: 5 },
      { produitId: 200, nomProduit: 'ProdBout', quantiteDisponible: 12, magasin: null, multiplicateur: 1, prixAchat: 5, prixDetail: 10, prixEnGros: 8 }
    ];

    // sequence: 1) magasins, 2) initial magasin stocks (component auto-loads), 3) boutique stocks after switching source
    const fetchStub = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => mockMagasins })
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, json: async () => mixedStocks });
    vi.stubGlobal('fetch', fetchStub);

    localStorage.setItem('smb_token', 'fake-token');
    const userValue = { currentBoutique: { id: 10, nom: 'Boutique X' }, permissions: ['INVENTAIRE_MODIFIER'], roles: [], setUserData: () => {}, logout: () => {} } as any;

    render(
      <MemoryRouter>
        <UserContext.Provider value={userValue}>
          <Transfert />
        </UserContext.Provider>
      </MemoryRouter>
    );

    // switch source to Boutique
    const boutiqueRadio = await screen.findByLabelText('Boutique (propre)');
    fireEvent.click(boutiqueRadio);

    // boutique product should appear, magasin-level product must NOT
    const prodBoutLabel = await screen.findByText('ProdBout');
    expect(prodBoutLabel).toBeTruthy();
    expect(screen.queryByText('ProdMag')).toBeNull();

    // verify UI requested boutique-level stocks explicitly
    expect(fetchStub).toHaveBeenCalledWith(`${API}/stocks?level=boutique`, expect.any(Object));

    const itemLabel = prodBoutLabel.closest('label');
    const utils = within(itemLabel as HTMLElement);
    const checkbox = utils.getAllByRole('checkbox')[0] as HTMLInputElement;
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);

    const qtyInput = utils.getByRole('spinbutton') as HTMLInputElement;
    fireEvent.change(qtyInput, { target: { value: '2' } });
    expect(qtyInput.value).toBe('2');

    await waitFor(() => expect(screen.getAllByText(/20,00\s*(?:FCFA|₵)/).length).toBeGreaterThan(0));
  });
});