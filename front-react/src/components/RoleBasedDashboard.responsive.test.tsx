/// <reference types="vitest/globals" />
import { vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import RoleBasedDashboard from './RoleBasedDashboard';

// mock the api client used by the dashboard to avoid network calls
vi.mock('../api/dashboardClient', () => ({
  getDashboard: vi.fn(async () => ({
    role: 'ADMIN',
    widgets: {
      shopsCount: { data: { value: 3 } },
      transactionsCount: { data: { value: 12 } },
      ventes_jour: { data: { value: 45600 } }
    }
  })),
  getSubordinatesDashboards: vi.fn(async () => ([])),
  getBoutiques: vi.fn(async () => ([])),
  getMagasins: vi.fn(async () => ([]))
}));

describe('RoleBasedDashboard — responsive behaviors', () => {
  test('renders dashboard-grid and cards when widgets present', async () => {
    render(<RoleBasedDashboard />);

    // dashboard-grid should appear once data is loaded
    await waitFor(() => expect(document.querySelector('.dashboard-grid')).toBeTruthy());

    const grid = document.querySelector('.dashboard-grid') as HTMLElement;
    expect(grid).toBeInTheDocument();

    // should contain at least one card per widget
    const cards = grid.querySelectorAll('.card');
    expect(cards.length).toBeGreaterThanOrEqual(2);

    // check that numeric values are rendered somewhere (basic smoke)
    expect(screen.getByText(/3/)).toBeInTheDocument();
    expect(screen.getByText(/12/)).toBeInTheDocument();
  });
});
