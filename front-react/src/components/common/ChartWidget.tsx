import React from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

type Props = {
  labels: string[];
  data: number[];
  title?: string;
};

const ChartWidget = ({ labels, data, title }: Props) => {
  const chartData = {
    labels,
    datasets: [
      {
        label: title || 'Données',
        data,
        fill: false,
        borderColor: '#4e73df',
        backgroundColor: '#4e73df',
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: { display: false },
      title: { display: !!title, text: title },
    },
  };

  return (
    <div className="card">
      <div className="card-body">
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
};

export default ChartWidget;