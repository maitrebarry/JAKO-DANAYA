import React, { useEffect, useState } from 'react';
import useHasPermission from '../contexts/useHasPermission';
import { useUser } from '../contexts/UserContext';
import { listUtilisateurs } from '../api/utilisateur';

const API_BASE = 'http://localhost:8085/api';
const AUTH_HEADER = () => ({ Authorization: `Bearer ${localStorage.getItem('smb_token')}` });

type Period = 'day' | 'month' | 'year';


interface CaisseSummaryItem {
  period: string;
  totalEntrees: number;
  totalSorties: number;
}

interface CaisseSummaryResult {
  items: CaisseSummaryItem[];
  totalEntrees: number;
  totalSorties: number;
  net: number;
}

const numberFmt = (n?: number) => (typeof n === 'number' ? n.toFixed(2) : '0.00');

const CaisseSummary: React.FC = () => {
  const isAuditor = useHasPermission('MOUVEMENT_AUDIT');
  const { currentBoutique, user, roles = [] } = useUser();
  // owner OR auditor OR SUPERADMIN can access this summary
  const hasAccess = isAuditor || (user && user.typeUtilisateur === 'PROPRIETAIRE') || (roles && roles.includes('SUPERADMIN'));
  const [users, setUsers] = useState<any[]>([]);
  const [userId, setUserId] = useState<number | ''>('');
  const [period, setPeriod] = useState<Period>('day');
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CaisseSummaryResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasAccess) return; // don't load users if no access
    let mounted = true;
    const loadUsers = async () => {
      try {
        const all = await listUtilisateurs();
        if (!mounted) return;
        // If currentBoutique available, filter users to that boutique (owners should only select their employees)
        if (currentBoutique && currentBoutique.id) {
          setUsers(all.filter((u: any) => u.boutiqueId === currentBoutique.id || u.boutique_id === currentBoutique.id || u.boutique?.id === currentBoutique.id));
        } else {
          setUsers(all);
        }
      } catch (e) {
        console.error(e);
      }
    };
    loadUsers();
    return () => { mounted = false; };
  }, [currentBoutique, hasAccess]);

  const buildQuery = () => {
    const params = new URLSearchParams();
    params.set('period', period);
    if (userId) params.set('userId', String(userId));
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    return params.toString();
  };

  const fetchSummary = async () => {
    if (!hasAccess) { setError('Accès refusé'); setResult(null); return; }
    setLoading(true);
    setError(null);
    try {
      const q = buildQuery();
      const res = await fetch(`${API_BASE}/mouvements/reports/caisse/summary?${q}`, { headers: AUTH_HEADER() });
      if (!res.ok) {
        const txt = await res.text();
        setError(txt || 'Erreur serveur');
        setResult(null);
        return;
      }
      const data: CaisseSummaryResult = await res.json();
      setResult(data);
    } catch (e: any) {
      console.error(e);
      setError(String(e));
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    if (!result) return;
    const lines: string[] = [];
    // French headers separated by semicolon to avoid locale issues
    lines.push('Période;Entrées;Sorties;NET');
    result.items.forEach(it => {
      const net = (it.totalEntrees || 0) - (it.totalSorties || 0);
      lines.push(`${it.period};${numberFmt(it.totalEntrees)};${numberFmt(it.totalSorties)};${numberFmt(net)}`);
    });
    // Totals row
    lines.push(`TOTAL;${numberFmt(result.totalEntrees)};${numberFmt(result.totalSorties)};${numberFmt(result.net)}`);
    const csv = lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `caisse_summary_${period}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div className="card mb-3">
      <div className="card-body">
        <h5 className="card-title">Résumé caisse par employé</h5>
        <div className="row g-2 align-items-end">
          <div className="col-auto">
            <label className="form-label">Employé</label>
            <select className="form-select" value={userId ?? ''} onChange={e => setUserId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">Tous</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.prenom ? `${u.prenom} ${u.nom}` : (u.email || u.pseudo)}</option>
              ))}
            </select>
          </div>

          <div className="col-auto">
            <label className="form-label">Période</label>
            <select className="form-select" value={period} onChange={e => setPeriod(e.target.value as Period)}>
              <option value="day">Jour</option>
              <option value="month">Mois</option>
              <option value="year">Année</option>
            </select>
          </div>

          <div className="col-auto">
            <label className="form-label">De</label>
            <input type="datetime-local" className="form-control" value={from ? new Date(from).toISOString().slice(0,16) : ''}
                   onChange={e => setFrom(e.target.value ? new Date(e.target.value).toISOString() : '')} />
          </div>

          <div className="col-auto">
            <label className="form-label">À</label>
            <input type="datetime-local" className="form-control" value={to ? new Date(to).toISOString().slice(0,16) : ''}
                   onChange={e => setTo(e.target.value ? new Date(e.target.value).toISOString() : '')} />
          </div>

          <div className="col-auto ms-auto d-flex gap-2">
            <button className="btn btn-primary" onClick={fetchSummary} disabled={loading}>{loading ? 'Chargement...' : 'Rechercher'}</button>
            <button className="btn btn-outline-success" onClick={exportCSV} disabled={!result}>Exporter CSV</button>
          </div>
        </div>

        <div className="mt-3">
          {error && <div className="alert alert-danger">{error}</div>}

          {!hasAccess && (
            <div className="alert alert-warning">Accès réservé aux propriétaires ou aux auditeurs disposant de la permission appropriée.</div>
          )}

          {!result && !error && hasAccess && <div className="text-muted">Aucune recherche effectuée.</div>}

          {result && hasAccess && (
            <div className="table-responsive mt-2">
              <table className="table table-sm table-striped">
                <thead>
                  <tr>
                    <th>Période</th>
                    <th className="text-end">Entrées</th>
                    <th className="text-end">Sorties</th>
                    <th className="text-end">NET</th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((it, idx) => (
                    <tr key={idx}>
                      <td>{it.period}</td>
                      <td className="text-end">{numberFmt(it.totalEntrees)}</td>
                      <td className="text-end">{numberFmt(it.totalSorties)}</td>
                      <td className="text-end">{numberFmt((it.totalEntrees || 0) - (it.totalSorties || 0))}</td>
                    </tr>
                  ))}
                  <tr className="fw-bold">
                    <td>TOTAL</td>
                    <td className="text-end">{numberFmt(result.totalEntrees)}</td>
                    <td className="text-end">{numberFmt(result.totalSorties)}</td>
                    <td className="text-end">{numberFmt(result.net)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CaisseSummary;
