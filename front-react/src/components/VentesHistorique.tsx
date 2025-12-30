import React, { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { jsPDF } from 'jspdf';
import { useUser } from '../contexts/UserContext';
import { formatServerDate } from '../utils/date';

interface HistoriqueItem {
  type: 'LIVRAISON' | 'PAIEMENT';
  id: number;
  date: string | null;
  dateIso?: string | null;
  reference: string | null;
  referenceCommandeId?: number | null;
  referenceCommande: string | null;
  client: string | null;
  montant?: number | null;
  annule?: boolean | null;
  annuleAt?: string | null;
  annuleReason?: string | null;
  annulePar?: number | null;
  annuleParNom?: string | null;
}

const VentesHistorique: React.FC = () => {
  const { currentBoutique, logout, permissions } = useUser();
  const [viewingAnnulations, setViewingAnnulations] = useState(false);
  const [items, setItems] = useState<HistoriqueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'LIVRAISON' | 'PAIEMENT'>('ALL');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (currentBoutique) fetchHistorique(viewingAnnulations);
  }, [currentBoutique, viewingAnnulations]);

  const fetchHistorique = async (annulations = false) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('smb_token');
      const endpoint = annulations ? `/api/historique/ventes/annulations/boutique/${currentBoutique?.id}` : `/api/historique/ventes/boutique/${currentBoutique?.id}`;
      const res = await fetch(`http://localhost:8085${endpoint}`, { headers: { Authorization: token ? `Bearer ${token}` : '' } });
      if (res.status === 401) {
        await Swal.fire({ icon: 'warning', title: 'Session expirée', text: 'Votre session est expirée ou non authentifiée. Vous allez être redirigé vers la connexion.' });
        logout();
        throw new Error('Authentification requise (401)');
      }
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const data = await res.json();
      setItems(data || []);
    } catch (err: any) {
      setError(err.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePaiementClient = async (id: number) => {
    const result = await Swal.fire({ title: 'Confirmer l\'annulation', text: 'Voulez-vous annuler ce paiement ?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Oui, annuler', cancelButtonText: 'Annuler' });
    if (!result.isConfirmed) return;
    try {
      const token = localStorage.getItem('smb_token');
      const res = await fetch(`http://localhost:8085/api/paiements-clients/${id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
      if (!res.ok) throw new Error('Impossible d\'annuler le paiement');
      Swal.fire('Succès', 'Paiement annulé', 'success');
      fetchHistorique(viewingAnnulations);
      try {
        const cancelledItem = items.find(it => it.type === 'PAIEMENT' && it.id === id);
        const commandeId = cancelledItem ? cancelledItem.referenceCommandeId ?? null : null;
        window.dispatchEvent(new CustomEvent('paiement:cancelled', { detail: { paiementId: id, commandeId } }));
      } catch (e) {}
    } catch (e) {
      Swal.fire('Erreur', 'Impossible d\'annuler le paiement', 'error');
    }
  };

  const handleDeleteLivraison = async (id: number) => {
    const result = await Swal.fire({ title: 'Confirmer l\'annulation', text: 'Voulez-vous annuler cette livraison ?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Oui, annuler', cancelButtonText: 'Annuler' });
    if (!result.isConfirmed) return;
    try {
      const token = localStorage.getItem('smb_token');
      const res = await fetch(`http://localhost:8085/api/livraisons/${id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
      if (!res.ok) throw new Error('Impossible d\'annuler la livraison');
      Swal.fire('Succès', 'Livraison annulée', 'success');
      fetchHistorique(viewingAnnulations);
    } catch (e) {
      Swal.fire('Erreur', 'Impossible d\'annuler la livraison', 'error');
    }
  };

  const generatePdfForLivraison = async (livraisonId: number) => {
    try {
      Swal.fire({ title: 'Génération PDF...', didOpen: () => Swal.showLoading() });
      const token = localStorage.getItem('smb_token');
      // try server endpoint first
      try {
        const res = await fetch(`http://localhost:8085/api/livraisons/${livraisonId}/pdf`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (res.ok) { const blob = await res.blob(); const url = URL.createObjectURL(blob); window.open(url, '_blank'); Swal.close(); return; }
      } catch (e) {}

      // fallback: fetch livraison details and render a small PDF
      const res2 = await fetch(`http://localhost:8085/api/livraisons/${livraisonId}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res2.ok) throw new Error('Impossible de récupérer la livraison');
      const lv = await res2.json();
      const pdf = new jsPDF({ unit: 'pt', format: 'A4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      pdf.setFontSize(12);
      const title = `LIVRAISON N : ${lv.reference || livraisonId}`;
      pdf.text(title, pageWidth / 2, 60, { align: 'center' });
      pdf.setFontSize(10);
      pdf.text(`Date: ${formatServerDate(lv.dateLivraison)}`, 40, 90);
      if (lv.commandeClient) pdf.text(`COMMANDE: ${lv.commandeClient.reference || ''}`, 40, 110);
      if (lv.commandeClient && lv.commandeClient.client) pdf.text(`CLIENT: ${lv.commandeClient.client.nom || ''} ${lv.commandeClient.client.prenom || ''}`, 40, 130);
      pdf.save(`livraison-${lv.reference || livraisonId}.pdf`);
      Swal.close();
    } catch (err: any) {
      Swal.close();
      Swal.fire('Erreur', err.message || 'Erreur génération PDF', 'error');
    }
  };

  const generatePdfForPaiementClient = async (paiementId: number) => {
    try {
      Swal.fire({ title: 'Génération PDF...', didOpen: () => Swal.showLoading() });
      const token = localStorage.getItem('smb_token');
      try {
        // No server-side PDF endpoint for client payments by default; try if present
        const res = await fetch(`http://localhost:8085/api/paiements-clients/${paiementId}/pdf`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (res.ok) { const blob = await res.blob(); const url = URL.createObjectURL(blob); window.open(url, '_blank'); Swal.close(); return; }
      } catch (e) {}

      const res2 = await fetch(`http://localhost:8085/api/paiements-clients/${paiementId}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res2.ok) throw new Error('Impossible de récupérer le paiement');
      const paie = await res2.json();
      const pdf = new jsPDF({ unit: 'pt', format: 'A4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const title = `PAIEMENT N : ${paie.reference || paiementId}`;
      pdf.setFontSize(12);
      pdf.text(title, pageWidth / 2, 60, { align: 'center' });
      pdf.setFontSize(10);
      pdf.text(`Commande: ${paie.commandeClient?.reference || ''}`, 40, 90);
      pdf.text(`Date: ${formatServerDate(paie.datePaie)}`, 40, 110);
      pdf.text(`Montant: ${(paie.montantPaye || paie.montant || 0).toLocaleString('fr-FR')} FCFA`, 40, 130);
      pdf.save(`paiement-client-${paie.reference || paiementId}.pdf`);
      Swal.close();
    } catch (err: any) {
      Swal.close();
      Swal.fire('Erreur', err.message || 'Erreur génération PDF', 'error');
    }
  };

  const filtered = items.filter(i => {
    if (filterType !== 'ALL' && i.type !== filterType) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return (i.reference && i.reference.toLowerCase().includes(s)) ||
      (i.referenceCommande && i.referenceCommande.toLowerCase().includes(s)) ||
      (i.client && i.client.toLowerCase().includes(s));
  });

  const normalized = permissions.map(p => p.toUpperCase());

  return (
    <div className="container-fluid">
      <div className="page-breadcrumb d-none d-sm-flex align-items-center mb-3">
        <div className="breadcrumb-title pe-3">Historique</div>
        <div className="ps-3">
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb mb-0 p-0">
              <li className="breadcrumb-item"><a href="#"><i className="bx bx-home-alt"></i></a></li>
              <li className="breadcrumb-item active" aria-current="page">Historique Ventes</li>
            </ol>
          </nav>
        </div>
      </div>

      <hr />

      <div className="row">
        <div className="col-12">
          <div className="card" style={{ minHeight: '65vh' }}>
            <div className="card-body" style={{ minHeight: '55vh' }}>
          <div className="d-flex mb-3">
            <div className="me-3">
              <label>Type:</label>
              <select className="form-select" value={filterType} onChange={(e) => setFilterType(e.target.value as any)}>
                <option value="ALL">Tout</option>
                <option value="LIVRAISON">Livraison</option>
                <option value="PAIEMENT">Paiement</option>
              </select>
            </div>
            <div className="flex-grow-1 ms-3">
              <label>Recherche (réf / client):</label>
              <input className="form-control" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher..." />
            </div>
            <div className="ms-3">
              <label style={{ display: 'block' }}>Afficher annulations</label>
              <div className="form-check form-switch">
                <input className="form-check-input" type="checkbox" id="showAnnulations" checked={viewingAnnulations} onChange={(e) => setViewingAnnulations(e.target.checked)} />
                <label className="form-check-label" htmlFor="showAnnulations">Afficher</label>
              </div>
            </div>
          </div>

          {loading ? <p>Chargement...</p> : error ? <p className="text-danger">{error}</p> : (
            <div className="table-responsive">
              <table className="table table-striped table-bordered">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Référence</th>
                    <th>Réf Commande</th>
                    <th>Client</th>
                    <th>Montant</th>
                    {viewingAnnulations ? <th>Annulé par</th> : <th>Opérations</th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(item => (
                    <tr key={`${item.type}-${item.id}`}>
                      <td>{formatServerDate(item.dateIso || item.date || '')}</td>
                      <td>{item.type}</td>
                      <td>{item.reference}</td>
                      <td>{item.referenceCommande}</td>
                      <td>{item.client}</td>
                      <td>{item.montant != null ? item.montant.toFixed(0) : '-'}</td>
                      {viewingAnnulations ? (
                        <td>{item.annule ? (item.annuleParNom || (item.annulePar != null ? String(item.annulePar) : '-')) : '-'}</td>
                      ) : (
                        <td>
                          {/* Aperçu */}
                          {item.referenceCommandeId ? (
                            <a className="btn btn-sm btn-outline-primary me-1" href={`/ventes/livraisons?venteId=${item.referenceCommandeId}`} title="Aperçu Commande"><i className="ri-eye-line"></i></a>
                          ) : (
                            <button className="btn btn-sm btn-outline-primary me-1 disabled" title="Aperçu indisponible"><i className="ri-eye-line"></i></button>
                          )}

                          {/* PDF Paiement (enabled for PAIEMENT rows) */}
                          <button
                            className={`btn btn-sm me-1 ${item.type === 'PAIEMENT' ? 'btn-outline-success' : 'btn-outline-secondary disabled'}`}
                            title={item.type === 'PAIEMENT' ? 'PDF Paiement' : 'PDF Paiement (non applicable)'}
                            onClick={() => { if (item.type === 'PAIEMENT') generatePdfForPaiementClient(item.id); }}
                          >
                            <i className="ri-wallet-2-line"></i>
                          </button>

                          {/* PDF Livraison (enabled for LIVRAISON rows) */}
                          <button
                            className={`btn btn-sm me-1 ${item.type === 'LIVRAISON' ? 'btn-outline-info' : 'btn-outline-secondary disabled'}`}
                            title={item.type === 'LIVRAISON' ? 'PDF Livraison' : 'PDF Livraison (non applicable)'}
                            onClick={() => { if (item.type === 'LIVRAISON') generatePdfForLivraison(item.id); }}
                          >
                            <i className="ri-truck-line"></i>
                          </button>

                          {/* Annulation (for paiement clients use DELETE endpoint if available) */}
                          {item.type === 'PAIEMENT' && (normalized.includes('PAIEMENT_ANNULATION') || normalized.includes('PAIEMENT_SUPPRESSION')) && (
                            <button
                              className="btn btn-sm btn-outline-danger"
                              title="Annuler"
                              onClick={() => handleDeletePaiementClient(item.id)}
                            >
                              <i className="ri-close-line"></i>
                            </button>
                          )}

                          {item.type === 'LIVRAISON' && (normalized.includes('RECEPTION_ANNULATION') || normalized.includes('RECEPTION_SUPPRESSION')) && (
                            <button
                              className="btn btn-sm btn-outline-danger"
                              title="Annuler"
                              onClick={() => handleDeleteLivraison(item.id)}
                            >
                              <i className="ri-close-line"></i>
                            </button>
                          )}
                        </td>
                      )}
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
  );
};

export default VentesHistorique;
