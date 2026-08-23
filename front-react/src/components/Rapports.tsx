import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import useHasPermission from '../contexts/useHasPermission';
import { useUser } from '../contexts/UserContext';
import { formatMoney } from '../utils/currency';
import { API as API_BASE } from '../config/api';
const AUTH_HEADER = () => ({ Authorization: `Bearer ${localStorage.getItem('smb_token')}` });

const Rapports: React.FC = () => {
  const { currentBoutique, user, roles = [] } = useUser();
  // Accept different permission names that exist in tokens and allow admin roles as fallback
  const canView = useHasPermission('RAPPORTS_VOIR') || useHasPermission('RAPPORT_LECTURE') || useHasPermission('RAPPORT_CREER') || (user && (user.typeUtilisateur === 'SUPERADMIN' || user.typeUtilisateur === 'ADMINISTRATEUR' || user.typeUtilisateur === 'PROPRIETAIRE' || roles.includes('ADMIN')));
  const [reportType, setReportType] = useState<'ventes'|'stock'|'valeur-stock'|'top-produits'>('ventes');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [boutique, setBoutique] = useState<string>(currentBoutique ? String(currentBoutique.id) : '');
  const [boutiques, setBoutiques] = useState<any[]>([]);
  const [limit, setLimit] = useState<number>(10);
  const [rows, setRows] = useState<any[]>([]);
  const [aggregates, setAggregates] = useState<any>({ totalCount: 0, totalAmount: 0, valeur: 0 });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const r = await fetch(`${API_BASE}/boutiques`, { headers: AUTH_HEADER() });
        if (!r.ok) return;
        const data = await r.json();
        if (mounted) setBoutiques(data || []);
      } catch (e) {
        console.error('Erreur chargement boutiques', e);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  if (!canView) return <div className="alert alert-warning">Accès non autorisé</div>

  const generate = async () => {
    setLoading(true);
    try {
      if (reportType === 'ventes') {
        const from = startDate || new Date().toISOString().slice(0,10).replace(/-\d{2}$/, '-01');
        const to = endDate || new Date().toISOString().slice(0,10);
        const q = new URLSearchParams();
        if (boutique) q.set('boutique', boutique);
        q.set('from', from);
        q.set('to', to);
        const r = await fetch(`${API_BASE}/rapports/ventes?${q.toString()}`, { headers: AUTH_HEADER() });
        if (!r.ok) throw new Error(await r.text());
        const data = await r.json();
        // map server DTO to table rows
        const mapped = data.map((d: any) => ({ date: d.date, ventes: d.nombreVentes, montant: d.montantTotal }));
        setRows(mapped);
        setAggregates({ totalCount: mapped.length, totalAmount: mapped.reduce((s:any, r:any) => s + (r.montant || 0), 0) });
      } else if (reportType === 'stock') {
        const q = new URLSearchParams();
        if (boutique) q.set('boutique', boutique);
        const r = await fetch(`${API_BASE}/rapports/stock?${q.toString()}`, { headers: AUTH_HEADER() });
        if (!r.ok) throw new Error(await r.text());
        const data = await r.json();
        const mapped = data.map((d: any) => ({ produit: d.produitName, qte: d.quantiteDisponible, magasin: d.magasinName }));
        setRows(mapped);
        setAggregates({ totalCount: mapped.length });
      } else if (reportType === 'valeur-stock') {
        const q = new URLSearchParams();
        if (boutique) q.set('boutique', boutique);
        const r = await fetch(`${API_BASE}/rapports/valeur-stock?${q.toString()}`, { headers: AUTH_HEADER() });
        if (!r.ok) throw new Error(await r.text());
        const data = await r.json();
        const mapped = (data.details || []).map((d: any) => ({ produit: d.produitName, qte: d.quantiteDisponible, unitPrice: d.costAverage || d.lastPurchasePrice, valeur: (d.costAverage || d.lastPurchasePrice) ? ((d.costAverage || d.lastPurchasePrice) * (d.quantiteDisponible || 0)) : 0 }));
        setRows(mapped);
        setAggregates({ valeur: data.valeurTotale, totalCount: mapped.length });
      } else { // top-produits
        const from = startDate || new Date().toISOString().slice(0,10).replace(/-\d{2}$/, '-01');
        const to = endDate || new Date().toISOString().slice(0,10);
        const q = new URLSearchParams();
        if (boutique) q.set('boutique', boutique);
        q.set('from', from);
        q.set('to', to);
        q.set('limit', String(limit));
        const r = await fetch(`${API_BASE}/rapports/top-produits?${q.toString()}`, { headers: AUTH_HEADER() });
        if (!r.ok) throw new Error(await r.text());
        const data = await r.json();
        const mapped = data.map((d: any) => ({ produit: d.produitName, ventes: d.quantiteVendue, montant: d.montantTotal }));
        setRows(mapped);
        setAggregates({ totalCount: mapped.length });
      }
    } catch (e: any) {
      console.error(e);
      alert('Erreur: ' + (e.message || e));
    } finally { setLoading(false); }
  };

  const exportFile = async (format: 'csv'|'pdf') => {
    if (format === 'pdf') Swal.fire({ title: 'Génération PDF...', didOpen: () => Swal.showLoading() });
    try {
      const params = new URLSearchParams();
      if (boutique) params.set('boutique', boutique);
      if (reportType === 'ventes' || reportType === 'top-produits') { params.set('from', startDate || ''); params.set('to', endDate || ''); }
      if (reportType === 'top-produits') params.set('limit', String(limit));
      params.set('format', format);
      const url = `${API_BASE}/rapports/${reportType}?${params.toString()}`;
      const r = await fetch(url, { headers: AUTH_HEADER() });
      if (!r.ok) throw new Error(await r.text());
      const blob = await r.blob();
      const disposition = r.headers.get('Content-Disposition') || '';
      let filename = `${reportType}.${format === 'csv' ? 'csv' : 'pdf'}`;
      const m = disposition.match(/filename=(.+)$/);
      if (m && m[1]) filename = m[1].replace(/"/g, '').trim();
      const urlObj = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = urlObj;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(urlObj);
      if (format === 'pdf') Swal.close();
    } catch (e: any) {
      if (format === 'pdf') { Swal.close(); Swal.fire('Erreur', 'Erreur export: ' + (e.message || e), 'error'); }
      else alert('Erreur export: ' + (e.message || e));
    }
  };

  const exportCsv = () => exportFile('csv');
  const exportPdf = () => exportFile('pdf');

  const formatCell = (key: string, value: any): string => {
    if (key === 'date' && typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, d] = value.split('-');
      return `${d}/${m}/${y}`;
    }
    return String(value ?? '');
  };

  return (
    <div>
      <div className="page-breadcrumb d-none d-sm-flex align-items-center mb-3">
        <div className="breadcrumb-title pe-3">Rapports</div>
        <div className="ps-3">
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb mb-0 p-0">
              <li className="breadcrumb-item"><a href="#"><i className="bx bx-home-alt"></i></a></li>
              <li className="breadcrumb-item active" aria-current="page">Rapports</li>
            </ol>
          </nav>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <h5>Rapports (étape 1 - UI)</h5>

          <div className="row mb-3">
            <div className="col-md-3">
              <label className="form-label">Type de rapport</label>
              <select className="form-select" value={reportType} onChange={e => setReportType(e.target.value as any)}>
                <option value="ventes">Ventes (par date)</option>
                <option value="stock">Stock actuel (par boutique)</option>
                <option value="valeur-stock">Valeur du stock</option>
                <option value="top-produits">Produits les plus vendus</option>
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label">Boutique</label>
              <select className="form-select" value={boutique} onChange={e => setBoutique(e.target.value)}>
                <option value="">Toutes</option>
                {boutiques.map(b => (<option key={b.id} value={String(b.id)}>{b.nom}</option>))}
              </select>
            </div>
            {reportType === 'ventes' && (
              <>
                <div className="col-md-2">
                  <label className="form-label">Date début</label>
                  <input type="date" className="form-control" value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>
                <div className="col-md-2">
                  <label className="form-label">Date fin</label>
                  <input type="date" className="form-control" value={endDate} onChange={e => setEndDate(e.target.value)} />
                </div>
              </>
            )}
            {reportType === 'top-produits' && (
              <div className="col-md-2">
                <label className="form-label">Limite</label>
                <input type="number" className="form-control" value={limit} onChange={e => setLimit(Number(e.target.value))} min={1} />
              </div>
            )}
            <div className="col-md-3 d-flex align-items-end">
              <button className="btn btn-primary me-2" onClick={generate} disabled={loading}>{loading ? 'Génération...' : 'Générer'}</button>
              <button className="btn btn-outline-secondary me-2" onClick={exportCsv} disabled={loading || rows.length === 0}>Exporter CSV</button>
              <button className="btn btn-outline-secondary" onClick={exportPdf} disabled={loading || rows.length === 0}>Exporter PDF</button>
            </div>
          </div>

          <div className="mb-3">
            <div className="fw-semibold">Résumé</div>
            <div>Éléments: {aggregates.totalCount ?? 0}</div>
            {typeof aggregates.totalAmount === 'number' && <div>Total Montant: {formatMoney(aggregates.totalAmount)}</div>}
            {aggregates.valeur && <div>Valeur stock: {formatMoney(aggregates.valeur)}</div>}
          </div>

          {rows.length > 0 && (
            <div className="table-responsive">
              <table className="table table-sm">
                <thead>
                  <tr>
                    {Object.keys(rows[0]).map(k => (<th key={k}>{k}</th>))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => (
                    <tr key={idx}>
                      {Object.keys(rows[0]).map(k => (<td key={k}>{formatCell(k, (r as any)[k])}</td>))}
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

export default Rapports;
