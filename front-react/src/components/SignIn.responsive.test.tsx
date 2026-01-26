/// <reference types="vitest/globals" />
import { render, screen } from '@testing-library/react';
import SignIn from './SignIn';

describe('SignIn — responsiveness & accessibility (unit checks)', () => {
  test('renders brand title and accessible elements', () => {
    render(<SignIn />);

    // brand title (visual) is present in DOM and remains on a single line
    const brand = screen.getByText(/JÀGO DÁNAYA/i);
    expect(brand).toBeInTheDocument();
    expect(brand).toHaveClass('brand-title');
    // ensure the visual text does not contain a hard line break (single-line requirement)
    expect(brand.textContent).not.toMatch(/\n/);

    // inputs use the larger, touch-friendly control class
    const email = screen.getByLabelText(/Adresse email/i) as HTMLInputElement;
    const pwd = screen.getByLabelText(/Mot de passe/i) as HTMLInputElement;
    expect(email).toHaveClass('form-control');
    expect(pwd).toHaveClass('form-control');

    // submit button uses the full-width / large button classes we rely on for mobile
    const btn = screen.getByRole('button', { name: /se connecter/i });
    expect(btn).toHaveClass('btn-lg');
    expect(btn).toHaveClass('w-100');
  });
});
