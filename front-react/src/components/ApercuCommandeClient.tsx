import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { formatServerDate } from '../utils/date';

interface Ligne { id: number; stockId: number; nom: string; quantite: number; prix: number; montant: number; quantiteConditionnement?: number | null; multiplicateur?: number | null; quantiteDisplay?: number | null; unitLabel?: string | null; qLabel?: string | null; }

const ApercuCommandeClient: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [commande, setCommande] = useState<any>(null);
  const [lignes, setLignes] = useState<Ligne[]>([]);

  // This preview is specific to commande client (vente) and uses the commandes-clients API
  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem('smb_token');
        const stockRes = await fetch('http://localhost:8085/api/stocks', { headers: { Authorization: `Bearer ${token}` } });
        const stockData = await stockRes.json();
        if (!id) return;
        const path = 'commandes-clients';
        const res = await fetch(`http://localhost:8085/api/${path}/${id}`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error('Commande introuvable');
        const data = await res.json();
        setCommande(data);
        if (data.lignes) {
          const computed = data.lignes.map((l: any) => {
            const stockId = l.stock?.id || l.id_stock || 0;
            const stockInfo = stockData.find((s: any) => s.id === stockId);
            const nom = (l.nom && l.nom.toString().trim()) || stockInfo?.produit?.nomProduit || l.produit?.nomProduit || l.produit?.designation || l.designation || 'Produit';
            const prix = (l.newPrice !== undefined && l.newPrice !== null) ? Number(l.newPrice) : ((l.prix !== undefined && l.prix !== null) ? Number(l.prix) : (Number(stockInfo?.produit?.prixAchat ?? (l.stock?.produit?.prixAchat ?? 0))));
            const qCond = l.quantiteConditionnement !== undefined && l.quantiteConditionnement !== null ? Number(l.quantiteConditionnement) : null;
            const mul = stockInfo?.produit?.nombreUnitesParConditionnement ?? l.stock?.produit?.nombreUnitesParConditionnement ?? 1;
            const totalUnits = qCond ? qCond * mul : (l.quantite || 0);
            const quantiteDisplay = qCond ? qCond : (l.quantite || 0);
            const unitLabel = (l.unite && (l.unite.symbole || l.unite.libelle)) ? (l.unite.symbole ?? l.unite.libelle) : (stockInfo?.produit?.unite?.symbole ?? stockInfo?.produit?.unite?.libelle ?? (l.produit && (l.produit.unite?.symbole || l.produit.unite?.libelle) ? (l.produit.unite.symbole ?? l.produit.unite.libelle) : 'unité'));

            // Rule:
            // - If quantiteConditionnement is present -> show "Q <libelle>"
            // - If quantiteConditionnement is null:
            //     * if quantity == 1 -> show "1 <libelle>" (preferred label)
            //     * else if product has nombreUnitesParConditionnement and quantity >= mul -> show boxes (+ rem U)
            //     * otherwise -> show "N U"
            let qLabel: string;
            if (l.quantiteConditionnement !== null && l.quantiteConditionnement !== undefined) {
              qLabel = `${l.quantiteConditionnement} ${unitLabel ?? 'carton'}`;
            } else {
              const qty = l.quantite ?? 0;
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

            return { id: l.id, stockId, nom, quantite: totalUnits, quantiteConditionnement: qCond, multiplicateur: mul, quantiteDisplay, prix, montant: prix * totalUnits, unitLabel, qLabel } as any;
          });
          setLignes(computed as any);
        }
      } catch (err) {
        const msg = err && (err as any).message ? (err as any).message : (err ? String(err) : 'Erreur lors de la récupération de la commande');
        Swal.fire('Erreur', msg, 'error');
      } finally { setLoading(false); }
    })();
  }, [id]);

  const openPdfPrint = async (commandeId: number | string | undefined) => {
    if (!commandeId) return;
    try {
      const token = localStorage.getItem('smb_token');
      if (!token) { Swal.fire('Erreur', 'Authentification nécessaire. Connectez-vous.', 'error'); return; }

      // Prefer commandes-clients for this view but fallback to commandes-fournisseurs if missing
      const tryPaths = [`http://localhost:8085/api/commandes-clients/${commandeId}/pdf`, `http://localhost:8085/api/commandes-fournisseurs/${commandeId}/pdf`];
      let lastErr: any = null;
      for (const p of tryPaths) {
        try {
          const r = await fetch(p, { headers: { Authorization: `Bearer ${token}` } });
          if (r.ok) { const blob = await r.blob(); const url = URL.createObjectURL(blob); window.open(url, '_blank'); return; }
          const txt = await r.text().catch(() => '');
          lastErr = `${p} -> ${r.status} ${r.statusText}: ${txt}`;
          console.debug('openPdfPrint (apercu client):', lastErr);
        } catch (e: any) {
          lastErr = e.message || e;
          console.debug('openPdfPrint (apercu client) fetch error:', lastErr);
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
        <h1>Commande / Aperçu</h1>
        <nav>
          <ol className="breadcrumb">
            <li className="breadcrumb-item"><a href="/">Home</a></li>
            <li className="breadcrumb-item">Commande</li>
            <li className="breadcrumb-item active" aria-current="page">Aperçu</li>
          </ol>
        </nav>
      </div>

      <div className="card info-card sales-card">
        <div className="card-body">
          <div className="mb-3 d-flex justify-content-between">
            <div>
              <button className="btn btn-secondary me-2" onClick={() => navigate('/ventes')}><i className="ri-arrow-left-line"></i></button>
              <button className="btn btn-primary me-2" onClick={() => openPdfPrint(commande.id)}>Imprimer</button>
              <button className="btn btn-outline-secondary" onClick={() => navigate(`/commandes-clients/update/${commande.id}`)}>Modifier</button>
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
                            {((l.quantiteConditionnement && l.quantiteConditionnement > 0)) ? (
                              (() => {
                                const mul = l.multiplicateur || 1;
                                const condCount = l.quantiteConditionnement ? l.quantiteConditionnement : (mul > 1 ? (l.quantite / mul) : 0);
                                const condLabel = l.unitLabel ?? 'carton';
                                return <div><small className="text-muted">{condCount} {condLabel} ≈ {l.quantite} u {mul ? `(1 ${condLabel} = ${mul} u)` : ''}</small></div>;
                              })()
                            ) : null}
                          </td>
                          <td>{l.qLabel}</td>
                          <td>{l.prix}</td>
                          <td>{(l.montant).toFixed(2)}</td>
                        </tr>
                      ))}
                      <tr>
                        <td colSpan={3} className="text-end"><strong>Total</strong></td>
                        <td className="text-end">{(commande?.total ?? 0)} FCFA</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="col-xl-12 col-md-10 col-xs-12 mt-3">
                <div className="form-group">
                  <a href="/ventes" className="btn btn-info form-control" onClick={() => navigate('/ventes')}>Liste des commandes</a>
                </div>
              </div>

            </div>
            <div className="col-xl-4">
              <div className="card text-left">
                <div className="card-body">
                  <div className="form-group">
                    <label>Référence </label>
                    <input type="text" name="ref" className="form-control" value={commande?.reference || ''} readOnly />
                  </div>
                  <div className="form-group mt-3">
                    <label>Date </label>
                    <input type="text" name="dat" className="form-control" value={formatServerDate(commande?.dateCommande)} readOnly />
                  </div>
                  <div className="form-group mt-3">
                    <label>Client</label>
                    <input type="text" className="form-control" value={`${commande?.client?.prenom || ''} ${commande?.client?.nom || ''}`.trim()} readOnly />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="footer" style={{position: 'fixed', bottom: 0, width: '100%', height: '50px', backgroundColor: '#f5f5f5'}}>
        <div className="container-fluid py-2 text-center small">© SMBOUTIQUE</div>
      </footer>
    </main>
  );
};

export default ApercuCommandeClient;
