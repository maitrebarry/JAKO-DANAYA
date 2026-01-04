import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { formatServerDate } from '../utils/date';
// import SearchableSelect from './SearchableSelect';

interface Ligne { id: number; stockId: number; nom: string; quantite: number; prix: number; montant: number; quantiteConditionnement?: number | null; multiplicateur?: number | null; quantiteDisplay?: number | null; unitLabel?: string | null; }
const CommandeApercu: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [commande, setCommande] = useState<any>(null);
  // Note: stock data is used within fetch for resolving names, not kept in state to avoid unused warning
  const [lignes, setLignes] = useState<Ligne[]>([]);

  // Detect ventes mode
  const isVenteMode = window.location.pathname && window.location.pathname.includes('/ventes');

  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem('smb_token');
        const stockRes = await fetch('http://localhost:8085/api/stocks', { headers: { Authorization: `Bearer ${token}` } });
        const stockData = await stockRes.json();
        // We use stockData locally to compute line names and prices; do not store it unnecessarily.
        if (!id) return;
        const path = isVenteMode ? 'commandes-clients' : 'commandes-fournisseurs';
        const res = await fetch(`http://localhost:8085/api/${path}/${id}`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error('Commande introuvable');
        const data = await res.json();
        setCommande(data);
        if (data.lignes) {
          const computed = data.lignes.map((l: any) => {
            const stockId = l.stock?.id || l.id_stock || 0;
            const stockInfo = stockData.find((s: any) => s.id === stockId);
            // Resolve name: prefer stock product, then ligne.produit, then ligne.designation
            const nom = stockInfo?.produit?.nomProduit || l.produit?.nomProduit || l.produit?.designation || l.designation || 'Produit';
            // Resolve price: prefer newPrice then ligne.prix then stock product price
            const prix = (l.newPrice !== undefined && l.newPrice !== null) ? Number(l.newPrice) : ((l.prix !== undefined && l.prix !== null) ? Number(l.prix) : (Number(stockInfo?.produit?.prixAchat ?? (l.stock?.produit?.prixAchat ?? 0))));

            // Handle conditionnement: prefer quantiteConditionnement when present
            const qCond = l.quantiteConditionnement !== undefined && l.quantiteConditionnement !== null ? Number(l.quantiteConditionnement) : null;
            const mul = stockInfo?.produit?.nombreUnitesParConditionnement ?? l.stock?.produit?.nombreUnitesParConditionnement ?? 1;
            const quantiteUnits = qCond ? qCond * mul : (l.quantite || 0);
            const quantiteDisplay = qCond ? qCond : (l.quantite || 0);
            const unitLabel = stockInfo?.produit?.unite?.libelle ?? 'carton';

            return { id: l.id, stockId, nom, quantite: quantiteUnits, quantiteConditionnement: qCond, multiplicateur: mul, quantiteDisplay, prix, montant: prix * quantiteUnits, unitLabel } as any;
          });
          setLignes(computed as any);
        }
      } catch (err: any) {
        Swal.fire('Erreur', err.message || 'Erreur lors de la récupération de la commande', 'error');
      } finally { setLoading(false); }
    })();
  }, [id]);

  // Open and print PDF using fetch with Authorization header
  const openPdfPrint = async (commandeId: number | string | undefined) => {
    if (!commandeId) return;
    try {
      const token = localStorage.getItem('smb_token');
      if (!token) {
        Swal.fire('Erreur', 'Authentification nécessaire. Connectez-vous.', 'error');
        return;
      }
      if (isVenteMode) {
        // try ventes endpoint first, then commandes-clients
        const tryPaths = [`http://localhost:8085/api/ventes/${commandeId}/pdf`, `http://localhost:8085/api/commandes-clients/${commandeId}/pdf`];
        let lastErr: any = null;
        for (const p of tryPaths) {
          try {
            const r = await fetch(p, { headers: { Authorization: `Bearer ${token}` } });
            if (r.ok) { const blob = await r.blob(); const url = URL.createObjectURL(blob); window.open(url, '_blank'); return; }
            const txt = await r.text().catch(() => '');
            lastErr = `${p} -> ${r.status} ${r.statusText}: ${txt}`;
            console.debug('openPdfPrint (apercu):', lastErr);
          } catch (e: any) {
            lastErr = e.message || e;
            console.debug('openPdfPrint (apercu) fetch error:', lastErr);
          }
        }
        Swal.fire('Erreur', `Impossible de charger le PDF (vente). Détails: ${lastErr}`, 'error');
        return;
      }
      const path = 'commandes-fournisseurs';
      const res = await fetch(`http://localhost:8085/api/${path}/${commandeId}/pdf`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Erreur lors de la récupération du PDF');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err: any) {
      Swal.fire('Erreur', err.message || 'Erreur lors de l\'ouverture du PDF', 'error');
    }
  };

  if (loading) return <div>Chargement...</div>;
  if (!commande) return <div className="alert alert-warning">Commande introuvable</div>;

    return (
      <main id="main" className="main">
        <div className="pagetitle">
        <h1>{isVenteMode ? 'Commande Client / Aperçu' : 'Commande / Aperçu'}</h1>
      </div>
      <div className="card info-card sales-card">
        <div className="card-body">
              <div className="mb-3 d-flex justify-content-between">
            <div>
              <button className="btn btn-secondary me-2" onClick={() => navigate(isVenteMode ? '/liste-commandes?mode=vente' : '/liste-commandes')}><i className="ri-arrow-left-line"></i></button>
              <button className="btn btn-primary me-2" onClick={() => openPdfPrint(commande.id)}>Imprimer</button>
              <button className="btn btn-outline-secondary" onClick={() => navigate(isVenteMode ? `/ventes/update/${commande.id}` : `/commandes/update/${commande.id}`)}>
                Modifier
              </button>
            </div>
          </div>
          <div className="row">
            <div className="col-xl-8 col-md-10 col-xm-12 col-xs-12">
              <div className="card">
                <div className="card-body">
                  <table className="col-md-12 table table-bordered table-striped table-condensed">
                    <thead>
                      <tr>
                        <th>Désignation</th>
                        <th>Quantité</th>
                        <th>Prix</th>
                        <th>Montant</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lignes.map(l => (
                        <tr key={l.id}>
                          <td>
                            {l.nom}
                            {((l.quantiteConditionnement && l.quantiteConditionnement > 0) || (l.multiplicateur && l.multiplicateur > 1 && l.quantite % l.multiplicateur === 0)) ? (
                              (() => {
                                const mul = l.multiplicateur || 1;
                                const condCount = l.quantiteConditionnement ? l.quantiteConditionnement : (mul > 1 ? (l.quantite / mul) : 0);
                                return <div><small className="text-muted">{condCount} {l.unitLabel ?? 'carton'} ≈ {l.quantite} u {mul ? `(1 ${l.unitLabel ?? 'carton'} = ${mul} u)` : ''}</small></div>;
                              })()
                            ) : null}
                          </td>
                          <td>{(l.quantiteConditionnement && l.quantiteConditionnement > 0) || (l.multiplicateur && l.multiplicateur > 1 && l.quantite % l.multiplicateur === 0) ? `${(l.quantiteConditionnement && l.quantiteConditionnement > 0) ? l.quantiteConditionnement : (l.quantite / (l.multiplicateur || 1))} ${l.unitLabel ?? 'carton'}` : l.quantite}</td>
                          <td>{l.prix}</td>
                          <td>{(l.montant).toFixed(2)}</td>
                        </tr>
                      ))}
                      <tr>
                        <td colSpan={3} className="text-end"><strong>Total</strong></td>
                        <td className="text-end">{commande.total || 0} FCFA</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="col-xl-4">
              <div className="card text-left">
                <div className="card-body">
                  <div className="form-group">
                    <label>Référence </label>
                    <input type="text" name="ref" className="form-control" value={commande.reference} readOnly />
                  </div>
                  <div className="form-group mt-3">
                    <label>Date </label>
                    <input type="text" name="dat" className="form-control" value={formatServerDate(commande.dateCommande)} readOnly />
                  </div>
                  <div className="form-group mt-3">
                    <label>{isVenteMode ? 'Client' : 'Fournisseur'}</label>
                    <input type="text" className="form-control" value={isVenteMode ? `${commande.client?.prenom || ''} ${commande.client?.nom || ''}` : `${commande.fournisseur?.prenom || ''} ${commande.fournisseur?.nom || ''}`} readOnly />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default CommandeApercu;
