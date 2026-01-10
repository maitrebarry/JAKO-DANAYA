import React, { useEffect, useState } from 'react';
import MetricCard from './common/MetricCard';
import ChartWidget from './common/ChartWidget';
import { getDashboard, DashboardPayload, SectionDTO, WidgetDTO } from '../api/dashboardClient';

const formatNumber = (n?: number) => n == null ? '—' : new Intl.NumberFormat('fr-FR').format(n);
const formatCurrency = (n?: number) => n == null ? '—' : new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' }).format(n);

const StatusBadge = ({ label, ok }: { label: string; ok: boolean }) => (
  <span className={`badge ${ok ? 'bg-success' : 'bg-danger'} me-2`}>{label}: {ok ? 'OK' : 'KO'}</span>
);

const RoleBasedDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedShopId, setSelectedShopId] = useState<number | undefined>(undefined);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [dateFrom, setDateFrom] = useState<string | null>(null);
  const [dateTo, setDateTo] = useState<string | null>(null);
  const [search, setSearch] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [modalContent, setModalContent] = useState<any>(null);

  const load = async (shopId?: number) => {
    setLoading(true);
    setError(null);
    try {
      const p = await getDashboard(shopId);
      setPayload(p);
      setLastRefresh(new Date());
    } catch (e: any) {
      setError(e?.message || 'Erreur lors du chargement du dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(selectedShopId); }, [selectedShopId]);

  const handleShopChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value;
    setSelectedShopId(v ? Number(v) : undefined);
  };

  const exportJson = () => {
    if (!payload) return;
    const dataStr = JSON.stringify(payload, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dashboard-${payload.role || 'unknown'}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderSimpleMetric = (key: string, val: any) => {
    const title = key.replace(/_/g, ' ');
    const isCurrency = /chiffre|valeur|sales|salesTotal/i.test(key);
    return (
      <MetricCard key={key} title={title} subtitle={key} value={isCurrency ? formatCurrency(val) : formatNumber(val)} icon="ti ti-chart-bar" bg="bg-primary" />
    );
  };

  const renderStatus = (val: any) => {
    if (!val || typeof val !== 'object') return <div className="text-muted">Aucun état</div>;
    const entries = Object.entries(val);
    return (
      <div>
        {entries.map(([k,v]) => <StatusBadge key={k} label={k} ok={String(v).toLowerCase() === 'ok' || v === 'OK' || v === true} />)}
      </div>
    );
  };

  const renderTopProducts = (val: any, key: string) => {
    if (!val || !Array.isArray(val) || val.length === 0) return (
      <div className="card p-3 text-center text-muted">
        <div>Aucun produit dans le Top.</div>
        <button className="btn btn-sm btn-outline-secondary mt-2" onClick={() => load(selectedShopId)}>Rafraîchir</button>
      </div>
    );
    const rows = val.slice(0, 10);
    return (
      <div className="card mb-3">
        <div className="card-body">
          <h6 className="mb-2">{key.replace(/_/g,' ')}</h6>
          <div className="table-responsive">
            <table className="table table-sm table-hover">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Produit</th>
                  <th>Quantité</th>
                  <th>Montant</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r: any, i: number) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td>{r.nom ?? r.name ?? r.product ?? ''}</td>
                    <td>{r.qty ?? r.quantity ?? r.qte ?? ''}</td>
                    <td>{formatCurrency(r.montant ?? r.total ?? r.price ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const generateDateLabels = (n: number) => {
    const labels: string[] = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      labels.push(`${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}`);
    }
    return labels;
  };

  const renderRevenueWidget = (val: any, key: string, fallbackSeries?: number[]) => {
    // val may be number (total), or object (by shop/date), or fallback series provided
    let series: number[] | undefined;
    let labels: string[] | undefined;

    if (Array.isArray(val)) {
      series = val.map((v:any) => Number(v ?? 0));
      labels = generateDateLabels(series.length);
    } else if (typeof val === 'object') {
      labels = Object.keys(val);
      series = labels.map(l => Number(val[l] ?? 0));
    } else if (typeof val === 'number' && fallbackSeries && Array.isArray(fallbackSeries)) {
      series = fallbackSeries.map(v => Number(v ?? 0));
      labels = generateDateLabels(series.length);
    }

    const total = typeof val === 'number' ? val : (series ? series.reduce((s, x) => s + x, 0) : 0);

    return (
      <div className="card mb-3">
        <div className="card-body">
          <div className="d-flex align-items-center justify-content-between mb-3">
            <div>
              <h6 className="mb-1">{key.replace(/_/g,' ')}</h6>
              <div className="text-muted small">Total: <strong>{formatCurrency(total)}</strong></div>
            </div>
            <div>
              <span className="badge bg-primary">Chiffres</span>
            </div>
          </div>

          {series && series.length ? (
                <div style={{ height: 260 }}>
              <ChartWidget
                type="line"
                labels={labels || generateDateLabels(series.length)}
                data={series}
                title={key.replace(/_/g,' ')}
                height={260}
                legend={false}
                yFormat="currency"
              />
            </div>
          ) : (
            <div className="text-muted">Aucune série temporelle disponible</div>
          )}
        </div>
      </div>
    );
  };

  const renderSalesChart = (val: any, key: string) => {
    // Prefer revenue renderer for numeric arrays or objects
    if (!val) return <div className="text-muted">Pas de données pour {key.replace(/_/g,' ')}</div>;
    if (Array.isArray(val) || typeof val === 'object') {
      return renderRevenueWidget(val, key);
    }
    return <div>{String(val)}</div>;
  };

  const renderPendingOrders = (val: any) => {
    const cnt = Number(val) || 0;
    return (
      <div className={`alert ${cnt > 0 ? 'alert-warning' : 'alert-secondary'}`} role="alert">
        Commandes en attente: <strong>{cnt}</strong>
        {cnt > 0 && <a className="btn btn-sm btn-link ms-2" href="/liste-commandes">Voir</a>}
      </div>
    );
  };

  const renderWidget = (w: WidgetDTO) => {
    const val = w?.data?.value;
    const rawKey = w.key || 'widget';
    const key = rawKey.toLowerCase();

    if (val === null || val === undefined) {
      return (
        <div className="card p-3 text-center text-muted">
          <div>Aucune donnée disponible</div>
          <button className="btn btn-sm btn-link" onClick={() => load(selectedShopId)}>Rafraîchir</button>
        </div>
      );
    }

    // Specific renderers for known keys
    if (key.includes('top_products') || key.includes('top-produits') || key === 'top_products') {
      return renderTopProducts(val, rawKey);
    }

    if (key.includes('evolution') || key.includes('sales7d') || key.includes('evolution_ventes')) {
      return renderSalesChart(val, rawKey);
    }

    if (key.includes('pending') || key.includes('pendingorders') || key.includes('pending_orders')) {
      return renderPendingOrders(val);
    }

    if (key.includes('chiffre') || (key.includes('sales') && typeof val === 'number') || rawKey === 'chiffre_affaires_total') {
      return renderSimpleMetric(rawKey, val);
    }

    if (key.includes('etat_caisse')) {
      return (
        <div className="card p-3">
          <h6 className="mb-2">{rawKey.replace(/_/g, ' ')}</h6>
          {renderStatus(val)}
        </div>
      );
    }

    // Fallbacks: numbers, arrays, objects
    // Numeric or boolean or short string metrics
    if (typeof val === 'number' || typeof val === 'boolean' || (typeof val === 'string' && val.length < 40)) {
      return renderSimpleMetric(rawKey, val);
    }

    // status-like object
    if (typeof val === 'object' && !Array.isArray(val) && Object.keys(val).every(k => typeof val[k] === 'string' || typeof val[k] === 'boolean')) {
      return (
        <div className="card p-3">
          <h6 className="mb-2">{rawKey.replace(/_/g, ' ')}</h6>
          {renderStatus(val)}
        </div>
      );
    }

    // Array
    if (Array.isArray(val)) {
      const numeric = val.length > 0 && val.every((v: any) => typeof v === 'number');
      if (numeric) {
        const labels = val.map((_: any, i: number) => `${i + 1}`);
        return <div key={rawKey} className="card p-3"><ChartWidget type="bar" labels={labels} data={val} title={rawKey.replace(/_/g, ' ')} height={220} /></div>;
      }
      if (val.length > 0 && typeof val[0] === 'object') {
        const fields = Array.from(new Set(val.flatMap((r: any) => Object.keys(r))));
        return (
          <div key={rawKey} className="card mb-3">
            <div className="card-body">
              <h6>{rawKey.replace(/_/g, ' ')}</h6>
              <div className="table-responsive">
                <table className="table table-sm">
                  <thead><tr>{fields.map(f => <th key={f}>{f}</th>)}</tr></thead>
                  <tbody>
                    {val.map((row: any, idx: number) => (
                      <tr key={idx}>{fields.map(f => <td key={f}>{row[f] ?? ''}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      }
      // fallback
      return <pre key={rawKey}>{JSON.stringify(val, null, 2)}</pre>;
    }

    // object fallback
    return <pre key={rawKey}>{JSON.stringify(val, null, 2)}</pre>;
  };

  if (loading) return <div>Chargement du tableau de bord...</div>;
  if (error) return <div className="alert alert-danger">{error}</div>;
  if (!payload) return <div className="alert alert-info">Aucun contenu pour le tableau de bord.</div>;

  const shops = payload.sections && payload.sections.length ? payload.sections[0].shops || [] : [];

  // helper: pick widgets from the section that matches current role (fallback to first)
  const currentSection = payload.sections?.find(s => s.role === payload.role) || payload.sections?.[0];
  const widgetVal = (key: string) => currentSection?.widgets?.find(w => w.key === key)?.data?.value ?? null;

  return (
    <div>
      {/* Breadcrumb / header */}
      <div className="page-breadcrumb d-none d-sm-flex align-items-center mb-3">
        <div className="breadcrumb-title pe-3">Dashboards</div>
        <div className="ps-3">
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb mb-0 p-0">
              <li className="breadcrumb-item"><a href="#"><i className="bx bx-home-alt"></i></a></li>
              <li className="breadcrumb-item active" aria-current="page">SMBOUTIQUE</li>
            </ol>
          </nav>
        </div>
      </div>

      {/* Card : Indicateurs */}
      <div className="card mb-3">
        <div className="card-header bg-transparent">
          <div className="row g-3 align-items-center">
            <div className="col">
              <h5 className="mb-0">Indicateurs</h5>
            </div>
            <div className="col">
              {shops && shops.length > 0 && (
                <select className="form-select" value={selectedShopId || ''} onChange={handleShopChange}>
                  <option value="">Toutes les boutiques</option>
                  {shops.map(s => <option key={s.id} value={s.id}>{s.nom}</option>)}
                </select>
              )}
            </div>
            <div className="col d-flex">
              <input type="date" className="form-control form-control-sm me-2" value={dateFrom ?? ''} onChange={e => setDateFrom((e.target as HTMLInputElement).value)} style={{ maxWidth: 160 }} />
              <input type="date" className="form-control form-control-sm me-2" value={dateTo ?? ''} onChange={e => setDateTo((e.target as HTMLInputElement).value)} style={{ maxWidth: 160 }} />
            </div>
            <div className="col d-flex justify-content-end">
              <button className="btn btn-outline-secondary btn-sm me-2" onClick={() => load(selectedShopId)}>Appliquer</button>
              <button className="btn btn-outline-secondary btn-sm me-2" onClick={() => load(selectedShopId)}>Rafraîchir</button>
              <button className="btn btn-sm btn-primary" onClick={exportJson}>Exporter JSON</button>
            </div>
          </div>
        </div>
        <div className="card-body" id="indicateurs">
          <div className="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-4">
            {/* Chiffre d'affaires total */}
            <div className="col d-flex flex-column align-items-center">
              <div className="card radius-10 border-0 border-start border-primary border-4 w-100">
                <div className="card-body d-flex align-items-center justify-content-between">
                  <div>
                    <p className="mb-1">Chiffre d'affaires total</p>
                    <h4 className="mb-0 text-primary">{formatCurrency(Number(widgetVal('chiffre_affaires_total') ?? 0))}</h4>
                  </div>
                  <div className="widget-icon bg-primary text-white d-flex align-items-center justify-content-center" style={{ width: 60, height: 60, borderRadius: 10 }}>
                    <i className="bi bi-currency-dollar" style={{ fontSize: 24 }}></i>
                  </div>
                </div>
              </div>
              <div className="mt-3 w-100">
                {/* sales7d chart */}
                {widgetVal('sales7d') && Array.isArray(widgetVal('sales7d')) ? (
                  <ChartWidget type="line" labels={generateDateLabels((widgetVal('sales7d') as any[]).length)} data={(widgetVal('sales7d') as number[])} height={200} title="Ventes (7j)" />
                ) : <div className="text-muted small">Pas de données temporelles</div>}
              </div>
            </div>

            {/* Valeur stock */}
            <div className="col d-flex flex-column align-items-center">
              <div className="card radius-10 border-0 border-start border-success border-4 w-100">
                <div className="card-body d-flex align-items-center justify-content-between">
                  <div>
                    <p className="mb-1">Valeur du stock</p>
                    <h4 className="mb-0 text-success">{formatCurrency(Number(widgetVal('valeur_stock') ?? 0))}</h4>
                  </div>
                  <div className="widget-icon bg-success text-white d-flex align-items-center justify-content-center" style={{ width: 60, height: 60, borderRadius: 10 }}>
                    <i className="bi bi-box-seam" style={{ fontSize: 24 }}></i>
                  </div>
                </div>
              </div>
              <div className="mt-3 w-100">
                {widgetVal('top_products') && Array.isArray(widgetVal('top_products')) ? (
                  <div className="table-responsive">
                    <table className="table table-sm table-hover">
                      <thead><tr><th>#</th><th>Produit</th><th>Qty</th><th>Montant</th></tr></thead>
                      <tbody>
                        {(widgetVal('top_products') as any[]).slice(0,5).map((r:any,i:number)=> (
                          <tr key={i}><td>{i+1}</td><td>{r.nom ?? r.name}</td><td>{r.qty ?? r.quantity}</td><td>{formatCurrency(r.montant ?? r.total ?? 0)}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <div className="text-muted small">Aucun produit en tête</div>}
              </div>
            </div>

            {/* Pending orders / summary caisse */}
            <div className="col d-flex flex-column align-items-center">
              <div className="card radius-10 border-0 border-start border-warning border-4 w-100">
                <div className="card-body d-flex align-items-center justify-content-between">
                  <div>
                    <p className="mb-1">Commandes en attente</p>
                    <h4 className="mb-0 text-warning">{widgetVal('pendingOrders') ?? widgetVal('pending_orders') ?? 0}</h4>
                  </div>
                  <div className="widget-icon bg-warning text-white d-flex align-items-center justify-content-center" style={{ width: 60, height: 60, borderRadius: 10 }}>
                    <i className="bi bi-cart-dash" style={{ fontSize: 24 }}></i>
                  </div>
                </div>
              </div>
              <div className="mt-3 w-100">
                <div className="card radius-10 w-100">
                  <div className="card-body">
                    <h6 className="mb-2">État caisse</h6>
                    {widgetVal('summary_caisse') ? <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(widgetVal('summary_caisse'), null, 2)}</pre> : <div className="text-muted small">Aucune information</div>}
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {payload.sections && payload.sections.length === 0 && <div className="alert alert-info">Aucune section disponible.</div>}

      {payload.sections && payload.sections.map((section: SectionDTO, idx: number) => (
        <div key={idx} className="mt-4">
          <div className="d-flex align-items-center justify-content-between mb-2">
            <h5 className="mb-0">{section.role}</h5>
            <div className="text-muted">{section.widgets?.length ?? 0} widgets</div>
          </div>

          <div className="row">
            {section.widgets && section.widgets.length ? section.widgets.map(w => {
              // choose col size heuristically
              const val = w?.data?.value;
              let col = 'col-md-4';
              if (Array.isArray(val) && val.length && typeof val[0] === 'number') col = 'col-md-6';
              if (Array.isArray(val) && val.length && typeof val[0] === 'object') col = 'col-md-12';
              if (typeof val === 'object' && !Array.isArray(val)) col = 'col-md-12';
              return (
                <div className={`${col} mb-3`} key={w.key}>
                  {renderWidget(w)}
                </div>
              );
            }) : <div className="text-muted">Aucun widget</div>}
          </div>
        </div>
      ))}

      {showModal && (
        <div className="modal fade show" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="modal-dialog modal-lg modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Détails</h5>
                <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
              </div>
              <div className="modal-body">
                <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{JSON.stringify(modalContent, null, 2)}</pre>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Fermer</button>
              </div>
            </div>
          </div>
        </div>
      )} 
    </div>
  );
};

export default RoleBasedDashboard;
