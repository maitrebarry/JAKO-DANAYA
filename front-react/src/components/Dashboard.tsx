import React, { useEffect, useState } from 'react';
import MetricCard from './common/MetricCard';
import RoleBased from './common/RoleBased';
import SuperadminOverview from './dashboard/SuperadminOverview';
import OwnerOverview from './dashboard/OwnerOverview';
import ManagerOverview from './dashboard/ManagerOverview';
import CashierOverview from './dashboard/CashierOverview';
import WarehouseOverview from './dashboard/WarehouseOverview';
import { useUser } from '../contexts/UserContext';
import { fetchOverview, OverviewPayload } from '../api/dashboard';

const Dashboard = () => {
  const { roles = [], currentBoutique } = useUser();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<OverviewPayload>({});

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const shopId = currentBoutique ? currentBoutique.id : undefined;
        const res = await fetchOverview(shopId);
        setData(res);
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

      {/* Superadmin full overview */}
      <RoleBased allowedRoles={["ROLE_SUPERADMIN"]}>
        <SuperadminOverview />
      </RoleBased>

      {/* Owner overview */}
      <RoleBased allowedRoles={["ROLE_OWNER"]}>
        <OwnerOverview />
      </RoleBased>

      {/* Manager overview */}
      <RoleBased allowedRoles={["ROLE_MANAGER"]}>
        <ManagerOverview />
      </RoleBased>

      {/* Cashier overview */}
      <RoleBased allowedRoles={["ROLE_CASHIER"]}>
        <CashierOverview />
      </RoleBased>

      {/* Warehouse overview */}
      <RoleBased allowedRoles={["ROLE_MAGASINIER"]}>
        <WarehouseOverview />
      </RoleBased>

      {/* Default generic overview for other roles */}
      <RoleBased allowedRoles={["ROLE_USER"]}>
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
          <RoleBased allowedRoles={["ROLE_SUPERADMIN","ROLE_OWNER","ROLE_MANAGER"]}>
            <MetricCard
              title="Ventes aujourd'hui"
              subtitle="Montant des ventes"
              value={loading ? '...' : data.salesToday ?? 0}
              icon="ti ti-calendar-event"
              bg="bg-secondary"
            />
          </RoleBased>

          {/* Pending orders visible to owners/managers */}
          <RoleBased allowedRoles={["ROLE_SUPERADMIN","ROLE_OWNER","ROLE_MANAGER"]}>
            <MetricCard
              title="Commandes en attente"
              subtitle="À traiter"
              value={loading ? '...' : data.pendingOrders ?? 0}
              icon="ti ti-package-check"
              bg="bg-danger"
            />
          </RoleBased>

          {/* Low stock visible to magasinier/manager/owner */}
          <RoleBased allowedRoles={["ROLE_SUPERADMIN","ROLE_OWNER","ROLE_MANAGER","ROLE_MAGASINIER"]}>
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
      </RoleBased>
    </div>
  );
};

export default Dashboard;