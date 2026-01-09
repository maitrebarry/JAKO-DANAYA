import React, { useEffect, useState } from 'react';
import MetricCard from './common/MetricCard';
import useHasPermission from '../contexts/useHasPermission';
import { fetchDashboard } from '../api/dashboard';

// Permission key for root dashboard access
const PERM_ROOT = 'TABLEAU_DE_BORD_VOIR';

const Dashboard: React.FC = () => {
  const canView = useHasPermission(PERM_ROOT);

  const [loading, setLoading] = useState(false);
  const [sections, setSections] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canView) return;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const dash = await fetchDashboard();
        setSections(dash.sections || []);
      } catch (e: any) {
        setError(e?.message || 'Erreur lors du chargement du dashboard');
      } finally {
        setLoading(false);
      }
    })();
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

      {error && <div className="alert alert-danger">{error}</div>}

      {sections.map((section, idx) => (
        <div key={idx} className="mt-4">
          <h5>{section.role}</h5>
          <div className="row">
            {section.widgets && section.widgets.length ? section.widgets.map((w: any) => {
              const has = !w.permission || useHasPermission(w.permission);
              if (!has) return null;
              // simple numeric widget
              const value = typeof w.data === 'object' && w.data !== null ? (w.data.value ?? '—') : (w.data ?? '—');
              return (
                <MetricCard key={w.key} title={w.key.replace(/_/g,' ')} subtitle={w.key} value={loading ? '...' : value} icon="ti ti-chart-bar" bg="bg-primary" />
              );
            }) : (<div className="text-muted">Aucun widget</div>)}
          </div>
        </div>
      ))}

    </div>
  );
};

export default Dashboard;
