import React, { useEffect, useState } from 'react';
import useHasPermission from '../contexts/useHasPermission';
import { useUser } from '../contexts/UserContext';
import CaisseSummary from './CaisseSummary';
import { formatServerDate } from '../utils/date';


interface Mouvement {
  id: number;
  dateMouvement: string;
  typeMouvement: string;
  sousType?: string;
  description?: string;
  referenceId?: number;
  quantite?: number;
  montant?: number;
  deviseSymbole?: string;
  produit?: { id?: number; nomProduit?: string } | null;
  boutique?: { id?: number; nom?: string } | null;
  magasin?: { id?: number; nom?: string } | null;
  utilisateur?: { id?: number; email?: string; nom?: string; prenom?: string } | null;
}

const API_BASE = 'http://localhost:8085/api';
const AUTH_HEADER = () => ({ Authorization: `Bearer ${localStorage.getItem('smb_token')}` });



// Remove numeric IDs and common id patterns from description for display
const sanitizeDescription = (s?: string) => {
  if (!s) return '';
  let out = (s || '').replace(/["']/g, '');
  out = out.replace(/\bids?\s*[:=]?\s*\d+\b/ig, ''); // id:123 or ids=123
  out = out.replace(/#\d+\b/g, ''); // #123
  out = out.replace(/\b\d{4,}\b/g, ''); // standalone long numbers
  return out.trim();
};

const Mouvements: React.FC = () => {
  const isAuditor = useHasPermission('MOUVEMENT_AUDIT');
  const { currentBoutique, user } = useUser();
  // owners (type PROPRIETAIRE) and auditors (MOUVEMENT_AUDIT) may access the caisse summary
  const canViewCaisseSummary = isAuditor || (user && (user.typeUtilisateur === 'PROPRIETAIRE'));

  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');
  const [type, setType] = useState<string>('');
  const [sousType, setSousType] = useState<string>('');
  const [boutiques, setBoutiques] = useState<any[]>([]);
  const [magasins, setMagasins] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [boutiqueId, setBoutiqueId] = useState<number | ''>('');
  const [magasinId, setMagasinId] = useState<number | ''>('');
  const [userId, setUserId] = useState<number | ''>('');
  const [results, setResults] = useState<Mouvement[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 25;

  useEffect(() => {
    let mounted = true;
    const loadLookups = async () => {
      try {
        const r1 = await fetch(`${API_BASE}/boutiques`, { headers: AUTH_HEADER() });
        if (mounted && r1.ok) setBoutiques(await r1.json());
      } catch (e) {}
      try {
        const r2 = await fetch(`${API_BASE}/magasins`, { headers: AUTH_HEADER() });
        if (mounted && r2.ok) setMagasins(await r2.json());
      } catch (e) {}
      if (isAuditor) {
        try {
          const r3 = await fetch(`${API_BASE}/utilisateurs`, { headers: AUTH_HEADER() });
          if (mounted && r3.ok) setUsers(await r3.json());
        } catch (e) {}
      }

      // Once lookups are loaded, fetch the first page so the table shows recent mouvements by default
      // For non-auditors this will display their own mouvements; auditors will see all (or filtered by current user selector)
      if (mounted) fetchResults(1);
    };
    loadLookups();
    return () => { mounted = false; };
  }, [isAuditor]);

  const buildQuery = (p?: number) => {
    const params = new URLSearchParams();
    if (userId) params.set('userId', String(userId));
    if (type) params.set('type', type);
    if (sousType) params.set('sousType', sousType);
    if (boutiqueId && isAuditor) params.set('boutiqueId', String(boutiqueId));
    if (magasinId) params.set('magasinId', String(magasinId));
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (p != null) params.set('page', String(p));
    params.set('size', String(pageSize));
    return params.toString();
  };

  const fetchResults = async (p: number = page) => {
    setLoading(true);
    try {
      const q = buildQuery(p);
      const url = `${API_BASE}/mouvements/search?${q}`;
      const r = await fetch(url, { headers: AUTH_HEADER() });
      if (!r.ok) {
        const text = await r.text();
        alert('Erreur: ' + text);
        setLoading(false);
        return;
      }
      const data = await r.json();
      if (Array.isArray(data)) {
        // legacy fallback: server returned array
        setResults(data);
        setTotalCount(data.length);
        setPage(1);
      } else if (data && data.items) {
        setResults(data.items);
        setTotalCount(data.total || 0);
        setPage(p);
      }
    } catch (e) {
      console.error(e);
      alert('Erreur lors de la récupération');
    } finally { setLoading(false); }
  };

  const presets = (range: 'day'|'week'|'month'|'year') => {
    const toDt = new Date();
    let fromDt = new Date();
    switch(range) {
      case 'day': fromDt.setDate(toDt.getDate()-1); break;
      case 'week': fromDt.setDate(toDt.getDate()-7); break;
      case 'month': fromDt.setMonth(toDt.getMonth()-1); break;
      case 'year': fromDt.setFullYear(toDt.getFullYear()-1); break;
    }
    const f = fromDt.toISOString();
    const t = toDt.toISOString();
    setFrom(f);
    setTo(t);
    // Trigger a search for page 1 after state updates
    setTimeout(() => { setPage(1); fetchResults(1); }, 0);
  };

  const exportCSV = async () => {
    // Export all matching results via server-side export
    try {
      const q = buildQuery();
      const url = `${API_BASE}/mouvements/export${q ? '?' + q : ''}`;
      const r = await fetch(url, { headers: AUTH_HEADER() });
      if (!r.ok) {
        const txt = await r.text();
        alert('Erreur export: ' + txt);
        return;
      }
      const blob = await r.blob();
      const cd = r.headers.get('Content-Disposition');
      let filename = 'mouvements_export.csv';
      if (cd && cd.includes('filename=')) {
        filename = cd.split('filename=')[1].replace(/"/g, '');
      }
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      console.error(e);
      alert('Erreur lors de l' + "export");
    }
  };

  // pagination helpers when server-side pagination is used
  const pageItems = results; // results already are the page from server
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const startIdx = (page-1)*pageSize + 1;
  const endIdx = Math.min(page*pageSize, (totalCount > 0 ? totalCount : results.length));

  return (
    <div>
      <div className="row mb-3">
        <div className="col-12">
          <h4>Journal global des mouvements</h4>
          <p className="text-muted">Filtrez et exportez les mouvements. </p>
        </div>
      </div>

      {canViewCaisseSummary ? <CaisseSummary /> : null}

      <div className="card mb-3">
        <div className="card-body">
          <div className="row g-2 align-items-end">
            <div className="col-auto">
              <label className="form-label">De</label>
              <input type="date-local" className="form-control" value={from ? new Date(from).toISOString().slice(0,16) : ''}
                onChange={e => setFrom(e.target.value ? new Date(e.target.value).toISOString() : '')} />
            </div>
            <div className="col-auto">
              <label className="form-label">À</label>
              <input type="date-local" className="form-control" value={to ? new Date(to).toISOString().slice(0,16) : ''}
                onChange={e => setTo(e.target.value ? new Date(e.target.value).toISOString() : '')} />
            </div>
            <div className="col-auto">
              <label className="form-label">Type</label>
              <input className="form-control" value={type} onChange={e => setType(e.target.value)} placeholder="ex. VENTE, CAISSE" />
            </div>
            <div className="col-auto">
              <label className="form-label">Sous-type</label>
              <input className="form-control" value={sousType} onChange={e => setSousType(e.target.value)} placeholder="ex. ESPECE, OUVERTURE" />
            </div>
            {isAuditor ? (
              <div className="col-auto">
                <label className="form-label">Boutique</label>
                <select className="form-select" value={boutiqueId ?? ''} onChange={e => setBoutiqueId(e.target.value ? Number(e.target.value) : '')}>
                  <option value="">Toutes</option>
                  {boutiques.map(b => <option key={b.id} value={b.id}>{b.nom}</option>)}
                </select>
              </div>
            ) : (
              <div className="col-auto">
                <label className="form-label">Boutique</label>
                <input className="form-control" value={currentBoutique ? currentBoutique.nom : ''} readOnly />
              </div>
            )}
            <div className="col-auto">
              <label className="form-label">Magasin</label>
              <select className="form-select" value={magasinId ?? ''} onChange={e => setMagasinId(e.target.value ? Number(e.target.value) : '')}>
                <option value="">Tous</option>
                {magasins.map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
              </select>
            </div>

            {isAuditor && (
              <div className="col-auto">
                <label className="form-label">Utilisateur</label>
                <select className="form-select" value={userId ?? ''} onChange={e => setUserId(e.target.value ? Number(e.target.value) : '')}>
                  <option value="">Tous</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.email || (u.prenom ? `${u.prenom} ${u.nom}` : u.pseudo)}</option>)}
                </select>
              </div>
            )}

            <div className="col-auto d-flex gap-2">
              <button className="btn btn-outline-secondary" onClick={() => presets('day')}>Jour</button>
              <button className="btn btn-outline-secondary" onClick={() => presets('week')}>Semaine</button>
              <button className="btn btn-outline-secondary" onClick={() => presets('month')}>Mois</button>
              <button className="btn btn-outline-secondary" onClick={() => presets('year')}>Année</button>
            </div>

            <div className="col-auto ms-auto d-flex gap-2">
              <button className="btn btn-primary" onClick={() => { setPage(1); fetchResults(1); }} disabled={loading}>{loading ? 'Chargement...' : 'Rechercher'}</button>
              <button className="btn btn-outline-success" onClick={exportCSV}>Exporter (tous)</button>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center"><h5 className="mb-0">Mouvements</h5></div>
        <div className="card-body">
          <div className="table-responsive">
            <table className="table table-striped">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Sous-type</th>
                  <th>Utilisateur</th>
                  <th>Boutique</th>
                  <th>Magasin</th>
                  <th>Produit</th>
                  <th>Quantité</th>
                  <th>Montant</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map(r => (
                  <tr key={r.id}>
                    <td>{formatServerDate(r.dateMouvement)}</td>
                    <td><span className={`badge bg-primary`}>{r.typeMouvement}</span></td>
                    <td><span className={`badge bg-secondary`}>{r.sousType}</span></td>
                    <td><span className={`badge bg-info text-white`}>{r.utilisateur ? (r.utilisateur.prenom ? `${r.utilisateur.prenom} ${r.utilisateur.nom}` : r.utilisateur.email) : ''}</span></td>
                    <td><span className={`badge bg-success`}>{r.boutique ? r.boutique.nom : ''}</span></td>
                    <td><span className={`badge bg-light text-white`}>{r.magasin ? r.magasin.nom : ''}</span></td>
                    <td>{r.produit && r.produit.nomProduit ? r.produit.nomProduit : ''}</td>
                    <td>{typeof r.quantite === 'number' ? r.quantite : ''}</td>
                    <td>{r.montant ? `${r.montant} ${r.deviseSymbole || ''}` : ''}</td>
                    <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>{sanitizeDescription(r.description)}</td>
                  </tr>
                ))}
                {pageItems.length === 0 && (
                  <tr><td colSpan={10} className="text-center">Aucun résultat</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="d-flex justify-content-between align-items-center mt-2">
            <div>Affichage {startIdx} - {endIdx} / {totalCount > 0 ? totalCount : results.length}</div>
            <div className="btn-group">
              <button className="btn btn-sm btn-outline-secondary" disabled={page <= 1} onClick={() => { setPage(p => { const np = Math.max(1, p-1); fetchResults(np); return np; }); }}>Préc</button>
              <button className="btn btn-sm btn-outline-secondary" disabled={page >= totalPages} onClick={() => { setPage(p => { const np = Math.min(totalPages, p+1); fetchResults(np); return np; }); }}>Suiv</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Mouvements;
