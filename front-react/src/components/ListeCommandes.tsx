import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { useUser } from '../contexts/UserContext';
import { formatServerDate } from '../utils/date';

// Ajouter du CSS personnalisé pour SweetAlert2
const swalWideStyle = document.createElement('style');
swalWideStyle.textContent = `
  .swal-wide {
    width: 400px !important;
  }
  .swal-wide .swal2-html-container {
    text-align: center;
  }
`;
document.head.appendChild(swalWideStyle);

interface CommandeData {
  id_commande_fournisseur: number;
  reference: string;
  date_de_commande: string;
  prenom_fournisseur: string;
  nom_fournisseur: string;
  pourcentage_recu: number;
  pourcentage_paye: number;
  total: number;
  paie: number;
}

const ListeCommandes: React.FC = () => {
  const navigate = useNavigate();
  const { currentBoutique } = useUser();
  const [commandes, setCommandes] = useState<CommandeData[]>([]);
  const [filteredCommandes, setFilteredCommandes] = useState<CommandeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCommande, setSelectedCommande] = useState<CommandeData | null>(null);

  useEffect(() => {
    if (!currentBoutique) {
      setError("Aucune boutique associée à votre compte. Contactez l'administrateur.");
      setLoading(false);
      return;
    }
    fetchCommandes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBoutique?.id]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredCommandes(commandes);
    } else {
      const filtered = commandes.filter(commande =>
        commande.reference.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredCommandes(filtered);
    }
  }, [commandes, searchQuery]);

  const fetchCommandes = async () => {
    try {
      const token = localStorage.getItem('smb_token');
      const url = currentBoutique
        ? `http://localhost:8085/api/commandes-fournisseurs/boutique/${currentBoutique.id}`
        : `http://localhost:8085/api/commandes-fournisseurs`; 
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Erreur lors du chargement des commandes');
      const data = await res.json();
      // Debug: print raw date strings returned by the API (first 10)
      try { console.debug('API dates sample:', (data || []).slice(0,10).map((c: any) => c.dateCommande)); } catch (e) {}

      // Transform data to match the expected format
      const transformedData = data.map((cmd: any) => ({
        id_commande_fournisseur: cmd.id,
        reference: cmd.reference,
        date_de_commande: cmd.dateCommande,
        prenom_fournisseur: cmd.fournisseur?.prenom || '',
        nom_fournisseur: cmd.fournisseur?.nom || '',
        pourcentage_recu: cmd.pourcentageRecu || 0,
        pourcentage_paye: cmd.pourcentagePaye || 0,
        total: cmd.total || 0,
        // normalize paie field (DTO or entity)
        paie: cmd.montantPaye != null ? cmd.montantPaye : (cmd.paie != null ? cmd.paie : 0)
      }));

      setCommandes(transformedData);
    } catch (err: any) {
      setError(err.message || 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = (commande: CommandeData) => {
    setSelectedCommande(commande);
    // Afficher le menu d'actions avec SweetAlert2 au lieu du modal Bootstrap
    showActionMenu();
  };

  const showActionMenu = () => {
    if (!selectedCommande) {
      // Swal.fire('Erreur', 'Veuillez sélectionner une commande', 'warning');
      return;
    }

    Swal.fire({
      title: `Actions pour ${selectedCommande.reference}`,
      html: `
        <div class="text-center">
          <button class="btn btn-primary w-100 my-2" onclick="window.handleActionFromSwal('view')">
            <i class="bx bx-show me-2"></i> Voir la commande
          </button>
          <button class="btn btn-secondary w-100 my-2" onclick="window.handleActionFromSwal('print')">
            <i class="bx bx-printer me-2"></i> Imprimer
          </button>
          <button class="btn btn-info w-100 my-2" onclick="window.handleActionFromSwal('payment')">
            <i class="bx bx-credit-card me-2"></i> Paiement
          </button>
          <button class="btn btn-warning w-100 my-2" onclick="window.handleActionFromSwal('reception')">
            <i class="bx bx-box me-2"></i> Réception
          </button>
          <button class="btn btn-success w-100 my-2 ${selectedCommande.pourcentage_recu > 0 ? 'disabled' : ''}" 
                  onclick="window.handleActionFromSwal('modify')" 
                  ${selectedCommande.pourcentage_recu > 0 ? 'disabled' : ''}>
            <i class="bx bx-edit me-2"></i> Modification
          </button>
          <button class="btn btn-danger w-100 my-2 ${selectedCommande.pourcentage_recu > 0 ? 'disabled' : ''}" 
                  onclick="window.handleActionFromSwal('delete')" 
                  ${selectedCommande.pourcentage_recu > 0 ? 'disabled' : ''}>
            <i class="bx bx-trash me-2"></i> Supprimer
          </button>
        </div>
      `,
      showConfirmButton: false,
      showCloseButton: true,
      customClass: {
        popup: 'swal-wide'
      }
    });

    // Définir les fonctions globales pour les boutons SweetAlert
    (window as any).handleActionFromSwal = (action: string) => {
      Swal.close();
      handleAction(action);
    };
  };

  const handleAction = (action: string) => {
    if (!selectedCommande) return;

    switch (action) {
      case 'view':
        navigate(`/commandes/appercu/${selectedCommande.id_commande_fournisseur}`);
        break;
      case 'print':
        openCommandePdf(selectedCommande.id_commande_fournisseur);
        break;
      case 'payment':
        navigate(`/commandes/paiement/${selectedCommande.id_commande_fournisseur}`);
        break;
      case 'reception':
        navigate(`/commandes/reception/${selectedCommande.id_commande_fournisseur}`);
        break;
      case 'modify':
        if (selectedCommande.pourcentage_recu > 0) {
          Swal.fire('Erreur', 'Impossible de modifier une commande déjà réceptionnée', 'error');
        } else {
          navigate(`/commandes/update/${selectedCommande.id_commande_fournisseur}`);
        }
        break;
      case 'delete':
        if (selectedCommande.pourcentage_recu > 0) {
          Swal.fire('Erreur', 'Impossible de supprimer une commande déjà réceptionnée', 'error');
        } else {
          handleDelete(selectedCommande.id_commande_fournisseur);
        }
        break;
    }
  };

  const openCommandePdf = async (commandeId: number) => {
    try {
      const token = localStorage.getItem('smb_token');
      const res = await fetch(`http://localhost:8085/api/commandes-fournisseurs/${commandeId}/pdf`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Impossible de charger le PDF');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err: any) {
      Swal.fire('Erreur', err.message || 'Erreur lors du téléchargement du PDF', 'error');
    }
  };

  const handleDelete = async (id: number) => {
    const result = await Swal.fire({
      title: 'Êtes-vous sûr ?',
      text: 'Cette action est irréversible.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Oui, supprimer',
      cancelButtonText: 'Annuler'
    });

    if (result.isConfirmed) {
      try {
        const token = localStorage.getItem('smb_token');
        const res = await fetch(`http://localhost:8085/api/commandes-fournisseurs/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!res.ok) throw new Error('Erreur lors de la suppression');

        Swal.fire('Succès', 'Commande supprimée avec succès', 'success');
        fetchCommandes();
      } catch (err: any) {
        Swal.fire('Erreur', err.message || 'Erreur inconnue', 'error');
      }
    }
  };

  const getProgressBarClass = (percentage: number): string => {
    if (percentage === 100) return 'bg-success';
    if (percentage > 0) return 'bg-primary';
    return 'bg-danger';
  };

  const calculateTotals = () => {
    const totalGeneral = filteredCommandes.reduce((sum, cmd) => sum + cmd.total, 0);
    const totalMontantPaye = filteredCommandes.reduce((sum, cmd) => sum + cmd.paie, 0);
    return { totalGeneral, totalMontantPaye };
  };

  const { totalGeneral, totalMontantPaye } = calculateTotals();

  if (loading) return <div>Chargement...</div>;
  if (error) return <div className="alert alert-danger">{error}</div>;

  return (
    <>
      {/* Breadcrumb */}
      <div className="page-breadcrumb d-none d-sm-flex align-items-center mb-3">
        <div className="breadcrumb-title pe-3">Commande</div>
        <div className="breadcrumb-subtitle">Commande Fournisseur</div>
        <div className="ps-3">
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb mb-0 p-0">
              <li className="breadcrumb-item"><a href="#"><i className="bx bx-home-alt"></i></a></li>
              <li className="breadcrumb-item active" aria-current="page">Liste des commandes</li>
            </ol>
          </nav>
        </div>
        <div className="ms-auto">
          <div className="btn-group">
            <button className="btn btn-primary mb-3 mb-lg-0" onClick={() => navigate('/commande-fournisseur')}>
              Commande Fournisseur
            </button>
          </div>
        </div>
      </div>
      {/* End breadcrumb */}
      <hr />

      <div className="row">
        <div className="col-xl-12">
          <div className="card">
            <div className="card-body">
              <div className="table-responsive">
                <form className="mb-3">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Rechercher une commande par sa référence..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </form>

                <table className="table table-striped table-bordered">
                  <thead>
                    <tr>
                      <th>DATE</th>
                      <th style={{ width: '15%' }}>REFERENCE</th>
                      <th style={{ width: '15%' }}>FOURNISSEUR</th>
                      <th>% REÇU</th>
                      <th>% PAYÉ</th>
                      <th style={{ width: '15%' }}>TOTAL</th>
                      <th style={{ width: '18%' }}>MONTANT PAYÉ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCommandes.length > 0 ? (
                      <>
                        {filteredCommandes.map((commande) => (
                          <tr
                            key={commande.id_commande_fournisseur}
                            className="table-row"
                            style={{ cursor: 'pointer' }}
                            onClick={() => handleRowClick(commande)}
                          >
                            <td>{formatServerDate(commande.date_de_commande)}</td>
                            <td>{commande.reference}</td>
                            <td>{commande.prenom_fournisseur} {commande.nom_fournisseur}</td>
                            <td>
                              <div className="progress" style={{ height: '35px' }}>
                                <div
                                  className={`progress-bar ${getProgressBarClass(commande.pourcentage_recu)}`}
                                  role="progressbar"
                                  style={{ width: `${commande.pourcentage_recu}%` }}
                                  aria-valuenow={commande.pourcentage_recu}
                                  aria-valuemin={0}
                                  aria-valuemax={100}
                                >
                                  {commande.pourcentage_recu.toFixed(2)}%
                                </div>
                              </div>
                            </td>
                            <td>
                              <div className="progress" style={{ height: '35px' }}>
                                <div
                                  className={`progress-bar ${getProgressBarClass(commande.pourcentage_paye)}`}
                                  role="progressbar"
                                  style={{ width: `${commande.pourcentage_paye}%` }}
                                  aria-valuenow={commande.pourcentage_paye}
                                  aria-valuemin={0}
                                  aria-valuemax={100}
                                >
                                  {commande.pourcentage_paye.toFixed(2)}%
                                </div>
                              </div>
                            </td>
                            <td>{commande.total.toFixed(2)} FCFA</td>
                            <td>{commande.paie.toFixed(2)} FCFA</td>
                          </tr>
                        ))}
                        <tr>
                          <td colSpan={5} className="text-end">
                            <span className="text-primary">Total Général :</span>
                          </td>
                          <td>
                            <span className="text-primary">{totalGeneral.toFixed(2)} FCFA</span>
                          </td>
                          <td>
                            <span className="text-primary">{totalMontantPaye.toFixed(2)} FCFA</span>
                          </td>
                        </tr>
                      </>
                    ) : (
                      <tr>
                        <td colSpan={7} className="text-center">Aucune commande trouvée</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

    </>
  );
};

export default ListeCommandes;