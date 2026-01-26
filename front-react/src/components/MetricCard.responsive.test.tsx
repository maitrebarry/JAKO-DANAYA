/// <reference types="vitest/globals" />
import { render, screen } from '@testing-library/react';
import MetricCard from './common/MetricCard';

describe('MetricCard — responsive & structure', () => {
  test('renders metric card with metric-card class and responsive column wrapper', () => {
    render(<MetricCard title="Test" value={42} subtitle="sub" icon="bi bi-star" />);

    // top-level wrapper should include the expected bootstrap column classes
    const wrapper = document.querySelector('.col-xl-3.col-lg-6');
    expect(wrapper).toBeInTheDocument();

    // inner card should have the metric-card class we added for responsive styling
    const card = document.querySelector('.metric-card');
    expect(card).toBeInTheDocument();

    // value is rendered
    expect(screen.getByText(/42/)).toBeInTheDocument();
  });
});
