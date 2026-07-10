import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { formatServerDate } from '../utils/date';
import { useFormatMoney } from '../utils/currency';
import { API } from '../config/api';
// import SearchableSelect from './SearchableSelect';

interface Ligne { id: number; stockId: number; nom: string; quantite: number; prix: number; montant: number; quantiteConditionnement?: number | null; multiplicateur?: number | null; quantiteDisplay?: number | null; unitLabel?: string | null; qLabel?: string | null; }
const CommandeApercu: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const fmt = useFormatMoney();
  const [loading, setLoading] = useState(true);
  const [commande, setCommande] = useState<any>(null);
  // Note: stock data is used within fetch for resolving names, not kept in state to avoid unused warning
  const [lignes, setLignes] = useState<Ligne[]>([]);

  // Detect ventes mode (legacy). If route is for vente, redirect to the dedicated vente apercu.
  const isVenteMode = window.location.pathname && window.location.pathname.includes('/ventes');
  // Detect commandes-clients preview route (not needed here)

  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem('smb_token');
        const stockRes = await fetch(`${API}/stocks`, { headers: { Authorization: `Bearer ${token}` } });
        const stockData = await stockRes.json();
        // We use stockData locally to compute line names and prices; do not store it unnecessarily.
        if (!id) return;
        if (isVenteMode) {
          // Do not handle vente here; redirect to dedicated vente apercu page
          window.location.href = `/ventes/espece/appercu/${id}`;
          return;
        } else {
          const path = 'commandes-fournisseurs';
          const res = await fetch(`${API}/${path}/${id}`, { headers: { Authorization: `Bearer ${token}` } });
          if (!res.ok) throw new Error('Commande introuvable');
          const data = await res.json();
          setCommande(data);
          if (data.lignes) {
            const computed = data.lignes.map((l: any) => {
              const stockId = l.stock?.id || l.id_stock || 0;
              const stockInfo = stockData.find((s: any) => s.id === stockId);
              // Resolve name: prefer stock product, then ligne.produit, then ligne.designation
              // Prefer an explicit ligne.nom (saved with older commandes or server-side), then product/store names, then designation
              const nom = (l.nom && l.nom.toString().trim()) || stockInfo?.produit?.nomProduit || l.produit?.nomProduit || l.produit?.designation || l.designation || 'Produit';
              // Resolve price: prefer newPrice then ligne.prix then stock product price
              const prix = (l.newPrice !== undefined && l.newPrice !== null) ? Number(l.newPrice) : ((l.prix !== undefined && l.prix !== null) ? Number(l.prix) : (Number(stockInfo?.produit?.prixAchat ?? (l.stock?.produit?.prixAchat ?? 0))));

              // Handle conditionnement: prefer quantiteConditionnement when present
              const qCond = l.quantiteConditionnement !== undefined && l.quantiteConditionnement !== null ? Number(l.quantiteConditionnement) : null;
              const mul = stockInfo?.produit?.nombreUnitesParConditionnement ?? l.stock?.produit?.nombreUnitesParConditionnement ?? 1;
              const quantiteUnits = qCond ? qCond * mul : (l.quantite || 0);
              const quantiteDisplay = qCond ? qCond : (l.quantite || 0);
              const unitLabel = (l.unite && (l.unite.symbole || l.unite.libelle)) ? (l.unite.symbole ?? l.unite.libelle) : (stockInfo?.produit?.unite?.symbole ?? stockInfo?.produit?.unite?.libelle ?? (l.produit && (l.produit.unite?.symbole || l.produit.unite?.libelle) ? (l.produit.unite.symbole ?? l.produit.unite.libelle) : 'unité'));

              // compute qLabel using same simplified rule as client preview
              let qLabel: string;
              if (qCond !== null && qCond !== undefined) {
                qLabel = `${qCond} ${unitLabel ?? 'carton'}`;
              } else {
                const qty = l.quantite || 0;
                if (qty === 1) {
                  qLabel = `1 ${unitLabel ?? 'U'}`;
                } else if (mul && mul > 1 && qty >= mul) {
                  const boxes = Math.floor(qty / mul);
                  const rem = qty % mul;
                  if (boxes > 0 && rem > 0) qLabel = `${boxes} ${unitLabel ?? 'carton'} + ${rem} U`;
                  else if (boxes > 0) qLabel = `${boxes} ${unitLabel ?? 'carton'}`;
                  else qLabel = `${rem} U`;
                } else {
                  qLabel = `${qty} U`;
                }
              }

              // Keep product name as main label; unit shown beside it in the UI
              const displayNom = nom;
              return { id: l.id, stockId, nom: displayNom, quantite: quantiteUnits, quantiteConditionnement: qCond, multiplicateur: mul, quantiteDisplay, prix, montant: prix * quantiteUnits, unitLabel, qLabel } as any;
            });
            setLignes(computed as any);
          }
        }
      } catch (err) {
        const msg = err && (err as any).message ? (err as any).message : (err ? String(err) : 'Erreur lors de la récupération de la commande');
        Swal.fire('Erreur', msg, 'error');
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
      // Séparation stricte : vente → ventes ; commande fournisseur → commandes-fournisseurs
      const tryPaths = isVenteMode
        ? [`${API}/ventes/${commandeId}/pdf`]
        : [`${API}/commandes-fournisseurs/${commandeId}/pdf`];

      let lastErr: any = null;
      for (const p of tryPaths) {
        try {
          const r = await fetch(p, { headers: { Authorization: `Bearer ${token}` } });
          if (r.status === 401) {
            await r.text().catch(() => '');
            Swal.fire('Session expirée', 'Authentification requise. Veuillez vous reconnecter.', 'warning');
            navigate('/login');
            return;
          }
          if (r.ok) { const blob = await r.blob(); const url = URL.createObjectURL(blob); window.open(url, '_blank'); return; }
          const txt = await r.text().catch(() => '');
          lastErr = `${p} -> ${r.status} ${r.statusText}: ${txt}`;
          console.debug('openPdfPrint (apercu):', lastErr);
        } catch (e: any) {
          lastErr = e.message || e;
          console.debug('openPdfPrint (apercu) fetch error:', lastErr);
        }
      }
      Swal.fire('Erreur', `Impossible de charger le PDF. Détails: ${lastErr}`, 'error');
    } catch (err: any) {
      Swal.fire('Erreur', err.message || 'Erreur lors de l\'ouverture du PDF', 'error');
    }
  };

  if (loading) return <div>Chargement...</div>;
  if (!commande) return <div className="alert alert-warning">Commande introuvable</div>;

    return (
      <main id="main" className="main">
        <div className="pagetitle">
        <h1>{isVenteMode ? 'Espace de vente' : 'Commande / Aperçu'}</h1>
        <nav>
          <ol className="breadcrumb">
            <li className="breadcrumb-item"><a href="/">Home</a></li>
            <li className="breadcrumb-item">{isVenteMode ? 'Espace de vente' : 'Commande'}</li>
            <li className="breadcrumb-item active" aria-current="page">{isVenteMode ? 'Aperçu de la vente' : 'Aperçu'}</li>
          </ol>
        </nav>
      </div>
      <div className="card info-card sales-card">
        <div className="card-body">
              <div className="mb-3 d-flex justify-content-between">
            <div>
              <button className="btn btn-secondary me-2" onClick={() => navigate(isVenteMode ? '/ventes' : '/commande-fournisseur')}><i className="ri-arrow-left-line"></i></button>
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
                            {l.nom} {l.unitLabel ? <small className="text-muted">({l.unitLabel})</small> : null}
                            {((l.quantiteConditionnement && l.quantiteConditionnement > 0) || (l.multiplicateur && l.multiplicateur > 1 && l.quantite % l.multiplicateur === 0)) ? (
                              (() => {
                                const mul = l.multiplicateur || 1;
                                const condCount = l.quantiteConditionnement ? l.quantiteConditionnement : (mul > 1 ? (l.quantite / mul) : 0);
                                return <div><small className="text-muted">{condCount} {l.unitLabel ?? 'unité'} ≈ {l.quantite} u {mul ? `(1 ${l.unitLabel ?? 'unité'} = ${mul} u)` : ''}</small></div>;
                              })()
                            ) : null}
                          </td>
                          <td>{l.qLabel}</td> 
                          <td>{l.quantiteConditionnement ? `${fmt(l.prix * (l.multiplicateur || 1))} / ${l.unitLabel ?? 'carton'}` : fmt(l.prix)}</td>
                          <td>{fmt(l.montant)}</td>
                        </tr>
                      ))}
                      <tr>
                        <td colSpan={3} className="text-end"><strong>Total</strong></td>
                        <td className="text-end">{fmt(isVenteMode ? (commande?.montantTotal ?? commande?.total ?? 0) : (commande?.total ?? 0))}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

