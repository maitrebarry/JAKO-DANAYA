import React, { useEffect, useState } from 'react';
import { useUser } from '../../contexts/UserContext';
import MetricCard from '../common/MetricCard';
import { fetchShopSalesToday, fetchPendingOrders, fetchStaffActivity, PendingOrder, StaffActivity, markOrderPrepared } from '../../api/manager';

const ManagerOverview: React.FC = () => {
  const { currentBoutique } = useUser();
  const shopId = currentBoutique?.id;
  const [salesToday, setSalesToday] = useState<number | null>(null);
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [staff, setStaff] = useState<StaffActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!shopId) return;
      setLoading(true);
      setError(null);
      try {
        const [s, po, st] = await Promise.all([
          fetchShopSalesToday(shopId),
          fetchPendingOrders(shopId),
          fetchStaffActivity(shopId),
        ]);
        setSalesToday(s);
        setPendingOrders(po);
        setStaff(st);
      } catch (e: any) {
        setError(e?.message || 'Erreur lors du chargement des données');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [shopId]);

  const handlePrepare = async (orderId: number) => {
    if (!shopId) return;
    setActionLoading(orderId);
    const ok = await markOrderPrepared(shopId, orderId);
    if (ok) {
      setPendingOrders(prev => prev.filter(o => o.id !== orderId));
    } else {
      alert('Échec lors du marquage comme préparée');
    }
    setActionLoading(null);
  };

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
        <h4>Tableau de bord - Gérant</h4>
        <div className="text-muted">Boutique: {currentBoutique?.nom ?? '—'}</div>
      </div>

      <div className="row">
        <MetricCard title="Ventes aujourd'hui" subtitle="Montant" value={loading ? '...' : salesToday ?? 0} icon="ti ti-calendar-event" bg="bg-secondary" />
        <MetricCard title="Commandes à préparer" subtitle="En cours" value={loading ? '...' : pendingOrders.length} icon="ti ti-package" bg="bg-danger" />
        <MetricCard title="Personnel en service" subtitle="Actifs" value={loading ? '...' : staff.length} icon="ti ti-user-check" bg="bg-info" />
        <div className="col-xl-3 col-lg-6">{/* reserved */}</div>
      </div>

      <div className="row mt-3">
        <div className="col-lg-8">
          <div className="card">
            <div className="card-body">
              <h5>Commandes à préparer</h5>
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Réf</th>
                    <th>Client</th>
                    <th>Montant</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingOrders.map(o => (
                    <tr key={o.id}>
                      <td>{o.reference}</td>
                      <td>{o.clientName}</td>
                      <td>{o.total}</td>
                      <td>
                        <button className="btn btn-sm btn-outline-success me-2" onClick={() => handlePrepare(o.id)} disabled={actionLoading === o.id}>
                          {actionLoading === o.id ? '...' : 'Marquer préparée'}
                        </button>
                        <button className="btn btn-sm btn-outline-primary">Voir</button>
                      </td>
                    </tr>
                  ))}
                  {pendingOrders.length === 0 && (
                    <tr><td colSpan={4} className="text-center">Aucune commande en attente</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="col-lg-4">
          <div className="card">
            <div className="card-body">
              <h5>Activité du personnel</h5>
              <ul className="list-group list-group-flush">
                {staff.map(s => (
                  <li key={s.userId} className="list-group-item d-flex justify-content-between align-items-center">
                    <div>
                      <strong>{s.name}</strong>
                      <div className="text-muted" style={{ fontSize: '0.9rem' }}>Ventes: {s.salesToday}</div>
                    </div>
                    <span className={`badge ${s.shiftStatus === 'ON_SHIFT' ? 'bg-success' : 'bg-secondary'}`}>{s.shiftStatus}</span>
                  </li>
                ))}
                {staff.length === 0 && <li className="list-group-item">Aucun membre actif</li>}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManagerOverview;
