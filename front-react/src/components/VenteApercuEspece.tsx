import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { formatServerDate } from '../utils/date';
import { useFormatMoney } from '../utils/currency';
import { API } from '../config/api';

interface Ligne { id: number; stockId?: number; nom: string; quantite: number; prix: number; montant: number; quantiteConditionnement?: number | null; multiplicateur?: number | null; quantiteDisplay?: number | null; unitLabel?: string | null; qLabel?: string | null; prixDisplay?: number | null; reste?: number | null }

const VenteApercuEspece: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const fmt = useFormatMoney();
  const [loading, setLoading] = useState(true);
  const [vente, setVente] = useState<any>(null);
  const [lignes, setLignes] = useState<Ligne[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem('smb_token');
        if (!id) return;
        // fetch vente
        const res = await fetch(`${API}/ventes/${id}`, { headers: { Authorization: token ? `Bearer ${token}` : '' } });
        if (!res.ok) throw new Error('Vente introuvable');
        const data = await res.json();
        setVente(data);

        // fetch stocks (used to compute unit labels and conditionnement) and lignes
        const stockRes = await fetch(`${API}/stocks`, { headers: { Authorization: token ? `Bearer ${token}` : '' } });
        const stockData = stockRes.ok ? await stockRes.json() : [];

        const lres = await fetch(`${API}/ventes/${id}/lignes`, { headers: { Authorization: token ? `Bearer ${token}` : '' } });
        if (lres.ok) {
          const ldata = await lres.json();
          const computed = ldata.map((lv: any) => {
            const stockId = lv.stock?.id || lv.id_stock || 0;
            const stockInfo = stockData.find((s: any) => s.id === stockId);
            const nom = (lv.nom && lv.nom.toString().trim()) || stockInfo?.produit?.nomProduit || lv.produit?.nomProduit || lv.produit?.designation || lv.designation || 'Produit';

            const prix = (lv.newPrice !== undefined && lv.newPrice !== null) ? Number(lv.newPrice) : ((lv.prix !== undefined && lv.prix !== null) ? Number(lv.prix) : Number(stockInfo?.produit?.prixAchat ?? (lv.stock?.produit?.prixAchat ?? 0)));
            const qCond = lv.quantiteConditionnement !== undefined && lv.quantiteConditionnement !== null ? Number(lv.quantiteConditionnement) : null;
            const mul = stockInfo?.produit?.nombreUnitesParConditionnement ?? lv.produit?.nombreUnitesParConditionnement ?? 1;
            const totalUnits = qCond ? qCond * mul : (lv.quantite || 0);
            const quantiteDisplay = qCond ? qCond : (lv.quantite || 0);
            const unitLabel = (lv.unite && (lv.unite.symbole || lv.unite.libelle)) ? (lv.unite.symbole ?? lv.unite.libelle) : (stockInfo?.produit?.unite?.symbole ?? stockInfo?.produit?.unite?.libelle ?? (lv.produit && (lv.produit.unite?.symbole || lv.produit.unite?.libelle) ? (lv.produit.unite.symbole ?? lv.produit.unite.libelle) : 'unité'));

            // build qLabel exactly like commande preview
            let qLabel: string;
            if (qCond !== null) {
              qLabel = `${qCond} ${unitLabel ?? 'carton'}`;
            } else {
              const qty = lv.quantite ?? 0;
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

            return {
              id: lv.id,
              stockId,
              nom,
              quantite: totalUnits,
              quantiteConditionnement: qCond,
              multiplicateur: mul,
              quantiteDisplay,
              prix,
              montant: prix * totalUnits,
              unitLabel,
              qLabel,
              prixDisplay: qCond ? (prix * mul) : prix,
              reste: lv.resteUnitesDansCartonApresVente ?? null
            } as Ligne;
          });
          setLignes(computed);
        }
      } catch (err: any) {
        Swal.fire('Erreur', err && err.message ? err.message : 'Erreur lors de la récupération de la vente', 'error');
      } finally { setLoading(false); }
    })();
  }, [id]);

  const openPdfPrint = async (venteId?: number | string) => {
    if (!venteId) return;
    try {
      const token = localStorage.getItem('smb_token');
      if (!token) { Swal.fire('Erreur', 'Authentification nécessaire. Connectez-vous.', 'error'); return; }

      const tryPaths = [ `${API}/ventes/${venteId}/pdf` ];
      let lastErr: any = null;
      for (const p of tryPaths) {
        try {
          const r = await fetch(p, { headers: { Authorization: `Bearer ${token}` } });
          if (r.status === 401) { await r.text().catch(() => ''); Swal.fire('Session expirée', 'Authentification requise. Veuillez vous reconnecter.', 'warning'); navigate('/login'); return; }
          if (r.ok) { const blob = await r.blob(); const url = URL.createObjectURL(blob); window.open(url, '_blank'); return; }
          const txt = await r.text().catch(() => '');
          lastErr = `${p} -> ${r.status} ${r.statusText}: ${txt}`;
          console.debug('openPdfPrint (apercu vente):', lastErr);
        } catch (e: any) {
          lastErr = e.message || e;
          console.debug('openPdfPrint (apercu vente) fetch error:', lastErr);
        }
      }
      Swal.fire('Erreur', `Impossible de charger le PDF. Détails: ${lastErr}`, 'error');
    } catch (err: any) {
      Swal.fire('Erreur', err.message || 'Erreur lors de l\'ouverture du PDF', 'error');
    }
  };

  const deleteVente = async () => {
    const r = await Swal.fire({ title: 'Confirmer la suppression', text: 'Supprimer cette vente ?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Supprimer' });
    if (!r.isConfirmed) return;
    try {
      const token = localStorage.getItem('smb_token');
      const res = await fetch(`${API}/ventes/${id}`, { method: 'DELETE', headers: { Authorization: token ? `Bearer ${token}` : '' } });
      if (!res.ok) throw new Error('Impossible de supprimer la vente');
      Swal.fire('Succès', 'Vente supprimée', 'success');
      navigate('/ventes/especes');
    } catch (err: any) {
      Swal.fire('Erreur', err && err.message ? err.message : 'Erreur suppression', 'error');
    }
  };

  if (loading) return <div>Chargement...</div>;
  if (!vente) return <div className="alert alert-warning">Vente introuvable</div>;

  return (
    <main id="main" className="main">
      <div className="pagetitle">
        <h1>Espace de vente</h1>
        <nav>
          <ol className="breadcrumb">
            <li className="breadcrumb-item"><a href="/">Home</a></li>
            <li className="breadcrumb-item">Espace de vente</li>
            <li className="breadcrumb-item active" aria-current="page">Aperçu de la vente</li>
          </ol>
        </nav>
      </div>

      <div className="card info-card sales-card">
        <div className="card-body">
          <div className="mb-3 d-flex justify-content-between align-items-end">
            <div>
              <button className="btn btn-secondary me-2" onClick={() => navigate('/ventes/especes')}><i className="ri-arrow-left-line"></i></button>
              <button className="btn btn-primary me-2" onClick={() => openPdfPrint(vente?.id)}>Imprimer</button>
              <button className="btn btn-outline-danger" onClick={deleteVente}>Supprimer</button>
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
                        <th>Prix de l'article</th>
                        <th>Montant</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lignes.map(l => (
                        <tr key={l.id}>
                          <td>{l.nom}</td>
                          <td>{l.qLabel}{l.reste != null ? <div className="small text-muted">Reste dans carton: {l.reste} unité{l.reste > 1 ? 's' : ''}</div> : null}</td>
                          <td>{l.quantiteConditionnement ? `${fmt(l.prix * (l.multiplicateur || 1))} / ${l.unitLabel ?? 'carton'}` : fmt(l.prix)}</td>
                          <td>{fmt(l.montant)}</td>
                        </tr>
                      ))}
                      <tr>
                        <td colSpan={3} className="text-end"><strong>Montant total</strong></td>
                        <td className="text-end">{fmt(vente.montantTotal ?? vente.total ?? 0)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="card mt-3">
                <div className="card-body">
                  <div className="row">
                    <div className="col-xl-3 col-md-6">
                      <label>Rémise</label>
                      <input className="form-control" value={fmt(vente.remise ?? 0)} readOnly />
                    </div>
                    <div className="col-xl-3 col-md-6">
                      <label>Net à payer</label>
                      <input className="form-control" value={fmt(vente.netAPayer ?? 0)} readOnly />
                    </div>
                    <div className="col-xl-3 col-md-6">
                      <label>Montant reçu</label>
                      <input className="form-control" value={fmt(vente.montantRecu ?? 0)} readOnly />
                    </div>
                    <div className="col-xl-3 col-md-6">
                      <label>Monnaie à rembourser</label>
                      <input className="form-control" value={fmt(vente.monnaieRembourse ?? 0)} readOnly />
                    </div>
                  </div>
                </div>
              </div>

            </div>

            <div className="col-xl-4">
              <div className="card text-left">
                <div className="card-body">
                  <div className="form-group">
                    <label>Référence</label>
                    <input className="form-control" value={vente.referenceCaisse || ''} readOnly />
                  </div>
                  <div className="form-group mt-3">
                    <label>Date</label>
                    <input className="form-control" value={formatServerDate(vente.dateVente)} readOnly />
                  </div>
                  <div className="form-group mt-3">
                    <label>Client</label>
                    <input className="form-control" value={vente.nomClient || ''} readOnly />
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      <footer className="footer" style={{position: 'fixed', bottom: 0, width: '100%', height: '50px', backgroundColor: '#f5f5f5'}}>
        <div className="container-fluid py-2 text-center small">© JÀGO DÁNAYA</div>
      </footer>
    </main>
  );
};

export default VenteApercuEspece;