import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import Swal from 'sweetalert2';
import { useUser } from '../contexts/UserContext';
import SearchableSelect from './SearchableSelect';
import { formatServerDate, formatLocalDate } from '../utils/date';
import useHasPermission from '../contexts/useHasPermission';
import RequirePermission from './RequirePermission';

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
  const [caisses, setCaisses] = useState<any[]>([]);
  const [selectedCaisseRef, setSelectedCaisseRef] = useState<string | null>(null);

  const generateRefPaiement = () => {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
    return `PAY-${dateStr}-${timeStr}`;
  };

  const [refPaiement] = useState(generateRefPaiement());
  // Store payment date as ISO string to avoid parsing localized strings later
  const [datePaiement] = useState(new Date().toISOString());

  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const isVenteMode = searchParams.get('mode') === 'vente';

  useEffect(() => {
    if (currentBoutique) {
      fetchCommandes();
      fetchCaisses();
      if (id) handleCommandeChange(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBoutique, id, isVenteMode]);

  // Listen for global paiement cancellation events to refresh data
  useEffect(() => {
    const handler = (ev: Event) => {
      try {
        // @ts-ignore
        const detail = ev.detail || {};
        const commandeId = detail.commandeId ?? null;
        // Always refresh commandes list
        fetchCommandes();
        // If the cancelled paiement affects the currently selected commande, refresh it
        if (selectedCommande && commandeId && Number(selectedCommande.id) === Number(commandeId)) {
          handleCommandeChange(String(commandeId));
        }
      } catch (e) {}
    };
    window.addEventListener('paiement:cancelled', handler as EventListener);
    return () => window.removeEventListener('paiement:cancelled', handler as EventListener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCommande]);

  // no search filter effect required for SearchableSelect

  const fetchCommandes = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('smb_token');
      // Use the new endpoint that returns only commandes with remaining amount (fournisseurs) or fetch clients list
      const url = currentBoutique
        ? (isVenteMode ? `http://localhost:8085/api/commandes-clients` : `http://localhost:8085/api/commandes-fournisseurs/boutique/${currentBoutique.id}/a-payer`)
        : (isVenteMode ? `http://localhost:8085/api/commandes-clients` : `http://localhost:8085/api/commandes-fournisseurs`);
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Erreur lors du chargement des commandes');
        const data = await res.json();
        // Transform data to ensure consistent property naming with local `paie` field
        const transformed = data.map((cmd: any) => ({
          id: cmd.id,
          reference: cmd.reference,
          dateCommande: cmd.dateCommande || cmd.dateVente,
          fournisseur: isVenteMode ? (cmd.client || null) : (cmd.fournisseur || null),
          total: cmd.total || 0,
          // backend may return montantPaye (DTO) or paie (entity)
          paie: cmd.montantPaye != null ? cmd.montantPaye : (cmd.paie != null ? cmd.paie : 0),
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

  const fetchCaisses = async () => {
    if (!currentBoutique) return setCaisses([]);
    try {
      const token = localStorage.getItem('smb_token');
      const res = await fetch('http://localhost:8085/api/caisses', { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) throw new Error('Impossible de charger les caisses');
      const data = await res.json();
      const open = (data || []).filter((c: any) => c.boutique && c.boutique.id === currentBoutique.id && (c.statut || '').toUpperCase() === 'OUVERTE');
      setCaisses(open);
      if (open.length > 0 && !selectedCaisseRef) setSelectedCaisseRef(open[0].reference);
    } catch (e: any) {
      // ignore fetch errors here - caisses are optional for the UI input
    }
  };

  const handleCommandeChange = async (commandeId: string) => {
    if (!commandeId) {
      setSelectedCommande(null);
      return;
    }

    try {
      const token = localStorage.getItem('smb_token');
      let endpoint = isVenteMode ? `http://localhost:8085/api/commandes-clients/${commandeId}` : `http://localhost:8085/api/commandes-fournisseurs/${commandeId}`;

      const commandeRes = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!commandeRes.ok) throw new Error('Erreur lors du chargement de la commande');
      const cmdRaw = await commandeRes.json();

      // Normalize shape for the UI: use the same fields (fournisseur holds client when in vente mode)
      const cmd = isVenteMode ? {
        id: cmdRaw.id,
        reference: cmdRaw.reference,
        dateCommande: cmdRaw.dateCommande,
        fournisseur: cmdRaw.client || null, // map client into fournisseur slot for reuse of UI
        total: cmdRaw.total || 0,
        paie: cmdRaw.paie != null ? cmdRaw.paie : 0,
        lignes: cmdRaw.lignes || []
      } : {
        id: cmdRaw.id,
        reference: cmdRaw.reference,
        dateCommande: cmdRaw.dateCommande,
        fournisseur: cmdRaw.fournisseur || null,
        total: cmdRaw.total || 0,
        paie: cmdRaw.montantPaye != null ? cmdRaw.montantPaye : (cmdRaw.paie != null ? cmdRaw.paie : 0),
        lignes: cmdRaw.lignes || []
      };

      // Ensure the commande still has remaining amount
      const total = Number(cmd.total || 0);
      const paie = Number(cmd.paie || 0);
      const remaining = Math.max(total - paie, 0);

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

  const canCreatePaiement = useHasPermission('PAIEMENT_CREER');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCommande) return;
    if (!canCreatePaiement) { Swal.fire('Accès refusé', 'Vous n\'avez pas la permission de créer un paiement', 'error'); return; }
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

      const endpoint = isVenteMode ? `http://localhost:8085/api/commandes-clients/${selectedCommande.id}/paiement` : `http://localhost:8085/api/commandes-fournisseurs/${selectedCommande.id}/paiement`;
      const payload: any = { montant: Math.round(montantToSend), reference: refPaiement, date: datePaiement, timezoneOffsetMinutes: new Date().getTimezoneOffset() };
      if (isVenteMode) payload.referenceCaisse = selectedCaisseRef;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Erreur lors de l\u0027enregistrement du paiement');
      const updated = await res.json();
      // Check caisse update headers
      const caisseUpdated = res.headers.get('X-Caisse-Updated') === 'true';
      const caisseTotal = res.headers.get('X-Caisse-Total');

      // Normalize update to local structure (support both DTO and entity shapes)
      const updatedPaie = updated.montantPaye != null ? updated.montantPaye : (updated.paie != null ? updated.paie : 0);
      const updatedCmd = isVenteMode ? {
        id: updated.id,
        reference: updated.reference,
        dateCommande: updated.dateCommande,
        fournisseur: updated.client || updated.fournisseur || null, // client maps into fournisseur slot
        total: updated.total || 0,
        paie: updated.paie != null ? updated.paie : updatedPaie,
        lignes: updated.lignes || []
      } : {
        id: updated.id,
        reference: updated.reference,
        dateCommande: updated.dateCommande,
        fournisseur: updated.fournisseur || null,
        total: updated.total || 0,
        paie: updatedPaie,
        lignes: updated.lignes || []
      };

      // Notify user
      let successMsg = 'Paiement enregistré avec succès';
      if (caisseUpdated) {
        successMsg += `. La caisse a été mise à jour (Montant total: ${caisseTotal} FCFA)`;
      }
      Swal.fire('Succès', successMsg, 'success');

      setSelectedCommande(updatedCmd);
      // Reset inputs
      setMontantAPayerTotal(0);
      // Refresh commandes list to ensure consistency with backend
      fetchCommandes();
      // Update current commandes list optimistically too (best effort)
      setCommandes(prev => {
        const newList = prev.map(cmd => ({ ...cmd }));
        const idx = newList.findIndex(c => c.id === updatedCmd.id);
        if (idx === -1) {
          if ((updatedCmd.total || 0) - (updatedCmd.paie || 0) > 0) {
            newList.push(updatedCmd);
          }
        } else {
          const remaining = (updatedCmd.total || 0) - (updatedCmd.paie || 0);
          if (remaining <= 0) {
            newList.splice(idx, 1);
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
        <div className="breadcrumb-subtitle">{isVenteMode ? 'Commande Client' : 'Commande Fournisseur'}</div>
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
                    <input type="text" className="form-control" value={formatLocalDate(datePaiement)} readOnly />
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
                      <input type="text" className="form-control" value={selectedCommande ? formatServerDate(selectedCommande.dateCommande) : ''} readOnly />
                    </div>
                    <div className="col-md-2">
                      <label className="form-label">{isVenteMode ? 'Client' : 'Fournisseur'} <span className="text-danger">*</span></label>
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
                              value={montantTotal}
                              readOnly
                            />
                          </td>
                          <td>
                            <input type="number" className="form-control" value={selectedCommande?.paie || 0} readOnly />
                          </td>
                          <td>
                            <input type="number" className="form-control" value={montantRestant} readOnly />
                          </td>
                          <td>
                            <input type="number" className="form-control" value={montantAPayerTotal} onChange={(e) => setMontantAPayerTotal(Number(e.target.value || 0))} />
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    {/* Caisse selector (required for Option A) — only for client payments (vente mode) */}
                    {isVenteMode && (
                      <div className="mt-3 mb-3">
                        <label className="form-label">Référence de la caisse <span className="text-danger">*</span></label>
                        <select className="form-select" value={selectedCaisseRef || ''} onChange={(e) => setSelectedCaisseRef(e.target.value)}>
                          <option value="">-- Sélectionnez une caisse ouverte --</option>
                          {caisses.map(c => (
                            <option key={c.id} value={c.reference}>{c.reference} (Montant total: {c.montantTotal ?? 0})</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className="text-end mt-3">
                      <RequirePermission permission="PAIEMENT_CREER" fallback={<button className="btn btn-secondary" disabled title="Permission requise" style={{ display: selectedCommande ? 'inline-block' : 'none' }}>Enregistrer le paiement</button>}>
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
                      </RequirePermission>
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
