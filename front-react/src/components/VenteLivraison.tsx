import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { formatServerDate } from '../utils/date';

interface VenteLine {
  id?: number; // ligne id if available
  id_stock?: number;
  produit?: any;
  designation?: string;
  quantiteCommande?: number;
  quantiteLivre?: number;
  quantiteLivreeNow?: number;
}

const VenteLivraison: React.FC = () => {
  const [searchParams] = useSearchParams();
  const venteId = searchParams.get('venteId');
  const navigate = useNavigate();

  const [vente, setVente] = useState<any>(null);
  const [lignes, setLignes] = useState<VenteLine[]>([]);
  const [stocks, setStocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!venteId) return;
    fetchStocks();
    fetchVenteAndLines(venteId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venteId]);

  const fetchStocks = async () => {
    try {
      const token = localStorage.getItem('smb_token');
      const res = await fetch('http://localhost:8085/api/stocks', { headers: { Authorization: token ? `Bearer ${token}` : '' } });
      if (!res.ok) throw new Error('Impossible de charger les stocks');
      const data = await res.json();
      setStocks(data || []);
    } catch (e: any) {
      Swal.fire('Erreur', e.message || 'Erreur lors du chargement des stocks', 'error');
    }
  };

  const fetchVenteAndLines = async (id: string) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('smb_token');
      const res = await fetch(`http://localhost:8085/api/ventes/${id}`, { headers: { Authorization: token ? `Bearer ${token}` : '' } });
      if (!res.ok) throw new Error('Impossible de charger la vente');
      const data = await res.json();
      setVente(data);

      // Try to fetch vente lines: backend may expose /api/ventes/{id}/lignes or /api/ventes/{id}/articles
      // Try both endpoints gracefully
      let lines: any[] = [];
      try {
        const lres = await fetch(`http://localhost:8085/api/ventes/${id}/lignes`, { headers: { Authorization: token ? `Bearer ${token}` : '' } });
        if (lres.ok) lines = await lres.json();
      } catch (e) {
        // ignore
      }
      if (!lines || lines.length === 0) {
        try {
          const lres2 = await fetch(`http://localhost:8085/api/ventes/${id}/articles`, { headers: { Authorization: token ? `Bearer ${token}` : '' } });
          if (lres2.ok) lines = await lres2.json();
        } catch (e) {
          // ignore
        }
      }

      // Fallback: if no dedicated lines endpoint, try commande-client endpoint
      if (!lines || lines.length === 0) {
        try {
          const ccRes = await fetch(`http://localhost:8085/api/commandes-clients/${id}`, { headers: { Authorization: token ? `Bearer ${token}` : '' } });
          if (ccRes.ok) {
            const cc = await ccRes.json();
            lines = (cc.lignes || []).map((l: any) => ({ id: l.id, designation: l.produit?.nomProduit || l.designation || '', quantiteCommande: l.quantite, quantiteLivre: l.quantiteLivre || 0 }));
          }
        } catch (e) {
          // ignore
        }
      }

      // Map to VenteLine
      const mapped: VenteLine[] = (lines || []).map((l: any) => ({
        id: l.id || l.ligneId || null,
        id_stock: l.stockId || l.id_stock || null,
        produit: l.produit || null,
        designation: l.designation || (l.produit && l.produit.nomProduit) || 'Produit',
        quantiteCommande: l.quantite || l.quantiteCommande || 0,
        quantiteLivre: l.quantiteLivre || 0,
        quantiteLivreeNow: 0
      }));

      setLignes(mapped);
    } catch (e: any) {
      Swal.fire('Erreur', e.message || 'Erreur', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleChangeLine = (index: number, field: keyof VenteLine, value: any) => {
    const copy = [...lignes];
    (copy[index] as any)[field] = value;
    setLignes(copy);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!venteId) return;

    try {
      const token = localStorage.getItem('smb_token');
      // Build request payload matching backend expectation: { reference, lignes: [{ligneVenteId, stockId, quantite}, ...] }
      const payload = {
        reference: `LV-${Date.now()}`,
        lignes: lignes.filter(l => (l.quantiteLivreeNow || 0) > 0).map(l => ({
          ligneVenteId: l.id,
          stockId: l.id_stock,
          quantite: l.quantiteLivreeNow
        }))
      };

      if (!payload.lignes.length) {
        Swal.fire('Erreur', 'Aucune quantité à livrer renseignée', 'warning');
        return;
      }

      const res = await fetch(`http://localhost:8085/api/ventes/${venteId}/livraisons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const text = await res.text().catch(() => null);
        let errMsg = `Erreur serveur (${res.status})`;
        if (text) errMsg = text;
        Swal.fire('Erreur', errMsg, 'error');
        return;
      }

      Swal.fire('Succès', 'Livraison enregistrée', 'success');
      navigate(-1); // go back
    } catch (e: any) {
      Swal.fire('Erreur', e.message || 'Erreur inconnue', 'error');
    }
  };

  if (!venteId) return <div className="alert alert-warning">Aucun ID de vente fourni</div>;
  if (loading) return <div>Chargement...</div>;

  return (
    <div className="container-fluid">
      <div className="card">
        <div className="card-header bg-primary text-white">Livraison de la vente {vente?.id ? `#${vente.id}` : ''}</div>
        <div className="card-body">
          <div className="mb-3">
            <strong>Client:</strong> {vente?.nomClient || '-'}
            <br />
            <strong>Date vente:</strong> {vente?.dateVente ? formatServerDate(vente.dateVente) : '-'}
          </div>

          <form onSubmit={handleSubmit}>
            <table className="table table-striped">
              <thead>
                <tr><th>Produit</th><th>Quantité commandée</th><th>Quantité livrée</th><th>Stock</th><th>Livrer maintenant</th></tr>
              </thead>
              <tbody>
                {lignes.map((l, i) => (
                  <tr key={i}>
                    <td>{l.designation}</td>
                    <td>{l.quantiteCommande}</td>
                    <td>{l.quantiteLivre || 0}</td>
                    <td>
                      <select className="form-select" value={l.id_stock || ''} onChange={(e) => handleChangeLine(i, 'id_stock', Number(e.target.value) || null)}>
                        <option value="">-- sélectionner un stock --</option>
                        {stocks.map(s => (
                          <option key={s.id} value={s.id}>{s.produit?.nomProduit || s.id} - {s.magasin?.nom || ''} - dispo: {s.quantiteDisponible}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input type="number" min={0} className="form-control" value={l.quantiteLivreeNow || 0} onChange={(e) => handleChangeLine(i, 'quantiteLivreeNow', Number(e.target.value))} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="d-flex justify-content-end">
              <button type="button" className="btn btn-secondary me-2" onClick={() => navigate(-1)}>Annuler</button>
              <button type="submit" className="btn btn-primary">Enregistrer la livraison</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default VenteLivraison;
