
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend);

type Dataset = {
  label?: string;
  data: number[];
  borderColor?: string;
  backgroundColor?: string;
  fill?: boolean;
};

type Props = {
  labels: string[];
  data?: number[]; // single-series convenience
  datasets?: Dataset[]; // explicit datasets for multi-series
  type?: 'line' | 'bar' | 'doughnut' | 'pie';
  title?: string;
  height?: number;
  legend?: boolean;
  yFormat?: 'currency' | 'number';
};

const currencyFormatter = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' });

const ChartWidget = ({ labels, data, datasets, type = 'line', title, height, legend = true, yFormat }: Props) => {
  const ds = datasets && datasets.length > 0 ? datasets : [{ label: title || 'Données', data: data || [], fill: true, borderColor: '#0d6efd', backgroundColor: 'rgba(13,110,253,0.12)' }];

  const chartData = {
    labels,
    datasets: ds,
  };

  const options: any = {
    responsive: true,
    maintainAspectRatio: height ? false : true,
    plugins: {
      legend: { display: !!legend, position: 'top' as const },
      title: { display: !!title, text: title },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          label: function (context: any) {
            const v = context.parsed && (context.parsed.y ?? context.parsed);
            if (typeof v === 'number') return yFormat === 'currency' ? currencyFormatter.format(v) : v.toString();
            return String(v);
          }
        }
      }
    },
    scales: {
      y: {
        ticks: {
          callback: function (value: any) {
            if (yFormat === 'currency') return currencyFormatter.format(Number(value));
            return Number(value).toLocaleString('fr-FR');
          }
        }
      }
    }
  };

  const ChartComp: any = type === 'bar' ? Bar : (type === 'doughnut' || type === 'pie' ? Doughnut : Line);

  return (
    <div className="card h-100">
      <div className="card-body" style={height ? { height } : undefined}>
        <ChartComp data={chartData} options={options} />
      </div>
    </div>
  );
};

export default ChartWidget;