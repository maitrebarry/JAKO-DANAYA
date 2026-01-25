import React, { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { useUser } from '../contexts/UserContext';
import useHasPermission from '../contexts/useHasPermission';
import RequirePermission from './RequirePermission';
import PhoneWithDial from './PhoneWithDial';
import { API } from '../config/api';

const Fournisseurs: React.FC = () => {
  const { roles, currentBoutique } = useUser();
  const [fournisseurs, setFournisseurs] = useState<any[]>([]);
  const [boutiques, setBoutiques] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [newFournisseur, setNewFournisseur] = useState({ prenom: '', nom: '', contact: '', ville: '', boutiqueId: '' });
  const [phoneCodePays, setPhoneCodePays] = useState<string | null>(null);
  const [newFournisseurTelephoneValid, setNewFournisseurTelephoneValid] = useState<boolean | null>(null);
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

  const canCreate = useHasPermission('FOURNISSEUR_CREER');
  const canModify = useHasPermission('FOURNISSEUR_MODIFIER');

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
      const res = await fetch(`${API}/fournisseurs`, {
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
      const res = await fetch(`${API}/boutiques`, {
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

    if (editing && !canModify) { setMessage("Vous n'avez pas la permission de modifier"); return; }
    if (!editing && !canCreate) { setMessage("Vous n'avez pas la permission de créer"); return; }

    setCreating(true);
    setMessage('');
    try {
      const token = localStorage.getItem('smb_token');
      const method = editing ? 'PUT' : 'POST';
      const url = editing ? `${API}/fournisseurs/${editing.id}` : `${API}/fournisseurs`;
      const payload: any = {
        prenom: newFournisseur.prenom,
        nom: newFournisseur.nom,
        contact: newFournisseur.contact,
        ville: newFournisseur.ville,
        codePays: phoneCodePays || undefined
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
      const res = await fetch(`${API}/fournisseurs/${id}`, {
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
        <div className="card-header d-flex justify-content-between align-items-center bg-primary text-white">
          <h6 className="mb-0">Fournisseurs</h6>
          <RequirePermission permission="FOURNISSEUR_CREER">
            <button className="btn btn-primary mb-3 mb-lg-0" onClick={() => { setEditing(null); resetForm(); setShowModal(true); }}>+ Fournisseur</button>
          </RequirePermission>
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
                    <RequirePermission permission="FOURNISSEUR_MODIFIER">
                      <button className="btn btn-sm btn-warning me-2" title="Modifier" onClick={() => { setEditing(f); setNewFournisseur({ prenom: f.prenom || '', nom: f.nom || '', contact: f.contact || '', ville: f.ville || '', boutiqueId: f.boutique?.id ? f.boutique.id.toString() : (currentBoutique?.id?.toString() || '') }); setPhoneCodePays(f.codePays || (f.boutique && f.boutique.pays ? f.boutique.pays.codeIso : 'ML')); setShowModal(true); }}><i className="ti ti-pencil"></i></button>
                    </RequirePermission>
                    <RequirePermission permission="FOURNISSEUR_SUPPRIMER">
                      <button className="btn btn-sm btn-danger" title="Supprimer" onClick={() => handleDelete(f.id)}><i className="ti ti-trash"></i></button>
                    </RequirePermission>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className={`modal fade ${showModal ? 'show' : ''}`} style={{ display: showModal ? 'block' : 'none' }} tabIndex={-1}>
        <div className="modal-dialog modal-fullscreen-sm-down">
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
                <PhoneWithDial value={newFournisseur.contact} defaultCountry={((currentBoutique as any) && (currentBoutique as any).pays && (currentBoutique as any).pays.codeIso) ? (currentBoutique as any).pays.codeIso : 'ML'} onChange={(tel, code, valid) => { setNewFournisseur({ ...newFournisseur, contact: tel || '' }); setPhoneCodePays(code || null); setNewFournisseurTelephoneValid(typeof valid === 'boolean' ? valid : null); }} />
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
              <button type="button" className="btn btn-primary" onClick={() => {
                // validate phone
                if (newFournisseur.contact && newFournisseur.contact.trim() && newFournisseurTelephoneValid !== true) { Swal.fire('Erreur', 'Le numéro de téléphone est invalide ou incomplet pour le pays sélectionné', 'error'); return; }
                handleCreateOrUpdate();
              }} disabled={creating || (!editing && !canCreate) || (editing && !canModify)}>
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