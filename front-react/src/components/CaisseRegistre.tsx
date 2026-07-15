import React, { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { useUser } from '../contexts/UserContext';
import useHasPermission from '../contexts/useHasPermission';
import RequirePermission from './RequirePermission';
import { formatLocalDate } from '../utils/date';
import { API } from '../config/api';

const CaisseRegistre: React.FC = () => {
  const { currentBoutique } = useUser();
  const [caisses, setCaisses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [montantInitial, setMontantInitial] = useState<number>(0);
  const [reference, setReference] = useState<string>('');
  const [statut, setStatut] = useState<string>('OUVERTE');
  // Date and validation errors (to match PHP form behavior)
  const [date, setDate] = useState<string>('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  useEffect(() => {
    fetchCaisses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBoutique]);

  // Set current date in yyyy-mm-dd for the date picker (like updateDate JS in PHP)
  useEffect(() => {
    const now = new Date();
    const formatted = now.toISOString().slice(0, 10);
    setDate(formatted);
  }, []);

  const sanitizeBoutiquePrefix = (name: string) => {
    if (!name) return '';
    return name.replace(/[^A-Za-z0-9\- ]/g, '').trim().replace(/\s+/g, '-').toUpperCase();
  };

  // When caisses list changes, regenerate the default reference prefixed by boutique (BOUTIQUE-CAISSE-mm-YYYY-N°count)
  useEffect(() => {
    if (!currentBoutique) return;
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const count = (caisses || []).length || 0;
    const prefix = sanitizeBoutiquePrefix(currentBoutique.nom || '');
    const gen = `${prefix}-CAISSE-${month}-${year}-N°${count + 1}`;
    setReference(gen);
  }, [caisses, currentBoutique]);

  // Determine if there is an open caisse for this boutique
  const openCaisse = (caisses || []).find(c => (c.statut || '').toUpperCase() === 'OUVERTE');
  const hasOpenCaisse = !!openCaisse;

  const generateRef = () => {
    const d = new Date();
    const date = d.toISOString().slice(0,10).replace(/-/g,'');
    const time = d.toTimeString().slice(0,8).replace(/:/g,'');
    const prefix = sanitizeBoutiquePrefix(currentBoutique?.nom || '');
    return `${prefix}-CAISSE-${date}-${time}`;
  }

  // Permissions
  const canModifyCaisse = useHasPermission('CAISSE_MODIFIER');

  const fetchCaisses = async () => {
    if (!currentBoutique) return setCaisses([]);
    setLoading(true);
    try {
      const token = localStorage.getItem('smb_token');
      const res = await fetch(`${API}/caisses`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) throw new Error('Impossible de charger les caisses');
      const data = await res.json();
      // filter by boutique
      const filtered = (data || []).filter((c: any) => c.boutique && c.boutique.id === currentBoutique.id);
      setCaisses(filtered);
    } catch (e: any) {
      Swal.fire('Erreur', e.message || 'Erreur lors du chargement des caisses', 'error');
    } finally {
      setLoading(false);
    }
  }

  const createCaisse = async () => {
    if (submitting) return;
    if (!currentBoutique) return Swal.fire('Erreur', 'Aucune boutique définie pour cet utilisateur', 'error');

    // Prevent creation if an open caisse exists
    if (hasOpenCaisse) {
      await Swal.fire('Erreur', 'Une caisse est déjà ouverte pour cette boutique. Fermez-la avant d\'en créer une nouvelle.', 'warning');
      return;
    }

    // Validation (match PHP server-side checks)
    const localErrors: Record<string, string> = {};
    if (!date || date.trim() === '') localErrors.date = 'Le champ Date est requis.';
    if (!reference || reference.trim() === '') localErrors.reference = 'Le champ Référence est requis.';
    if (!montantInitial || Number(montantInitial) <= 0) localErrors.montant = 'Le champ Montant Initial est requis.';

    if (Object.keys(localErrors).length > 0) {
      setErrors(localErrors);
      return;
    }

    // Clear previous errors
    setErrors({});

    setSubmitting(true);
    try {
      const token = localStorage.getItem('smb_token');
      const ref = reference || generateRef();
      const payload = {
        dateCaisse: date, // use selected date
        montantInitial: Math.round(montantInitial || 0),
        montantTotal: Math.round(montantInitial || 0),
        reference: ref,
        statut: statut,
        boutique: { id: currentBoutique.id }
      };
      const res = await fetch(`${API}/caisses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' },
        body: JSON.stringify(payload)
      });
      if (res.status === 409) throw new Error('Une caisse est déjà ouverte pour cette boutique.');
      if (!res.ok) throw new Error('Erreur lors de la création de la caisse');
      await Swal.fire('Succès', 'Caisse créée', 'success');
      setReference('');
      setMontantInitial(0);
      setStatut('OUVERTE');
      // refresh list which will also regenerate the reference
      fetchCaisses();
    } catch (e: any) {
      Swal.fire('Erreur', e.message || 'Erreur inconnue', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  const updateStatut = async (id: number, newStatut: string) => {
    if (updatingId !== null) return;
    if (!canModifyCaisse) { Swal.fire('Accès refusé', 'Vous n\'avez pas la permission de modifier les caisses', 'error'); return; }
    setUpdatingId(id);
    try {
      const token = localStorage.getItem('smb_token');
      // fetch existing caisse
      const resGet = await fetch(`${API}/caisses/${id}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!resGet.ok) throw new Error('Caisse introuvable');
      const caisse = await resGet.json();
      caisse.statut = newStatut;
      const res = await fetch(`${API}/caisses/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' },
        body: JSON.stringify(caisse)
      });
      if (!res.ok) throw new Error('Impossible de mettre à jour le statut');
      await Swal.fire('Succès', 'Statut mis à jour', 'success');
      fetchCaisses();
    } catch (e: any) {
      Swal.fire('Erreur', e.message || 'Erreur inconnue', 'error');
    } finally {
      setUpdatingId(null);
    }
  }

  if (!currentBoutique) return <div className="alert alert-warning">Aucune boutique associée à votre compte.</div>

  return (
    <div className="container-fluid">
      <div className="page-breadcrumb d-none d-sm-flex align-items-center mb-3">
        <div className="breadcrumb-title pe-3">Caisse</div>
        <div className="breadcrumb-subtitle">Registre de caisse</div>
      </div>
      <hr />

      <div className="card mb-4">
        <div className="card-header bg-primary text-white">Nouvelle caisse</div>
        <div className="card-body">
          <div className="row mb-3">
            <label htmlFor="currentDate" className="col-sm-1 col-form-label">Date<span className="text-danger">*</span></label>
            <div className="col-sm-2">
              <input type="date" id="currentDate" name="date" value={date} onChange={(e) => setDate(e.target.value)} className={`form-control ${errors.date ? 'is-invalid' : ''}`} />
              {errors.date && <div className="invalid-feedback">{errors.date}</div>}
            </div>

            <label htmlFor="reference" className="col-sm-1 col-form-label">Référence<span className="text-danger">*</span></label>
            <div className="col-sm-2">
              <input type="text" id="reference" name="reference" className={`form-control ${errors.reference ? 'is-invalid' : ''}`} value={reference} readOnly />
              {errors.reference && <div className="invalid-feedback">{errors.reference}</div>}
            </div>

            <label htmlFor="montant" className="col-sm-1 col-form-label">Montant Initial<span className="text-danger">*</span></label>
            <div className="col-sm-2">
              <input type="number" id="montant" name="montant_initial" placeholder="montant initial" className={`form-control ${errors.montant ? 'is-invalid' : ''}`} value={montantInitial} onChange={(e) => setMontantInitial(Number(e.target.value || 0))} />
              {errors.montant && <div className="invalid-feedback">{errors.montant}</div>}
            </div>

            <label htmlFor="statut" className="col-sm-1 col-form-label">Statut</label>
            <div className="col-sm-1">
              <div className="form-check">
                <input type="checkbox" id="statut" className="form-check-input" checked={statut === 'OUVERTE'} onChange={(e) => setStatut(e.target.checked ? 'OUVERTE' : 'FERMEE')} />
                <label className="form-check-label" htmlFor="statut"></label>
              </div>
            </div>
          </div>

          <div className="text-center">
            <RequirePermission permission="CAISSE_GERER" fallback={<button type="button" className="btn btn-secondary me-2" disabled title="Permission requise">Sauvegarder</button>}>
              <button type="button" className="btn btn-success me-2" onClick={createCaisse} disabled={hasOpenCaisse || submitting} title={hasOpenCaisse ? 'Une caisse est ouverte. Fermez-la avant d\'en créer une nouvelle.' : ''}>{submitting ? 'Création...' : 'Sauvegarder'}</button>
            </RequirePermission>
            {/* <a className="btn btn-primary" href="#liste-caisses">Liste caisse</a> */}
            {hasOpenCaisse && (
              <div className="mt-2"><small className="text-warning">Une caisse est ouverte (Réf: {openCaisse?.reference} — N°{openCaisse?.numero}). Fermez-la avant d'en créer une nouvelle.</small></div>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header bg-primary text-white">Caisses (Boutique: {currentBoutique?.nom})</div>
        <div className="card-body">
          {loading && <div>Chargement...</div>}
          <table id="liste-caisses" className="table table-striped">
            <thead>
              <tr>
                {/* <th>N°</th> */}
                <th>DATE</th>
                <th>REFERENCE</th>
                <th>MONTANT INITIAL</th>
                <th>MONTANT TOTAL</th>
                <th>STATUT</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {caisses.map(c => (
                <tr key={c.id}>
                  {/* <td>{c.numero ?? '-'}</td> */}
                  <td>{c.dateCaisse ? formatLocalDate(c.dateCaisse) : '-'}</td>
                  <td>{c.reference}</td>
                  <td>{c.montantInitial ?? '-'}</td>
                  <td>{c.montantTotal ?? '-'}</td>
                  <td>{c.statut ?? '-'}</td>
                  <td>
                    <button className="btn btn-sm btn-secondary me-2" onClick={() => updateStatut(c.id, c.statut === 'OUVERTE' ? 'FERMEE' : 'OUVERTE')} disabled={updatingId === c.id}>{updatingId === c.id ? '...' : (c.statut === 'OUVERTE' ? 'Fermer' : 'Ouvrir')}</button>
                    <button className="btn btn-sm btn-outline-primary" style={{ marginLeft: 8 }} onClick={() => window.location.href = `/caisses/movements?ref=${encodeURIComponent(c.reference)}`}>Voir mouvements</button>
                  </td>
                </tr>
              ))}
              {caisses.length === 0 && (
                <tr><td colSpan={7} className="text-center">Aucune caisse trouvée pour cette boutique</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default CaisseRegistre;