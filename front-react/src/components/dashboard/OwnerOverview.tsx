import React, { useEffect, useState } from 'react';
import { useUser } from '../../contexts/UserContext';
import MetricCard from '../common/MetricCard';
import ChartWidget from '../common/ChartWidget';
import { fetchShopOverview, ShopOverview } from '../../api/owner';
import { fetchAdminShops, ShopDTO } from '../../api/admin';

const OwnerOverview: React.FC = () => {
  const { currentBoutique } = useUser();
  const [shops, setShops] = useState<ShopDTO[]>([]);
  const [selectedShop, setSelectedShop] = useState<number | undefined>(currentBoutique?.id);
  const [overview, setOverview] = useState<ShopOverview | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const sh = await fetchAdminShops();
        setShops(sh);
        // if no selected shop, pick first or current
        if (!selectedShop) setSelectedShop(currentBoutique?.id ?? (sh[0] && sh[0].id));
      } catch (e) {
        // ignore
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedShop) return;
    setLoading(true);
    (async () => {
      try {
        const ov = await fetchShopOverview(selectedShop);
        setOverview(ov);
      } catch (e) {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedShop]);

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4>Tableau de bord - Propriétaire</h4>
        <div>
          <select className="form-select" style={{ minWidth: 220 }} value={selectedShop} onChange={(e) => setSelectedShop(Number(e.target.value))}>
            {shops.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="row">
        <MetricCard title="CA total" subtitle="Chiffre d'affaires" value={loading ? '...' : overview?.salesTotal ?? 0} icon="ti ti-stats-up" bg="bg-primary" />
        <MetricCard title="Commandes en attente" subtitle="À traiter" value={loading ? '...' : overview?.pendingOrders ?? 0} icon="ti ti-package" bg="bg-warning" />
        <MetricCard title="Boutiques" subtitle="Vos boutiques" value={shops.length} icon="ti ti-building" bg="bg-info" />
        <MetricCard title="Top produit" subtitle="Le plus vendu" value={loading ? '...' : (overview?.topProducts?.[0]?.name ?? '—')} icon="ti ti-crown" bg="bg-success" />
      </div>

      <div className="row mt-3">
        <div className="col-lg-8">
          <ChartWidget labels={overview?.sales7d ? overview.sales7d.map((_,i)=>`J-${6-i}`) : ['J-6','J-5','J-4','J-3','J-2','J-1','Aujourd\'hui']} data={overview?.sales7d ?? [0,0,0,0,0,0,0]} title="CA (7 jours)" />
        </div>
        <div className="col-lg-4">
          <div className="card">
            <div className="card-body">
              <h5>Top produits</h5>
              <ul className="list-group list-group-flush mt-2">
                {overview?.topProducts?.map(p => (
                  <li key={p.id} className="list-group-item d-flex justify-content-between align-items-center">
                    <div>{p.name}</div>
                    <span className="badge bg-primary rounded-pill">{p.sold}</span>
                  </li>
                ))}
                {(!overview?.topProducts || overview.topProducts.length===0) && <li className="list-group-item">Aucun produit</li>}
              </ul>
              <div className="mt-3 d-grid">
                <button className="btn btn-outline-primary">Exporter rapport</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row mt-3">
        <div className="col-12">
          <div className="card">
            <div className="card-body">
              <h5>Commandes récentes</h5>
              <div className="text-muted">(Fonctionnalité à implémenter : liste paginée via `/api/dashboard/shops/{id}/orders`)</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OwnerOverview;