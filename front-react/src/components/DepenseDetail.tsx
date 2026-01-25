import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { getDepense, validateDepense, rejectDepense, cancelDepense } from '../api/depense';
import utilisateurApi from '../api/utilisateur';
import useHasPermission from '../contexts/useHasPermission';
import { API } from '../config/api';

const DepenseDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [depense, setDepense] = useState<any | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const canValidate = useHasPermission('DEPENSE_VALIDATION');
  const canCancel = useHasPermission('DEPENSE_ANNULATION');
  const canRead = useHasPermission('DEPENSE_LECTURE');
  const printRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!id) return;
        const d = await getDepense(Number(id));
        if (!mounted) return;
        setDepense(d);
        const u = await utilisateurApi.listUtilisateurs();
        if (!mounted) return;
        setUsers(u || []);
      } catch (err: any) {
        Swal.fire('Erreur', err.message || 'Erreur', 'error');
      } finally { setLoading(false); }
    })();
    return () => { mounted = false; };
  }, [id]);

  if (loading) return <div>Chargement...</div>;
  if (!canRead) return <div className="alert alert-danger">Permission DEPENSE_LECTURE requise</div>;
  if (!depense) return <div>Dépense introuvable</div>;

  const userName = (id?: number) => {
    if (!id) return '';
    const u = users.find(x => x.id === id);
    return u ? `${u.nom || ''} ${u.prenom || ''}`.trim() : `#${id}`;
  };

  const doValidate = async () => {
    const { value: ref } = await Swal.fire({
      title: 'Valider dépense',
      input: 'text',
      inputLabel: 'Référence de la caisse (optionnel)',
      inputPlaceholder: 'Entrez la référence de la caisse',
      showCancelButton: true
    });
    if (ref === undefined) return;
    try {
      await validateDepense(depense.id, (ref && ref.trim()) ? ref.trim() : undefined);
      Swal.fire('Succès', 'Dépense validée', 'success');
      const d = await getDepense(depense.id);
      setDepense(d);
    } catch (err: any) { Swal.fire('Erreur', err.message || 'Erreur lors de la validation', 'error'); }
  };

  const doReject = async () => {
    const ok = await Swal.fire({ title: 'Confirmer', text: 'Rejeter cette dépense ?', icon: 'warning', showCancelButton: true });
    if (!ok.isConfirmed) return;
    try {
      await rejectDepense(depense.id);
      Swal.fire('Succès', 'Dépense rejetée', 'success');
      const d = await getDepense(depense.id);
      setDepense(d);
    } catch (err: any) { Swal.fire('Erreur', err.message || 'Erreur lors du rejet', 'error'); }
  };

  const doCancel = async () => {
    const { value: reason } = await Swal.fire({
      title: 'Annuler dépense',
      input: 'text',
      inputLabel: 'Raison (optionnel)',
      inputPlaceholder: 'Motif de l\'annulation',
      showCancelButton: true
    });
    if (reason === undefined) return;
    try {
      await cancelDepense(depense.id, (reason && reason.trim()) ? reason.trim() : undefined);
      Swal.fire('Succès', 'Dépense annulée', 'success');
      const d = await getDepense(depense.id);
      setDepense(d);
    } catch (err: any) { Swal.fire('Erreur', err.message || 'Erreur lors de l\'annulation', 'error'); }
  };

  const doPrint = async () => {
    try {
      const token = localStorage.getItem('smb_token');
      if (!token) { Swal.fire('Erreur', 'Authentification nécessaire pour imprimer. Connectez-vous.', 'error'); return; }
      const res = await fetch(`${API}/depenses/${depense.id}/pdf`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Erreur lors de la récupération du PDF');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err: any) {
      Swal.fire('Erreur', err.message || 'Erreur lors de l\'ouverture du PDF', 'error');
    }
  };

  return (
    <div className="card">
      <div className="card-body">
        <div className="d-flex justify-content-between mb-3">
          <h5>Dépense: {depense.reference}</h5>
          <div className="d-flex gap-2">
            <button className="btn btn-outline-secondary" onClick={() => navigate(-1)} title="Retour"><i className="ri-arrow-left-line me-1"></i>Retour</button>
            <button className="btn btn-outline-primary" onClick={doPrint}><i className="ri-file-pdf-line me-1"></i>Imprimer</button>
            {depense.status === 'EN_ATTENTE' && canValidate && <button className="btn btn-success" onClick={doValidate}><i className="ri-check-line me-1"></i>Valider</button>}
            {depense.status === 'EN_ATTENTE' && canValidate && <button className="btn btn-danger" onClick={doReject}><i className="ri-close-circle-line me-1"></i>Rejeter</button>}
            {depense.status === 'VALIDEE' && canCancel && <button className="btn btn-warning" onClick={doCancel}><i className="ri-history-line me-1"></i>Annuler</button>}
          </div>
        </div>

        <div ref={printRef}>
          <div className="row mb-2">
            <div className="col-md-6"><strong>Libellé:</strong> {depense.libelle}</div>
            <div className="col-md-3"><strong>Montant:</strong> {depense.montant}</div>
            <div className="col-md-3"><strong>Date:</strong> {depense.date || (depense.createdAt ? depense.createdAt.substring(0,10) : '')}</div>
          </div>
          <div className="row mb-2">
            <div className="col-md-6"><strong>Référence caisse:</strong> {depense.referenceCaisse || '-'}</div>
            <div className="col-md-6"><strong>Statut:</strong> <span className={`badge ${depense.status === 'EN_ATTENTE' ? 'bg-warning' : depense.status === 'VALIDEE' ? 'bg-success' : 'bg-secondary'}`}>{depense.status}</span></div>
          </div>
          <div className="row mb-2">
            <div className="col-md-6"><strong>Créée par:</strong> {userName(depense.createurId)}</div>
            <div className="col-md-6"><strong>Validée par:</strong> {depense.validatorId ? userName(depense.validatorId) : '-'}</div>
          </div>
          {depense.annulePar && (
            <div className="row mb-2">
              <div className="col-md-12"><strong>Annulée par:</strong> {userName(depense.annulePar)} — {depense.annuleReason || ''}</div>
            </div>
          )}
          <div className="row mb-2">
            <div className="col-md-12"><strong>Note:</strong> {depense.note || '-'}</div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default DepenseDetail;