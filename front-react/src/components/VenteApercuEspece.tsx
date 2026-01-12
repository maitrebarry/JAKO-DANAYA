import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { formatServerDate } from '../utils/date';

interface Ligne { id: number; nom: string; quantite: number; quantiteConditionnement?: number | null; multiplicateur?: number | null; prix: number; montant: number; unitLabel?: string | null; reste?: number | null }

const VenteApercuEspece: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [vente, setVente] = useState<any>(null);
  const [lignes, setLignes] = useState<Ligne[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem('smb_token');
        if (!id) return;
        const res = await fetch(`http://localhost:8085/api/ventes/${id}`, { headers: { Authorization: token ? `Bearer ${token}` : '' } });
        if (!res.ok) throw new Error('Vente introuvable');
        const data = await res.json();
        setVente(data);
        // fetch lignes
        const lres = await fetch(`http://localhost:8085/api/ventes/${id}/lignes`, { headers: { Authorization: token ? `Bearer ${token}` : '' } });
        if (lres.ok) {
          const ldata = await lres.json();
          const computed = ldata.map((lv: any) => ({
            id: lv.id,
            nom: lv.produit?.nomProduit || 'Produit',
            quantite: lv.quantite || (lv.quantiteConditionnement && lv.produit?.nombreUnitesParConditionnement ? lv.quantiteConditionnement * lv.produit.nombreUnitesParConditionnement : 0),
            quantiteConditionnement: lv.quantiteConditionnement,
            multiplicateur: lv.produit?.nombreUnitesParConditionnement || 1,
            prix: lv.newPrice ?? 0,
            montant: (lv.newPrice ?? 0) * (lv.quantite || (lv.quantiteConditionnement ? lv.quantiteConditionnement * (lv.produit?.nombreUnitesParConditionnement || 1) : 0)),
            unitLabel: lv.produit?.unite?.libelle || lv.produit?.uniteConditionnement || 'emballage',
            reste: lv.resteUnitesDansCartonApresVente ?? null
          })) as Ligne[];
          setLignes(computed);
        }
      } catch (err: any) {
        Swal.fire('Erreur', err && err.message ? err.message : 'Erreur lors de la récupération de la vente', 'error');
      } finally { setLoading(false); }
    })();
  }, [id]);

  const printPdf = async () => {
    try {
      const token = localStorage.getItem('smb_token');
      const res = await fetch(`http://localhost:8085/api/ventes/${id}/pdf`, { headers: { Authorization: token ? `Bearer ${token}` : '' } });
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err: any) {
      Swal.fire('Erreur', err && err.message ? err.message : 'Erreur génération PDF', 'error');
    }
  };

  const deleteVente = async () => {
    const r = await Swal.fire({ title: 'Confirmer la suppression', text: 'Supprimer cette vente ?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Supprimer' });
    if (!r.isConfirmed) return;
    try {
      const token = localStorage.getItem('smb_token');
      const res = await fetch(`http://localhost:8085/api/ventes/${id}`, { method: 'DELETE', headers: { Authorization: token ? `Bearer ${token}` : '' } });
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
              <button className="btn btn-primary me-2" onClick={printPdf}>Imprimer</button>
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
                          <td>{l.quantite}{l.quantiteConditionnement ? <small className="text-muted"> ({l.quantiteConditionnement} x {l.multiplicateur})</small> : null} {l.reste != null ? <div className="small text-muted">Reste dans carton: {l.reste} unité{l.reste > 1 ? 's' : ''}</div> : null}</td>
                          <td>{l.prix}</td>
                          <td>{l.montant}</td>
                        </tr>
                      ))}
                      <tr>
                        <td colSpan={3} className="text-end"><strong>Montant total</strong></td>
                        <td className="text-end">{vente.montantTotal ?? vente.total ?? 0} FCFA</td>
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
                      <input className="form-control" value={vente.remise ?? 0} readOnly />
                    </div>
                    <div className="col-xl-3 col-md-6">
                      <label>Net à payer</label>
                      <input className="form-control" value={vente.netAPayer ?? 0} readOnly />
                    </div>
                    <div className="col-xl-3 col-md-6">
                      <label>Montant reçu</label>
                      <input className="form-control" defaultValue={vente.montantRecu ?? 0} />
                    </div>
                    <div className="col-xl-3 col-md-6">
                      <label>Monnaie à rembourser</label>
                      <input className="form-control" value={vente.monnaieRembourse ?? 0} readOnly />
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
