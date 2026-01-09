import React, { useEffect, useState } from 'react';
import MetricCard from '../common/MetricCard';
import { fetchCriticalStocks, fetchReceptions, StockItem, Reception } from '../../api/inventory';

const WarehouseOverview: React.FC = () => {
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [receptions, setReceptions] = useState<Reception[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [s, r] = await Promise.all([fetchCriticalStocks(), fetchReceptions()]);
        setStocks(s);
        setReceptions(r);
      } catch (e) {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4>Tableau de bord - Magasinier</h4>
      </div>

      <div className="row">
        <MetricCard title="Articles en rupture" subtitle="Criticité" value={loading ? '...' : stocks.length} icon="ti ti-alert-circle" bg="bg-danger" />
        <MetricCard title="Réceptions attendues" subtitle="À valider" value={loading ? '...' : receptions.length} icon="ti ti-truck" bg="bg-primary" />
        <div className="col-xl-3 col-lg-6">{/* reserved */}</div>
        <div className="col-xl-3 col-lg-6">{/* reserved */}</div>
      </div>

      <div className="row mt-3">
        <div className="col-lg-8">
          <div className="card">
            <div className="card-body">
              <h5>Articles critiques</h5>
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Produit</th>
                    <th>Quantité</th>
                    <th>Magasin</th>
                  </tr>
                </thead>
                <tbody>
                  {stocks.map(s => (
                    <tr key={s.id}>
                      <td>{s.produitName}</td>
                      <td>{s.quantiteDisponible}</td>
                      <td>{s.magasin}</td>
                    </tr>
                  ))}
                  {stocks.length === 0 && <tr><td colSpan={3} className="text-center">Aucun article critique</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="col-lg-4">
          <div className="card">
            <div className="card-body">
              <h5>Réceptions à valider</h5>
              <ul className="list-group list-group-flush">
                {receptions.map(r => (
                  <li key={r.id} className="list-group-item d-flex justify-content-between align-items-center">
                    <div>
                      <strong>{r.reference}</strong>
                      <div className="text-muted" style={{ fontSize: '0.9rem' }}>Prévue: {new Date(r.expectedAt || '').toLocaleString()}</div>
                    </div>
                    <span className={`badge ${r.status === 'ATTENTE' ? 'bg-warning' : 'bg-secondary'}`}>{r.status}</span>
                  </li>
                ))}
                {receptions.length === 0 && <li className="list-group-item">Aucune réception</li>}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WarehouseOverview;
