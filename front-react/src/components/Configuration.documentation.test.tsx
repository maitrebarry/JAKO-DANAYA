/// <reference types="vitest/globals" />
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// mock useUser to provide necessary roles for Configuration menu
vi.mock('../contexts/UserContext', () => ({
  useUser: () => ({ roles: ['SUPERADMIN'], currentBoutique: { id: 1, nom: 'Test' } })
}));

import Configuration from './Configuration';

describe('Configuration → Documentation submenu', () => {
  test('shows Documentation item and renders documentation content with download buttons', async () => {
    render(<Configuration />);

    const docItem = screen.getByText(/Documentation/i);
    expect(docItem).toBeInTheDocument();

    fireEvent.click(docItem);

    await waitFor(() => expect(screen.getByText(/Bienvenue sur JÀGO DÁNAYA/i)).toBeInTheDocument());

    expect(screen.getByRole('button', { name: /Télécharger \(PDF\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Télécharger \(Word\)/i })).toBeInTheDocument();
  });
});
