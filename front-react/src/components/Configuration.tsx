import { useState, useEffect, useMemo } from 'react';
import { useUser } from '../contexts/UserContext';
import Swal from 'sweetalert2';

const Configuration = () => {
  const { user, roles } = useUser();
  const [selectedSub, setSelectedSub] = useState('liste-utilisateurs');
  const normalizedRoles = roles.map(r => r.toUpperCase());
  const isSuperAdmin = normalizedRoles.includes('SUPERADMIN') || (user?.typeUtilisateur || '').toUpperCase() === 'SUPERADMIN';

  const renderContent = () => {
    switch (selectedSub) {
      case 'liste-utilisateurs':
        return <ListeUtilisateurs />;
      case 'boutique':
        return <Boutique />;
      case 'magasins':
        return <Magasins />;
      case 'unite':
        return <Unite />;
      case 'permissions':
        return <Permissions />;
      case 'assigner-permissions':
        return <AssignerPermissions />;
      default:
        return <ListeUtilisateurs />;
    }
  };

  return (
    <>
      <style>{`
        .list-group-item-action:hover {
          background-color: #e3f2fd !important;
        }
      `}</style>
      <div className="row">
        <div className="col-3">
          <div className="card">
            <div className="card-header" style={{ backgroundColor: '#007bff', color: 'white' }}>
              <h6>MENU de Configuration</h6>
            </div>
            <div className="list-group list-group-flush">
              <a href="#" className="list-group-item list-group-item-action" style={{ cursor: 'pointer' }} onClick={() => setSelectedSub('liste-utilisateurs')}>
                Liste utilisateurs
              </a>
              <a href="#" className="list-group-item list-group-item-action" style={{ cursor: 'pointer' }} onClick={() => setSelectedSub('boutique')}>
                Boutique
              </a>
              <a href="#" className="list-group-item list-group-item-action" style={{ cursor: 'pointer' }} onClick={() => setSelectedSub('magasins')}>
                Magasins
              </a>
              <a href="#" className="list-group-item list-group-item-action" style={{ cursor: 'pointer' }} onClick={() => setSelectedSub('unite')}>
                Unité
              </a>
              {isSuperAdmin && (
                <a href="#" className="list-group-item list-group-item-action" style={{ cursor: 'pointer' }} onClick={() => setSelectedSub('permissions')}>
                  Permissions
                </a>
              )}
              <a href="#" className="list-group-item list-group-item-action" style={{ cursor: 'pointer' }} onClick={() => setSelectedSub('assigner-permissions')}>
                Assigner des permissions
              </a>
            </div>
          </div>
        </div>
        <div className="col-9">
          {renderContent()}
        </div>
      </div>
    </>
  );
};

