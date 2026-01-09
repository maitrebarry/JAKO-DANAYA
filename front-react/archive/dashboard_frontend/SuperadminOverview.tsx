import { useEffect, useState } from 'react';
import MetricCard from '../common/MetricCard';
import ChartWidget from '../common/ChartWidget';
import AlertBanner from '../common/AlertBanner';
import { fetchOverview, OverviewPayload } from '../../api/dashboard';
import { fetchAdminAlerts, fetchAdminShops, ShopDTO, AlertDTO } from '../../api/admin';

const SuperadminOverview = () => {
  const [data, setData] = useState<OverviewPayload>({});
  const [shops, setShops] = useState<ShopDTO[]>([]);
  const [alerts, setAlerts] = useState<AlertDTO[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [ov, sh, al] = await Promise.all([fetchOverview(undefined), fetchAdminShops(), fetchAdminAlerts()]);
        setData(ov);
        setShops(sh);
        setAlerts(al);
      } catch (e) {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Mock time series for the chart (if none provided)
  const labels = Array.from({ length: 7 }).map((_, i) => `J-${6 - i}`);
  const chartData = [1000, 1200, 900, 1400, 1100, 1600, data.salesToday ?? 0];

  return (
    <div>
      <AlertBanner alerts={alerts} />

      <div className="row">
        <MetricCard title="CA total" subtitle="Chiffre d'affaires total" value={loading ? '...' : data.salesTotal ?? 0} icon="ti ti-stats-up" bg="bg-primary" />
        <MetricCard title="Commandes totales" subtitle="Nombre de commandes" value={loading ? '...' : data.pendingOrders ?? 0} icon="ti ti-package" bg="bg-success" />
        <MetricCard title="Boutiques actives" subtitle="Nombre de boutiques" value={loading ? '...' : shops.length} icon="ti ti-building" bg="bg-info" />
        <MetricCard title="Erreurs système" subtitle="Logs récents" value={loading ? '...' : alerts.filter(a => a.level === 'CRITICAL').length} icon="ti ti-alert-triangle" bg="bg-danger" />
      </div>

      <div className="row mt-3">
        <div className="col-lg-8">
          <ChartWidget labels={labels} data={chartData} title="CA (7 jours)" />
        </div>
        <div className="col-lg-4">
          <div className="card">
            <div className="card-body">
              <h5>Gestion des boutiques</h5>
              <ul className="list-group list-group-flush mt-2">
                {shops.length === 0 ? (
                  <li className="list-group-item">Aucune boutique trouvée</li>
                ) : (
                  shops.map(s => (
                    <li className="list-group-item d-flex justify-content-between align-items-center" key={s.id}>
                      <div>
                        <strong>{s.name}</strong>
                        <div className="text-muted" style={{ fontSize: '0.8rem' }}>{s.statut}</div>
                      </div>
                      <div>
                        <button className="btn btn-sm btn-outline-primary me-1">Ouvrir</button>
                        <button className="btn btn-sm btn-outline-danger">Désactiver</button>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="row mt-3">
        <div className="col-12">
          <div className="card">
            <div className="card-body">
              <h5>Logs récents / Activité</h5>
              <div className="text-muted">Voir les logs via l'API admin (endpoint: /api/admin/logs)</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuperadminOverview;