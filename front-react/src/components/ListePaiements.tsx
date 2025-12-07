import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';

interface PaiementData {
  id: number;
  montantPaye: number;
  datePaie: string;
  reference: string;
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

const ListePaiements: React.FC = () => {
  const navigate = useNavigate();
  const { currentBoutique } = useUser();
  const [paiements, setPaiements] = useState<PaiementData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPaiements();
  }, [currentBoutique]);

  const fetchPaiements = async () => {
    if (!currentBoutique) return;
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:8085/api/paiements`);
      if (!res.ok) throw new Error('Erreur lors du chargement');
      const data = await res.json();
      setPaiements(data);
    } catch (err) {
      setError('Erreur lors du chargement des paiements');
    } finally {
      setLoading(false);
    }
  };

  const handleDetail = (id: number) => {
    // Navigate to detail if exists
  };

  const handleDelete = async (id: number) => {
    // Implement delete
  };

  return (
    <>
      <div className="pagetitle">
        <h1>Liste des Paiements</h1>
        <nav>
          <ol className="breadcrumb">
            <li className="breadcrumb-item"><a href="/">Home</a></li>
            <li className="breadcrumb-item active">Paiements</li>
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
                ) : (
                  <div className="table-responsive">
                    <table className="table datatable table-bordered table-striped">
                      <thead>
                        <tr>
                          <th>Date Paiement</th>
                          <th>Référence Paiement</th>
                          <th>Référence Commande</th>
                          <th>Fournisseur</th>
                          <th>Montant Payé</th>
                          <th>Opérations</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paiements.map((paiement) => (
                          <tr key={paiement.id}>
                            <td>{new Date(paiement.datePaie).toLocaleString()}</td>
                            <td>{paiement.reference}</td>
                            <td>{paiement.commandeFournisseur.reference}</td>
                            <td>{paiement.commandeFournisseur.fournisseur.nom} {paiement.commandeFournisseur.fournisseur.prenom}</td>
                            <td>{paiement.montantPaye} FCFA</td>
                            <td>
                              <button
                                className="btn btn-primary btn-sm me-2"
                                onClick={() => handleDetail(paiement.id)}
                              >
                                <i className="ri-eye-fill"></i>
                              </button>
                              <button
                                className="btn btn-danger btn-sm"
                                onClick={() => handleDelete(paiement.id)}
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
      </section>
    </>
  );
};

export default ListePaiements;