{isVenteMode ? (
              <>
                <div className="card mt-3">
                  <div className="card-body">
                    <div className="row">
                      <div className="col-xl-3 col-md-6">
                        <div className="form-group">
                          <label>Rémise</label>
                          <input className="form-control" value={fmt(commande?.remise ?? 0)} readOnly />
                        </div>
                      </div>
                      <div className="col-xl-3 col-md-6">
                        <div className="form-group">
                          <label>Net à payer</label>
                          <input className="form-control" value={fmt(commande?.netAPayer ?? 0)} readOnly />
                        </div>
                      </div>
                      <div className="col-xl-3 col-md-6">
                        <div className="form-group">
                          <label>Montant reçu</label>
                          <input type="text" className="form-control" value={fmt(commande?.montantRecu ?? 0)} readOnly />
                        </div>
                      </div>
                      <div className="col-xl-3 col-md-6">
                        <div className="form-group">
                          <label>Monnaie à rembourser</label>
                          <input className="form-control" value={fmt(commande?.monnaieRembourse ?? 0)} readOnly />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="col-xl-12 col-md-10 col-xs-12 mt-3">
                  <div className="form-group">
                    <a href="/ventes/especes" className="btn btn-info form-control">Liste des ventes réalisées</a>
                  </div>
                </div>
              </>
            ) : (
              <div className="col-xl-12 col-md-10 col-xs-12 mt-3">
                <div className="form-group">
                  <button className="btn btn-info form-control" onClick={() => navigate('/commande-fournisseur')}>Liste des commandes fournisseur</button>
                </div>
              </div>
            )}

            </div>
            <div className="col-xl-4">
              <div className="card text-left">
                <div className="card-body">
                  <div className="form-group">
                    <label>Référence </label>
                    <input type="text" name="ref" className="form-control" value={isVenteMode ? (commande?.referenceCaisse || '') : (commande?.reference || '')} readOnly />
                  </div>
                  <div className="form-group mt-3">
                    <label>Date </label>
                    <input type="text" name="dat" className="form-control" value={isVenteMode ? formatServerDate(commande?.dateVente) : formatServerDate(commande?.dateCommande)} readOnly />
                  </div>
                  <div className="form-group mt-3">
                    <label>{isVenteMode ? 'Client' : 'Fournisseur'}</label>
                    <input type="text" className="form-control" value={isVenteMode ? (commande?.nomClient || '') : `${commande?.fournisseur?.prenom || ''} ${commande?.fournisseur?.nom || ''}`} readOnly />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="apercu-print-footer" style={{position: 'fixed', bottom: 0, width: '100%', height: '50px', backgroundColor: '#f5f5f5'}}>
        <div className="container-fluid py-2 text-center small">© JÀGO DÁNAYA</div>
      </footer>
    </main>
  );
};

export default CommandeApercu;