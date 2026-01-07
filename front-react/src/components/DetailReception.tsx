import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { formatServerDate } from '../utils/date';
import { useUser } from '../contexts/UserContext';

interface LigneReceptionDTO {
  idProduit: number;
  designation: string;
  depot: string;
  stock: number;
  qteCommande: number;
  qteRecue: number;
  receptionActuelle: number;
  quantiteConditionnement?: number | null;
  quantiteConditionnementRecueThis?: number | null;
  quantiteConditionnementRestante?: number | null;
  nombreUnitesParConditionnement?: number | null;
  uniteConditionnementLibelle?: string | null;
}

interface ReceptionDetail {
  id: number;
  reference: string;
  dateReception: string;
  idCommandeFournisseur: number;
  referenceCommande: string;
  fournisseur: string;
  idBoutique: number;
  lignesReception: LigneReceptionDTO[];
}

const DetailReception: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { logout } = useUser();
  const [detail, setDetail] = useState<ReceptionDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDetail();
  }, [id]);

  const fetchDetail = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:8085/api/receptions/${id}/detail`);
      if (!res.ok) throw new Error('Erreur lors du chargement');
      const data = await res.json();
      setDetail(data);
    } catch (err) {
      setError('Erreur lors du chargement du détail');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <p>Chargement...</p>;
  if (error) return <p className="text-danger">{error}</p>;
  if (!detail) return <p>Aucune donnée</p>;

  return (
    <>
      <div className="pagetitle">
        <h1>Détail de la Réception</h1>
        <nav>
          <ol className="breadcrumb">
            <li className="breadcrumb-item"><a href="/">Home</a></li>
            <li className="breadcrumb-item"><a href="/historique">Réceptions</a></li>
            <li className="breadcrumb-item active">Détail</li>
          </ol>
        </nav>
      </div>

      <section className="section">
        <div className="row">
          <div className="col-lg-12">
            <div className="card">
              <div className="card-body">
                {loading ? (
                  <p>Chargement...</p>
                ) : error ? (
                  <p className="text-danger">{error}</p>
                ) : detail ? (
                  <>
                    <div className="row mb-3">
                      <div className="col-4">
                        <h5>Info sur la commande N° {detail.referenceCommande}</h5>
                      </div>
                      <div className="col-4">
                        <h5>Fournisseur: {detail.fournisseur}</h5>
                      </div>
                      <div className="col-4">
                        <h5>Date de la réception: {formatServerDate(detail.dateReception)}</h5>
                      </div>
                    </div>
                    <div className="card">
                      <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center"><h5 className="mb-0">Articles</h5></div>
                      <div className="card-body p-2">
                        <div className="table-responsive">
                      <table className="table table-bordered table-striped">
                        <thead>
                          <tr>
                            <th>Désignation</th>
                            <th>Qté Commande</th>
                            <th>Qté Reçue</th>
                            <th>Qté Restante</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.lignesReception.map((ligne, index) => (
                            <tr key={index}>
                              <td>
                                {((ligne.quantiteConditionnement && ligne.quantiteConditionnement > 0) || (ligne.nombreUnitesParConditionnement && ligne.nombreUnitesParConditionnement > 1 && ligne.qteCommande % ligne.nombreUnitesParConditionnement === 0)) ? (
                                  (() => {
                                    const mul = ligne.nombreUnitesParConditionnement || 1;
                                    const condCount = ligne.quantiteConditionnement && ligne.quantiteConditionnement > 0 ? ligne.quantiteConditionnement : Math.floor(ligne.qteCommande / mul);
                                    return (
                                      <div>
                                        <div><strong>{condCount} {ligne.uniteConditionnementLibelle || 'carton'} {ligne.designation}</strong></div>
                                        <div><small className="text-muted"># {ligne.qteCommande} u — 1 {ligne.uniteConditionnementLibelle ?? 'carton'} = {mul} u</small></div>
                                      </div>
                                    );
                                  })()
                                ) : (
                                  <>{ligne.designation}</>
                                )}
                              </td>
                              <td>{((ligne.quantiteConditionnement && ligne.quantiteConditionnement > 0) || (ligne.nombreUnitesParConditionnement && ligne.nombreUnitesParConditionnement > 1 && ligne.qteCommande % ligne.nombreUnitesParConditionnement === 0)) ? `${ligne.quantiteConditionnement && ligne.quantiteConditionnement > 0 ? ligne.quantiteConditionnement : Math.floor(ligne.qteCommande / (ligne.nombreUnitesParConditionnement || 1))} ${ligne.uniteConditionnementLibelle ?? 'carton'}` : ligne.qteCommande}</td>
                              <td>{(ligne.quantiteConditionnementRecueThis && ligne.quantiteConditionnementRecueThis > 0) || ((ligne.nombreUnitesParConditionnement && ligne.nombreUnitesParConditionnement > 1 && ligne.qteRecue % ligne.nombreUnitesParConditionnement === 0) ? `${Math.floor(ligne.qteRecue / (ligne.nombreUnitesParConditionnement || 1))} ${ligne.uniteConditionnementLibelle ?? 'carton'}` : ligne.qteRecue)}</td>
                              <td>{(ligne.quantiteConditionnementRestante && ligne.quantiteConditionnementRestante > 0) || ((ligne.nombreUnitesParConditionnement && ligne.nombreUnitesParConditionnement > 1 && ligne.receptionActuelle % ligne.nombreUnitesParConditionnement === 0) ? `${Math.floor(ligne.receptionActuelle / (ligne.nombreUnitesParConditionnement || 1))} ${ligne.uniteConditionnementLibelle ?? 'carton'}` : ligne.receptionActuelle)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
                  </>
                ) : (
                  <p>Aucune donnée</p>
                )}
              </div>
              <div className="card-footer">
                <div className="row">
                  <div className="col-6">
                    <h6>Référence de la réception: {detail?.reference}</h6>
                  </div>
                  <div className="col-6 text-end">
                    <button className="btn btn-outline-secondary me-2" onClick={async () => {
                      try {
                        const token = localStorage.getItem('smb_token');
                        const res = await fetch(`http://localhost:8085/api/receptions/${id}/pdf`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
                        if (res.status === 401) {
                          await Swal.fire('Session expirée', 'Authentification requise. Vous allez être redirigé vers la page de connexion.', 'error');
                          try { logout(); } catch (e) {}
                          return;
                        }
                        if (!res.ok) throw new Error('Impossible de générer le PDF');
                        const blob = await res.blob();
                        const url = URL.createObjectURL(blob);
                        window.open(url, '_blank');
                      } catch (e) {
                        alert('Erreur lors du téléchargement du PDF');
                      }
                    }} title="PDF Réception">
                      <i className="ri-file-pdf-line"></i>
                    </button>
                    <button className="btn btn-primary" onClick={() => navigate('/historique')}>
                      Historique
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default DetailReception;