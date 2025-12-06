import React, { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { useUser } from '../contexts/UserContext';

const Fournisseurs: React.FC = () => {
  const { roles, currentBoutique } = useUser();
  const [fournisseurs, setFournisseurs] = useState<any[]>([]);
  const [boutiques, setBoutiques] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [newFournisseur, setNewFournisseur] = useState({ prenom: '', nom: '', contact: '', ville: '', boutiqueId: '' });
  const [editing, setEditing] = useState<any>(null);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');

  const isSuperAdmin = useMemo(() => {
    if (!roles || roles.length === 0) return false;
    return roles.some((r: any) => {
      const name = typeof r === 'string' ? r : (r?.name || '');
      return name.toUpperCase().includes('SUPERADMIN');
    });
  }, [roles]);

  const resetForm = () => {
    setNewFournisseur({
      prenom: '',
      nom: '',
      contact: '',
      ville: '',
      boutiqueId: isSuperAdmin ? '' : (currentBoutique?.id?.toString() || '')
    });
  };

  const fetchFournisseurs = async () => {
    try {
      const token = localStorage.getItem('smb_token');
      const res = await fetch('http://localhost:8085/api/fournisseurs', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Erreur lors du chargement des fournisseurs');
      const data = await res.json();
      setFournisseurs(data);
    } catch (err: any) {
      setError(err.message || 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  const fetchBoutiques = async () => {
    try {
      const token = localStorage.getItem('smb_token');
      const res = await fetch('http://localhost:8085/api/boutiques', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Erreur lors du chargement des boutiques');
      const data = await res.json();
      setBoutiques(data);
    } catch (err: any) {
      setError(err.message || 'Erreur inconnue');
    }
  };

  useEffect(() => {
    fetchFournisseurs();
    if (isSuperAdmin) {
      fetchBoutiques();
    }
  }, []);

  useEffect(() => {
    if (!isSuperAdmin && currentBoutique?.id) {
      setNewFournisseur(prev => ({ ...prev, boutiqueId: currentBoutique.id.toString() }));
    }
  }, [currentBoutique, isSuperAdmin]);

  const handleCreateOrUpdate = async () => {
    if (!newFournisseur.nom.trim() || !newFournisseur.prenom.trim()) {
      setMessage('Veuillez renseigner nom et prénom.');
      return;
    }
    if (isSuperAdmin && !newFournisseur.boutiqueId) {
      setMessage('Sélectionnez une boutique.');
      return;
    }

    setCreating(true);
    setMessage('');
    try {
      const token = localStorage.getItem('smb_token');
      const method = editing ? 'PUT' : 'POST';
      const url = editing ? `http://localhost:8085/api/fournisseurs/${editing.id}` : 'http://localhost:8085/api/fournisseurs';
      const payload: any = {
        prenom: newFournisseur.prenom,
        nom: newFournisseur.nom,
        contact: newFournisseur.contact,
        ville: newFournisseur.ville
      };
      if (newFournisseur.boutiqueId) payload.boutique = { id: newFournisseur.boutiqueId };

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Erreur lors de la ${editing ? 'modification' : 'création'}`);
      }
      setShowModal(false);
      resetForm();
      setEditing(null);
      setMessage(`Fournisseur ${editing ? 'modifié' : 'créé'} avec succès !`);
      fetchFournisseurs();
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setMessage(err.message || 'Erreur inconnue');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: number) => {
    const result = await Swal.fire({
      title: 'Êtes-vous sûr ?',
      text: 'Cette action est irréversible.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Oui, supprimer',
      cancelButtonText: 'Annuler'
    });
    if (!result.isConfirmed) return;
    try {
      const token = localStorage.getItem('smb_token');
      const res = await fetch(`http://localhost:8085/api/fournisseurs/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Erreur lors de la suppression');
      setMessage('Fournisseur supprimé avec succès !');
      fetchFournisseurs();
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setMessage(err.message || 'Erreur inconnue');
    }
  };

  const filtered = fournisseurs.filter((f: any) => {
    const target = `${f.prenom || ''} ${f.nom || ''} ${f.contact || ''} ${f.ville || ''} ${f.boutique?.nom || ''}`.toLowerCase();
    return target.includes(search.toLowerCase());
  });

  if (loading) return <div>Chargement...</div>;
  if (error) return <div className="alert alert-danger">{error}</div>;

  return (
    <>
      {message && (
        <div className={`alert ${message.includes('succès') ? 'alert-success' : 'alert-danger'} mb-3`}>
          {message}
        </div>
      )}
      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center" style={{ backgroundColor: '#007bff', color: 'white' }}>
          <h5>Fournisseurs</h5>
          <button className="btn btn-light" onClick={() => { setEditing(null); resetForm(); setShowModal(true); }}>+ Fournisseur</button>
        </div>
        <div className="card-body">
          <div className="mb-3">
            <input
              type="text"
              className="form-control"
              placeholder="Rechercher par nom, contact, ville ou boutique..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <table className="table table-striped">
            <thead>
              <tr>
                 <th>N°</th>
                <th>Nom</th>
                <th>Prénom</th>
                <th>Contact</th>
                <th>Ville</th>
                <th>Boutique</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((f: any, index: number) => (
                <tr key={f.id}>
                  <td>{index + 1}</td>
                  <td>{f.nom}</td>
                  <td>{f.prenom}</td>
                  <td>{f.contact}</td>
                  <td>{f.ville}</td>
                  <td>{f.boutique?.nom || 'N/A'}</td>
                  <td>
                    <button className="btn btn-sm btn-warning me-2" title="Modifier" onClick={() => { setEditing(f); setNewFournisseur({ prenom: f.prenom || '', nom: f.nom || '', contact: f.contact || '', ville: f.ville || '', boutiqueId: f.boutique?.id ? f.boutique.id.toString() : (currentBoutique?.id?.toString() || '') }); setShowModal(true); }}><i className="ti ti-pencil"></i></button>
                    <button className="btn btn-sm btn-danger" title="Supprimer" onClick={() => handleDelete(f.id)}><i className="ti ti-trash"></i></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className={`modal fade ${showModal ? 'show' : ''}`} style={{ display: showModal ? 'block' : 'none' }} tabIndex={-1}>
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">{editing ? 'Modifier le fournisseur' : 'Créer un fournisseur'}</h5>
              <button type="button" className="btn-close" onClick={() => { setShowModal(false); setEditing(null); resetForm(); }}></button>
            </div>
            <div className="modal-body">
              <div className="mb-3">
                <label className="form-label">Nom</label>
                <input
                  type="text"
                  className="form-control"
                  value={newFournisseur.nom}
                  onChange={(e) => setNewFournisseur({ ...newFournisseur, nom: e.target.value })}
                  placeholder="Nom"
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Prénom</label>
                <input
                  type="text"
                  className="form-control"
                  value={newFournisseur.prenom}
                  onChange={(e) => setNewFournisseur({ ...newFournisseur, prenom: e.target.value })}
                  placeholder="Prénom"
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Contact</label>
                <input
                  type="text"
                  className="form-control"
                  value={newFournisseur.contact}
                  onChange={(e) => setNewFournisseur({ ...newFournisseur, contact: e.target.value })}
                  placeholder="Contact"
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Ville</label>
                <input
                  type="text"
                  className="form-control"
                  value={newFournisseur.ville}
                  onChange={(e) => setNewFournisseur({ ...newFournisseur, ville: e.target.value })}
                  placeholder="Ville"
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Boutique</label>
                {isSuperAdmin ? (
                  <select
                    className="form-control"
                    value={newFournisseur.boutiqueId}
                    onChange={(e) => setNewFournisseur({ ...newFournisseur, boutiqueId: e.target.value })}
                  >
                    <option value="">Sélectionner une boutique</option>
                    {boutiques.map((b: any) => (
                      <option key={b.id} value={b.id}>{b.nom}</option>
                    ))}
                  </select>
                ) : (
                  <input type="text" className="form-control" value={currentBoutique?.nom || ''} disabled />
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => { setShowModal(false); setEditing(null); resetForm(); }}>Annuler</button>
              <button type="button" className="btn btn-primary" onClick={handleCreateOrUpdate} disabled={creating}>
                {creating ? (editing ? 'Modification...' : 'Création...') : (editing ? 'Modifier' : 'Créer')}
              </button>
            </div>
          </div>
        </div>
      </div>
      {showModal && <div className="modal-backdrop fade show"></div>}
    </>
  );
};

export default Fournisseurs;
