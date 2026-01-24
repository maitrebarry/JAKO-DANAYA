import React, { useEffect, useState } from 'react';
import RequirePermission from './RequirePermission';
import { useUser } from '../contexts/UserContext';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { formatServerDate } from '../utils/date';
import * as inventaireApi from '../api/inventaire';

const Inventaires: React.FC = () => {
  const { currentBoutique } = useUser();
  const navigate = useNavigate();
  const [inventaires, setInventaires] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!currentBoutique) return;
    setLoading(true);
    try {
      const data = await inventaireApi.listInventaires(currentBoutique.id);
      setInventaires(data);
    } catch (e: any) {
      setError(e.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [currentBoutique]);

  // Redirect to the create page instead of inline modal
  const handleCreate = () => {
    navigate('/inventaires/new');
  };

  const handleRegularize = async (id: number) => {
    const resp = await Swal.fire({title: 'Confirmation', text: 'Confirmer la régularisation ? Cette action est irréversible.', icon: 'warning', showCancelButton: true});
    if (!resp.isConfirmed) return;
    try {
      await inventaireApi.regularizeInventaire(id);
      await Swal.fire('Succès', 'Inventaire régularisé.', 'success');
      load();
    } catch (e: any) {
      await Swal.fire('Erreur', e && e.message ? e.message : 'Erreur', 'error');
    }
  };

  return (
    <>
      <div className="page-breadcrumb d-none d-sm-flex align-items-center mb-3">
        <div className="breadcrumb-title pe-3">Inventaire</div>
        <div className="ps-3">
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb mb-0 p-0">
              <li className="breadcrumb-item"><a href="#"><i className="bx bx-home-alt"></i></a></li>
              <li className="breadcrumb-item active" aria-current="page">Liste Inventaires</li>
            </ol>
          </nav>
        </div>
        <div className="ms-auto">
          <div className="btn-group" />
        </div>
      </div>

      <div className="card mb-3">
        <div className="card-body d-flex align-items-center">
          <h4 className="me-3 mb-0">Inventaires</h4>
          <div className="ms-auto d-flex gap-2">
            <RequirePermission permission="INVENTAIRE_CREER">
              <button className="btn btn-primary" onClick={() => handleCreate()}><i className="bx bxs-plus-square"></i> Créer</button>
            </RequirePermission>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {loading ? (
        <div>Chargement...</div>
      ) : (
        <div className="card">
          <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center"><h5 className="mb-0">Inventaires</h5></div>
          <div className="card-body p-2">
            <div className="table-responsive">
              <table className="table table-hover table-striped align-middle">
                <thead className="table-light">
                  <tr>
                    <th>Référence</th>
                    <th>Date</th>
                    <th>Regularisé</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {inventaires.map(inv => (
                    <tr key={inv.idInventaire || inv.id}>
                      <td>{inv.referenceInventaire || inv.reference}</td>
                      <td>{formatServerDate(inv.dateInventaire || inv.date || '')}</td>
                      <td>{inv.regulariser ? <span className="badge bg-success">Oui</span> : <span className="badge bg-secondary">Non</span>}</td>
                      <td className="text-end">
                        <a className="btn btn-sm btn-outline-primary me-2" href={`/inventaires/${inv.idInventaire || inv.id}`}>Voir</a>
                        {!inv.regulariser && (
                          <RequirePermission permission="INVENTAIRE_REGULARISER">
                            <button className="btn btn-sm btn-success" onClick={() => handleRegularize(inv.idInventaire || inv.id)}>Régulariser</button>
                          </RequirePermission>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}


    </>
  );
};

export default Inventaires;