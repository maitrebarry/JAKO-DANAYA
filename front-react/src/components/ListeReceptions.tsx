import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';

interface ReceptionData {
  id: number;
  reference: string;
  dateReception: string;
  commandeFournisseur: {
    id: number;
    reference: string;
    fournisseur: {
      id: number;
      nom: string;
      prenom: string;
    };
  };
}

const ListeReceptions: React.FC = () => {
  const navigate = useNavigate();
  const { currentBoutique, logout } = useUser();
  const [unfinishedReceptions, setUnfinishedReceptions] = useState<ReceptionData[]>([]);
  const [finishedReceptions, setFinishedReceptions] = useState<ReceptionData[]>([]);
  const [activeTab, setActiveTab] = useState<'unfinished' | 'finished'>('unfinished');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Debug info (temporary)
  const [debugInfo, setDebugInfo] = useState<{ token?: string | null; fetchStatus?: string; fetchResponse?: any }>({ token: null, fetchStatus: '', fetchResponse: null });

  useEffect(() => {
    const token = localStorage.getItem('smb_token');
    setDebugInfo(prev => ({ ...prev, token: token ? (token.length > 12 ? token.slice(0,12) + '...' : token) : null }));
    fetchReceptions();
  }, [currentBoutique]);

  const fetchReceptions = async () => {
    if (!currentBoutique) return;
    setLoading(true);
    setDebugInfo(prev => ({ ...prev, fetchStatus: 'loading', fetchResponse: null }));
    try {
      const token = localStorage.getItem('smb_token');
      setDebugInfo(prev => ({ ...prev, token: token ? (token.length > 12 ? token.slice(0,12) + '...' : token) : null }));
      const headers: any = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const [unfinishedRes, finishedRes] = await Promise.all([
        fetch(`http://localhost:8085/api/receptions/unfinished`, { headers }),
        fetch(`http://localhost:8085/api/receptions/finished`, { headers })
      ]);
      // Handle authentication errors explicitly: force logout and set debug info
      if (unfinishedRes.status === 401 || finishedRes.status === 401) {
        const uBody = await (unfinishedRes.text().catch(() => null));
        const fBody = await (finishedRes.text().catch(() => null));
        const details = uBody || fBody || '';
        setDebugInfo(prev => ({ ...prev, fetchStatus: 'unauthorized', fetchResponse: details }));
        setError('Authentification requise — vous allez être redirigé vers la connexion.' + (details ? ' (' + details + ')' : ''));
        // Logout immediately to force re-authentication
        logout();
        return;
      }

      if (!unfinishedRes.ok || !finishedRes.ok) {
        // Try to read server details when available
        const uBody = await (unfinishedRes.text().catch(() => null));
        const fBody = await (finishedRes.text().catch(() => null));
        const msg = `Erreur lors du chargement des réceptions (unfinished: ${unfinishedRes.status}, finished: ${finishedRes.status})`;
        throw new Error(msg + (uBody || fBody ? ' - details: ' + (uBody || fBody) : ''));
      }
      const unfinishedData = await unfinishedRes.json();
      const finishedData = await finishedRes.json();
      setUnfinishedReceptions(unfinishedData);
      setFinishedReceptions(finishedData);
      setDebugInfo(prev => ({ ...prev, fetchStatus: 'ok', fetchResponse: { unfinishedCount: unfinishedData.length, finishedCount: finishedData.length } }));
    } catch (err: any) {
      const message = err && err.message ? err.message : 'Erreur lors du chargement des réceptions';
      setError(message);
      setDebugInfo(prev => ({ ...prev, fetchStatus: 'error', fetchResponse: message }));
    } finally {
      setLoading(false);
    }
  };

  const handleDetail = (id: number) => {
    navigate(`/receptions/${id}`);
  };

  const handleDelete = async (_id: number) => {
    // Implement delete with confirmation
  };

  const currentReceptions = activeTab === 'unfinished' ? unfinishedReceptions : finishedReceptions;

  return (
    <>
      <div className="pagetitle">
        <h1>Liste des Réceptions</h1>
        <nav>
          <ol className="breadcrumb">
            <li className="breadcrumb-item"><a href="/">Home</a></li>
            <li className="breadcrumb-item active">Réceptions</li>
          </ol>
        </nav>
      </div>

      <section className="section">
        <div className="row">
          <div className="col-lg-12">
            <div className="card">
              <div className="card-body">
                <ul className="nav nav-tabs" role="tablist">
                  <li className="nav-item" role="presentation">
                    <button
                      className={`nav-link ${activeTab === 'unfinished' ? 'active' : ''}`}
                      onClick={() => setActiveTab('unfinished')}
                      type="button"
                    >
                      Réceptions Non Terminées
                    </button>
                  </li>
                  <li className="nav-item" role="presentation">
                    <button
                      className={`nav-link ${activeTab === 'finished' ? 'active' : ''}`}
                      onClick={() => setActiveTab('finished')}
                      type="button"
                    >
                      Réceptions Terminées
                    </button>
                  </li>
                </ul>
                {/* Debug panel (temp) */}
                <div className="card mb-3">
                  <div className="card-header bg-secondary text-white">Debug (temp)</div>
                  <div className="card-body">
                    <div><strong>Token:</strong> {debugInfo.token ? debugInfo.token : <em>none</em>}</div>
                    <div style={{marginTop: '8px'}}><strong>Fetch status:</strong> {debugInfo.fetchStatus}</div>
                    {debugInfo.fetchResponse && <div style={{marginTop: '8px'}}><strong>Fetch response:</strong>
                      <pre style={{whiteSpace:'pre-wrap', textAlign:'left', maxHeight: '200px', overflow: 'auto'}}>{JSON.stringify(debugInfo.fetchResponse, null, 2)}</pre>
                    </div>}
                  </div>
                </div>

                <div className="tab-content pt-3">
                  {loading ? (
                    <p>Chargement...</p>
                  ) : error ? (
                    <p className="text-danger">{error}</p>
                  ) : (
                    <div className="table-responsive">
                      <table className="table datatable table-bordered table-striped">
                        <thead>
                          <tr>
                            <th>Date Réception</th>
                            <th>Référence Réception</th>
                            <th>Référence Commande</th>
                            <th>Fournisseur</th>
                            <th>Opérations</th>
                          </tr>
                        </thead>
                        <tbody>
                          {currentReceptions.map((reception) => (
                            <tr key={reception.id}>
                              <td>{new Date(reception.dateReception).toLocaleString()}</td>
                              <td>{reception.reference}</td>
                              <td>{reception.commandeFournisseur.reference}</td>
                              <td>{reception.commandeFournisseur.fournisseur.nom} {reception.commandeFournisseur.fournisseur.prenom}</td>
                              <td>
                                <button
                                  className="btn btn-primary btn-sm me-2"
                                  onClick={() => handleDetail(reception.id)}
                                >
                                  <i className="ri-eye-fill"></i>
                                </button>
                                <button
                                  className="btn btn-danger btn-sm"
                                  onClick={() => handleDelete(reception.id)}
                                >
                                  <i className="ri-delete-bin-5-fill"></i>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default ListeReceptions;