import React, { useEffect, useState } from 'react';
import { useUser } from '../contexts/UserContext';

const ConfigurationMarges: React.FC = () => {
  const { currentBoutique, permissions } = useUser();
  const [config, setConfig] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState(false);

  const [form, setForm] = useState({ typeMarge: 'FIXE', valeurDetail: '', valeurGros: '', margeMinimaleDetail: '', margeMinimaleGros: '' });
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [jobUpdatedCount, setJobUpdatedCount] = useState<number | null>(null);
  const [showRecompute, setShowRecompute] = useState<boolean>(false);
  const [showJobModal, setShowJobModal] = useState<boolean>(false);
  const [jobDetails, setJobDetails] = useState<any | null>(null);
  const jobTimer = React.useRef<any>(null);

  // Authorize edit only when the explicit permission CONFIG_MARGE_ECRITURE is present
  const isAllowed = (() => {
    return Array.isArray(permissions) && permissions.map(p => p.toUpperCase()).includes('CONFIG_MARGE_ECRITURE');
  })();

  useEffect(() => {
    if (currentBoutique && currentBoutique.id) fetchConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBoutique]);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('smb_token');
      const res = await fetch(`http://localhost:8085/api/configuration-marge/boutique/${currentBoutique!.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 404) {
        setConfig(null);
        setLoading(false);
        return;
      }
      // Try to parse response body for helpful error messages
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setMessage((data && (data.error || data.message)) || 'Impossible de charger la configuration');
        setLoading(false);
        return;
      }
      setConfig(data);
      setForm({
        typeMarge: data.typeMarge || 'FIXE',
        valeurDetail: data.valeurDetail ?? '',
        valeurGros: data.valeurGros ?? '',
        margeMinimaleDetail: data.margeMinimaleDetail ?? '',
        margeMinimaleGros: data.margeMinimaleGros ?? ''
      });
    } catch (err: any) {
      setMessage(err.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!isAllowed) { setMessage('Accès refusé'); return; }
    // hide recompute button while saving
    setShowRecompute(false);
    try {
      const token = localStorage.getItem('smb_token');
      const payload = {
        typeMarge: form.typeMarge,
        valeurDetail: parseFloat(String(form.valeurDetail || 0)) || 0,
        valeurGros: parseFloat(String(form.valeurGros || 0)) || 0,
        margeMinimaleDetail: parseFloat(String(form.margeMinimaleDetail || 0)) || 0,
        margeMinimaleGros: parseFloat(String(form.margeMinimaleGros || 0)) || 0,
        boutique: { id: currentBoutique!.id }
      };
      const url = config ? `http://localhost:8085/api/configuration-marge/${config.id}` : 'http://localhost:8085/api/configuration-marge';
      const method = config ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Erreur lors de la sauvegarde');
      }
      const data = await res.json().catch(() => null);
      // backend now returns { saved, jobId } when a recompute job is started
      const savedCfg = data && data.saved ? data.saved : data;
      const returnedJobId = data && data.jobId ? data.jobId : null;
      setConfig(savedCfg);
      if (returnedJobId) {
        setMessage('Configuration enregistrée. Recalcul automatique lancé.');
        setJobId(returnedJobId);
        setJobStatus('RUNNING');
        setShowRecompute(false);
        startPollingJob(returnedJobId);
      } else {
        // Only show the recompute button after a successful modification (PUT)
        if (method === 'PUT') {
          setShowRecompute(true);
          setMessage('Modification enregistrée. Vous pouvez cliquer sur "Recalculer maintenant" pour appliquer les changements.');
        } else {
          // creation: do not show recompute button automatically
          setShowRecompute(false);
          setMessage('Configuration créée. Les changements ne sont pas appliqués automatiquement — utilisez le bouton Recalculer après modification.');
        }
      }
      setEditing(false);
      setTimeout(() => setMessage(''), 6000);
    } catch (err: any) {
      setMessage(err.message || 'Erreur');
    }
  };

  const handleDelete = async () => {
    if (!isAllowed || !config) return;
    try {
      const token = localStorage.getItem('smb_token');
      const res = await fetch(`http://localhost:8085/api/configuration-marge/${config.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Impossible de supprimer');
      setConfig(null);
      setMessage('Configuration supprimée');
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setMessage(err.message || 'Erreur');
    }
  };

  const handleRecomputeNow = async () => {
    if (!isAllowed || !config) return;
    try {
      const token = localStorage.getItem('smb_token');
      const res = await fetch(`http://localhost:8085/api/configuration-marge/boutique/${currentBoutique!.id}/recompute-job`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      if (res.status !== 202 && !res.ok) throw new Error('Impossible de lancer le job de recalcul');
      const data = await res.json().catch(() => null);
      const jid = data && data.jobId ? data.jobId : null;
      if (jid) {
        setJobId(jid);
        setJobStatus('RUNNING');
        setShowRecompute(false);
        setMessage('Recalcul des marges lancé...');
        startPollingJob(jid);
      }
    } catch (err: any) {
      setMessage(err.message || 'Erreur');
    }
  };

  const handleViewJob = async (jid: string) => {
    if (!jid) return;
    const token = localStorage.getItem('smb_token');
    try {
      const res = await fetch(`http://localhost:8085/api/configuration-marge/job/${jid}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) { setMessage('Non autorisé (token invalide)'); return; }
      if (res.status === 404) { setMessage('Job introuvable'); return; }
      if (!res.ok) { setMessage('Impossible de récupérer le job'); return; }
      const data = await res.json();
      setJobDetails(data);
      setShowJobModal(true);
    } catch (e) {
      setMessage('Erreur de récupération du job');
    }
  };

  const startPollingJob = (jid: string) => {
    if (jobTimer.current) clearInterval(jobTimer.current);
    jobTimer.current = setInterval(async () => {
      try {
        const token = localStorage.getItem('smb_token');
        const res = await fetch(`http://localhost:8085/api/configuration-marge/job/${jid}`, { headers: { Authorization: `Bearer ${token}` } });
        // stop polling on unauthorized or not found
        if (res.status === 401) {
          clearInterval(jobTimer.current); jobTimer.current = null; setMessage('Non autorisé (token invalide)'); setJobId(null); setJobStatus(null); return;
        }
        if (res.status === 404) {
          clearInterval(jobTimer.current); jobTimer.current = null; setMessage('Job introuvable'); setJobId(null); setJobStatus(null); return;
        }
        if (!res.ok) return; // ignore temporary failures
        const data = await res.json().catch(() => null);
        if (!data) return;
        setJobStatus(data.status);
        setJobUpdatedCount(data.updatedCount ?? null);
        if (data.status === 'DONE' || data.status === 'FAILED') {
          clearInterval(jobTimer.current);
          jobTimer.current = null;
          if (data.status === 'DONE') {
            setMessage(`Recalcul terminé : ${data.updatedCount} produits mis à jour`);
          } else {
            setMessage(`Erreur pendant le recalcul : ${data.error || 'inconnue'}`);
          }
          // clear job after short delay and re-enable recompute button
          setTimeout(() => { setJobId(null); setJobStatus(null); setJobUpdatedCount(null); setShowRecompute(true); }, 4000);
        }
      } catch (e) {
        // ignore
      }
    }, 2000);
  };

  React.useEffect(() => {
    return () => {
      if (jobTimer.current) clearInterval(jobTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!currentBoutique) return <div className="alert alert-warning">Aucune boutique sélectionnée.</div>;

  return (
    <div className="card">
    <div className="card-header d-flex justify-content-between align-items-center" style={{ backgroundColor: '#007bff', color: 'white' }}>
        <h6>Configuration des marges - Boutique: {currentBoutique.nom}</h6>
      </div>
      <div className="card-body">
        <div className="alert alert-light">
          <strong>Note :</strong>
          <ul className="mb-0 mt-2">
            <li>Le <em>Type de marge</em> peut être <strong>FIXE</strong> (montant ajouté au CMP) ou <strong>POURCENTAGE</strong> (pourcentage appliqué au CMP).</li>
            <li><strong>Valeur détail</strong> et <strong>Valeur gros</strong> déterminent le prix final en détail et en gros.</li>
            <li><strong>Marge minimale</strong> (fixe) : si la marge calculée est inférieure à cette valeur, le système applique la marge minimale.</li>
            {/* <li>Pour modifier ces réglages, vous devez avoir la permission <code>CONFIG_MARGE_ECRITURE</code>. Si vous n'avez pas cette permission, demandez à un administrateur via <em>Configuration → Assigner des permissions</em>.</li>
            <li>Les modifications s'appliquent à la boutique sélectionnée et impactent automatiquement le calcul des prix lors des réceptions.</li> */}
          </ul>
        </div>
      </div>
      <div className="card-body">
        {message && <div className="alert alert-info">{message}</div>}
        {loading ? (
          <div>Chargement...</div>
        ) : (
          <div>
            {config && !editing ? (
              <div>
                <p><strong>Type marge:</strong> {config.typeMarge}</p>
                <p><strong>Valeur détail:</strong> {config.valeurDetail}</p>
                <p><strong>Valeur gros:</strong> {config.valeurGros}</p>
                <p><strong>Marge minimale détail (fixe):</strong> {config.margeMinimaleDetail ?? 0}</p>
                <p><strong>Marge minimale gros (fixe):</strong> {config.margeMinimaleGros ?? 0}</p>

                {/* Banner / spinner while job running */}
                {jobStatus === 'RUNNING' && (
                  <div className="alert alert-info d-flex align-items-center" role="status">
                    <div className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></div>
                    Recalcul des marges en cours...
                  </div>
                )}

                {/* Small inline result messages */}
                {jobStatus === 'DONE' && (
                  <div className="alert alert-success">Recalcul terminé : {jobUpdatedCount ?? 0} produits mis à jour</div>
                )}
                {jobStatus === 'FAILED' && (
                  <div className="alert alert-danger">Erreur lors du recalcul des marges</div>
                )}

                {isAllowed && (
                  <div>
                    <button className="btn btn-sm btn-primary me-2" onClick={() => setEditing(true)}>Modifier</button>
                    <button className="btn btn-sm btn-danger me-2" onClick={handleDelete}>Supprimer</button>
                    {showRecompute && (
                      <button className="btn btn-sm btn-secondary me-2" onClick={handleRecomputeNow}>Recalculer maintenant</button>
                    )}
                    {jobId && <button className="btn btn-sm btn-link" onClick={() => handleViewJob(jobId)}>Voir le job</button>}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div className="mb-3">
                  <label className="form-label">Type de marge</label>
                  <select className="form-control" value={form.typeMarge} onChange={(e) => setForm({ ...form, typeMarge: e.target.value })}>
                    <option value="FIXE">FIXE</option>
                    <option value="POURCENTAGE">POURCENTAGE</option>
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label">Valeur détail ({form.typeMarge === 'POURCENTAGE' ? '%' : 'montant'})</label>
                  <input type="number" className="form-control" value={form.valeurDetail} onChange={(e) => setForm({ ...form, valeurDetail: e.target.value })} />
                </div>
                <div className="mb-3">
                  <label className="form-label">Valeur gros ({form.typeMarge === 'POURCENTAGE' ? '%' : 'montant'})</label>
                  <input type="number" className="form-control" value={form.valeurGros} onChange={(e) => setForm({ ...form, valeurGros: e.target.value })} />
                </div>
                <div className="mb-3">
                  <label className="form-label">Marge minimale détail (fixe)</label>
                  <input type="number" className="form-control" value={form.margeMinimaleDetail} onChange={(e) => setForm({ ...form, margeMinimaleDetail: e.target.value })} />
                </div>
                <div className="mb-3">
                  <label className="form-label">Marge minimale gros (fixe)</label>
                  <input type="number" className="form-control" value={form.margeMinimaleGros} onChange={(e) => setForm({ ...form, margeMinimaleGros: e.target.value })} />
                </div>
                {isAllowed ? (
                  <div>
                    <button className="btn btn-primary me-2" onClick={handleSave}>Enregistrer</button>
                    {config && <button className="btn btn-secondary" onClick={() => { setEditing(false); setForm({ typeMarge: config.typeMarge, valeurDetail: config.valeurDetail, valeurGros: config.valeurGros, margeMinimaleDetail: config.margeMinimaleDetail ?? '', margeMinimaleGros: config.margeMinimaleGros ?? '' }); }}>Annuler</button>}
                  </div>
                ) : (
                  <div className="alert alert-warning">Accès lecture seule (permissions insuffisantes)</div>
                )}
              </div>
            )}
          </div>
        )}
      {showJobModal && (
        <>
          <div className="modal-backdrop fade show"></div>
          <div className="modal d-block" tabIndex={-1} role="dialog">
            <div className="modal-dialog modal-lg" role="document">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Détail du job {jobDetails?.jobId}</h5>
                  <button type="button" className="btn-close" onClick={() => setShowJobModal(false)} aria-label="Close"></button>
                </div>
                <div className="modal-body">
                  <pre style={{whiteSpace: 'pre-wrap'}}>{JSON.stringify(jobDetails, null, 2)}</pre>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-secondary" onClick={() => setShowJobModal(false)}>Fermer</button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      </div>
    </div>
  );
};

export default ConfigurationMarges;
