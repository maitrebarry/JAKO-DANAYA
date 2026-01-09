import { useEffect, useState } from 'react';
import MetricCard from './common/MetricCard';
import RoleBased from './common/RoleBased';
import OwnerOverview from './dashboard/OwnerOverview';
import ManagerOverview from './dashboard/ManagerOverview';
import CashierOverview from './dashboard/CashierOverview';
import WarehouseOverview from './dashboard/WarehouseOverview';
import { useUser } from '../contexts/UserContext';
import { fetchOverview, OverviewPayload, fetchDashboard, DashboardPayload } from '../api/dashboard';

const Dashboard = () => {
  const { roles = [], currentBoutique, permissions = [], user } = useUser();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<OverviewPayload>({});
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);

  const normalizedRoles = (roles || []).map(r => (r||'').toString().toUpperCase());
  const isOwner = ((user && (user.typeUtilisateur || '').toString().toUpperCase().includes('PROPRI')) || normalizedRoles.includes('PROPRIETAIRE') || normalizedRoles.includes('OWNER') || normalizedRoles.includes('ROLE_PROPRIETAIRE'));

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const shopId = currentBoutique ? currentBoutique.id : undefined;
        // fetch both the generic overview and the role-filtered dashboard payload
        const [dashRes, overviewRes] = await Promise.allSettled([fetchDashboard(shopId), fetchOverview(shopId)]);

        if (dashRes.status === 'fulfilled') {
          setDashboard(dashRes.value);
        }

        if (overviewRes.status === 'fulfilled') {
          setData(overviewRes.value);
        }

        // if dashboard widgets are present, use them to override the generic fields
        const widgets = (dashRes.status === 'fulfilled' && dashRes.value && dashRes.value.widgets) ? dashRes.value.widgets : {};

        setData(prev => ({
          salesTotal: widgets.chiffre_affaires_total ?? widgets.volumes ?? widgets.salesTotal ?? prev.salesTotal,
          productsCount: prev.productsCount ?? 0,
          clientsCount: prev.clientsCount ?? 0,
          suppliersCount: prev.suppliersCount ?? 0,
          salesToday: widgets.ventes_jour ?? widgets.salesToday ?? prev.salesToday,
          pendingOrders: widgets.pendingOrders ?? prev.pendingOrders,
          lowStockCount: widgets.produits_en_rupture ?? widgets.produits_sous_seuil ?? prev.lowStockCount,
        }));
      } catch (e: any) {
        setError(e.message || 'Erreur de chargement');
      } finally {
        setLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBoutique, roles.join(',')]);

  return (
    <div>
      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      {/* Owner overview - visible only to PROPRIETAIRE */}
      {isOwner && (
        <OwnerOverview />
      )}

      {/* Manager overview */}
      <RoleBased allowedRoles={["PROPRIETAIRE", "ROLE_PROPRIETAIRE", "GERANT_BOUTIQUE", "ROLE_GERANT_BOUTIQUE", "MANAGER", "ROLE_MANAGER"]}>
        <ManagerOverview />
      </RoleBased>

      {/* Cashier overview */}
      <RoleBased allowedRoles={["PROPRIETAIRE", "ROLE_PROPRIETAIRE", "CAISSIER", "ROLE_CAISSIER", "CASHIER", "ROLE_CASHIER"]}>
        <CashierOverview />
      </RoleBased>

      {/* Warehouse overview */}
      <RoleBased allowedRoles={["PROPRIETAIRE", "ROLE_PROPRIETAIRE", "MAGASINIER", "ROLE_MAGASINIER", "STOREKEEPER", "ROLE_STOREKEEPER"]}>
        <WarehouseOverview />
      </RoleBased>

      {/* Default generic overview for other roles OR users with explicit dashboard permission */}
      {(permissions.includes('TABLEAU_DE_BORD_VOIR') || permissions.includes('TABLEAU_DE_BORD_LECTURE') || roles.some(r=>['ADMIN','ADMINISTRATEUR'].includes(r))) && (
        <>
        <div className="row">
          <MetricCard
            title="Ventes"
            subtitle="Total des ventes"
            value={loading ? '...' : data.salesTotal ?? 0}
            icon="ti ti-cash"
            bg="bg-primary"
          />

          <MetricCard
            title="Produits"
            subtitle="Nombre de produits"
            value={loading ? '...' : data.productsCount ?? 0}
            icon="ti ti-package"
            bg="bg-success"
          />

          <MetricCard
            title="Clients"
            subtitle="Nombre de clients"
            value={loading ? '...' : data.clientsCount ?? 0}
            icon="ti ti-users"
            bg="bg-info"
          />

          <MetricCard
            title="Fournisseurs"
            subtitle="Nombre de fournisseurs"
            value={loading ? '...' : data.suppliersCount ?? 0}
            icon="ti ti-truck"
            bg="bg-warning"
          />
        </div>

        {/* Second row with operational metrics (role-based) */}
        <div className="row mt-3">
          {/* Sales today visible to owners, managers, superadmins */}
          <RoleBased allowedRoles={["ROLE_OWNER","ROLE_MANAGER","ADMIN","ADMINISTRATEUR"]}>
            <MetricCard
              title="Ventes aujourd'hui"
              subtitle="Montant des ventes"
              value={loading ? '...' : data.salesToday ?? 0}
              icon="ti ti-calendar-event"
              bg="bg-secondary"
            />
          </RoleBased>

          {/* Pending orders visible to owners/managers */}
          <RoleBased allowedRoles={["ROLE_OWNER","ROLE_MANAGER","ADMIN","ADMINISTRATEUR"]}>
            <MetricCard
              title="Commandes en attente"
              subtitle="À traiter"
              value={loading ? '...' : data.pendingOrders ?? 0}
              icon="ti ti-package-check"
              bg="bg-danger"
            />
          </RoleBased>

          {/* Low stock visible to magasinier/manager/owner */}
          <RoleBased allowedRoles={["ROLE_OWNER","ROLE_MANAGER","ROLE_MAGASINIER","ADMIN","ADMINISTRATEUR"]}>
            <MetricCard
              title="Stock critique"
              subtitle="Articles en rupture"
              value={loading ? '...' : data.lowStockCount ?? 0}
              icon="ti ti-alert-circle"
              bg="bg-dark"
            />
          </RoleBased>

          <div className="col-xl-3 col-lg-6">
            {/* reserved for future widget */}
          </div>
        </div>
        </>
      )}

      {/* Backend-provided widgets (raw) for diagnostics / incremental integration */}
      {dashboard && dashboard.widgets && (
        <div className="card mt-3">
          <div className="card-body">
            <h5 className="card-title">Widgets (serveur)</h5>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{JSON.stringify(dashboard.widgets, null, 2)}</pre>
          </div>
        </div>
      )}

      {/* Debug panel: show client roles and backend-detected role (temporary) */}
      <div className="card mt-3">
        <div className="card-body">
          <h5 className="card-title">Diagnostics</h5>
          <div><strong>user.typeUtilisateur:</strong> {user?.typeUtilisateur ?? '—'}</div>
          <div><strong>client roles:</strong> {roles && roles.length ? roles.join(', ') : '—'}</div>
          <div><strong>permissions:</strong> {permissions && permissions.length ? permissions.join(', ') : '—'}</div>
          <div><strong>backend role:</strong> {dashboard?.role ?? '—'}</div>
        </div>
      </div>

      {/* Server-driven role render: if backend reports a role, prefer it to decide showing owner/manager/cashier/warehouse panels */}
      {dashboard && dashboard.role && (
        <>
          {dashboard.role === 'PROPRIETAIRE' && (
            <div className="mt-3">
              <OwnerOverview allowServerOverride={true} />
            </div>
          )}
          {dashboard.role === 'GERANT' && (
            <div className="mt-3">
              <ManagerOverview />
            </div>
          )}
          {dashboard.role === 'CAISSIER' && (
            <div className="mt-3">
              <CashierOverview />
            </div>
          )}
          {dashboard.role === 'MAGASINIER' && (
            <div className="mt-3">
              <WarehouseOverview />
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Dashboard;