import React, { useEffect, useState } from 'react';
import { useUser } from '../../contexts/UserContext';
import MetricCard from '../common/MetricCard';
import ChartWidget from '../common/ChartWidget';
import { fetchShopOverview, ShopOverview } from '../../api/owner';
import { fetchOverview } from '../../api/dashboard';

type OwnerOverviewProps = { allowServerOverride?: boolean };

const OwnerOverview: React.FC<OwnerOverviewProps> = ({ allowServerOverride = false }) => {
  const { currentBoutique, user, roles = [] } = useUser();
  const [shops, setShops] = useState<{ id: number; name: string }[]>([]);
  const [selectedShop, setSelectedShop] = useState<number | undefined>(currentBoutique?.id);

  // Defensive: only allow proprietaire or superadmin to view owner dashboard
  const normalizedRoles = roles.map(r => (r||'').toString().toUpperCase());
  const isOwner = (user && ((user.typeUtilisateur || '').toString().toUpperCase() === 'PROPRIETAIRE')) || normalizedRoles.includes('PROPRIETAIRE') || normalizedRoles.includes('OWNER') || normalizedRoles.includes('ROLE_PROPRIETAIRE');
  const isSuperAdmin = normalizedRoles.includes('SUPERADMIN') || normalizedRoles.includes('ROLE_SUPERADMIN');
  if (!isOwner && !isSuperAdmin && !allowServerOverride) {
    return (
      <div className="alert alert-warning" role="alert">
        Accès réservé au propriétaire de la boutique.
      </div>
    );
  }

  const [shopOverview, setShopOverview] = useState<ShopOverview | null>(null);
  // overview is intentionally not kept at component-level; shop-level overview is fetched via shopOverview
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If user is owner, allow a global view (Toutes mes boutiques) selectable as id=0
    if (isOwner) {
      const list: { id: number; name: string }[] = [];
      if (currentBoutique) list.push({ id: currentBoutique.id, name: currentBoutique.nom });
      list.unshift({ id: 0, name: "Toutes mes boutiques" });
      setShops(list);
      if (selectedShop === undefined) setSelectedShop(0);
    } else if (currentBoutique) {
      setShops([{ id: currentBoutique.id, name: currentBoutique.nom }]);
      setSelectedShop(currentBoutique.id);
    } else {
      setShops([]);
    }
  }, [currentBoutique, isOwner]);


  useEffect(() => {
    if (selectedShop === undefined) return;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        let sv: ShopOverview;
        if (selectedShop === 0) {
          // global/aggregated overview for the owner
          const ov = await fetchOverview();
          sv = {
            salesTotal: ov.salesTotal,
            sales7d: (ov as any).sales7d ?? undefined,
            pendingOrders: ov.pendingOrders,
            topProducts: (ov as any).topProducts ?? [],
          } as ShopOverview;
        } else {
          sv = await fetchShopOverview(selectedShop);
        }
        setShopOverview(sv);
      } catch (e: any) {
        setError(e?.message || 'Erreur lors du chargement du tableau de bord');
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedShop]);

  if (error) {
    return (
      <div className="alert alert-danger" role="alert">
        {error}
      </div>
    );
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4>Tableau de bord - Propriétaire</h4>
        <div>
          <select className="form-select" style={{ minWidth: 220 }} value={selectedShop} onChange={(e) => setSelectedShop(Number(e.target.value))}>
            {shops.length ? shops.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            )) : <option value="">Aucune boutique</option>}
          </select>
        </div>
      </div>

      <div className="row">
        <MetricCard title="CA total" subtitle="Chiffre d'affaires" value={loading ? '...' : shopOverview?.salesTotal ?? 0} icon="ti ti-stats-up" bg="bg-primary" />
        <MetricCard title="Commandes en attente" subtitle="À traiter" value={loading ? '...' : shopOverview?.pendingOrders ?? 0} icon="ti ti-package" bg="bg-warning" />
        <MetricCard title="Boutiques" subtitle="Vos boutiques" value={shops.length} icon="ti ti-building" bg="bg-info" />
        <MetricCard title="Top produit" subtitle="Le plus vendu" value={loading ? '...' : (shopOverview?.topProducts?.[0]?.name ?? '—')} icon="ti ti-crown" bg="bg-success" />
      </div>

      <div className="row mt-3">
        <div className="col-lg-8">
          <ChartWidget labels={shopOverview?.sales7d ? shopOverview.sales7d.map((_,i)=>`J-${6-i}`) : ['J-6','J-5','J-4','J-3','J-2','J-1','Aujourd\'hui']} data={shopOverview?.sales7d ?? [0,0,0,0,0,0,0]} title="CA (7 jours)" />
        </div>
        <div className="col-lg-4">
          <div className="card">
            <div className="card-body">
              <h5>Top produits</h5>
              <ul className="list-group list-group-flush mt-2">
                {shopOverview?.topProducts?.map(p => (
                  <li key={p.id} className="list-group-item d-flex justify-content-between align-items-center">
                    <div>{p.name}</div>
                    <span className="badge bg-primary rounded-pill">{p.sold}</span>
                  </li>
                ))}
                {(!shopOverview?.topProducts || shopOverview.topProducts.length===0) && <li className="list-group-item">Aucun produit</li>}
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
              <div className="text-muted">(Fonctionnalité à implémenter : liste paginée via {'/api/dashboard/shops/{id}/orders'})</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OwnerOverview;