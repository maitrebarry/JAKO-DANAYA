import React, { useEffect, useState } from 'react';
import { useUser } from '../contexts/UserContext';

const ConfigurationMarges: React.FC = () => {
  const { currentBoutique, user, permissions } = useUser();
  const [config, setConfig] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState(false);

  const [form, setForm] = useState({ typeMarge: 'FIXE', valeurDetail: '', valeurGros: '', margeMinimaleDetail: '', margeMinimaleGros: '' });

  // Authorize edit when user is superadmin/proprietaire OR has explicit permission CONFIG_MARGE_ECRITURE
  const isAllowed = (() => {
    const t = (user?.typeUtilisateur || '').toUpperCase();
    if (t === 'SUPERADMIN' || t === 'PROPRIETAIRE') return true;
    if (Array.isArray(permissions) && permissions.map(p => p.toUpperCase()).includes('CONFIG_MARGE_ECRITURE')) return true;
    return false;
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
      const saved = await res.json();
      setConfig(saved);
      setMessage('Configuration enregistrée');
      setEditing(false);
      setTimeout(() => setMessage(''), 3000);
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

  if (!currentBoutique) return <div className="alert alert-warning">Aucune boutique sélectionnée.</div>;

  return (
    <div className="card">
      <div className="card-header bg-primary text-white">
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
                {isAllowed && (
                  <div>
                    <button className="btn btn-sm btn-primary me-2" onClick={() => setEditing(true)}>Modifier</button>
                    <button className="btn btn-sm btn-danger" onClick={handleDelete}>Supprimer</button>
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
      </div>
    </div>
  );
};

export default ConfigurationMarges;
