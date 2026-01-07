import React, { useEffect, useState } from 'react';
import UtilisationForm from './UtilisationForm';
import useHasPermission from '../contexts/useHasPermission';
import { formatServerDate } from '../utils/date';
import Swal from 'sweetalert2';

const API_BASE = 'http://localhost:8085/api';
const AUTH_HEADER = () => ({ Authorization: `Bearer ${localStorage.getItem('smb_token')}` });

const UtilisationsPage: React.FC = () => {
  const canCreate = useHasPermission('UTILISA_PERTE_CREER');
  const canRead = useHasPermission('UTILISA_PERTE_VOIR') || useHasPermission('MOUVEMENT_AUDIT');
  const canModify = useHasPermission('UTILISA_PERTE_MODIFIER');
  const canDelete = useHasPermission('UTILISA_PERTE_SUPPRIMER');
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<any | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [magasins, setMagasins] = useState<any[]>([]);
  const [magasinFilter, setMagasinFilter] = useState<number | ''>('');

  const fetchList = async () => {
    if (!canRead && !canCreate) return; // no permission to view
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API_BASE}/mouvements/utilisations`, { headers: AUTH_HEADER() });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setItems(data || []);
    } catch (e: any) {
      console.error(e);
      setError(String(e.message || e));
    } finally { setLoading(false); }
  };

  const handleDelete = async (it: any) => {
    const r = await Swal.fire({
      title: 'Confirmer la suppression',
      text: 'Cette action est irréversible. Supprimer cette utilisation/perte ?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Supprimer',
      cancelButtonText: 'Annuler',
      reverseButtons: true,
    });
    if (!r.isConfirmed) return;

    try {
      const res = await fetch(`${API_BASE}/mouvements/${it.id}`, { method: 'DELETE', headers: AUTH_HEADER() });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
      await Swal.fire('Succès', 'Utilisation supprimée', 'success');
      fetchList();
    } catch (e: any) {
      console.error(e);
      setError(String(e.message || e));
      Swal.fire('Erreur', e && e.message ? e.message : 'Erreur suppression', 'error');
    }
  };

  useEffect(() => { if (!showForm) setEditItem(null); }, [showForm]);

  const fetchMagasins = async () => {
    try {
      const res = await fetch(`${API_BASE}/magasins`, { headers: AUTH_HEADER() });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setMagasins(data || []);
    } catch (e: any) {
      console.error('fetchMagasins', e);
    }
  };

  useEffect(() => { fetchList(); fetchMagasins(); }, [canRead, canCreate]);

  const filteredItems = items.filter(it => {
    const matchSearch = !search || [it.produit?.nomProduit, it.produit?.nom, it.description, it.utilisateur?.email, it.utilisateur?.prenom, it.utilisateur?.nom].some(f => (f||'').toString().toLowerCase().includes(search.toLowerCase()));
    const matchMag = !magasinFilter || (it.magasin && (it.magasin.id === magasinFilter || it.magasinId === magasinFilter));
    return matchSearch && matchMag;
  });

  const exportCSV = (itemsToExport = items) => {
    const lines: string[] = [];
    lines.push('Date;Type;Produit;Magasin;Quantité;Description;Utilisateur');
    itemsToExport.forEach((it: any) => {
      const date = formatServerDate(it.dateMouvement || it.date);
      lines.push(`${date};${it.sousType || it.typeMouvement};${it.produit?.nomProduit || it.produit?.nom || it.produitId || ''};${it.magasin?.nom || it.magasinId || ''};${it.quantite || ''};"${(it.description || '').replace(/"/g,'""')}";${it.utilisateur?.email || it.utilisateurId || ''}`);
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `utilisations_export.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div>
      {/* Breadcrumb header similar to Produits */}
      <div className="page-breadcrumb d-none d-sm-flex align-items-center mb-3">
        <div className="breadcrumb-title pe-3">Utilisations</div>
        <div className="ps-3">
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb mb-0 p-0">
              <li className="breadcrumb-item"><a href="#"><i className="bx bx-home-alt"></i></a></li>
              <li className="breadcrumb-item active" aria-current="page">Liste Utilisations</li>
            </ol>
          </nav>
        </div>
        <div className="ms-auto">
          <div className="btn-group" />
        </div>
      </div>

      <hr />

      <div className="row mb-3">
        <div className="col-12">
          <div className="card">
            <div className="card-body">
              <div className="row">
                <div className="col-12 d-flex align-items-center">
                  <div className="me-3">
                    {canCreate && <button className="btn btn-primary mb-3 mb-lg-0" onClick={() => setShowForm(true)}>Nouvelle Utilisation / Perte</button>}
                  </div>
                  <div className="flex-grow-1">
                    <form className="float-lg-end">
                      <div className="row row-cols-lg-auto g-2 align-items-center">
                        <div className="col-12">
                          <div className="position-relative">
                            <input
                              type="text"
                              className="form-control ps-5"
                              placeholder="Rechercher..."
                              value={search}
                              onChange={(e) => setSearch(e.target.value)}
                            />
                            <span className="position-absolute top-50 product-show translate-middle-y">
                              <i className="bx bx-search"></i>
                            </span>
                          </div>
                        </div>
                        <div className="col-12">
                          <select className="form-control" value={magasinFilter ?? ''} onChange={(e) => setMagasinFilter(e.target.value ? Number(e.target.value) : '')}>
                            <option value="">Boutique (global)</option>
                            {magasins.map(m => <option key={m.id} value={m.id}>{m.nom || m.nomMagasin || m.id}</option>)}
                          </select>
                        </div>
                        <div className="col-12">
                          <button className="btn btn-outline-success mb-3 mb-lg-0" onClick={(e) => { e.preventDefault(); exportCSV(filteredItems); }} disabled={filteredItems.length === 0}>Exporter CSV</button>
                        </div>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {loading ? <div className="text-muted">Chargement...</div> : (
        <div className="table-responsive">
          <table className="table table-sm table-striped">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Produit</th>
                <th>Magasin</th>
                <th className="text-end">Quantité</th>
                <th>Utilisateur</th>
                <th>Description</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((it: any) => (
                <tr key={it.id}>
                  <td>{formatServerDate(it.dateMouvement || it.date)}</td>
                  <td><span className={`badge ${it.sousType === 'PERTE' ? 'bg-danger' : 'bg-primary'}`}>{it.sousType || it.typeMouvement}</span></td>
                  <td>{it.produit?.nomProduit || it.produit?.nom || it.produitId}</td>
                  <td>{it.magasin?.nom || it.magasinId || ''}</td>
                  <td className="text-end">{it.quantite}</td>
                  <td>{it.utilisateur?.prenom ? `${it.utilisateur.prenom} ${it.utilisateur.nom}` : it.utilisateur?.email || ''}</td>
                  <td>{it.description}</td>
                  <td>
                    <div className="d-flex align-items-center">
                      {canModify ? (
                        <button title="Modifier" className="btn btn-sm btn-outline-warning me-2" onClick={async () => {
                          // try to fetch utilisation_pertes associated with this movement and open form with that if present
                          if (it.mouvementId) {
                            const r = await fetch(`${API_BASE}/utilisation-pertes/mouvement/${it.mouvementId}`, { headers: AUTH_HEADER() });
                            if (r.ok) {
                              const up = await r.json();
                              setEditItem(up);
                              setShowForm(true);
                              return;
                            }
                          }
                          // fallback to pass the movement
                          setEditItem(it);
                          setShowForm(true);
                        }}>
                          <i className="bx bx-edit"></i>
                        </button>
                      ) : null}

                      {canDelete ? (
                        <button title="Supprimer" className="btn btn-sm btn-outline-danger" onClick={async () => {
                          // prefer deleting via utilisation_pertes if linked
                          if (it.mouvementId) {
                            const r = await fetch(`${API_BASE}/utilisation-pertes/mouvement/${it.mouvementId}`, { headers: AUTH_HEADER() });
                            if (r.ok) {
                              const up = await r.json();
                              // confirm and delete
                              const resp = await Swal.fire({
                                title: 'Confirmer la suppression',
                                text: 'Cette action est irréversible. Supprimer cette utilisation/perte ? (enregistrée)',
                                icon: 'warning',
                                showCancelButton: true,
                                confirmButtonText: 'Supprimer',
                                cancelButtonText: 'Annuler',
                                reverseButtons: true,
                              });
                              if (!resp.isConfirmed) return;
                              const del = await fetch(`${API_BASE}/utilisation-pertes/${up.id}`, { method: 'DELETE', headers: AUTH_HEADER() });
                              if (!del.ok) { const txt = await del.text(); throw new Error(txt || 'Erreur suppression'); }
                              await Swal.fire('Succès', 'Utilisation supprimée', 'success');
                              fetchList();
                              return;
                            }
                          }
                          // fallback: delete movement
                          handleDelete(it);
                        }}>
                          <i className="bx bx-trash"></i>
                        </button>
                      ) : null}

                      {(!canModify && !canDelete) && <span className="text-muted">Aucune action</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && <UtilisationForm editing={editItem || undefined} onClose={() => setShowForm(false)} onSuccess={() => { setShowForm(false); fetchList(); }} />}
    </div>
  );
};

export default UtilisationsPage;
