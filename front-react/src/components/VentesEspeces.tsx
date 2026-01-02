import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { useUser } from '../contexts/UserContext';
import useHasPermission from '../contexts/useHasPermission';
import { formatServerDate } from '../utils/date';

interface Item {
  id: number;
  date: string | null;
  dateIso?: string | null;
  reference?: string | null;
  referenceCommandeId?: number | null;
  referenceCommande?: string | null;
  client?: string | null;
  fournisseur?: string | null;
  responsable?: string | null;
  montant?: number | null;
}

const VentesEspeces: React.FC = () => {
  const { currentBoutique, logout } = useUser();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const canAnnulerPaiement = useHasPermission('PAIEMENT_ANNULATION') || useHasPermission('PAIEMENT_SUPPRESSION');

  useEffect(() => {
    if (currentBoutique) fetchEspeces();
  }, [currentBoutique]);

  const fetchEspeces = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('smb_token');
      const endpoint = `/api/historique/ventes/especes/boutique/${currentBoutique?.id}`;
      console.debug('fetchEspeces: token present?', !!token, 'endpoint=', endpoint);
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`http://localhost:8085${endpoint}`, { headers });

      if (res.status === 401) {
        const txt = await res.text().catch(() => null);
        console.debug('fetchEspeces: 401 body=', txt);
        const result = await Swal.fire({
          icon: 'warning',
          title: 'Session expirée ?',
          html: `<div>Le serveur a répondu 401 (non autorisé). Détails: <pre style="white-space:pre-wrap">${txt || ''}</pre></div>`,
          showCancelButton: true,
          confirmButtonText: 'Se reconnecter',
          cancelButtonText: 'Rester ici'
        });
        if (result.isConfirmed) {
          logout();
          throw new Error('Authentification requise (401)');
        } else {
          setError('Session invalide (401) — reconnectez-vous si nécessaire.');
          return;
        }
      }

      if (!res.ok) {
        const txt = await res.text().catch(() => null);
        console.debug('fetchEspeces: non-ok status', res.status, txt);
        throw new Error(`Erreur ${res.status}: ${(txt && txt.toString()) || ''}`);
      }

      const data = await res.json();
      setItems(data || []);
    } catch (err: any) {
      setError(err.message || 'Erreur');
    } finally { setLoading(false); }
  };

  const generatePdfForPaiementClient = async (paiementId: number) => {
    try {
      Swal.fire({ title: 'Génération PDF...', didOpen: () => Swal.showLoading() });
      const token = localStorage.getItem('smb_token');
      const res = await fetch(`http://localhost:8085/api/paiements-clients/${paiementId}/pdf`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) throw new Error('Impossible de générer le PDF côté serveur');
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl);
      Swal.close();
    } catch (err: any) {
      Swal.close();
      Swal.fire('Erreur', err.message || 'Erreur génération PDF', 'error');
    }
  };

  const handleDeletePaiement = async (id: number) => {
    const result = await Swal.fire({ title: 'Confirmer l\'annulation', text: 'Voulez-vous annuler ce paiement ?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Oui, annuler', cancelButtonText: 'Annuler' });
    if (!result.isConfirmed) return;
    try {
      const token = localStorage.getItem('smb_token');
      const res = await fetch(`http://localhost:8085/api/paiements-clients/${id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ reason: 'Annulation via ventes en espèces' })
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => null);
        let msg = 'Impossible d\'annuler le paiement';
        try { const j = txt ? JSON.parse(txt) : null; if (j && j.error) msg += ': ' + j.error; } catch(e){}
        throw new Error(msg);
      }
      Swal.fire('Succès', 'Paiement annulé', 'success');
      fetchEspeces();
      try { window.dispatchEvent(new CustomEvent('paiement:cancelled', { detail: { paiementId: id } })); } catch (e) {}
    } catch (e) {
      Swal.fire('Erreur', 'Impossible d\'annuler le paiement', 'error');
    }
  };

  return (
    <div className="container-fluid">
      <div className="page-breadcrumb d-none d-sm-flex align-items-center mb-3">
        <div className="breadcrumb-title pe-3">Ventes</div>
        <div className="ps-3">
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb mb-0 p-0">
              <li className="breadcrumb-item"><a href="#"><i className="bx bx-home-alt"></i></a></li>
              <li className="breadcrumb-item active" aria-current="page">Ventes en Espèces</li>
            </ol>
          </nav>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="d-flex mb-3 justify-content-between align-items-end">
            <div>
              <h5>Liste Ventes en Espèces</h5>
            </div>
            <div>
              {/* Optionally add filters or export buttons here */}
            </div>
          </div>

          {loading ? <p>Chargement...</p> : error ? <p className="text-danger">{error}</p> : (
            <div className="table-responsive">
              <table className="table table-striped table-bordered">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Client</th>
                    <th>Responsable</th>
                    <th>Montant</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(it => (
                    <tr key={it.id}>
                      <td>{formatServerDate((it as any).dateIso || it.date || '')}</td>
                      <td>{it.client ?? it.fournisseur}</td>
                      <td>{it.responsable ?? '-'}</td>
                      <td>{it.montant != null ? it.montant.toFixed(0) : '-'}</td>
                      <td>
                        <button className={`btn btn-sm btn-outline-primary me-1 ${it.referenceCommandeId ? '' : 'disabled'}`} title={it.referenceCommandeId ? 'Détail' : 'Détail indisponible'} onClick={() => { if (it.referenceCommandeId) navigate(`/ventes/appercu/${it.referenceCommandeId}`); }}><i className="ri-eye-line"></i></button>
                        <button className="btn btn-sm btn-outline-success me-1" title="Imprimer" onClick={() => generatePdfForPaiementClient(it.id)}><i className="ri-printer-line"></i></button>
                        {canAnnulerPaiement && <button className="btn btn-sm btn-outline-danger" title="Supprimer" onClick={() => handleDeletePaiement(it.id)}><i className="ri-delete-bin-line"></i></button>}
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
  );
};

export default VentesEspeces;
