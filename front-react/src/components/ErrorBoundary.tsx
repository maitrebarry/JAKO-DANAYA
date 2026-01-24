import React from 'react';

type State = { hasError: boolean; error?: Error };

export default class ErrorBoundary extends React.Component<React.PropsWithChildren<{}>, State> {
  constructor(props: React.PropsWithChildren<{}>) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_error: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // store error + stack so UI can show useful details to developer
    // (kept safe for production: only message/stack shown when DEBUG=true)
    this.setState({ error });
    // also log to console for developer visibility
    // eslint-disable-next-line no-console
    console.error('Captured error in ErrorBoundary:', error, info);
  }

  render() {
    if (this.state.hasError) {
      const showDetails = Boolean(process.env.NODE_ENV !== 'production');
      return (
        <div className="container mt-4">
          <div className="alert alert-danger" role="alert">
            Une erreur inattendue est survenue dans la page — vous pouvez réessayer ou contacter l'administrateur.
            {showDetails && (
              <div className="mt-2">
                <small className="text-muted">Détails: {this.state.error?.message || '—'}</small>
                <pre style={{ maxHeight: 240, overflow: 'auto', background: '#f8f9fa', padding: 8, marginTop: 8 }}>
                  {this.state.error?.stack || 'stack unavailable'}
                </pre>
                <button className="btn btn-sm btn-outline-secondary mt-2" onClick={() => navigator.clipboard?.writeText(String(this.state.error || ''))}>Copier les détails</button>
              </div>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
