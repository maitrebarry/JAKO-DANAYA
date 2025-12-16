import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

interface LigneReceptionDTO {
  idProduit: number;
  designation: string;
  depot: string;
  stock: number;
  qteCommande: number;
  qteRecue: number;
  receptionActuelle: number;
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
            <li className="breadcrumb-item"><a href="/liste-receptions">Réceptions</a></li>
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
                        <h5>Date de la réception: {new Date(detail.dateReception).toLocaleString()}</h5>
                      </div>
                    </div>
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
                              <td>{ligne.designation}</td>
                              <td>{ligne.qteCommande}</td>
                              <td>{ligne.qteRecue}</td>
                              <td>{ligne.receptionActuelle}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
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
                    <button className="btn btn-primary" onClick={() => navigate('/liste-receptions')}>
                      Liste Des Réceptions
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