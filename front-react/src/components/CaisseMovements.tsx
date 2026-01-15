import React, { useEffect, useState } from 'react';
import RequirePermission from './RequirePermission';
import { useUser } from '../contexts/UserContext';
import Swal from 'sweetalert2';
import { formatLocalDate } from '../utils/date';
import { useLocation } from 'react-router-dom';

interface Movement {
  id: number;
  type: string;
  typeLabel?: string | null;
  montant: number;
  balanceBefore: number;
  balanceAfter: number;
  deviseSymbole?: string;
  paiementId?: number | null;
  paiementReference?: string | null;
  commandeId?: number | null;
  commandeReference?: string | null;
  userId?: number | null;
  userFullName?: string | null;
  referenceCaisse?: string | null;
  boutiqueId?: number | null;
  raison?: string | null;
  metadata?: string | null;
  createdAt?: string | null;
}

const CaisseMovements: React.FC = () => {
  const { currentBoutique } = useUser();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const initialRef = params.get('ref') || '';

  const [reference, setReference] = useState<string>(initialRef);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (reference && reference.trim() !== '') fetchByReference(reference.trim());
  }, [reference]);

  const fetchByReference = async (ref: string) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('smb_token');
      const res = await fetch(`http://localhost:8085/api/caisses/${encodeURIComponent(ref)}/movements`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (res.status === 403) { Swal.fire('Accès refusé', 'Vous n\'avez pas la permission de voir les mouvements de caisse', 'error'); setLoading(false); return; }
      if (!res.ok) throw new Error('Erreur lors du chargement des mouvements');
      const data = await res.json();
      setMovements(data || []);
    } catch (e: any) {
      Swal.fire('Erreur', e.message || 'Erreur inconnue', 'error');
    } finally { setLoading(false); }
  };

  const fetchByBoutique = async () => {
    if (!currentBoutique) return Swal.fire('Erreur', 'Aucune boutique sélectionnée', 'error');
    setLoading(true);
    try {
      const token = localStorage.getItem('smb_token');
      const res = await fetch(`http://localhost:8085/api/caisses/boutique/${currentBoutique.id}/movements`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (res.status === 403) { Swal.fire('Accès refusé', 'Vous n\'avez pas la permission de voir les mouvements de caisse', 'error'); setLoading(false); return; }
      if (!res.ok) throw new Error('Erreur lors du chargement des mouvements');
      const data = await res.json();
      setMovements(data || []);
    } catch (e: any) {
      Swal.fire('Erreur', e.message || 'Erreur inconnue', 'error');
    } finally { setLoading(false); }
  };

  return (
    <RequirePermission permission="CAISSE_MOUVEMENT_VIEW" fallback={<div className="alert alert-danger">Permission requise pour voir les mouvements de caisse</div>}>
      <div className="container-fluid">
        <div className="page-breadcrumb d-none d-sm-flex align-items-center mb-3">
          <div className="breadcrumb-title pe-3">Mouvements de caisse</div>
          <div className="breadcrumb-subtitle">Historique détaillé</div>
        </div>
        <hr />

        <div className="card mb-3">
          <div className="card-body">
            <div className="row g-2 align-items-end">
              <div className="col-md-4">
                <label className="form-label">Référence caisse</label>
                <input className="form-control" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Ex: CAISSE-01-2026-N°1" />
              </div>
              <div className="col-md-2">
                <button className="btn btn-primary" onClick={() => fetchByReference(reference)}>Rechercher</button>
              </div>
              <div className="col-md-3">
                <button className="btn btn-secondary" onClick={() => fetchByBoutique()}>Charger mouvements boutique</button>
              </div>
              <div className="col-md-3 text-end">
                <button className="btn btn-outline-secondary" onClick={() => { setReference(''); setMovements([]); }}>Réinitialiser</button>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            {loading && <div>Chargement...</div>}
            {!loading && movements.length === 0 && <div className="text-center">Aucun mouvement trouvé</div>}
            {!loading && movements.length > 0 && (
              <table className="table table-striped">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Montant</th>
                    <th>Solde avant</th>
                    <th>Solde après</th>
                    <th>Réf caisse</th>
                    <th>Commande</th>
                    <th>Paiement</th>
                    <th>Utilisateur</th>
                    <th>Raison</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map(m => (
                    <tr key={m.id}>
                      <td>{m.createdAt ? formatLocalDate(m.createdAt) : '-'}</td>
                      <td>
                        {/* Render type as a colored badge */}
                        {(() => {
                          const label = m.typeLabel ?? m.type ?? '';
                          const key = (label || '').toString().toUpperCase();
                          let cls = 'bg-secondary';
                          if (key.includes('ENTREE') || key.includes('CREDIT')) cls = 'bg-success';
                          else if (key.includes('SORTIE') || key.includes('DEPENSE')) cls = 'bg-danger';
                          else if (key.includes('REVERSAL') || key.includes('REVERSE')) cls = 'bg-warning';
                          else cls = 'bg-secondary';
                          return <span className={`badge ${cls}`} title={label}>{label}</span>;
                        })()}
                      </td>
                      <td>{m.montant ? `${m.montant} ${m.deviseSymbole || ''}` : 0}</td>
                      <td>{m.balanceBefore ? `${m.balanceBefore} ${m.deviseSymbole || ''}` : 0}</td>
                      <td>{m.balanceAfter ? `${m.balanceAfter} ${m.deviseSymbole || ''}` : 0}</td>
                      <td>{m.referenceCaisse ?? ''}</td>
                      <td>{m.commandeReference ?? (m.commandeId ?? '')}</td>
                      <td>{m.paiementReference ?? (m.paiementId ?? '')}</td>
                      <td>{m.userFullName ?? (m.userId ?? '')}</td>
                      <td>{m.raison ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </RequirePermission>
  );
};

export default CaisseMovements;
