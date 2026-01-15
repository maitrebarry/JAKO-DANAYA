import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { listDepenses, deleteDepense, validateDepense, rejectDepense, cancelDepense } from '../api/depense';
import DepenseForm from './DepenseForm';
import useHasPermission from '../contexts/useHasPermission';

const statusOptions = ['ALL', 'EN_ATTENTE', 'VALIDEE', 'REJETEE', 'ANNULEE'];

const DepenseList: React.FC = () => {
  const [depenses, setDepenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('EN_ATTENTE');
  const canValidate = useHasPermission('DEPENSE_VALIDATION');
  const canCreate = useHasPermission('DEPENSE_CREER');
  const canCancel = useHasPermission('DEPENSE_ANNULATION');
  const canRead = useHasPermission('DEPENSE_LECTURE');
  const navigate = useNavigate();

  const fetchList = async () => {
    if (!canRead) { setDepenses([]); setLoading(false); return; }
    setLoading(true);
    try {
      const data = await listDepenses(undefined, statusFilter === 'ALL' ? undefined : statusFilter);
      setDepenses(data);
    } catch (err: any) {
      Swal.fire('Erreur', err.message || 'Erreur lors du chargement', 'error');
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchList(); /* eslint-disable-next-line */ }, [statusFilter, canRead]);

  const handleDelete = async (d: any) => {
    const ok = await Swal.fire({ title: 'Confirmer', text: 'Supprimer cette dépense ?', icon: 'warning', showCancelButton: true });
    if (!ok.isConfirmed) return;
    try {
      await deleteDepense(d.id);
      Swal.fire('Supprimé', 'Dépense supprimée', 'success');
      fetchList();
    } catch (err: any) { Swal.fire('Erreur', err.message || 'Erreur lors de la suppression', 'error'); }
  };

  const handleValidate = async (d: any) => {
    const { value: ref } = await Swal.fire({
      title: 'Valider dépense',
      input: 'text',
      inputLabel: 'Référence de la caisse (optionnel)',
      inputPlaceholder: 'Entrez la référence de la caisse',
      showCancelButton: true
    });
    if (ref === undefined) return; // cancelled
    try {
      await validateDepense(d.id, (ref && ref.trim()) ? ref.trim() : undefined);
      Swal.fire('Validée', 'Dépense validée avec succès', 'success');
      fetchList();
    } catch (err: any) { Swal.fire('Erreur', err.message || 'Erreur lors de la validation', 'error'); }
  };

  const handleReject = async (d: any) => {
    const ok = await Swal.fire({ title: 'Confirmer', text: 'Rejeter cette dépense ?', icon: 'warning', showCancelButton: true });
    if (!ok.isConfirmed) return;
    try {
      await rejectDepense(d.id);
      Swal.fire('Rejetée', 'Dépense rejetée', 'success');
      fetchList();
    } catch (err: any) { Swal.fire('Erreur', err.message || 'Erreur lors du rejet', 'error'); }
  };

  const handleCancel = async (d: any) => {
    const { value: reason } = await Swal.fire({
      title: 'Annuler dépense',
      input: 'text',
      inputLabel: 'Raison (optionnel)',
      inputPlaceholder: 'Motif de l\'annulation',
      showCancelButton: true
    });
    if (reason === undefined) return;
    try {
      await cancelDepense(d.id, (reason && reason.trim()) ? reason.trim() : undefined);
      Swal.fire('Annulée', 'Dépense annulée', 'success');
      fetchList();
    } catch (err: any) { Swal.fire('Erreur', err.message || 'Erreur lors de l\'annulation', 'error'); }
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h4>Dépenses</h4>
        <div className="d-flex gap-2">
          <select className="form-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            {statusOptions.map(s => (<option key={s} value={s}>{s === 'ALL' ? 'Tous' : s}</option>))}
          </select>
        </div>
      </div>

      <DepenseForm onCreated={() => fetchList()} />

      <div className="card">
        <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center"><h5 className="mb-0">Dépenses</h5></div>
        <div className="card-body">
          {loading ? <div>Chargement...</div> : (
            <div className="table-responsive">
              <table className="table table-striped">
                <thead>
                  <tr>
                    <th>Réf</th>
                    <th>Libellé</th>
                    <th>Montant</th>
                    <th>Date</th>
                    <th>Réf caisse</th>
                    <th>Statut</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {depenses.map(d => (
                    <tr key={d.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/depenses/${d.id}`)}>
                      <td>{d.reference}</td>
                      <td>{d.libelle}</td>
                      <td>{d.montant ? `${d.montant} ${d.deviseSymbole || ''}` : ''}</td>
                      <td>{d.date || (d.createdAt ? d.createdAt.substring(0,10) : '')}</td>
                      <td>{d.referenceCaisse || '-'}</td>
                      <td><span className={`badge ${d.status === 'EN_ATTENTE' ? 'bg-warning' : d.status === 'VALIDEE' ? 'bg-success' : 'bg-secondary'}`}>{d.status}</span></td>
                      <td>
                        {canRead && (
                          <button
                            className="btn btn-sm btn-outline-primary me-1"
                            onClick={(e) => { e.stopPropagation(); navigate(`/depenses/${d.id}`); }}
                            title="Voir"
                          ><i className="ri-eye-line me-1"></i><span className="d-none d-sm-inline">Voir</span></button>
                        )}
                        {d.status === 'EN_ATTENTE' && canValidate && (
                          <button
                            className={`btn btn-sm btn-success me-1`}
                            onClick={(e) => { e.stopPropagation(); handleValidate(d); }}
                            title="Valider"
                          ><i className="ri-check-line me-1"></i><span className="d-none d-sm-inline">Valider</span></button>
                        )}
                        {d.status === 'EN_ATTENTE' && canValidate && (
                          <button
                            className={`btn btn-sm btn-danger me-1`}
                            onClick={(e) => { e.stopPropagation(); handleReject(d); }}
                            title="Rejeter"
                          ><i className="ri-close-circle-line me-1"></i><span className="d-none d-sm-inline">Rejeter</span></button>
                        )}
                        {d.status === 'VALIDEE' && canCancel && (
                          <button
                            className={`btn btn-sm btn-warning me-1`}
                            onClick={(e) => { e.stopPropagation(); handleCancel(d); }}
                            title="Annuler"
                          ><i className="ri-history-line me-1"></i><span className="d-none d-sm-inline">Annuler</span></button>
                        )}
                        {d.status === 'EN_ATTENTE' && canCreate && (
                          <button
                            className={`btn btn-sm btn-outline-danger`}
                            onClick={(e) => { e.stopPropagation(); handleDelete(d); }}
                            title="Supprimer"
                          ><i className="ri-delete-bin-5-fill me-1"></i><span className="d-none d-sm-inline">Supprimer</span></button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {depenses.length === 0 && (
                    <tr><td colSpan={7} className="text-center">Aucune dépense</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DepenseList;