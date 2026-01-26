/// <reference types="vitest/globals" />
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// mock useUser to provide necessary roles for Configuration menu
vi.mock('../contexts/UserContext', () => ({
  useUser: () => ({ roles: ['SUPERADMIN'], currentBoutique: { id: 1, nom: 'Test' } })
}));

import Configuration from './Configuration';
import Layout from './Layout';
import Documentation from './Documentation';

describe('Documentation placement', () => {
  test('removed from Configuration menu and available from sidebar (public)', async () => {
    // Configuration no longer exposes Documentation as a submenu
    render(<Configuration />);
    expect(screen.queryByText(/Documentation/i)).not.toBeInTheDocument();

    // Sidebar exposes Documentation and clicking it shows the documentation content

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<Layout><div data-testid="home-child" /></Layout>} />
          <Route path="/documentation" element={<Documentation />} />
        </Routes>
      </MemoryRouter>
    );

    const sideDoc = screen.getByText(/Documentation/i);
    expect(sideDoc).toBeInTheDocument();

    fireEvent.click(sideDoc);

    await waitFor(() => expect(screen.getByText(/DOCUMENTATION UTILISATEUR/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Télécharger \(PDF\)/i })).toBeInTheDocument();
  });
});
