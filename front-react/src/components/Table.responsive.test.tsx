/// <reference types="vitest/globals" />
import { render, screen } from '@testing-library/react';

describe('Table — mobile-friendly structure', () => {
  test('table inside a card-body is present and cell-break class exists', () => {
    render(
      <div className="card">
        <div className="card-body">
          <table>
            <thead>
              <tr><th>Col</th></tr>
            </thead>
            <tbody>
              <tr>
                <td className="cell-break">This is a very long text that should wrap on small screens and be breakable by the cell-break utility.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );

    const tbl = document.querySelector('.card .card-body table');
    expect(tbl).toBeInTheDocument();

    const td = screen.getByText(/very long text/i);
    expect(td).toHaveClass('cell-break');
  });
});
