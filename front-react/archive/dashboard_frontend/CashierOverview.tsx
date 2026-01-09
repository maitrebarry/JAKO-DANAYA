import React, { useEffect, useState } from 'react';
import MetricCard from '../common/MetricCard';
import { useUser } from '../../contexts/UserContext';
import { fetchCashierTransactions, fetchCashTotals, Transaction, closeShift } from '../../api/cashier';

const CashierOverview: React.FC = () => {
  const { currentBoutique } = useUser();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totals, setTotals] = useState<{ [method: string]: number }>({});
  const [loading, setLoading] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [tx, t] = await Promise.all([fetchCashierTransactions(), fetchCashTotals()]);
        setTransactions(tx);
        setTotals(t);
      } catch (e: any) {
        setError(e?.message || 'Erreur lors du chargement des transactions');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleCloseShift = async () => {
    setClosing(true);
    const ok = await closeShift(0);
    if (ok) {
      alert('Shift fermé avec succès');
      setTransactions([]);
      setTotals({});
    } else {
      alert('Erreur lors de la fermeture');
    }
    setClosing(false);
  };

  if (error) {
    return (
      <div className="alert alert-danger" role="alert">{error}</div>
    );
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4>Tableau de bord - Caissier</h4>
        <div className="text-muted">Boutique: {currentBoutique?.nom ?? '—'}</div>
      </div>

      <div className="row">
        <MetricCard title="Transactions" subtitle="Nombre" value={loading ? '...' : transactions.length} icon="ti ti-receipt" bg="bg-primary" />
        <MetricCard title="Totaux" subtitle="Par moyen" value={loading ? '...' : Object.values(totals).reduce((a,b)=>a+(b||0),0)} icon="ti ti-wallet" bg="bg-success" />
        <div className="col-xl-3 col-lg-6">
          <div className="card">
            <div className="card-body">
              <h5>Actions</h5>
              <div className="d-grid mt-2">
                <button className="btn btn-outline-danger" onClick={handleCloseShift} disabled={closing}>{closing ? '...' : 'Clôturer le shift'}</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row mt-3">
        <div className="col-12">
          <div className="card">
            <div className="card-body">
              <h5>Transactions récentes</h5>
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Réf</th>
                    <th>Moyen</th>
                    <th>Montant</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(t => (
                    <tr key={t.id}>
                      <td>{t.reference}</td>
                      <td>{t.paymentMethod}</td>
                      <td>{t.amount}</td>
                      <td>{new Date(t.date || '').toLocaleString()}</td>
                    </tr>
                  ))}
                  {transactions.length === 0 && <tr><td colSpan={4} className="text-center">Aucune transaction</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CashierOverview;
