import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';

interface Line {
  id_stock?: number;
  produit?: any;
  designation?: string;
  quantite?: number; // units
  venteParConditionnement?: boolean;
  quantiteConditionnement?: number; // number of packs
  prix?: number;
  priceMode?: string;
  quantiteReelle?: number; // computed
}

const VenteEnEspece: React.FC = () => {
  const navigate = useNavigate();
  const [stocks, setStocks] = useState<any[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [nomClient, setNomClient] = useState<string>('Clients divers');
  const [montantRecu, setMontantRecu] = useState<number | null>(null);
  const [remise, setRemise] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  const getAuthToken = (): string | null => {
    const raw = localStorage.getItem('smb_token');
    if (!raw) return null;
    try {
      const trimmed = raw.trim();
      if (trimmed.startsWith('{')) {
        const parsed = JSON.parse(trimmed);
        return parsed?.token || parsed?.accessToken || parsed?.jwt || parsed?.authToken || null;
      }
    } catch (e) {
      // not json
    }
    if (raw.startsWith('Bearer ')) return raw.slice('Bearer '.length);
    return raw;
  };

  useEffect(() => {
    fetchStocks();
    // initialize with one empty line
    setLines([{ quantite: 1, prix: 0, venteParConditionnement: false }]);
  }, []);

  const fetchStocks = async () => {
    try {
      const token = getAuthToken();
      const res = await fetch('http://localhost:8085/api/stocks', { headers: { Authorization: token ? `Bearer ${token}` : '' } });
      if (!res.ok) throw new Error('Impossible de charger les stocks');
      const data = await res.json();
      setStocks(data || []);
    } catch (e: any) {
      Swal.fire('Erreur', e.message || 'Erreur lors du chargement des stocks', 'error');
    }
  };

  const addLine = () => setLines([...lines, { quantite: 1, prix: 0, venteParConditionnement: false }]);
  const removeLine = (index: number) => setLines(lines.filter((_, i) => i !== index));

  const handleLineChange = (index: number, field: keyof Line, value: any) => {
    const copy = [...lines];
    (copy[index] as any)[field] = value;
    setLines(copy);
  };

  const computeLineQuantiteReelle = (l: Line) => {
    if (l.venteParConditionnement) {
      const stock = stocks.find(s => s.id === l.id_stock);
      const mul = stock && stock.produit && stock.produit.nombreUnitesParConditionnement ? stock.produit.nombreUnitesParConditionnement : 1;
      return (l.quantiteConditionnement || 0) * mul;
    }
    return l.quantite || 0;
  };

  const computeTotal = () => {
    const subtotal = lines.reduce((acc, l) => {
      const q = computeLineQuantiteReelle(l);
      const p = l.prix || 0;
      return acc + q * p;
    }, 0);
    return subtotal - (remise || 0);
  };

  const monnaieRembourse = () => {
    const total = computeTotal();
    if (montantRecu == null) return 0;
    return Math.max((montantRecu || 0) - total, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // validate lines
    const validLines = lines.filter(l => l.id_stock && (l.quantite || l.quantiteConditionnement));
    if (validLines.length === 0) {
      Swal.fire('Attention', 'Veuillez ajouter au moins un produit avec une quantité', 'warning');
      return;
    }

    const payload = {
      reference: `ES-${new Date().toISOString().replace(/[:.]/g, '').slice(0,15)}`,
      dateVente: new Date().toISOString(),
      nomClient: nomClient || 'Clients divers',
      total: computeTotal(),
      montantRecu: montantRecu || 0,
      monnaieRembourse: monnaieRembourse(),
      remise: remise || 0,
      produitsSelectionnes: validLines.map(l => ({
        id_stock: l.id_stock,
        quantite: l.venteParConditionnement ? undefined : l.quantite,
        venteParConditionnement: l.venteParConditionnement || false,
        quantiteConditionnement: l.venteParConditionnement ? l.quantiteConditionnement : undefined,
        prix: l.prix || 0,
        priceMode: l.priceMode || undefined
      }))
    };

    setLoading(true);
    try {
      const token = getAuthToken();
      const res = await fetch('http://localhost:8085/api/ventes/cash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        Swal.fire('Succès', 'Vente en espèces enregistrée', 'success');
        // Redirect to ventes historique or show detail
        navigate('/ventes/historique');
      } else {
        const err = await res.json().catch(() => null);
        console.debug('create vente cash failed', { status: res.status, body: err });
        Swal.fire('Erreur', (err && err.error) ? err.error : 'Erreur lors de la création de la vente', 'error');
      }
    } catch (e: any) {
      Swal.fire('Erreur', e.message || 'Erreur lors de la création de la vente', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="row">
        <div className="col-12">
          <div className="card">
            <div className="card-body">
              <h4 className="card-title">Vente en Espèce</h4>
              <form onSubmit={handleSubmit}>
                <div className="mb-3 row">
                  <label className="col-sm-2 col-form-label">Nom Client</label>
                  <div className="col-sm-10">
                    <input className="form-control" value={nomClient} onChange={e => setNomClient(e.target.value)} />
                  </div>
                </div>

                <table className="table">
                  <thead>
                    <tr>
                      <th>Produit / Stock</th>
                      <th>Conditionnement</th>
                      <th>Quantité</th>
                      <th>Prix (unité)</th>
                      <th>Montant</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l, idx) => {
                      const qreelle = computeLineQuantiteReelle(l);
                      return (
                        <tr key={idx}>
                          <td style={{ minWidth: 250 }}>
                            <select className="form-select" value={l.id_stock || ''} onChange={e => handleLineChange(idx, 'id_stock', Number(e.target.value) || undefined)}>
                              <option value="">Sélectionner le stock</option>
                              {stocks.map(s => (
                                <option key={s.id} value={s.id}> {s.produit?.nomProduit || ('Stock ' + s.id)} (Disponible: {s.quantiteDisponible || 0})</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <div className="form-check">
                              <input className="form-check-input" type="checkbox" checked={!!l.venteParConditionnement} onChange={e => handleLineChange(idx, 'venteParConditionnement', e.target.checked)} id={`cond-${idx}`} />
                              <label className="form-check-label" htmlFor={`cond-${idx}`}>Par conditionnement</label>
                            </div>
                          </td>
                          <td>
                            {!l.venteParConditionnement ? (
                              <input type="number" min={0} className="form-control" value={l.quantite || 0} onChange={e => handleLineChange(idx, 'quantite', Number(e.target.value))} />
                            ) : (
                              <input type="number" min={0} className="form-control" value={l.quantiteConditionnement || 0} onChange={e => handleLineChange(idx, 'quantiteConditionnement', Number(e.target.value))} />
                            )}
                            <small className="text-muted">Réel: {qreelle}</small>
                          </td>
                          <td>
                            <input type="number" min={0} className="form-control" value={l.prix || 0} onChange={e => handleLineChange(idx, 'prix', Number(e.target.value))} />
                          </td>
                          <td>{(qreelle * (l.prix || 0)) || 0}</td>
                          <td>
                            <button type="button" className="btn btn-sm btn-danger" onClick={() => removeLine(idx)}>Supprimer</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <div className="mb-3">
                  <button type="button" className="btn btn-secondary" onClick={addLine}>Ajouter produit</button>
                </div>

                <div className="mb-3 row">
                  <label className="col-sm-2 col-form-label">Remise</label>
                  <div className="col-sm-4">
                    <input className="form-control" type="number" value={remise} onChange={e => setRemise(Number(e.target.value))} />
                  </div>
                  <label className="col-sm-2 col-form-label">Montant Reçu</label>
                  <div className="col-sm-4">
                    <input className="form-control" type="number" value={montantRecu == null ? '' : montantRecu} onChange={e => setMontantRecu(e.target.value === '' ? null : Number(e.target.value))} />
                  </div>
                </div>

                <div className="mb-3 row">
                  <label className="col-sm-2 col-form-label">Total</label>
                  <div className="col-sm-4">
                    <input className="form-control" readOnly value={computeTotal()} />
                  </div>

                  <label className="col-sm-2 col-form-label">Monnaie à rendre</label>
                  <div className="col-sm-4">
                    <input className="form-control" readOnly value={monnaieRembourse()} />
                  </div>
                </div>

                <div className="d-flex justify-content-end">
                  <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Enregistrement…' : 'Enregistrer la vente'}</button>
                </div>

              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VenteEnEspece;
