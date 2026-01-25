import React, { useEffect, useState } from 'react';
import { useUser } from '../contexts/UserContext';
import { formatServerDate } from '../utils/date';
import { useNavigate } from 'react-router-dom';
import { useFormatMoney } from '../utils/currency';
import Swal from 'sweetalert2';
import { API } from '../config/api';

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
  const { currentBoutique } = useUser();
  const navigate = useNavigate();
  const fmt = useFormatMoney();
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
      const token = localStorage.getItem('smb_token');
      const res = await fetch(`${API}/paiements`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) throw new Error('Erreur lors du chargement');
      const data = await res.json();
      setPaiements(data);
    } catch (err) {
      setError('Erreur lors du chargement des paiements');
    } finally {
      setLoading(false);
    }
  };

  const handleDetail = (commandeId: number) => {
    navigate(`/commandes/appercu/${commandeId}`);
  };

  const handleDelete = async (id: number) => {
    const result = await Swal.fire({
      title: 'Confirmer la suppression',
      text: 'Voulez-vous supprimer ce paiement ?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Oui, supprimer',
      cancelButtonText: 'Annuler'
    });

    if (result.isConfirmed) {
      try {
        const token = localStorage.getItem('smb_token');
        const res = await fetch(`${API}/paiements/${id}`, { method: 'DELETE', headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (!res.ok) throw new Error('Erreur lors de la suppression');
        Swal.fire('Succès', 'Paiement supprimé', 'success');
        fetchPaiements();
      } catch (err) {
        Swal.fire('Erreur', 'Impossible de supprimer le paiement', 'error');
      }
    }
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
              <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center"><h5 className="mb-0">Paiements</h5></div>
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
                            <td>{formatServerDate(paiement.datePaie)}</td>
                            <td>{paiement.reference}</td>
                            <td>{paiement.commandeFournisseur.reference}</td>
                            <td>{paiement.commandeFournisseur.fournisseur.nom} {paiement.commandeFournisseur.fournisseur.prenom}</td>
                            <td>{fmt(paiement.montantPaye)}</td>
                            <td>
                              <button
                                className="btn btn-primary btn-sm me-2"
                                onClick={() => handleDetail(paiement.commandeFournisseur.id)}
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