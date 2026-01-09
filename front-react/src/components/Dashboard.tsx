import React, { useEffect, useState } from 'react';
import MetricCard from './common/MetricCard';
import ChartWidget from './common/ChartWidget';
import useHasPermission from '../contexts/useHasPermission';

// Permission keys for dashboard sections (view-only)
const PERM_ROOT = 'TABLEAU_DE_BORD_VOIR';
const PERM_SALES = 'DASHBOARD_SALES_VOIR';
const PERM_ORDERS = 'DASHBOARD_ORDERS_VOIR';
const PERM_INVENTORY = 'DASHBOARD_INVENTORY_VOIR';
const PERM_REPORTS = 'DASHBOARD_REPORTS_VOIR';

const Dashboard: React.FC = () => {
  const canView = useHasPermission(PERM_ROOT);
  const canSales = useHasPermission([PERM_SALES, PERM_ROOT]);
  const canOrders = useHasPermission([PERM_ORDERS, PERM_ROOT]);
  const canInventory = useHasPermission([PERM_INVENTORY, PERM_ROOT]);
  const canReports = useHasPermission([PERM_REPORTS, PERM_ROOT]);

  const [loading, setLoading] = useState(false);
  const [overview, setOverview] = useState<any>(null);

  useEffect(() => {
    if (!canView) return;
    // Placeholder for first-step implementation: use static/mock data for the global overview.
    setLoading(true);
    setOverview({
      salesTotal: 0,
      sales7d: [0,0,0,0,0,0,0],
      pendingOrders: 0,
      lowStockCount: 0,
    });
    setLoading(false);
  }, [canView]);

  if (!canView) {
    return (
      <div className="alert alert-warning" role="alert">
        Accès au tableau de bord restreint — permission manquante ({PERM_ROOT}).
      </div>
    );
  }

  return (
    <div>
      <h4>Tableau de bord</h4>

      <div className="row">
        {canSales && (
          <MetricCard title="Ventes" subtitle="Total des ventes" value={loading ? '...' : (overview?.salesTotal ?? 0)} icon="ti ti-cash" bg="bg-primary" />
        )}

        {canOrders && (
          <MetricCard title="Commandes" subtitle="En attente" value={loading ? '...' : (overview?.pendingOrders ?? 0)} icon="ti ti-package-check" bg="bg-warning" />
        )}

        {canInventory && (
          <MetricCard title="Stock critique" subtitle="Articles en rupture" value={loading ? '...' : (overview?.lowStockCount ?? 0)} icon="ti ti-alert-circle" bg="bg-danger" />
        )}

        {canReports && (
          <MetricCard title="Rapports" subtitle="Accès" value="—" icon="ti ti-file-text" bg="bg-info" />
        )}
      </div>

      <div className="row mt-3">
        <div className="col-lg-8">
          {canSales ? (
            <ChartWidget
              labels={overview?.sales7d ? overview.sales7d.map((_: any, i: number) => `J-${6-i}`) : ['J-6','J-5','J-4','J-3','J-2','J-1','Aujourd\'hui']}
              data={overview?.sales7d ?? [0,0,0,0,0,0,0]}
              title="CA (7 jours)"
            />
          ) : (
            <div className="card"><div className="card-body text-muted">Section Ventes: accès restreint</div></div>
          )}
        </div>
        <div className="col-lg-4">
          <div className="card">
            <div className="card-body">
              <h5>Notes</h5>
              <div className="text-muted">Chaque partie du tableau de bord est contrôlée par une permission de type <code>DASHBOARD_*</code> (voir conventions).</div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default Dashboard;
