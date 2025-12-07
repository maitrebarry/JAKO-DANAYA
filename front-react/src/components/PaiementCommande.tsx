import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import { useUser } from '../contexts/UserContext';
import SearchableSelect from './SearchableSelect';

interface CommandeData {
  id: number;
  reference: string;
  dateCommande: string;
  fournisseur: { id: number; prenom: string; nom: string } | null;
  total: number;
  paie: number;
  lignes: Array<any>;
}

// No per-line article/payment details needed on the paiement page

const PaiementCommande: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { currentBoutique } = useUser();
  const navigate = useNavigate();
  const [commandes, setCommandes] = useState<CommandeData[]>([]);
  // filteredCommandes/searchQuery are not needed with SearchableSelect
  const [selectedCommande, setSelectedCommande] = useState<CommandeData | null>(null);
  // No article list: payment is per-commande
  const [montantAPayerTotal, setMontantAPayerTotal] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generateRefPaiement = () => {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
    return `PAY-${dateStr}-${timeStr}`;
  };

  const [refPaiement] = useState(generateRefPaiement());
  const [datePaiement] = useState(new Date().toLocaleString('fr-FR'));

  useEffect(() => {
    if (currentBoutique) {
      fetchCommandes();
      if (id) handleCommandeChange(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBoutique, id]);

  // no search filter effect required for SearchableSelect

  const fetchCommandes = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('smb_token');
      // Use the new endpoint that returns only commandes with remaining amount
      const url = currentBoutique
        ? `http://localhost:8085/api/commandes-fournisseurs/boutique/${currentBoutique.id}/a-payer`
        : `http://localhost:8085/api/commandes-fournisseurs`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Erreur lors du chargement des commandes');
        const data = await res.json();
        // Transform data to ensure consistent property naming with local `paie` field
        const transformed = data.map((cmd: any) => ({
          id: cmd.id,
          reference: cmd.reference,
          dateCommande: cmd.dateCommande,
          fournisseur: cmd.fournisseur || null,
          total: cmd.total || 0,
          paie: cmd.montantPaye || 0,
          lignes: cmd.lignes || []
        }));
        // Ensure only commandes with remaining amount are displayed in the payment select
        const filtered = transformed.filter((cmd: any) => Number(cmd.total || 0) - Number(cmd.paie || 0) > 0);
        setCommandes(filtered);

      // Keep existing transformed & filtered list
    } catch (err: any) {
      setError(err.message || 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  const handleCommandeChange = async (commandeId: string) => {
    if (!commandeId) {
      setSelectedCommande(null);
      return;
    }

    try {
      const token = localStorage.getItem('smb_token');

      const commandeRes = await fetch(`http://localhost:8085/api/commandes-fournisseurs/${commandeId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!commandeRes.ok) throw new Error('Erreur lors du chargement de la commande');
        const cmdRaw = await commandeRes.json();
        const cmd = {
          id: cmdRaw.id,
          reference: cmdRaw.reference,
          dateCommande: cmdRaw.dateCommande,
          fournisseur: cmdRaw.fournisseur || null,
          total: cmdRaw.total || 0,
          paie: cmdRaw.montantPaye || 0,
          lignes: cmdRaw.lignes || []
        };
      // Ensure the commande still has remaining amount
      const total = Number(cmd.total || 0);
      const paie = Number(cmd.paie || 0);
      const remaining = Math.max(total - paie, 0);
    //   if (remaining <= 0) {
    //     Swal.fire('Info', 'Cette commande est déjà entièrement payée et ne peut pas être sélectionnée pour un paiement.', 'info');
    //     // Reset selection
    //     setSelectedCommande(null);
    //     setMontantAPayerTotal(0);
    //     return;
    //   }
      setSelectedCommande(cmd);
      // Pre-fill total payment amount with remaining amount of commande
      setMontantAPayerTotal(remaining);
    } catch (err: any) {
      Swal.fire('Erreur', err.message || 'Erreur inconnue', 'error');
    }
  };

  // No per-line payment calculations on this page

  const calculateTotals = () => {
    const montantTotal = selectedCommande ? (selectedCommande.total || 0) : 0;
    const montantPaye = selectedCommande ? (selectedCommande.paie || 0) : 0;
    const montantRestant = Math.max(montantTotal - montantPaye, 0);
    const montantAPayer = montantAPayerTotal || 0;
    return { montantTotal, montantPaye, montantRestant, montantAPayer };
  };

  const { montantTotal, montantRestant, montantAPayer } = calculateTotals();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCommande) return;
    const montantToSend = montantAPayerTotal > 0 ? montantAPayerTotal : montantAPayer;
    if (montantToSend <= 0) {
      Swal.fire('Erreur', 'Veuillez saisir un montant à payer', 'warning');
      return;
    }

    try {
      const token = localStorage.getItem('smb_token');
      // Send total montant (sum of per-line input) to backend
      // Ask for confirmation before sending
      const confirm = await Swal.fire({
        title: 'Confirmer le paiement',
        text: `Voulez-vous réellement payer ${(montantToSend).toLocaleString('fr-FR')} FCFA pour cette commande ?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Oui, payer',
        cancelButtonText: 'Annuler'
      });
      if (!confirm.isConfirmed) return;

      const res = await fetch(`http://localhost:8085/api/commandes-fournisseurs/${selectedCommande.id}/paiement`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ montant: Math.round(montantToSend), reference: refPaiement, date: new Date(datePaiement).toISOString() })
      });
      if (!res.ok) throw new Error('Erreur lors de l\u0027enregistrement du paiement');
      const updated = await res.json();
      // Normalize update to local structure
      const updatedCmd = {
        id: updated.id,
        reference: updated.reference,
        dateCommande: updated.dateCommande,
        fournisseur: updated.fournisseur || null,
        total: updated.total || 0,
        paie: updated.montantPaye || 0,
        lignes: updated.lignes || []
      };
      Swal.fire('Succès', 'Paiement enregistré avec succès', 'success');
      setSelectedCommande(updatedCmd);
      // Reset inputs
      setMontantAPayerTotal(0);
      // Update current commandes list optimistically: remove if fully paid, otherwise update the paie field and keep
      setCommandes(prev => {
        const newList = prev.map(cmd => ({ ...cmd }));
          const idx = newList.findIndex(c => c.id === updatedCmd.id);
          if (idx === -1) {
          // Not in the list already, if it still has remainder, add it back
            if ((updatedCmd.total || 0) - (updatedCmd.paie || 0) > 0) {
              newList.push(updatedCmd);
          }
        } else {
          const remaining = (updatedCmd.total || 0) - (updatedCmd.paie || 0);
          if (remaining <= 0) {
            newList.splice(idx, 1); // remove fully paid
          } else {
            newList[idx] = { ...newList[idx], paie: updatedCmd.paie };
          }
        }
        return newList;
      });
    } catch (err: any) {
      Swal.fire('Erreur', err.message || 'Erreur inconnue', 'error');
    }
  };

  if (loading) return <div>Chargement...</div>;
  if (error) return <div className="alert alert-danger">{error}</div>;

  return (
    <div className="container-fluid paiement-page">
      {/* Breadcrumb */}
      <div className="page-breadcrumb d-none d-sm-flex align-items-center mb-3">
        <div className="breadcrumb-title pe-3">Commande</div>
        <div className="ps-3">
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb mb-0 p-0">
              <li className="breadcrumb-item"><a href="#"><i className="bx bx-home-alt"></i></a></li>
              <li className="breadcrumb-item active" aria-current="page">Paiement</li>
            </ol>
          </nav>
        </div>
        <div className="ms-auto">
          <div className="btn-group">
            <button className="btn btn-primary mb-3 mb-lg-0" onClick={() => navigate('/liste-commandes')}>
              Liste des commandes
            </button>
          </div>
        </div>
      </div>
      <hr />

      <form onSubmit={handleSubmit} className="row" noValidate>
        <div className="row">
          {/* Informations principales */}
          <div className="col-xl-12">
            <div className="card">
              <div className="card-header bg-primary text-white">Référence de la commande et du paiement</div>
              <div className="card-body">
                <div className="row mb-4">
                  <div className="col-md-2">
                    <label className="form-label">Date de paiement <span className="text-danger">*</span></label>
                    <input type="text" className="form-control" value={datePaiement} readOnly />
                  </div>
                  <div className="col-md-2">
                    <label className="form-label">Réf paiement <span className="text-danger">*</span></label>
                    <input type="text" className="form-control" value={refPaiement} readOnly />
                  </div>
                  <div className="col-md-2">
                    <label className="form-label">Réf Commande <span className="text-danger">*</span></label>
                    <input type="text" className="form-control" value={selectedCommande?.reference || ''} readOnly />
                  </div>
                    <div className="col-md-2">
                      <label className="form-label">Date commande <span className="text-danger">*</span></label>
                      <input type="text" className="form-control" value={selectedCommande ? new Date(selectedCommande.dateCommande).toLocaleString('fr-FR') : ''} readOnly />
                    </div>
                    <div className="col-md-2">
                      <label className="form-label">Fournisseur <span className="text-danger">*</span></label>
                      <input type="text" className="form-control" value={selectedCommande?.fournisseur ? `${selectedCommande.fournisseur.prenom} ${selectedCommande.fournisseur.nom}` : ''} readOnly />
                    </div>
                    {/* Totals are displayed in the table below */}
                </div>
              </div>
            </div>
          </div>

          {/* Paiement - totaux & sélection */}
          <div className="col-xl-12">
            <div className="card">
              <div className="card-header bg-primary text-white">Paiement</div>
              <div className="card-body">
                <div className="form-group mb-4">
                  <label htmlFor="commande_select">Sélectionnez une commande :</label>
                  <SearchableSelect
                    options={(commandes || []).map(cmd => ({ value: cmd.id, label: `${cmd.reference} - Reste: ${Math.max(Number(cmd.total || 0) - Number(cmd.paie || 0), 0)} FCFA` }))}
                    value={selectedCommande?.id ?? null}
                    onChange={(val) => handleCommandeChange(String(val || ''))}
                    placeholder="Rechercher par référence..."
                  />
                </div>

                <div className="row mt-4">
                  <div className="col-12">
                    <table id="example" className="table table-striped table-bordered" style={{ width: '100%' }}>
                      <thead>
                        <tr>
                          <th>MONTANT TOTAL/CMD</th>
                          <th>MONTANT PAYÉ</th>
                          <th>MONTANT RESTANT</th>
                          <th>MONTANT À PAYER</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>
                            <input
                              type="number"
                              className="form-control"
                              name="mt"
                              value={Math.round(montantTotal)}
                              readOnly
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              className="form-control"
                              name="mp"
                              value={Math.round(selectedCommande?.paie || 0)}
                              readOnly
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              className="form-control"
                              name="mr"
                              value={Math.round(montantRestant)}
                              readOnly
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              className="form-control"
                              name="map"
                              min={0}
                              max={Math.round(montantRestant)}
                              value={montantAPayerTotal}
                              onChange={(e) => setMontantAPayerTotal(parseInt(e.target.value || '0', 10))}
                            />
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    <div className="text-end mt-3">
                      <button
                        id="valider-btn"
                        name="valider"
                        className="btn btn-primary"
                        type="submit"
                        style={{ display: selectedCommande ? 'inline-block' : 'none' }}
                        disabled={(montantAPayerTotal) <= 0 || (montantAPayerTotal) > montantRestant}
                      >
                        Enregistrer le paiement
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

export default PaiementCommande;
