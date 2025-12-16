import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';

interface ReceptionData {
  id: number;
  reference: string;
  dateReception: string;
  commandeFournisseur: {
    id: number;
    reference: string;
    fournisseur: {
      id: number;
      nom: string;
      prenom: string;
    };
  };
}

const ListeReceptions: React.FC = () => {
  const navigate = useNavigate();
  const { currentBoutique } = useUser();
  const [unfinishedReceptions, setUnfinishedReceptions] = useState<ReceptionData[]>([]);
  const [finishedReceptions, setFinishedReceptions] = useState<ReceptionData[]>([]);
  const [activeTab, setActiveTab] = useState<'unfinished' | 'finished'>('unfinished');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchReceptions();
  }, [currentBoutique]);

  const fetchReceptions = async () => {
    if (!currentBoutique) return;
    setLoading(true);
    try {
      const [unfinishedRes, finishedRes] = await Promise.all([
        fetch(`http://localhost:8085/api/receptions/unfinished`),
        fetch(`http://localhost:8085/api/receptions/finished`)
      ]);
      if (!unfinishedRes.ok || !finishedRes.ok) throw new Error('Erreur lors du chargement');
      const unfinishedData = await unfinishedRes.json();
      const finishedData = await finishedRes.json();
      setUnfinishedReceptions(unfinishedData);
      setFinishedReceptions(finishedData);
    } catch (err) {
      setError('Erreur lors du chargement des réceptions');
    } finally {
      setLoading(false);
    }
  };

  const handleDetail = (id: number) => {
    navigate(`/receptions/${id}`);
  };

  const handleDelete = async (_id: number) => {
    // Implement delete with confirmation
  };

  const currentReceptions = activeTab === 'unfinished' ? unfinishedReceptions : finishedReceptions;

  return (
    <>
      <div className="pagetitle">
        <h1>Liste des Réceptions</h1>
        <nav>
          <ol className="breadcrumb">
            <li className="breadcrumb-item"><a href="/">Home</a></li>
            <li className="breadcrumb-item active">Réceptions</li>
          </ol>
        </nav>
      </div>

      <section className="section">
        <div className="row">
          <div className="col-lg-12">
            <div className="card">
              <div className="card-body">
                <ul className="nav nav-tabs" role="tablist">
                  <li className="nav-item" role="presentation">
                    <button
                      className={`nav-link ${activeTab === 'unfinished' ? 'active' : ''}`}
                      onClick={() => setActiveTab('unfinished')}
                      type="button"
                    >
                      Réceptions Non Terminées
                    </button>
                  </li>
                  <li className="nav-item" role="presentation">
                    <button
                      className={`nav-link ${activeTab === 'finished' ? 'active' : ''}`}
                      onClick={() => setActiveTab('finished')}
                      type="button"
                    >
                      Réceptions Terminées
                    </button>
                  </li>
                </ul>
                <div className="tab-content pt-3">
                  {loading ? (
                    <p>Chargement...</p>
                  ) : error ? (
                    <p className="text-danger">{error}</p>
                  ) : (
                    <div className="table-responsive">
                      <table className="table datatable table-bordered table-striped">
                        <thead>
                          <tr>
                            <th>Date Réception</th>
                            <th>Référence Réception</th>
                            <th>Référence Commande</th>
                            <th>Fournisseur</th>
                            <th>Opérations</th>
                          </tr>
                        </thead>
                        <tbody>
                          {currentReceptions.map((reception) => (
                            <tr key={reception.id}>
                              <td>{new Date(reception.dateReception).toLocaleString()}</td>
                              <td>{reception.reference}</td>
                              <td>{reception.commandeFournisseur.reference}</td>
                              <td>{reception.commandeFournisseur.fournisseur.nom} {reception.commandeFournisseur.fournisseur.prenom}</td>
                              <td>
                                <button
                                  className="btn btn-primary btn-sm me-2"
                                  onClick={() => handleDetail(reception.id)}
                                >
                                  <i className="ri-eye-fill"></i>
                                </button>
                                <button
                                  className="btn btn-danger btn-sm"
                                  onClick={() => handleDelete(reception.id)}
                                >
                                  <i className="ri-delete-bin-5-fill"></i>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default ListeReceptions;