import React, { useState } from 'react';
import useHasPermission from '../contexts/useHasPermission';
import { useUser } from '../contexts/UserContext';

const Rapports: React.FC = () => {
  const canView = useHasPermission('RAPPORT_LECTURE');
  const { currentBoutique } = useUser();
  const [reportType, setReportType] = useState<'ventes'|'stock'|'valeur-stock'|'top-produits'>('ventes');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [boutique, setBoutique] = useState<string>(currentBoutique ? String(currentBoutique.id) : '');
  const [limit, setLimit] = useState<number>(10);
  const [rows, setRows] = useState<any[]>([]);
  const [aggregates, setAggregates] = useState<any>({ totalCount: 0, totalAmount: 0, valeur: 0 });
  const [loading, setLoading] = useState(false);

  if (!canView) return <div className="alert alert-warning">Accès non autorisé</div>;

  // Génération mock pour test progressif
  const generate = () => {
    setLoading(true);
    setTimeout(() => {
      if (reportType === 'ventes') {
        const sample = [
          { date: '2026-01-01', ventes: 12, montant: 125000 },
          { date: '2026-01-02', ventes: 8, montant: 76000 }
        ];
        setRows(sample);
        setAggregates({ totalCount: sample.length, totalAmount: sample.reduce((s, r) => s + r.montant, 0) });
      } else if (reportType === 'stock') {
        const sample = [
          { produit: 'Produit A', qte: 120, boutique: boutique || 'Toutes' },
          { produit: 'Produit B', qte: 45, boutique: boutique || 'Toutes' }
        ];
        setRows(sample);
        setAggregates({ totalCount: sample.length });
      } else if (reportType === 'valeur-stock') {
        setRows([]);
        setAggregates({ valeur: 1525000 });
      } else {
        const sample = [
          { produit: 'Produit A', ventes: 120, montant: 250000 },
          { produit: 'Produit B', ventes: 90, montant: 180000 }
        ];
        setRows(sample);
        setAggregates({ totalCount: sample.length });
      }
      setLoading(false);
    }, 300);
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
              <input className="form-control" type="text" value={boutique} onChange={e => setBoutique(e.target.value)} placeholder="ID boutique" />
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
              <button className="btn btn-primary me-2" onClick={generate} disabled={loading}>{loading ? 'Génération...' : 'Générer (mock)'}</button>
            </div>
          </div>

          <div className="mb-3">
            <div className="fw-semibold">Résumé</div>
            <div>Éléments: {aggregates.totalCount ?? 0}</div>
            {typeof aggregates.totalAmount === 'number' && <div>Total Montant: {aggregates.totalAmount.toFixed(2)} FCFA</div>}
            {aggregates.valeur && <div>Valeur stock: {aggregates.valeur} FCFA</div>}
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
                      {Object.keys(rows[0]).map(k => (<td key={k}>{String((r as any)[k] ?? '')}</td>))}
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
