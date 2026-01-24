import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import VenteApercuEspece from './VenteApercuEspece';

describe('VenteApercuEspece — affichage conditionnement', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('affiche le prix par conditionnement et le montant cohérent (ex: 1 carton = 12 unités)', async () => {
    const venteId = 123;
    const venteResp = { id: venteId, montantTotal: 9000, montantRecu: 9000, referenceCaisse: 'ES-1', dateVente: new Date().toISOString() };
    const lignesResp = [
      {
        id: 1,
        produit: { nomProduit: 'Savon SANTEX', nombreUnitesParConditionnement: 12, unite: { libelle: 'carton' } },
        quantiteConditionnement: 1,
        quantite: 12,
        newPrice: 750,
        resteUnitesDansCartonApresVente: null
      }
    ];

    // stub fetch: first call -> vente, second call -> lignes
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => venteResp })
      .mockResolvedValueOnce({ ok: true, json: async () => lignesResp })
    );

    localStorage.setItem('smb_token', 'fake-token');

    render(
      <MemoryRouter initialEntries={[`/ventes/espece/appercu/${venteId}`]}>
        <Routes>
          <Route path="/ventes/espece/appercu/:id" element={<VenteApercuEspece />} />
        </Routes>
      </MemoryRouter>
    );

    // wait for produit name to appear
    const prod = await screen.findByText('Savon SANTEX');
    expect(prod).toBeTruthy();

    const row = prod.closest('tr');
    expect(row).toBeTruthy();

    // quantity should show 1 carton (12 unités) or similar
    await waitFor(() => {
      expect(row!.textContent).toMatch(/1\s+carton/i);
      // price displayed should be 750*12 = 9000 (either as prix per carton or montant)
      expect(row!.textContent).toMatch(/9000/);
      // montant column must also show 9000
      expect(row!.textContent).toMatch(/9000/);
    });
  });

  it('affiche le symbole de la devise (ex: ₵) quand la boutique utilise GHS', async () => {
    const venteId = 222;
    const venteResp = { id: venteId, montantTotal: 12000, montantRecu: 12000, referenceCaisse: 'ES-2', dateVente: new Date().toISOString(), boutique: { pays: { deviseSymbole: '₵' } } };
    const lignesResp = [{ id: 1, produit: { nomProduit: 'Article GH' }, quantite: 1, newPrice: 12000 }];

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => venteResp })
      .mockResolvedValueOnce({ ok: true, json: async () => lignesResp })
    );

    localStorage.setItem('smb_token', 'fake-token');

    render(
      <MemoryRouter initialEntries={[`/ventes/espece/appercu/${venteId}`]}>
        <Routes>
          <Route path="/ventes/espece/appercu/:id" element={<VenteApercuEspece />} />
        </Routes>
      </MemoryRouter>
    );

    const amountCell = await screen.findByText(/12\s*000/);
    expect(amountCell).toBeTruthy();
    expect(amountCell.textContent).toMatch(/₵|GHS/);
  });

  it('appel le endpoint PDF avec Authorization quand on clique sur Imprimer', async () => {
    const venteId = 333;
    const venteResp = { id: venteId, montantTotal: 5000, referenceCaisse: 'ES-3', dateVente: new Date().toISOString() };
    const lignesResp: any[] = [];

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => venteResp })
      .mockResolvedValueOnce({ ok: true, json: async () => lignesResp })
      .mockResolvedValueOnce({ ok: true, blob: async () => new Blob(['pdf']) });

    vi.stubGlobal('fetch', fetchMock);
    localStorage.setItem('smb_token', 'token-123');

    render(
      <MemoryRouter initialEntries={[`/ventes/espece/appercu/${venteId}`]}>
        <Routes>
          <Route path="/ventes/espece/appercu/:id" element={<VenteApercuEspece />} />
        </Routes>
      </MemoryRouter>
    );

    const btn = await screen.findByRole('button', { name: /Imprimer/i });
    expect(btn).toBeTruthy();
    btn.click();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
      // the last call should be the PDF endpoint with Authorization header
      const lastCall = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
      expect(lastCall[0]).toMatch(new RegExp(`/api/ventes/${venteId}/pdf$`));
      expect(lastCall[1]).toBeDefined();
      expect(lastCall[1].headers).toBeDefined();
      expect(lastCall[1].headers.Authorization).toBe('Bearer token-123');
    });
  });
});