const ListeUtilisateurs = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [boutiques, setBoutiques] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);

  const { user, roles: sessionRoles } = useUser();
  const normalizedRoles = sessionRoles.map(r => (r || '').replace(/^ROLE_/i, '').toUpperCase());
  const currentType = (user?.typeUtilisateur || '').toUpperCase();
  const isAdminOrProprio = normalizedRoles.some(r => ['ADMINISTRATEUR', 'PROPRIETAIRE', 'SUPERADMIN'].includes(r))
    || ['ADMINISTRATEUR', 'PROPRIETAIRE', 'SUPERADMIN'].includes(currentType);

  const defaultForm = {
    nom: '',
    prenom: '',
    email: '',
    pseudo: '',
    motDePasse: '',
    contact: '',
    adresse: '',
    typeUtilisateur: isAdminOrProprio ? 'GERANT_BOUTIQUE' : 'GERANT_BOUTIQUE',
    statut: 'ACTIF',
    boutiqueId: '',
    roleIds: [] as string[]
  };

  const [formData, setFormData] = useState(() => ({ ...defaultForm }));

  const typeOptions = [
    { value: 'SUPERADMIN', label: 'Super admin' },
    { value: 'ADMINISTRATEUR', label: 'Administrateur' },
    { value: 'GERANT_BOUTIQUE', label: 'Gérant boutique' },
    { value: 'CAISSIER', label: 'Caissier' },
    { value: 'MAGASINIER', label: 'Magasinier' }
  ];

  const statutOptions = [
    { value: 'ACTIF', label: 'Actif' },
    { value: 'INACTIF', label: 'Inactif' }
  ];

  const resetForm = () => {
    setFormData({ ...defaultForm });
    setEditingUser(null);
  };

  const loadUsers = async () => {
    setLoading(true);
    setError('');
    const token = localStorage.getItem('smb_token');
    if (!token) {
      setError('Vous devez être connecté pour accéder à cette section.');
      setLoading(false);
      return;
    }
    const headers: Record<string, string> = { 'Authorization': `Bearer ${token}` };
    
    let hasError = false;
    let errorMessages: string[] = [];

    try {
      const usersRes = await fetch('http://localhost:8085/api/users', { headers });
      if (usersRes.status === 401) {
        errorMessages.push("Vous n'avez pas les droits pour consulter les utilisateurs. Connectez-vous avec un compte SUPERADMIN ou ADMINISTRATEUR.");
        hasError = true;
      } else if (!usersRes.ok) {
        errorMessages.push('Impossible de charger les utilisateurs.');
        hasError = true;
      } else {
        const usersData = await usersRes.json();
        setUsers(usersData || []);
      }
    } catch (err: any) {
      errorMessages.push(err.message);
      hasError = true;
    }

    try {
      const boutiquesRes = await fetch('http://localhost:8085/api/boutiques', { headers });
      if (!boutiquesRes.ok) {
        errorMessages.push('Erreur lors du chargement des boutiques.');
        hasError = true;
      } else {
        const boutiquesData = await boutiquesRes.json();
        setBoutiques(boutiquesData || []);
      }
    } catch (err: any) {
      errorMessages.push(err.message);
      hasError = true;
    }

    try {
      const rolesRes = await fetch('http://localhost:8085/api/roles', { headers });
      if (rolesRes.status === 401) {
        errorMessages.push("Vous n'avez pas accès au chargement des rôles.");
        hasError = true;
      } else if (!rolesRes.ok) {
        errorMessages.push('Erreur lors du chargement des rôles.');
        hasError = true;
      } else {
        const rolesData = await rolesRes.json();
        setRoles(rolesData || []);
      }
    } catch (err: any) {
      errorMessages.push(err.message);
      hasError = true;
    }

    if (hasError && errorMessages.length > 0) {
      setError(errorMessages.join(' '));
    }
    
    setLoading(false);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleRoleToggle = (roleId: number) => {
    setFormData(prev => {
      const exists = prev.roleIds.includes(String(roleId));
      return {
        ...prev,
        roleIds: exists
          ? prev.roleIds.filter(id => id !== String(roleId))
          : [...prev.roleIds, String(roleId)]
      };
    });
  };

  const handleCreateOrUpdate = async () => {
    if (!formData.nom.trim() || !formData.email.trim() || !formData.pseudo.trim() || !formData.boutiqueId) {
      setMessage('Nom, email, pseudo et boutique sont obligatoires.');
      return;
    }
    if (!editingUser && !formData.motDePasse.trim()) {
      setMessage('Le mot de passe est requis pour créer un utilisateur.');
      return;
    }
    setCreating(true);
    setMessage('');
    try {
      const token = localStorage.getItem('smb_token');
      const method = editingUser ? 'PUT' : 'POST';
      const url = editingUser ? `http://localhost:8085/api/users/${editingUser.id}` : 'http://localhost:8085/api/users';
      const payload: any = {
        nom: formData.nom,
        prenom: formData.prenom,
        email: formData.email,
        pseudo: formData.pseudo,
        contact: formData.contact,
        adresse: formData.adresse,
        typeUtilisateur: formData.typeUtilisateur,
        statut: formData.statut,
        boutique: { id: Number(formData.boutiqueId) },
        roles: formData.roleIds.map(id => ({ id: Number(id) })),
        permissions: []
      };
      if (formData.motDePasse.trim()) {
        payload.motDePasse = formData.motDePasse;
      }
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Erreur lors de la ${editingUser ? 'modification' : 'création'}`);
      }
      setShowModal(false);
      setMessage(`Utilisateur ${editingUser ? 'modifié' : 'créé'} avec succès !`);
      resetForm();
      loadUsers();
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setMessage(err.message);
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
      const res = await fetch(`http://localhost:8085/api/users/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Erreur lors de la suppression');
      setMessage('Utilisateur supprimé avec succès !');
      loadUsers();
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setMessage(err.message);
    }
  };

  const handleEdit = (user: any) => {
    setEditingUser(user);
    setFormData({
      nom: user.nom || '',
      prenom: user.prenom || '',
      email: user.email || '',
      pseudo: user.pseudo || '',
      motDePasse: '',
      contact: user.contact || '',
      adresse: user.adresse || '',
      typeUtilisateur: user.typeUtilisateur || 'GERANT_BOUTIQUE',
      statut: user.statut || 'ACTIF',
      boutiqueId: user.boutique?.id ? String(user.boutique.id) : '',
      roleIds: user.roles ? user.roles.map((role: any) => String(role.id)) : []
    });
    setShowModal(true);
  };

  const filteredUsers = users.filter(user =>
    `${user.nom || ''} ${user.prenom || ''}`.toLowerCase().includes(search.toLowerCase()) ||
    (user.email || '').toLowerCase().includes(search.toLowerCase()) ||
    (user.pseudo || '').toLowerCase().includes(search.toLowerCase()) ||
    (user.boutique?.nom || '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return (
    <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '200px' }}>
      <div className="spinner-border text-primary" role="status">
        <span className="visually-hidden">Chargement...</span>
      </div>
    </div>
  );
  
  if (error) return (
    <div className="alert alert-danger">
      <h5>Erreur</h5>
      <p>{error}</p>
      <button className="btn btn-primary" onClick={loadUsers}>
        Réessayer
      </button>
    </div>
  );

  return (
    <>
      {message && (
        <div className={`alert ${message.includes('succès') ? 'alert-success' : 'alert-danger'} mb-3`}>
          {message}
        </div>
      )}
      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center" style={{ backgroundColor: '#007bff', color: 'white' }}>
          <h5>Utilisateurs</h5>
          <button className="btn btn-light" onClick={() => { resetForm(); setShowModal(true); }}>+ Nouvel utilisateur</button>
        </div>
        <div className="card-body">
          <div className="mb-3 row">
            <div className="col-md-6">
              <input
                type="text"
                className="form-control"
                placeholder="Rechercher par nom, email, pseudo ou boutique..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="table-responsive">
            <table className="table table-striped">
              <thead>
                <tr>
                  <th>N°</th>
                  <th>Nom</th>
                  <th>Prénom</th>
                  <th>Email</th>
                  <th>Pseudo</th>
                  <th>Boutique</th>
                  <th>Type</th>
                  <th>Statut</th>
                  <th>Rôles</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user: any, index: number) => (
                  <tr key={user.id}>
                    <td>{index + 1}</td>
                    <td>{user.nom}</td>
                    <td>{user.prenom}</td>
                    <td>{user.email}</td>
                    <td>{user.pseudo}</td>
                    <td>{user.boutique?.nom || 'N/A'}</td>
                    <td>{user.typeUtilisateur}</td>
                    <td>{user.statut}</td>
                    <td>{(user.roles || []).map((role: any) => role.name).join(', ')}</td>
                    <td>
                      <button className="btn btn-sm btn-warning me-2" title="Modifier" onClick={() => handleEdit(user)}><i className="ti ti-pencil"></i></button>
                      <button className="btn btn-sm btn-danger" title="Supprimer" onClick={() => handleDelete(user.id)}><i className="ti ti-trash"></i></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal */}
      <div className={`modal fade ${showModal ? 'show' : ''}`} style={{ display: showModal ? 'block' : 'none' }} tabIndex={-1}>
        <div className="modal-dialog modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">{editingUser ? "Modifier l'utilisateur" : 'Créer un utilisateur'}</h5>
              <button type="button" className="btn-close" onClick={() => { setShowModal(false); resetForm(); }}></button>
            </div>
            <div className="modal-body">
              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label">Nom</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.nom}
                    onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                  />
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label">Prénom</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.prenom}
                    onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                  />
                </div>
              </div>
              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    className="form-control"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label">Pseudo</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.pseudo}
                    onChange={(e) => setFormData({ ...formData, pseudo: e.target.value })}
                  />
                </div>
              </div>
              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label">Boutique</label>
                  <select
                    className="form-control"
                    value={formData.boutiqueId}
                    onChange={(e) => setFormData({ ...formData, boutiqueId: e.target.value })}
                  >
                    <option value="">Sélectionner une boutique</option>
                    {boutiques.map((boutique: any) => (
                      <option key={boutique.id} value={boutique.id}>{boutique.nom}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-3 mb-3">
                  <label className="form-label">Type</label>
                  <select
                    className="form-control"
                    value={formData.typeUtilisateur}
                    onChange={(e) => setFormData({ ...formData, typeUtilisateur: e.target.value })}
                  >
                    {typeOptions.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-3 mb-3">
                  <label className="form-label">Statut</label>
                  <select
                    className="form-control"
                    value={formData.statut}
                    onChange={(e) => setFormData({ ...formData, statut: e.target.value })}
                  >
                    {statutOptions.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label">Contact</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.contact}
                    onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                  />
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label">Adresse</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.adresse}
                    onChange={(e) => setFormData({ ...formData, adresse: e.target.value })}
                  />
                </div>
              </div>
              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label">Mot de passe</label>
                  <input
                    type="password"
                    className="form-control"
                    value={formData.motDePasse}
                    onChange={(e) => setFormData({ ...formData, motDePasse: e.target.value })}
                    placeholder={editingUser ? 'Laissez vide pour ne pas changer' : ''}
                  />
                </div>
              </div>
              <div className="mb-3">
                <label className="form-label">Rôles</label>
                <div className="d-flex flex-wrap gap-2">
                  {roles.map(role => (
                    <div className="form-check" key={role.id}>
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id={`role-${role.id}`}
                        checked={formData.roleIds.includes(String(role.id))}
                        onChange={() => handleRoleToggle(role.id)}
                      />
                      <label className="form-check-label" htmlFor={`role-${role.id}`}>
                        {role.name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => { setShowModal(false); resetForm(); }}>Annuler</button>
              <button type="button" className="btn btn-primary" onClick={handleCreateOrUpdate} disabled={creating}>
                {creating ? (editingUser ? 'Modification...' : 'Création...') : (editingUser ? 'Modifier' : 'Créer')}
              </button>
            </div>
          </div>
        </div>
      </div>
      {showModal && <div className="modal-backdrop fade show"></div>}
    </>
  );
};

const Boutique = () => {
  const { user, roles } = useUser();
  const normalizedRoles = roles.map((r: string) => (r || '').replace(/^ROLE_/i, '').toUpperCase());
  const isSuperAdmin = normalizedRoles.includes('SUPERADMIN') || (user?.typeUtilisateur || '').toUpperCase() === 'SUPERADMIN';
  const [boutiques, setBoutiques] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [newBoutique, setNewBoutique] = useState({ nom: '', quartier: '', adresse: '', telephone: '', logo: null as File | null });
  const [editingBoutique, setEditingBoutique] = useState<any>(null);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');

  const fetchBoutiques = async () => {
    try {
      const token = localStorage.getItem('smb_token');
      const res = await fetch('http://localhost:8085/api/boutiques', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Erreur lors du chargement des boutiques');
      const data = await res.json();
      setBoutiques(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBoutiques();
  }, []);

  const handleCreateOrUpdate = async () => {
    if (!isSuperAdmin) {
      setMessage('Accès lecture seule pour les boutiques.');
      return;
    }
    if (!newBoutique.nom.trim() || !newBoutique.adresse.trim()) {
      setMessage('Veuillez remplir au moins le nom et l\'adresse.');
      return;
    }
    setCreating(true);
    setMessage('');
    try {
      const token = localStorage.getItem('smb_token');
      const method = editingBoutique ? 'PUT' : 'POST';
      const url = editingBoutique ? `http://localhost:8085/api/boutiques/${editingBoutique.id}` : 'http://localhost:8085/api/boutiques';

      const formData = new FormData();
      formData.append('nom', newBoutique.nom);
      formData.append('quartier', newBoutique.quartier);
      formData.append('adresse', newBoutique.adresse);
      formData.append('telephone', newBoutique.telephone);
      if (newBoutique.logo) {
        formData.append('logo', newBoutique.logo);
      }

      const res = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Erreur lors de la ${editingBoutique ? 'modification' : 'création'}`);
      }
      setShowModal(false);
      setNewBoutique({ nom: '', quartier: '', adresse: '', telephone: '', logo: null });
      setEditingBoutique(null);
      setMessage(`Boutique ${editingBoutique ? 'modifiée' : 'créée'} avec succès !`);
      fetchBoutiques();
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!isSuperAdmin) {
      setMessage('Accès lecture seule pour les boutiques.');
      return;
    }
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
      const res = await fetch(`http://localhost:8085/api/boutiques/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Erreur lors de la suppression');
      setMessage('Boutique supprimée avec succès !');
      fetchBoutiques();
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setMessage(err.message);
    }
  };

  const filteredBoutiques = boutiques.filter((boutique: any) =>
    boutique.nom.toLowerCase().includes(search.toLowerCase()) ||
    boutique.quartier.toLowerCase().includes(search.toLowerCase()) ||
    boutique.adresse.toLowerCase().includes(search.toLowerCase())
  );

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
          <h5>Boutique</h5>
          {isSuperAdmin && (
            <button className="btn btn-light" onClick={() => { setEditingBoutique(null); setNewBoutique({ nom: '', quartier: '', adresse: '', telephone: '', logo: null }); setShowModal(true); }}>+ Nouvelle Boutique</button>
          )}
        </div>
        <div className="card-body">
          <div className="mb-3">
            <input
              type="text"
              className="form-control"
              placeholder="Rechercher par nom, quartier ou adresse..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <table className="table table-striped">
            <thead>
              <tr>
                <th>N°</th>
                <th>Nom</th>
                <th>Quartier</th>
                <th>Adresse</th>
                <th>Téléphone</th>
                {isSuperAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filteredBoutiques.map((boutique: any, index: number) => (
                <tr key={boutique.id}>
                  <td>{index + 1}</td>
                  <td>{boutique.nom}</td>
                  <td>{boutique.quartier}</td>
                  <td>{boutique.adresse}</td>
                  <td>{boutique.telephone}</td>
                  {isSuperAdmin && (
                    <td>
                      <button className="btn btn-sm btn-warning me-2" title="Modifier" onClick={() => { setEditingBoutique(boutique); setNewBoutique({ nom: boutique.nom, quartier: boutique.quartier, adresse: boutique.adresse, telephone: boutique.telephone, logo: boutique.logo }); setShowModal(true); }}><i className="ti ti-pencil"></i></button>
                      <button className="btn btn-sm btn-danger" title="Supprimer" onClick={() => handleDelete(boutique.id)}><i className="ti ti-trash"></i></button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal for creating/editing boutique */}
      <div className={`modal fade ${showModal ? 'show' : ''}`} style={{ display: showModal ? 'block' : 'none' }} tabIndex={-1}>
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">{editingBoutique ? 'Modifier la Boutique' : 'Créer une Boutique'}</h5>
              <button type="button" className="btn-close" onClick={() => { setShowModal(false); setEditingBoutique(null); setNewBoutique({ nom: '', quartier: '', adresse: '', telephone: '', logo: null }); }}></button>
            </div>
            <div className="modal-body">
              <div className="mb-3">
                <label className="form-label">Nom</label>
                <input
                  type="text"
                  className="form-control"
                  value={newBoutique.nom}
                  onChange={(e) => setNewBoutique({ ...newBoutique, nom: e.target.value })}
                  placeholder="Nom de la boutique"
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Quartier</label>
                <input
                  type="text"
                  className="form-control"
                  value={newBoutique.quartier}
                  onChange={(e) => setNewBoutique({ ...newBoutique, quartier: e.target.value })}
                  placeholder="Quartier"
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Adresse</label>
                <input
                  type="text"
                  className="form-control"
                  value={newBoutique.adresse}
                  onChange={(e) => setNewBoutique({ ...newBoutique, adresse: e.target.value })}
                  placeholder="Adresse complète"
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Téléphone</label>
                <input
                  type="text"
                  className="form-control"
                  value={newBoutique.telephone}
                  onChange={(e) => setNewBoutique({ ...newBoutique, telephone: e.target.value })}
                  placeholder="Numéro de téléphone"
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Logo</label>
                <input
                  type="file"
                  className="form-control"
                  accept="image/*"
                  onChange={(e) => setNewBoutique({ ...newBoutique, logo: e.target.files ? e.target.files[0] : null })}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => { setShowModal(false); setEditingBoutique(null); setNewBoutique({ nom: '', quartier: '', adresse: '', telephone: '', logo: null }); }}>Annuler</button>
              <button type="button" className="btn btn-primary" onClick={handleCreateOrUpdate} disabled={creating}>
                {creating ? (editingBoutique ? 'Modification...' : 'Création...') : (editingBoutique ? 'Modifier' : 'Créer')}
              </button>
            </div>
          </div>
        </div>
      </div>
      {showModal && <div className="modal-backdrop fade show"></div>}
    </>
  );
};

const Unite = () => {
  const { roles, currentBoutique } = useUser();
  const [unites, setUnites] = useState([]);
  const [boutiques, setBoutiques] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [newUnite, setNewUnite] = useState({ libelle: '', symbole: '', /* conversionUnite: '', */ boutiqueId: '' });
  const [editingUnite, setEditingUnite] = useState<any>(null);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');

  const isSuperAdmin = () => {
    if (!roles || roles.length === 0) return false;
    return roles.some((r: any) => {
      const name = typeof r === 'string' ? r : (r?.name || '');
      return name.toUpperCase().includes('SUPERADMIN');
    });
  };

  const resetForm = () => {
    setNewUnite({
      libelle: '',
      symbole: '',
      /* conversionUnite: '', */
      boutiqueId: isSuperAdmin() ? '' : (currentBoutique?.id?.toString() || '')
    });
  };

  const fetchUnites = async () => {
    try {
      const token = localStorage.getItem('smb_token');
      const res = await fetch('http://localhost:8085/api/unites', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Erreur lors du chargement des unités');
      const data = await res.json();
      setUnites(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchBoutiques = async () => {
    try {
      const token = localStorage.getItem('smb_token');
      const res = await fetch('http://localhost:8085/api/boutiques', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Erreur lors du chargement des boutiques');
      const data = await res.json();
      setBoutiques(data);
    } catch (err: any) {
      setError(err.message);
    }
  };

  useEffect(() => {
    fetchUnites();
    fetchBoutiques();
  }, []);

  useEffect(() => {
    if (!isSuperAdmin() && currentBoutique?.id) {
      setNewUnite((prev) => ({ ...prev, boutiqueId: currentBoutique.id.toString() }));
    }
  }, [currentBoutique]);

  const handleCreateOrUpdate = async () => {
    if (!newUnite.libelle.trim() || !newUnite.symbole.trim()) {
      setMessage('Veuillez remplir tous les champs.');
      return;
    }
    /* const parsedConversion = parseFloat(newUnite.conversionUnite as any);
    if (isNaN(parsedConversion) || parsedConversion <= 0) {
      setMessage('Conversion invalide. Saisir un nombre positif.');
      return;
    } */
    if (isSuperAdmin() && !newUnite.boutiqueId) {
      setMessage('Sélectionnez une boutique.');
      return;
    }

    setCreating(true);
    setMessage('');
    try {
      const token = localStorage.getItem('smb_token');
      const method = editingUnite ? 'PUT' : 'POST';
      const url = editingUnite ? `http://localhost:8085/api/unites/${editingUnite.id}` : 'http://localhost:8085/api/unites';
      const payload: any = {
        libelle: newUnite.libelle,
        symbole: newUnite.symbole,
        /* conversionUnite: parsedConversion */
      };
      if (newUnite.boutiqueId) {
        payload.boutique = { id: newUnite.boutiqueId };
      }
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Erreur lors de la ${editingUnite ? 'modification' : 'création'}`);
      }
      setShowModal(false);
      resetForm();
      setEditingUnite(null);
      setMessage(`Unité ${editingUnite ? 'modifiée' : 'créée'} avec succès !`);
      fetchUnites();
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setMessage(err.message);
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
      const res = await fetch(`http://localhost:8085/api/unites/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Erreur lors de la suppression');
      setMessage('Unité supprimée avec succès !');
      fetchUnites();
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setMessage(err.message);
    }
  };

  const filteredUnites = unites.filter((unite: any) => {
    const target = `${unite.libelle || ''} ${unite.symbole || ''} /* ${unite.conversionUnite || ''} */ ${unite.boutique?.nom || ''}`.toLowerCase();
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
          <h5>Unités</h5>
          <button className="btn btn-light" onClick={() => { setEditingUnite(null); resetForm(); setShowModal(true); }}>+ Unité</button>
        </div>
        <div className="card-body">
          <div className="mb-3">
            <input
              type="text"
              className="form-control"
              placeholder="Rechercher par libellé, symbole ou boutique..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <table className="table table-striped">
            <thead>
              <tr>
                <th>N°</th>
                <th>Libellé</th>
                <th>Symbole</th>
                {/* <th>Conversion</th> */}
                <th>Boutique</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUnites.map((unite: any, index: number) => (
                <tr key={unite.id}>
                  <td>{index + 1}</td>
                  <td>{unite.libelle}</td>
                  <td>{unite.symbole}</td>
                  {/* <td>{unite.conversionUnite}</td> */}
                  <td>{unite.boutique?.nom || 'N/A'}</td>
                  <td>
                    <button className="btn btn-sm btn-warning me-2" title="Modifier" onClick={() => { setEditingUnite(unite); setNewUnite({ libelle: unite.libelle || '', symbole: unite.symbole || '', /* conversionUnite: `${unite.conversionUnite ?? ''}`, */ boutiqueId: unite.boutique?.id ? unite.boutique.id.toString() : (currentBoutique?.id?.toString() || '') }); setShowModal(true); }}><i className="ti ti-pencil"></i></button>
                    <button className="btn btn-sm btn-danger" title="Supprimer" onClick={() => handleDelete(unite.id)}><i className="ti ti-trash"></i></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal for creating/editing unite */}
      <div className={`modal fade ${showModal ? 'show' : ''}`} style={{ display: showModal ? 'block' : 'none' }} tabIndex={-1}>
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">{editingUnite ? 'Modifier l\'unité' : 'Créer une unité'}</h5>
              <button type="button" className="btn-close" onClick={() => { setShowModal(false); setEditingUnite(null); resetForm(); }}></button>
            </div>
            <div className="modal-body">
              <div className="mb-3">
                <label className="form-label">Libellé</label>
                <input
                  type="text"
                  className="form-control"
                  value={newUnite.libelle}
                  onChange={(e) => setNewUnite({ ...newUnite, libelle: e.target.value })}
                  placeholder="Ex: Kilogramme"
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Symbole</label>
                <input
                  type="text"
                  className="form-control"
                  value={newUnite.symbole}
                  onChange={(e) => setNewUnite({ ...newUnite, symbole: e.target.value })}
                  placeholder="Ex: kg"
                />
              </div>
              {/* <div className="mb-3">
                <label className="form-label">Conversion</label>
                <input
                  type="number"
                  className="form-control"
                  value={newUnite.conversionUnite}
                  onChange={(e) => setNewUnite({ ...newUnite, conversionUnite: e.target.value })}
                  placeholder="Ex: 1"
                  min="0"
                  step="0.0001"
                />
              </div> */}
              <div className="mb-3">
                <label className="form-label">Boutique</label>
                {isSuperAdmin() ? (
                  <select
                    className="form-control"
                    value={newUnite.boutiqueId}
                    onChange={(e) => setNewUnite({ ...newUnite, boutiqueId: e.target.value })}
                  >
                    <option value="">Sélectionner une boutique</option>
                    {boutiques.map((boutique: any) => (
                      <option key={boutique.id} value={boutique.id}>{boutique.nom}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    className="form-control"
                    value={currentBoutique?.nom || ''}
                    disabled
                  />
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => { setShowModal(false); setEditingUnite(null); resetForm(); }}>Annuler</button>
              <button type="button" className="btn btn-primary" onClick={handleCreateOrUpdate} disabled={creating}>
                {creating ? (editingUnite ? 'Modification...' : 'Création...') : (editingUnite ? 'Modifier' : 'Créer')}
              </button>
            </div>
          </div>
        </div>
      </div>
      {showModal && <div className="modal-backdrop fade show"></div>}
    </>
  );
};

const Magasins = () => {
  const [magasins, setMagasins] = useState([]);
  const [boutiques, setBoutiques] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [newMagasin, setNewMagasin] = useState({ nom: '', adresse: '', boutiqueId: '' });
  const [editingMagasin, setEditingMagasin] = useState<any>(null);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');

  const fetchMagasins = async () => {
    try {
      const token = localStorage.getItem('smb_token');
      const res = await fetch('http://localhost:8085/api/magasins', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Erreur lors du chargement des magasins');
      const data = await res.json();
      setMagasins(data);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const fetchBoutiques = async () => {
    try {
      const token = localStorage.getItem('smb_token');
      const res = await fetch('http://localhost:8085/api/boutiques', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Erreur lors du chargement des boutiques');
      const data = await res.json();
      setBoutiques(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMagasins();
    fetchBoutiques();
  }, []);

  const handleCreateOrUpdate = async () => {
    if (!newMagasin.nom.trim() || !newMagasin.adresse.trim() || !newMagasin.boutiqueId) {
      setMessage('Veuillez remplir tous les champs.');
      return;
    }
    setCreating(true);
    setMessage('');
    try {
      const token = localStorage.getItem('smb_token');
      const method = editingMagasin ? 'PUT' : 'POST';
      const url = editingMagasin ? `http://localhost:8085/api/magasins/${editingMagasin.id}` : 'http://localhost:8085/api/magasins';
      const body = {
        nom: newMagasin.nom,
        adresse: newMagasin.adresse,
        boutique: { id: newMagasin.boutiqueId }
      };
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Erreur lors de la ${editingMagasin ? 'modification' : 'création'}`);
      }
      setShowModal(false);
      setNewMagasin({ nom: '', adresse: '', boutiqueId: '' });
      setEditingMagasin(null);
      setMessage(`Magasin ${editingMagasin ? 'modifié' : 'créé'} avec succès !`);
      fetchMagasins();
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setMessage(err.message);
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
      const res = await fetch(`http://localhost:8085/api/magasins/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Erreur lors de la suppression');
      setMessage('Magasin supprimé avec succès !');
      fetchMagasins();
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setMessage(err.message);
    }
  };

  const filteredMagasins = magasins.filter((magasin: any) =>
    magasin.nom.toLowerCase().includes(search.toLowerCase()) ||
    magasin.adresse.toLowerCase().includes(search.toLowerCase()) ||
    magasin.boutique?.nom.toLowerCase().includes(search.toLowerCase())
  );

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
          <h5>Magasins</h5>
          <button className="btn btn-light" onClick={() => { setEditingMagasin(null); setNewMagasin({ nom: '', adresse: '', boutiqueId: '' }); setShowModal(true); }}>+ Nouveau Magasin</button>
        </div>
        <div className="card-body">
          <div className="mb-3">
            <input
              type="text"
              className="form-control"
              placeholder="Rechercher par nom, adresse ou boutique..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <table className="table table-striped">
            <thead>
              <tr>
                <th>N°</th>
                <th>Nom</th>
                <th>Adresse</th>
                <th>Boutique</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMagasins.map((magasin: any, index: number) => (
                <tr key={magasin.id}>
                  <td>{index + 1}</td>
                  <td>{magasin.nom}</td>
                  <td>{magasin.adresse}</td>
                  <td>{magasin.boutique?.nom || 'N/A'}</td>
                  <td>
                    <button className="btn btn-sm btn-warning me-2" title="Modifier" onClick={() => { setEditingMagasin(magasin); setNewMagasin({ nom: magasin.nom, adresse: magasin.adresse, boutiqueId: magasin.boutique?.id || '' }); setShowModal(true); }}><i className="ti ti-pencil"></i></button>
                    <button className="btn btn-sm btn-danger" title="Supprimer" onClick={() => handleDelete(magasin.id)}><i className="ti ti-trash"></i></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal for creating/editing magasin */}
      <div className={`modal fade ${showModal ? 'show' : ''}`} style={{ display: showModal ? 'block' : 'none' }} tabIndex={-1}>
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">{editingMagasin ? 'Modifier le Magasin' : 'Créer un Magasin'}</h5>
              <button type="button" className="btn-close" onClick={() => { setShowModal(false); setEditingMagasin(null); setNewMagasin({ nom: '', adresse: '', boutiqueId: '' }); }}></button>
            </div>
            <div className="modal-body">
              <div className="mb-3">
                <label className="form-label">Nom</label>
                <input
                  type="text"
                  className="form-control"
                  value={newMagasin.nom}
                  onChange={(e) => setNewMagasin({ ...newMagasin, nom: e.target.value })}
                  placeholder="Nom du magasin"
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Adresse</label>
                <input
                  type="text"
                  className="form-control"
                  value={newMagasin.adresse}
                  onChange={(e) => setNewMagasin({ ...newMagasin, adresse: e.target.value })}
                  placeholder="Adresse complète"
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Boutique</label>
                <select
                  className="form-control"
                  value={newMagasin.boutiqueId}
                  onChange={(e) => setNewMagasin({ ...newMagasin, boutiqueId: e.target.value })}
                >
                  <option value="">Sélectionner une boutique</option>
                  {boutiques.map((boutique: any) => (
                    <option key={boutique.id} value={boutique.id}>{boutique.nom}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => { setShowModal(false); setEditingMagasin(null); setNewMagasin({ nom: '', adresse: '', boutiqueId: '' }); }}>Annuler</button>
              <button type="button" className="btn btn-primary" onClick={handleCreateOrUpdate} disabled={creating}>
                {creating ? (editingMagasin ? 'Modification...' : 'Création...') : (editingMagasin ? 'Modifier' : 'Créer')}
              </button>
            </div>
          </div>
        </div>
      </div>
      {showModal && <div className="modal-backdrop fade show"></div>}
    </>
  );
};

const AssignerPermissions = () => {
  const apiBaseUrl = (window as any)?.APP_CONFIG?.API_BASE_URL || 'http://localhost:8085';
  const { user, roles, currentBoutique } = useUser();
  const [users, setUsers] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedUserPermissions, setSelectedUserPermissions] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const allowedRoles = ['SUPERADMIN', 'PROPRIETAIRE', 'ADMINISTRATEUR', 'ADMIN'];

  const normalizeRole = (value: string) => (value || '').replace(/^ROLE_/i, '').toUpperCase();

  const getUserRoleLabel = (user: any) => {
    if (user?.typeUtilisateur) return normalizeRole(user.typeUtilisateur);
    if (Array.isArray(user?.roles) && user.roles.length > 0) {
      const firstRole = user.roles[0];
      if (firstRole?.name) return normalizeRole(firstRole.name);
    }
    return normalizeRole(user?.role || '');
  };

  const currentRole = useMemo(() => {
    if (Array.isArray(roles) && roles.length > 0) {
      const firstRole = roles[0];
      if (typeof firstRole === 'string') return normalizeRole(firstRole);
      if ((firstRole as any)?.name) return normalizeRole((firstRole as any).name);
    }
    return normalizeRole(user?.typeUtilisateur || '');
  }, [roles, user]);

  const allowedNormalized = useMemo(() => allowedRoles.map(normalizeRole), []);
  const hasAccess = allowedNormalized.includes(currentRole);

  const fetchUsers = async () => {
    const token = localStorage.getItem('smb_token');
    if (!token) {
      setError('Token non disponible. Veuillez vous reconnecter.');
      setLoading(false);
      return;
    }
    try {
      const response = await fetch(`${apiBaseUrl}/api/utilisateurs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) {
        throw new Error("Erreur lors du chargement des utilisateurs");
      }
      let data = await response.json();

      const currentId = user?.id;
      const boutiqueId = currentBoutique?.id;
      data = data
        .filter((u: any) => u.id !== currentId)
        .filter((u: any) => {
          if (!boutiqueId) return true;
          return u.boutique?.id === boutiqueId;
        });

      setUsers(data);
    } catch (err: any) {
      setError(err.message || 'Erreur inconnue');
    }
  };

  const fetchPermissions = async () => {
    const token = localStorage.getItem('smb_token');
    if (!token) return;
    try {
      const response = await fetch(`${apiBaseUrl}/api/admin/permissions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) {
        throw new Error("Erreur lors du chargement des permissions");
      }
      const data = await response.json();
      setPermissions(data);
    } catch (err: any) {
      setError(err.message || 'Erreur inconnue');
    }
  };

  const fetchUserPermissions = async (userId: number) => {
    const token = localStorage.getItem('smb_token');
    if (!token) return;
    try {
      const response = await fetch(`${apiBaseUrl}/api/admin/utilisateurs/${userId}/permissions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) {
        throw new Error("Erreur lors du chargement des permissions de l'utilisateur");
      }
      const data = await response.json();
      setSelectedUserPermissions(new Set(data.map((p: any) => p.id)));
    } catch (err: any) {
      setError(err.message || 'Erreur inconnue');
    }
  };

  useEffect(() => {
    if (!hasAccess) {
      setLoading(false);
      return;
    }
    const load = async () => {
      setLoading(true);
      setError('');
      await Promise.all([fetchUsers(), fetchPermissions()]);
      setLoading(false);
    };
    load();
  }, [hasAccess, currentBoutique]);

  const filteredUsers = users.filter((user: any) => {
    const target = `${user.prenom || ''} ${user.nom || ''} ${user.email || ''}`.toLowerCase();
    return target.includes(search.toLowerCase());
  });

  const permissionsByModule = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    permissions.forEach((permission: any) => {
      const code = permission.code || permission.name || '';
      const module = code.split('_')[0] || 'AUTRE';
      if (!grouped[module]) grouped[module] = [];
      grouped[module].push(permission);
    });
    return grouped;
  }, [permissions]);

  const handleUserSelect = async (id: number) => {
    setSelectedUserId(id);
    setSelectedUserPermissions(new Set());
    await fetchUserPermissions(id);
  };

  const togglePermission = (permissionId: number) => {
    setSelectedUserPermissions(prev => {
      const next = new Set(prev);
      if (next.has(permissionId)) {
        next.delete(permissionId);
      } else {
        next.add(permissionId);
      }
      return next;
    });
  };

  const toggleModulePermissions = (module: string, checked: boolean) => {
    setSelectedUserPermissions(prev => {
      const next = new Set(prev);
      (permissionsByModule[module] || []).forEach((p: any) => {
        if (checked) {
          next.add(p.id);
        } else {
          next.delete(p.id);
        }
      });
      return next;
    });
  };

  const savePermissions = async () => {
    if (!selectedUserId) {
      Swal.fire('Action impossible', 'Sélectionnez un utilisateur', 'warning');
      return;
    }
    const token = localStorage.getItem('smb_token');
    if (!token) {
      Swal.fire('Session expirée', 'Veuillez vous reconnecter', 'error');
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/admin/utilisateurs/${selectedUserId}/permissions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(Array.from(selectedUserPermissions))
      });
      if (!response.ok) {
        throw new Error('Erreur lors de la sauvegarde des permissions');
      }
      Swal.fire('Succès', 'Permissions mises à jour', 'success');
      await fetchUserPermissions(selectedUserId);
    } catch (err: any) {
      Swal.fire('Erreur', err.message || 'Une erreur est survenue', 'error');
    } finally {
      setSaving(false);
    }
  };

  const totalCount = permissions.length;
  const selectedCount = selectedUserPermissions.size;

  if (!hasAccess) {
    return (
      <div className="alert alert-warning">
        Accès refusé. Cette fonctionnalité est réservée aux administrateurs.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '200px' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Chargement...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="alert alert-danger">{error}</div>;
  }

  return (
    <div className="row">
      <div className="col-md-4">
        <div className="card h-100">
          <div className="card-header d-flex justify-content-between align-items-center bg-light">
            <div>
              <h6 className="mb-0">Utilisateurs</h6>
              <small className="text-muted">Sélectionnez un utilisateur</small>
            </div>
          </div>
          <div className="card-body">
            <input
              type="text"
              className="form-control mb-3"
              placeholder="Rechercher par nom ou email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="list-group" style={{ maxHeight: '420px', overflowY: 'auto' }}>
              {filteredUsers.map((user: any) => (
                <button
                  key={user.id}
                  type="button"
                  className={`list-group-item list-group-item-action ${selectedUserId === user.id ? 'active' : ''}`}
                  onClick={() => handleUserSelect(user.id)}
                >
                  <div className="d-flex w-100 justify-content-between">
                    <h6 className="mb-1">{user.prenom} {user.nom}</h6>
                    <small className="badge bg-secondary">{getUserRoleLabel(user)}</small>
                  </div>
                  <small className="text-muted">{user.email}</small>
                </button>
              ))}
              {filteredUsers.length === 0 && (
                <div className="text-muted text-center py-3">Aucun utilisateur</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="col-md-8">
        <div className="card h-100">
          <div className="card-header d-flex justify-content-between align-items-center bg-light">
            <div>
              <h6 className="mb-0">Permissions</h6>
              <small className="text-muted">
                {selectedUserId ? 'Sélectionnez les permissions à attribuer' : 'Choisissez un utilisateur'}
              </small>
            </div>
            <div>
              <span className="badge bg-primary">{selectedCount}/{totalCount}</span>
            </div>
          </div>
          <div className="card-body" style={{ maxHeight: '520px', overflowY: 'auto' }}>
            {!selectedUserId && (
              <div className="text-center text-muted py-5">
                <i className="fas fa-user-lock fa-2x mb-2"></i>
                <p className="mb-0">Sélectionnez un utilisateur pour gérer ses permissions</p>
              </div>
            )}

            {selectedUserId && Object.keys(permissionsByModule).sort().map((module) => {
              const modulePermissions = permissionsByModule[module];
              const allChecked = modulePermissions.every((p: any) => selectedUserPermissions.has(p.id));
              const someChecked = modulePermissions.some((p: any) => selectedUserPermissions.has(p.id));
              return (
                <div className="mb-3" key={module}>
                  <div className="d-flex justify-content-between align-items-center bg-light px-2 py-2">
                    <div className="d-flex align-items-center gap-2">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={allChecked}
                        ref={(el) => {
                          if (el) el.indeterminate = !allChecked && someChecked;
                        }}
                        onChange={(e) => toggleModulePermissions(module, e.target.checked)}
                      />
                      <strong>{module}</strong>
                      <span className="badge bg-secondary">{modulePermissions.length}</span>
                    </div>
                  </div>
                  <table className="table table-sm align-middle mb-2">
                    <tbody>
                      {modulePermissions.map((permission: any) => {
                        const action = (permission.code || permission.name || '').split('_')[1] || permission.name;
                        const isChecked = selectedUserPermissions.has(permission.id);
                        return (
                          <tr key={permission.id} className={isChecked ? 'table-success' : ''}>
                            <td style={{ width: '50px' }}>
                              <input
                                type="checkbox"
                                className="form-check-input"
                                checked={isChecked}
                                onChange={() => togglePermission(permission.id)}
                              />
                            </td>
                            <td style={{ width: '160px' }} className="text-uppercase small fw-bold">{action}</td>
                            <td className="small">{permission.description || '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
          <div className="card-footer d-flex justify-content-between align-items-center">
            <small className="text-muted">{selectedCount} permission(s) sélectionnée(s)</small>
            <button className="btn btn-primary" onClick={savePermissions} disabled={saving || !selectedUserId}>
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const Permissions = () => {
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [newPermName, setNewPermName] = useState('');
  const [newPermDesc, setNewPermDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [editingPerm, setEditingPerm] = useState<any>(null);

  const getModuleName = (name: string) => {
    const prefix = name.split('_')[0];
    const modules: { [key: string]: string } = {
      'TABLEAU_DE_BORD': 'Tableau de Bord',
      'UTILISATEUR': 'Utilisateurs',
      'PRODUIT': 'Produits',
      'COMMANDE': 'Commandes',
      'CLIENT': 'Clients',
      'VENTE': 'Ventes',
      'INVENTAIRE': 'Inventaire',
      'FOURNISSEUR': 'Fournisseurs',
      'BOUTIQUE': 'Boutiques',
      'RAPPORT': 'Rapports',
      'PARAMETRES': 'Paramètres'
    };
    return modules[prefix] || prefix;
  };

  const fetchPermissions = async () => {
    try {
      const token = localStorage.getItem('smb_token');
      const res = await fetch('http://localhost:8085/api/permissions', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Erreur lors du chargement des permissions');
      const data = await res.json();
      setPermissions(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPermissions();
  }, []);

  const handleCreateOrUpdate = async () => {
    if (!newPermName.trim() || !newPermDesc.trim()) {
      setMessage('Veuillez remplir tous les champs.');
      return;
    }
    setCreating(true);
    setMessage('');
    try {
      const token = localStorage.getItem('smb_token');
      const method = editingPerm ? 'PUT' : 'POST';
      const url = editingPerm ? `http://localhost:8085/api/permissions/${editingPerm.id}` : 'http://localhost:8085/api/permissions';
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: newPermName, description: newPermDesc })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Erreur lors de la ${editingPerm ? 'modification' : 'création'}`);
      }
      setShowModal(false);
      setNewPermName('');
      setNewPermDesc('');
      setEditingPerm(null);
      setMessage(`Permission ${editingPerm ? 'modifiée' : 'créée'} avec succès !`);
      fetchPermissions();
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setMessage(err.message);
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
      const res = await fetch(`http://localhost:8085/api/permissions/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Erreur lors de la suppression');
      setMessage('Permission supprimée avec succès !');
      fetchPermissions();
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setMessage(err.message);
    }
  };

  const sortedPermissions = [...permissions].sort((a: any, b: any) => {
    const moduleA = getModuleName(a.name);
    const moduleB = getModuleName(b.name);
    return moduleA.localeCompare(moduleB);
  });

  const filteredPermissions = sortedPermissions.filter((perm: any) =>
    perm.name.toLowerCase().includes(search.toLowerCase()) ||
    perm.description.toLowerCase().includes(search.toLowerCase())
  );

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
          <h5>Permissions</h5>
          <button className="btn btn-light" onClick={() => { setEditingPerm(null); setNewPermName(''); setNewPermDesc(''); setShowModal(true); }}>+ Nouvelle Permission</button>
        </div>
        <div className="card-body">
          <div className="mb-3">
            <input
              type="text"
              className="form-control"
              placeholder="Rechercher par nom ou description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <table className="table table-striped">
            <thead>
              <tr>
                <th>N°</th>
                <th>Module</th>
                <th>Nom</th>
                <th>Description</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPermissions.map((perm: any, index: number) => (
                <tr key={perm.id}>
                  <td>{index + 1}</td>
                  <td>{getModuleName(perm.name)}</td>
                  <td>{perm.name}</td>
                  <td>{perm.description}</td>
                  <td>
                    <button className="btn btn-sm btn-warning me-2" title="Modifier" onClick={() => { setEditingPerm(perm); setNewPermName(perm.name); setNewPermDesc(perm.description); setShowModal(true); }}><i className="ti ti-pencil"></i></button>
                    <button className="btn btn-sm btn-danger" title="Supprimer" onClick={() => handleDelete(perm.id)}><i className="ti ti-trash"></i></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal for creating permission */}
      <div className={`modal fade ${showModal ? 'show' : ''}`} style={{ display: showModal ? 'block' : 'none' }} tabIndex={-1}>
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">{editingPerm ? 'Modifier la Permission' : 'Créer une Permission'}</h5>
              <button type="button" className="btn-close" onClick={() => { setShowModal(false); setEditingPerm(null); setNewPermName(''); setNewPermDesc(''); }}></button>
            </div>
            <div className="modal-body">
              <div className="mb-3">
                <label className="form-label">Nom de la Permission</label>
                <input
                  type="text"
                  className="form-control"
                  value={newPermName}
                  onChange={(e) => setNewPermName(e.target.value)}
                  placeholder="Ex: NOUVELLE_PERMISSION"
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Description</label>
                <textarea
                  className="form-control"
                  value={newPermDesc}
                  onChange={(e) => setNewPermDesc(e.target.value)}
                  placeholder="Description de la permission"
                ></textarea>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => { setShowModal(false); setEditingPerm(null); setNewPermName(''); setNewPermDesc(''); }}>Annuler</button>
              <button type="button" className="btn btn-primary" onClick={handleCreateOrUpdate} disabled={creating}>
                {creating ? (editingPerm ? 'Modification...' : 'Création...') : (editingPerm ? 'Modifier' : 'Créer')}
              </button>
            </div>
          </div>
        </div>
      </div>
      {showModal && <div className="modal-backdrop fade show"></div>}
    </>
  );
};

export default Configuration;