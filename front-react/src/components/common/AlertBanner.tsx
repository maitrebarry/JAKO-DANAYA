
import { AlertDTO } from '../../api/admin';

type Props = { alerts: AlertDTO[] };

const AlertBanner = ({ alerts }: Props) => {
  if (!alerts || alerts.length === 0) return null;
  const critical = alerts.filter(a => a.level === 'CRITICAL');
  return (
    <div>
      {critical.length > 0 && (
        <div className="alert alert-danger" role="alert">
          <strong>Alertes critiques:</strong> {critical[0].message}
        </div>
      )}
    </div>
  );
};

export default AlertBanner;