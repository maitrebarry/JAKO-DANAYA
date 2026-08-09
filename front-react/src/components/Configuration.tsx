import { useState, useEffect, useMemo, useRef } from 'react';
import { useUser } from '../contexts/UserContext';
import ConfigurationMarges from './ConfigurationMarges';
import Swal from 'sweetalert2';
import useHasPermission from '../contexts/useHasPermission';
import RequirePermission from './RequirePermission';
import PhoneWithDial from './PhoneWithDial';
import { withApi, API, API_BASE } from '../config/api';

const Configuration = () => {
  const { roles } = useUser();
  const [selectedSub, setSelectedSub] = useState('liste-utilisateurs');
  const [pendingPermissionUserId, setPendingPermissionUserId] = useState<number | null>(null);
  const normalizedRoles = roles.map(r => r.toUpperCase());
  const isSuperAdmin = normalizedRoles.includes('SUPERADMIN');

  const renderContent = () => {
    switch (selectedSub) {
      case 'liste-utilisateurs':
        return (
          <ListeUtilisateurs
            onUserCreated={(userId) => {
              setPendingPermissionUserId(userId);
              setSelectedSub('assigner-permissions');
            }}
          />
        );
      case 'boutique':
        return <Boutique />;
      case 'magasins':
        return <Magasins />;
      case 'unite':
        return <Unite />;
      case 'permissions':
        return <Permissions />;
      case 'assigner-permissions':
        return (
          <AssignerPermissions
            initialUserId={pendingPermissionUserId}
            onInitialUserConsumed={() => setPendingPermissionUserId(null)}
          />
        );
      case 'marges':
        return <ConfigurationMarges />;
      case 'abonnement-tarifs':
        return <ConfigurationAbonnementTarifs />;
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
            <div className="card-header d-flex justify-content-between align-items-center bg-primary text-white">
              <h6>MENU de Configuration</h6>
            </div>
            <div className="list-group list-group-flush">
              <a
                href="#"
                className={`list-group-item list-group-item-action ${selectedSub === 'liste-utilisateurs' ? 'active' : ''}`}
                style={{ cursor: 'pointer' }}
                onClick={(e) => { e.preventDefault(); setSelectedSub('liste-utilisateurs'); }}
              >
                Liste utilisateurs
              </a>
              <a
                href="#"
                className={`list-group-item list-group-item-action ${selectedSub === 'boutique' ? 'active' : ''}`}
                style={{ cursor: 'pointer' }}
                onClick={(e) => { e.preventDefault(); setSelectedSub('boutique'); }}
              >
                Boutique
              </a>
              <a
                href="#"
                className={`list-group-item list-group-item-action ${selectedSub === 'magasins' ? 'active' : ''}`}
                style={{ cursor: 'pointer' }}
                onClick={(e) => { e.preventDefault(); setSelectedSub('magasins'); }}
              >
                Magasins
              </a>
              <a
                href="#"
                className={`list-group-item list-group-item-action ${selectedSub === 'unite' ? 'active' : ''}`}
                style={{ cursor: 'pointer' }}
                onClick={(e) => { e.preventDefault(); setSelectedSub('unite'); }}
              >
                Unité
              </a>
              {isSuperAdmin && (
                <a
                  href="#"
                  className={`list-group-item list-group-item-action ${selectedSub === 'permissions' ? 'active' : ''}`}
                  style={{ cursor: 'pointer' }}
                  onClick={(e) => { e.preventDefault(); setSelectedSub('permissions'); }}
                >
                  Permissions
                </a>
              )}
              <a
                href="#"
                className={`list-group-item list-group-item-action ${selectedSub === 'assigner-permissions' ? 'active' : ''}`}
                style={{ cursor: 'pointer' }}
                onClick={(e) => { e.preventDefault(); setSelectedSub('assigner-permissions'); }}
              >
                Assigner des permissions
              </a>
              <a
                href="#"
                className={`list-group-item list-group-item-action ${selectedSub === 'marges' ? 'active' : ''}`}
                style={{ cursor: 'pointer' }}
                onClick={(e) => { e.preventDefault(); setSelectedSub('marges'); }}
              >
                Marges (configuration)
              </a>
              {isSuperAdmin && (
                <a
                  href="#"
                  className={`list-group-item list-group-item-action ${selectedSub === 'abonnement-tarifs' ? 'active' : ''}`}
                  style={{ cursor: 'pointer' }}
                  onClick={(e) => { e.preventDefault(); setSelectedSub('abonnement-tarifs'); }}
                >
                  Tarifs abonnement
                </a>
              )}
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

const ListeUtilisateurs = ({ onUserCreated }: { onUserCreated?: (userId: number) => void }) => {
  const [users, setUsers] = useState<any[]>([]);
  const [boutiques, setBoutiques] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [paysList, setPaysList] = useState<any[]>([]);
  const [assignableRoleIds, setAssignableRoleIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [phoneCodePays, setPhoneCodePays] = useState<string | null>(null);
  const [userTelephoneValid, setUserTelephoneValid] = useState<boolean | null>(null);

  const canCreateUser = useHasPermission('UTILISATEUR_CREER');
  const canModifyUser = useHasPermission('UTILISATEUR_MODIFIER');
  const canToggleUser = useHasPermission('UTILISATEUR_ACTIVER_DESACTIVER');
  const [togglingUserId, setTogglingUserId] = useState<number | null>(null);

  const { roles: sessionRoles, currentBoutique, user: currentUser } = useUser();
  const normalizedRoles = sessionRoles.map(r => (r || '').replace(/^ROLE_/i, '').toUpperCase());
  const isAdminOrProprio = normalizedRoles.some(r => ['ADMINISTRATEUR', 'PROPRIETAIRE', 'SUPERADMIN'].includes(r));
  const isSuperAdmin = normalizedRoles.includes('SUPERADMIN') || (currentUser as any)?.typeUtilisateur === 'SUPERADMIN';

  const [formData, setFormData] = useState({
    id: null as number | null,
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
  });

  const typeOptions = [
    { value: 'SUPERADMIN', label: 'Super admin' },
    { value: 'ADMINISTRATEUR', label: 'Administrateur' },
    { value: 'GERANT_BOUTIQUE', label: 'Gérant boutique' },
    { value: 'CAISSIER', label: 'Caissier' },
    { value: 'MAGASINIER', label: 'Magasinier' }
  ];

  const normalizeRoleName = (value: string) => (value || '').replace(/^ROLE_/i, '').toUpperCase();

  const roleCandidatesByType: Record<string, string[]> = {
    SUPERADMIN: ['SUPERADMIN'],
    ADMINISTRATEUR: ['ADMINISTRATEUR', 'ADMIN'],
    GERANT_BOUTIQUE: ['GERANT_BOUTIQUE', 'GERANT', 'MANAGER'],
    CAISSIER: ['CAISSIER', 'CASHIER'],
    MAGASINIER: ['MAGASINIER', 'STOREKEEPER']
  };

  const getRoleIdForType = (typeValue: string) => {
    const candidates = roleCandidatesByType[typeValue] || [typeValue];
    const match = roles.find((r: any) => candidates.includes(normalizeRoleName(r?.name || '')));
    return match?.id;
  };

  // Determine which type options are allowed to be shown based on current user's role
  const forbiddenTypes = new Set<string>();
  if (normalizedRoles.includes('SUPERADMIN')) {
    forbiddenTypes.add('SUPERADMIN');
  } else if (normalizedRoles.includes('ADMINISTRATEUR')) {
    forbiddenTypes.add('SUPERADMIN');
    forbiddenTypes.add('ADMINISTRATEUR');
  } else if (normalizedRoles.includes('GERANT_BOUTIQUE')) {
    forbiddenTypes.add('SUPERADMIN');
    forbiddenTypes.add('ADMINISTRATEUR');
    forbiddenTypes.add('GERANT_BOUTIQUE');
  } else {
    forbiddenTypes.add('SUPERADMIN');
    forbiddenTypes.add('ADMINISTRATEUR');
    forbiddenTypes.add('GERANT_BOUTIQUE');
  }

  const filteredTypeOptions = typeOptions.filter(opt => !forbiddenTypes.has(opt.value));

  const statutOptions = [
    { value: 'ACTIF', label: 'Actif' },
    { value: 'INACTIF', label: 'Inactif' }
  ];

  const resetForm = () => {
    setFormData({
      id: null,
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
      roleIds: []
    });
    setPhoneCodePays(null);
    setUserTelephoneValid(null);
  };

  useEffect(() => {
    if (formData.id) return;
    const roleId = getRoleIdForType(formData.typeUtilisateur);
    if (!roleId) return;
    const nextRoleId = String(roleId);
    if (formData.roleIds.length !== 1 || formData.roleIds[0] !== nextRoleId) {
      setFormData(prev => ({ ...prev, roleIds: [nextRoleId] }));
    }
  }, [formData.typeUtilisateur, roles, formData.id]);

  const isMountedRef = useRef(true);

  const loadUsers = async () => {
    setLoading(true);
    setError('');
    const token = localStorage.getItem('smb_token');
    if (!token) {
      setError('Vous devez être connecté pour accéder à cette section.');
      setLoading(false);
      return;
    }

    try {
      // Chargement en parallèle pour plus de rapidité
      const [usersRes, boutiquesRes, rolesRes, assignableRes, paysRes] = await Promise.all([
        fetch(withApi('users'), {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(withApi('boutiques'), {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(withApi('roles'), {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API}/admin/assignable-roles`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API}/pays`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (usersRes.status === 401) {
        throw new Error("Vous n'avez pas les droits pour consulter les utilisateurs.");
      }
      if (!usersRes.ok) throw new Error('Impossible de charger les utilisateurs.');
      if (!boutiquesRes.ok) throw new Error('Erreur lors du chargement des boutiques.');
      if (rolesRes.status === 401) {
        console.warn("Accès refusé pour les rôles");
      }

      const usersData = await usersRes.json().catch(() => []);
      const boutiquesData = await boutiquesRes.json().catch(() => []);
      const rolesData = rolesRes.ok ? await rolesRes.json().catch(() => []) : [];
      const assignableData = assignableRes.ok ? await assignableRes.json().catch(() => []) : [];
      const paysData = paysRes.ok ? await paysRes.json().catch(() => []) : [];

      if (isMountedRef.current) {
        setUsers(usersData || []);
        setBoutiques(boutiquesData || []);
        setRoles(rolesData || []);
        setAssignableRoleIds((assignableData || []).map((r: any) => r.id));
        setPaysList(paysData || []);
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        setError(err.message || 'Erreur lors du chargement des données');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    loadUsers();
    return () => { isMountedRef.current = false; };
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
    // Validation
    if (!formData.nom.trim() || !formData.email.trim() || !formData.boutiqueId) {
      setMessage('Nom, email et boutique sont obligatoires.');
      return;
    }
    
    const isEdit = !!formData.id;
    if (isEdit && currentUser?.id != null && Number(formData.id) === Number(currentUser.id)) {
      await Swal.fire('Action interdite', "Vous ne pouvez pas modifier vos informations ici. Utilisez plutôt votre Profil.", 'warning');
      return;
    }
    if (isEdit && !canModifyUser) { 
      Swal.fire('Erreur', "Vous n'avez pas la permission de modifier des utilisateurs", 'error');
      return; 
    }
    if (!isEdit && !canCreateUser) { 
      Swal.fire('Erreur', "Vous n'avez pas la permission de créer des utilisateurs", 'error');
      return; 
    }
    if (!isEdit && !formData.motDePasse.trim()) {
      Swal.fire('Erreur', 'Le mot de passe est requis pour créer un utilisateur.', 'error');
      return;
    }
    if (formData.contact && formData.contact.trim() && userTelephoneValid !== true) {
      Swal.fire('Erreur', 'Le numéro de téléphone est invalide ou incomplet pour le pays sélectionné', 'error');
      return;
    }

    setCreating(true);
    setMessage('');
    try {
      const token = localStorage.getItem('smb_token');
      const method = isEdit ? 'PUT' : 'POST';
      const url = isEdit 
        ? `${API}/users/${formData.id}` 
        : `${API}/users`;
      
      const payload: any = {
        nom: formData.nom,
        prenom: formData.prenom,
        email: formData.email,
        pseudo: formData.pseudo || formData.email.split('@')[0],
        contact: formData.contact,
        codePays: phoneCodePays || (currentBoutique?.pays?.codeIso || 'ML'),
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
        Swal.fire('Erreur', errData.message || `Erreur lors de la ${isEdit ? 'modification' : 'création'}`, 'error');
        return;
      }

      const savedUser = await res.json().catch(() => null);

      setShowModal(false);
      await Swal.fire('Succès', `Utilisateur ${isEdit ? 'modifié' : 'créé'} avec succès !`, 'success');
      setMessage(`Utilisateur ${isEdit ? 'modifié' : 'créé'} avec succès !`);
      resetForm();
      loadUsers();
      if (!isEdit && savedUser?.id && onUserCreated) {
        onUserCreated(savedUser.id);
      }
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      Swal.fire('Erreur', err.message, 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: number) => {
    const target = users.find((u: any) => Number(u.id) === Number(id)) as any;
    const label = target
      ? (target.email || `${target.nom || ''} ${target.prenom || ''}`.trim() || `#${id}`)
      : `#${id}`;

    const result = await Swal.fire({
      title: 'Suppression définitive',
      html: `Cette action supprimera <strong>${label}</strong> ET <strong>toutes ses données</strong> :`
        + ` ventes, commandes, réceptions, livraisons, inventaires, transferts, mouvements, caisse et notifications.`
        + `<br><br><span style="color:#d33">⚠️ Irréversible. Le stock et la caisse de la boutique ne seront pas recalculés.</span>`
        + `<br><br>Saisissez <strong>SUPPRIMER</strong> pour confirmer.`,
      icon: 'warning',
      input: 'text',
      inputPlaceholder: 'SUPPRIMER',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Supprimer définitivement',
      cancelButtonText: 'Annuler',
      reverseButtons: true,
      preConfirm: (value) => {
        if (String(value || '').trim().toUpperCase() !== 'SUPPRIMER') {
          Swal.showValidationMessage('Tapez SUPPRIMER pour confirmer.');
          return false;
        }
        return true;
      },
    });

    if (!result.isConfirmed) return;

    try {
      const token = localStorage.getItem('smb_token');
      const res = await fetch(`${API}/users/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.message || body?.details || 'Erreur lors de la suppression');

      await Swal.fire(
        'Supprimé',
        `Utilisateur supprimé (${body?.totalDeleted ?? 0} enregistrement(s) effacé(s)).`,
        'success'
      );
      loadUsers();
    } catch (err: any) {
      Swal.fire('Erreur', err.message || 'Erreur lors de la suppression', 'error');
    }
  };

  const handleToggleStatus = async (user: any) => {
    if (currentUser?.id != null && user?.id === currentUser.id) {
      await Swal.fire('Action interdite', "Vous ne pouvez pas activer/désactiver votre propre compte.", 'warning');
      return;
    }
    const target = user.statut === 'ACTIF' ? 'INACTIF' : 'ACTIF';
    const result = await Swal.fire({
      title: `${target === 'ACTIF' ? 'Activer' : 'Désactiver'} l'utilisateur ?`,
      text: `Voulez-vous ${target === 'ACTIF' ? 'activer' : 'désactiver'} ${user.email || user.nom || ''} ?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: target === 'ACTIF' ? 'Oui, activer' : 'Oui, désactiver',
      cancelButtonText: 'Annuler'
    });

    if (!result.isConfirmed) return;

    try {
      setTogglingUserId(user.id);
      const token = localStorage.getItem('smb_token');
      const res = await fetch(`${API}/users/${user.id}/statut`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ statut: target })
      });
      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        throw new Error(errBody || 'Erreur lors de la modification du statut');
      }
      setMessage(`Utilisateur ${target === 'ACTIF' ? 'activé' : 'désactivé'} avec succès !`);
      loadUsers();
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setMessage(err.message || 'Erreur');
    } finally {
      setTogglingUserId(null);
    }
  };

  const cleanIndicatif = (indic?: string) => {
    if (!indic) return '';
    return String(indic).replace(/[^0-9]/g, '');
  };

  const extractDialFromContact = (contact?: string) => {
    if (!contact) return '';
    const cleaned = String(contact).replace(/[^0-9+]/g, '');
    // Prefer leading + then digits
    const m = cleaned.match(/^\+?(\d{1,4})/);
    return m ? m[1] : '';
  };

  const handleEdit = (user: any) => {
    if (currentUser?.id != null && user?.id === currentUser.id) {
      Swal.fire('Action interdite', "Vous ne pouvez pas modifier vos informations ici. Utilisez plutôt votre Profil.", 'warning');
      return;
    }
    setFormData({
      id: user.id,
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
    // Infer country from existing contact if possible to avoid mismatch
    const dial = extractDialFromContact(user.contact);
    let inferredCode: string | null = null;
    if (dial && paysList && paysList.length > 0) {
      const found = paysList.find((p: any) => cleanIndicatif(p.indicatif) === dial);
      if (found && found.codeIso) {
        inferredCode = String(found.codeIso).toUpperCase();
      }
    }
    setPhoneCodePays(inferredCode || user.codePays || (user.boutique && user.boutique.pays ? user.boutique.pays.codeIso : (currentBoutique?.pays?.codeIso || 'ML')));
    // Le numéro existant est présumé valide tant qu'il n'est pas retouché dans le formulaire
    setUserTelephoneValid(user.contact ? true : null);
    setShowModal(true);
  };

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users;
    
    const searchTerm = search.toLowerCase();
    return users.filter(user => {
      const fullName = `${user.nom || ''} ${user.prenom || ''}`.toLowerCase();
      const email = (user.email || '').toLowerCase();
      const pseudo = (user.pseudo || '').toLowerCase();
      const boutique = (user.boutique?.nom || '').toLowerCase();
      
      return fullName.includes(searchTerm) || 
             email.includes(searchTerm) || 
             pseudo.includes(searchTerm) || 
             boutique.includes(searchTerm);
    });
  }, [users, search]);

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
        <div className="card-header d-flex justify-content-between align-items-center bg-primary text-white">
          <h5>Utilisateurs</h5>
          {canCreateUser && (
            <button 
              className="btn btn-light" 
              onClick={() => { 
                resetForm(); 
                setShowModal(true); 
              }}
              disabled={loading}
            >
              + Nouvel utilisateur
            </button>
          )}
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
            <table className="table table-striped table-hover">
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
                {loading ? (
                  <tr>
                    <td colSpan={10} className="text-center text-muted py-3">
                      <div className="spinner-border spinner-border-sm me-2" role="status"></div>
                      Chargement des utilisateurs...
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center text-muted py-3">
                      {search ? "Aucun utilisateur trouvé" : "Aucun utilisateur"}
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user: any, index: number) => (
                    <tr key={user.id} className="align-middle">
                      <td>{index + 1}</td>
                      <td>{user.nom}</td>
                      <td>{user.prenom}</td>
                      <td>{user.email}</td>
                      <td>{user.pseudo}</td>
                      <td>{user.boutique?.nom || 'N/A'}</td>
                      <td>
                        <span className={`badge ${
                          user.typeUtilisateur === 'SUPERADMIN' ? 'bg-danger' :
                          user.typeUtilisateur === 'ADMINISTRATEUR' ? 'bg-warning' :
                          user.typeUtilisateur === 'GERANT_BOUTIQUE' ? 'bg-primary' :
                          user.typeUtilisateur === 'CAISSIER' ? 'bg-success' :
                          user.typeUtilisateur === 'MAGASINIER' ? 'bg-info' :
                          'bg-secondary'
                        }`}>
                          {user.typeUtilisateur}
                        </span>
                      </td>
                      <td>
                        <div className="d-flex align-items-center">
                          <span className={`badge ${user.statut === 'ACTIF' ? 'bg-success' : 'bg-danger'}`}>
                            {user.statut}
                          </span>
                          {canToggleUser && currentUser?.id !== user.id && (
                            <button
                              className="btn btn-sm btn-outline-secondary ms-2"
                              title={user.statut === 'ACTIF' ? 'Désactiver' : 'Activer'}
                              onClick={() => handleToggleStatus(user)}
                              disabled={togglingUserId === user.id}
                            >
                              <i className={`ti ${user.statut === 'ACTIF' ? 'ti-power' : 'ti-power-off'} fs-5`}></i>
                            </button>
                          )}
                        </div>
                      </td>
                      <td>
                        <small>
                          {(user.roles || []).map((role: any) => role.name).join(', ')}
                        </small>
                      </td>
                      <td>
                        <div className="btn-group" role="group">
                          {canModifyUser && currentUser?.id !== user.id && (
                            <button 
                              className="btn btn-sm btn-outline-warning" 
                              title="Modifier" 
                              onClick={() => handleEdit(user)}
                            >
                              <i className="ti ti-pencil"></i>
                            </button>
                          )}
                          {isSuperAdmin && (
                            <RequirePermission permission="UTILISATEUR_SUPPRIMER">
                              <button
                                className="btn btn-sm btn-outline-danger ms-1"
                                title="Supprimer"
                                onClick={() => handleDelete(user.id)}
                              >
                                <i className="ti ti-trash"></i>
                              </button>
                            </RequirePermission>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal */}
      <div className={`modal fade ${showModal ? 'show' : ''}`} style={{ display: showModal ? 'block' : 'none' }} tabIndex={-1}>
        <div className="modal-dialog modal-lg modal-fullscreen-sm-down">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">{formData.id ? "Modifier l'utilisateur" : 'Créer un utilisateur'}</h5>
              <button 
                type="button" 
                className="btn-close" 
                onClick={() => { 
                  setShowModal(false); 
                  resetForm(); 
                }}
              ></button>
            </div>
            
            <div className="modal-body">
              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label">Nom *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.nom}
                    onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                    required
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
                  <label className="form-label">Email *</label>
                  <input
                    type="email"
                    className="form-control"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label">Contact</label>
                  <PhoneWithDial value={formData.contact} defaultCountry={phoneCodePays || currentBoutique?.pays?.codeIso || 'ML'} onChange={(tel, code, valid) => { setFormData(prev => ({ ...prev, contact: tel || '' })); setPhoneCodePays(code || null); setUserTelephoneValid(typeof valid === 'boolean' ? valid : null); }} />
                </div>
              </div>

              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label">Boutique *</label>
                  <select
                    className="form-control"
                    value={formData.boutiqueId}
                    onChange={(e) => setFormData({ ...formData, boutiqueId: e.target.value })}
                    required
                  >
                    <option value="">Sélectionner une boutique</option>
                    {boutiques.map((boutique: any) => (
                      <option key={boutique.id} value={boutique.id}>{boutique.nom}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label">Type</label>
                  <select
                    className="form-control"
                    value={formData.typeUtilisateur}
                    onChange={(e) => {
                      const nextType = e.target.value;
                      const roleId = getRoleIdForType(nextType);
                      setFormData({
                        ...formData,
                        typeUtilisateur: nextType,
                        roleIds: roleId ? [String(roleId)] : []
                      });
                    }}
                  >
                    {(() => {
                      const optionsToShow = [...filteredTypeOptions];
                      if (formData.typeUtilisateur && !optionsToShow.find(o => o.value === formData.typeUtilisateur)) {
                        optionsToShow.push({ value: formData.typeUtilisateur, label: formData.typeUtilisateur });
                      }
                      return optionsToShow.map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ));
                    })()}
                  </select>
                </div>
              </div>

              <div className="row">
                <div className="col-md-6 mb-3">
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
                <div className="col-md-6 mb-3">
                  <label className="form-label">
                    Mot de passe {!formData.id && '*'}
                  </label>
                  <input
                    type="password"
                    className="form-control"
                    value={formData.motDePasse}
                    onChange={(e) => setFormData({ ...formData, motDePasse: e.target.value })}
                    placeholder={formData.id ? 'Laissez vide pour ne pas changer' : 'Obligatoire pour la création'}
                    required={!formData.id}
                  />
                  {formData.id && (
                    <small className="text-muted">Laissez vide pour conserver le mot de passe actuel</small>
                  )}
                </div>
              </div>
              
              <div className="mb-3">
                <label className="form-label">Rôles</label>
                <div className="d-flex flex-wrap gap-2">
                  {roles.map(role => {
                    const assigned = formData.roleIds.includes(String(role.id));
                    const allowed = assignableRoleIds.length === 0 || assignableRoleIds.includes(role.id);
                    const creationLocked = !formData.id;
                    return (
                      <div className="form-check" key={role.id}>
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id={`role-${role.id}`}
                          checked={assigned}
                          onChange={() => !creationLocked && handleRoleToggle(role.id)}
                          disabled={creationLocked || (!allowed && !assigned)}
                        />
                        <label className="form-check-label" htmlFor={`role-${role.id}`}>
                          {role.name}{!allowed && ' (non assignable)'}
                        </label>
                      </div>
                    );
                  })}
                  {roles.length === 0 && (
                    <div className="text-muted">Aucun rôle disponible</div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="modal-footer">
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => { 
                  setShowModal(false); 
                  resetForm(); 
                }}
              >
                Annuler
              </button>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={handleCreateOrUpdate} 
                disabled={creating}
              >
                {creating ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                    {formData.id ? 'Modification...' : 'Création...'}
                  </>
                ) : (
                  formData.id ? 'Modifier' : 'Créer'
                )}
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
  const { roles, currentBoutique, setUserData } = useUser();
  const normalizedRoles = roles.map((r: string) => (r || '').replace(/^ROLE_/i, '').toUpperCase());
  const isSuperAdmin = normalizedRoles.includes('SUPERADMIN');
  const [boutiques, setBoutiques] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [newBoutique, setNewBoutique] = useState({
    id: null as number | null,
    nom: '', 
    quartier: '', 
    adresse: '', 
    logo: null as File | null 
  });
  const [boutiqueCodePays, setBoutiqueCodePays] = useState<string | null>(null);
  const [paysList, setPaysList] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [selectedPlanCode, setSelectedPlanCode] = useState<'MENSUEL' | 'TRIMESTRIEL' | 'SEMESTRIEL' | 'ANNUEL' | 'ACHAT'>('MENSUEL');
  const [initialPlanCodeForEdit, setInitialPlanCodeForEdit] = useState<string | null>(null);

  // Load countries for boutique creation (flags + symbole monnaie). If backend has few seeds, enrich from restcountries.com
  const fetchPays = async () => {
    try {
      const token = localStorage.getItem('smb_token');
      const res = await fetch(`${API}/pays`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const backendPays = res.ok ? await res.json() : [];

      let merged = backendPays || [];
      // If backend has only a small seed set, fetch global list from restcountries and merge
      if (!backendPays || backendPays.length < 10) {
        let enriched = null;
        // Try restcountries first
        try {
          const rc = await fetch('https://restcountries.com/v3.1/all');
          if (rc.ok) {
            const rcData: any[] = await rc.json();
            const rcMapped = rcData.map((c: any) => {
              const code = (c.cca2 || c.cca3 || '').toUpperCase();
              const name = c?.name?.common || code;
              const iddRoot = c?.idd?.root || '';
              const suffix = (c?.idd?.suffixes && c.idd.suffixes.length > 0) ? c.idd.suffixes[0] : '';
              const indicatif = iddRoot ? `${iddRoot}${suffix}` : '';
              const curKeys = c?.currencies ? Object.keys(c.currencies) : [];
              const deviseSymbole = curKeys.length ? (c.currencies[curKeys[0]].symbol || curKeys[0]) : '';
              const deviseCode = curKeys.length ? curKeys[0] : '';
              const drapeau = c?.flags?.png || '';
              return { codeIso: code, nom: name, indicatif, deviseSymbole, deviseCode, drapeau };
            });
            enriched = rcMapped;
          }
        } catch (err) {
          console.warn('Restcountries inacessible, essayer fallback intl-tel-input');
        }

        // If restcountries failed, try extracting country data from intl-tel-input (bundled in the lib)
        if (!enriched) {
          try {
            await import('intl-tel-input');
            // global helper exposed by the library
            const globals: any = (window as any).intlTelInputGlobals || (window as any).intlTelInput ? (window as any).intlTelInputGlobals : null;
            const raw = globals && typeof globals.getCountryData === 'function' ? globals.getCountryData() : (globals && globals?.countries ? globals.countries : null);
            if (raw && raw.length) {
              const mapped = (raw as any[]).map(c => ({ codeIso: (c.iso2 || '').toUpperCase(), nom: c.name, indicatif: c.dialCode ? `+${c.dialCode}` : '', deviseSymbole: '', deviseCode: '', drapeau: '' }));
              enriched = mapped;
            }
          } catch (err) {
            console.warn('Impossible d\'extraire la liste depuis intl-tel-input');
          }
        }

        if (enriched) {
          // Merge & prefer backend entries when present
          const map = new Map<string, any>();
          enriched.forEach(p => map.set(p.codeIso, p));
          (backendPays || []).forEach((p: any) => map.set((p.codeIso || '').toUpperCase(), p));
          merged = Array.from(map.values()).sort((a, b) => (a.nom || '').localeCompare(b.nom || ''));
        }
      }

      setPaysList(merged);
    } catch (err: any) {
      console.error('Erreur chargement pays :', err);
    }
  };

  useEffect(() => {
    fetchPays();
  }, []);

  const fetchBoutiques = async () => {
    try {
      const token = localStorage.getItem('smb_token');
      const res = await fetch(`${API}/boutiques`, {
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
    const isEdit = !!newBoutique.id;
    setCreating(true);
    setMessage('');
    
    try {
      const token = localStorage.getItem('smb_token');
      const method = isEdit ? 'PUT' : 'POST';
      const url = isEdit 
        ? `${API}/boutiques/${newBoutique.id}` 
        : `${API}/boutiques`;

      const formData = new FormData();
      formData.append('nom', newBoutique.nom);
      formData.append('quartier', newBoutique.quartier);
      formData.append('adresse', newBoutique.adresse);
      if (boutiqueCodePays) {
        formData.append('codePays', boutiqueCodePays);
      }
      if (!isEdit) {
        formData.append('planCode', selectedPlanCode);
      }
      if (newBoutique.logo) {
        formData.append('logo', newBoutique.logo);
      }

      const res = await fetch(url, {
        method,
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const msg = errData && errData.message ? errData.message : `Erreur lors de la ${isEdit ? 'modification' : 'création'}`;
        await Swal.fire('Erreur', msg, 'error');
        throw new Error(msg);
      }

      // parse created/updated boutique
      const savedBoutique = await res.json().catch(() => null);

      // If editing and plan changed, rotate/activate a new subscription period with selected plan.
      if (isEdit && savedBoutique?.id && selectedPlanCode && selectedPlanCode !== (initialPlanCodeForEdit || '')) {
        try {
          const subRes = await fetch(`${API}/admin/subscriptions/boutiques/${savedBoutique.id}/activate`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ planCode: selectedPlanCode }),
          });
          if (!subRes.ok) {
            const txt = await subRes.text().catch(() => '');
            console.warn('Plan abonnement non mis à jour:', txt || subRes.status);
            const details = (txt || '').trim();
            await Swal.fire(
              'Attention',
              `Boutique modifiée, mais le plan d'abonnement n'a pas pu être mis à jour.${details ? `\n\nDétail: ${details}` : ''}`,
              'warning'
            );
          }
        } catch (e) {
          console.warn('Erreur mise à jour abonnement:', e);
        }
      }

      setShowModal(false);
      setNewBoutique({ id: null, nom: '', quartier: '', adresse: '', logo: null });
      setSelectedPlanCode('MENSUEL');
      setInitialPlanCodeForEdit(null);
      await Swal.fire('Succès', `Boutique ${isEdit ? 'modifiée' : 'créée'} avec succès !`, 'success');

      // If this boutique is the current boutique in the user context, refresh it so currentBoutique has full pays info
      try {
        if (savedBoutique && currentBoutique && savedBoutique.id === (currentBoutique as any).id) {
          // fetch full boutique and update user context
          const bRes = await fetch(`${API}/boutiques/${savedBoutique.id}`, { headers: { 'Authorization': `Bearer ${token}` } });
          if (bRes.ok) {
            const full = await bRes.json();
            // Update stored user data in localStorage and via setUserData so components react
            try {
              const userDataStr = localStorage.getItem('smb_user_data');
              if (userDataStr) {
                const ud = JSON.parse(userDataStr);
                ud.currentBoutique = full;
                localStorage.setItem('smb_user_data', JSON.stringify(ud));
                setUserData(ud);
              } else {
                setUserData({ user: null, permissions: [], roles: [], currentBoutique: full });
              }
            } catch (e) {
              // fallback: set only currentBoutique
              setUserData({ user: null, permissions: [], roles: [], currentBoutique: full });
            }
          }
        }
      } catch (e) { /* ignore */ }

      fetchBoutiques();
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      await Swal.fire('Erreur', err.message || 'Une erreur est survenue', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!isSuperAdmin) {
      setMessage('Accès lecture seule pour les boutiques.');
      return;
    }

    const boutique = boutiques.find((item: any) => Number(item.id) === Number(id)) as any;
    if (!boutique) {
      setMessage('Boutique introuvable.');
      return;
    }

    const result = await Swal.fire({
      title: 'Suppression définitive',
      html: `Cette action supprimera <strong>${boutique.nom}</strong> ainsi que tous ses utilisateurs, produits, stocks, commandes, ventes, paiements et historiques.<br><br>Saisissez exactement <strong>${boutique.nom}</strong> pour confirmer.`,
      icon: 'warning',
      input: 'text',
      inputPlaceholder: boutique.nom,
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Supprimer définitivement',
      cancelButtonText: 'Annuler',
      reverseButtons: true,
      preConfirm: (value) => {
        if (String(value || '').trim().toLowerCase() !== String(boutique.nom).trim().toLowerCase()) {
          Swal.showValidationMessage('Le nom saisi ne correspond pas à la boutique.');
          return false;
        }
        return value;
      },
    });
    
    if (!result.isConfirmed) return;
    
    try {
      const token = localStorage.getItem('smb_token');
      const res = await fetch(`${API}/boutiques/${id}?confirmation=${encodeURIComponent(boutique.nom)}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message || body?.error || 'Erreur lors de la suppression');
      
      setMessage(`Boutique supprimée avec succès (${body?.totalDeleted || 0} enregistrements nettoyés).`);
      fetchBoutiques();
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setMessage(err.message);
    }
  };

  const handleEdit = (boutique: any) => {
    setNewBoutique({
      id: boutique.id,
      nom: boutique.nom || '',
      quartier: boutique.quartier || '',
      adresse: boutique.adresse || '',
      logo: null
    });
    setBoutiqueCodePays(boutique?.pays?.codeIso || 'ML');
    setSelectedPlanCode('MENSUEL');
    setInitialPlanCodeForEdit(null);
    setShowModal(true);

    // Load current plan for this boutique (best effort)
    (async () => {
      try {
        const token = localStorage.getItem('smb_token');
        const r = await fetch(`${API}/admin/subscriptions/boutiques/${boutique.id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        if (!r.ok) return;
        const d = await r.json();
        const code = (d?.plan_code || 'MENSUEL').toUpperCase();
        if (['MENSUEL','TRIMESTRIEL','SEMESTRIEL','ANNUEL','ACHAT'].includes(code)) {
          setSelectedPlanCode(code as any);
          setInitialPlanCodeForEdit(code);
        }
      } catch {
        // ignore
      }
    })();
  };

  const filteredBoutiques = useMemo(() => {
    if (!search.trim()) return boutiques;
    
    const searchTerm = search.toLowerCase();
    return boutiques.filter((boutique: any) =>
      boutique.nom.toLowerCase().includes(searchTerm) ||
      (boutique.quartier || '').toLowerCase().includes(searchTerm) ||
      boutique.adresse.toLowerCase().includes(searchTerm)
    );
  }, [boutiques, search]);

  if (loading) return (
    <div className="text-center p-5">
      <div className="spinner-border text-primary" role="status">
        <span className="visually-hidden">Chargement...</span>
      </div>
    </div>
  );
  
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
          <h5>Boutiques</h5>
          {isSuperAdmin && (
            <button 
              className="btn btn-light" 
              onClick={() => { 
                setNewBoutique({ id: null, nom: '', quartier: '', adresse: '', logo: null }); 
                setBoutiqueCodePays('ML'); // default country
                setSelectedPlanCode('MENSUEL');
                setInitialPlanCodeForEdit(null);
                setShowModal(true); 
              }}
            >
              + Nouvelle Boutique
            </button>
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
          
          <div className="table-responsive">
            <table className="table table-striped table-hover">
              <thead>
                <tr>
                  <th>N°</th>
                  <th>Nom</th>
                  <th>Quartier</th>
                  <th>Adresse</th>
                  {/* <th>Téléphone</th> */}
                  {isSuperAdmin && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filteredBoutiques.length === 0 ? (
                  <tr>
                    <td colSpan={isSuperAdmin ? 6 : 5} className="text-center text-muted py-3">
                      {search ? "Aucune boutique trouvée" : "Aucune boutique"}
                    </td>
                  </tr>
                ) : (
                  filteredBoutiques.map((boutique: any, index: number) => (
                    <tr key={boutique.id}>
                      <td>{index + 1}</td>
                      <td>{boutique.nom}</td>
                      <td>{boutique.quartier || '-'}</td>
                      <td>{boutique.adresse}</td>
                      {/* <td>{boutique.telephone || '-'}</td> */}
                      {isSuperAdmin && (
                        <td>
                          <div className="btn-group" role="group">
                            <button 
                              className="btn btn-sm btn-outline-warning" 
                              title="Modifier" 
                              onClick={() => handleEdit(boutique)}
                            >
                              <i className="ti ti-pencil"></i>
                            </button>
                            <button 
                              className="btn btn-sm btn-outline-danger ms-1" 
                              title="Supprimer" 
                              onClick={() => handleDelete(boutique.id)}
                            >
                              <i className="ti ti-trash"></i>
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal pour créer/modifier boutique */}
      {showModal && (
        <>
          <div className="modal fade show" style={{ display: 'block' }} tabIndex={-1}>
            <div className="modal-dialog">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">
                    {newBoutique.id ? 'Modifier la Boutique' : 'Créer une Boutique'}
                  </h5>
                  <button 
                    type="button" 
                    className="btn-close" 
                    onClick={() => { 
                      setShowModal(false); 
                      setNewBoutique({ id: null, nom: '', quartier: '', adresse: '', logo: null }); 
                      setSelectedPlanCode('MENSUEL');
                      setInitialPlanCodeForEdit(null);
                    }}
                  ></button>
                </div>
                
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Nom *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={newBoutique.nom}
                      onChange={(e) => setNewBoutique({ ...newBoutique, nom: e.target.value })}
                      placeholder="Nom de la boutique"
                      required
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
                    <label className="form-label">Adresse *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={newBoutique.adresse}
                      onChange={(e) => setNewBoutique({ ...newBoutique, adresse: e.target.value })}
                      placeholder="Adresse complète"
                      required
                    />
                  </div>
                  
                  <div className="mb-3">
                    <label className="form-label">Pays</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className={`iti__flag iti__${(boutiqueCodePays || 'ML').toLowerCase()}`} style={{ width: 28, height: 20, display: 'inline-block' }} />
                      <select className="form-select" value={boutiqueCodePays || ''} onChange={(e) => {
                        const code = e.target.value;
                        setBoutiqueCodePays(code);
                        // When a country is selected, clear the telephone field so the user enters the full number
                        // and mark it as invalid until a real number is entered/validated. Keep the indicatif separately.
                      }} style={{ maxWidth: 360 }}>
                        <option value="">Sélectionnez un pays</option>
                        {paysList.map(p => (
                          <option key={p.codeIso} value={p.codeIso}>{`${p.nom} (${p.deviseSymbole || ''})`}</option>
                        ))}
                      </select>
                      <div style={{ marginLeft: 8 }}>
                        <small className="text-muted">Devise: {(paysList.find(p => p.codeIso === (boutiqueCodePays || 'ML')) || { deviseSymbole: 'FCFA' }).deviseSymbole}</small>
                      </div>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Logo</label>
                    <input
                      type="file"
                      className="form-control"
                      accept="image/*"
                      onChange={(e) => setNewBoutique({ ...newBoutique, logo: e.target.files ? e.target.files[0] : null })}
                    />
                    <small className="text-muted">
                      Formats acceptés: JPG, PNG, GIF. Max 5MB.
                    </small>
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Plan d'abonnement {newBoutique.id ? '(modification)' : 'initial'}</label>
                    <select
                      className="form-select"
                      value={selectedPlanCode}
                      onChange={(e) => setSelectedPlanCode(e.target.value as any)}
                    >
                      <option value="MENSUEL">Mensuel</option>
                      <option value="TRIMESTRIEL">Trimestriel</option>
                      <option value="SEMESTRIEL">Semestriel</option>
                      <option value="ANNUEL">Annuel</option>
                      <option value="ACHAT">Licence achetée (à vie)</option>
                    </select>
                    <small className="text-muted">
                      {newBoutique.id
                        ? 'Si vous changez ce plan, un nouvel abonnement actif sera appliqué à cette boutique.'
                        : 'Ce plan sera activé automatiquement à la création de la boutique.'}
                    </small>
                  </div>
                </div>
                
                <div className="modal-footer">
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={() => { 
                      setShowModal(false); 
                      setNewBoutique({ id: null, nom: '', quartier: '', adresse: '', logo: null }); 
                      setSelectedPlanCode('MENSUEL');
                      setInitialPlanCodeForEdit(null);
                    }}
                  >
                    Annuler
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-primary" 
                    onClick={handleCreateOrUpdate} 
                    disabled={creating}
                  >
                    {creating ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                        {newBoutique.id ? 'Modification...' : 'Création...'}
                      </>
                    ) : (
                      newBoutique.id ? 'Modifier' : 'Créer'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show"></div>
        </>
      )}
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
  const [newUnite, setNewUnite] = useState({ 
    id: null as number | null,
    libelle: '', 
    symbole: '', 
    boutiqueId: currentBoutique?.id?.toString() || '' 
  });
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
    setNewUnite({
      id: null,
      libelle: '',
      symbole: '',
      boutiqueId: isSuperAdmin ? '' : (currentBoutique?.id?.toString() || '')
    });
  };

  const fetchUnites = async () => {
    try {
      const token = localStorage.getItem('smb_token');
      const res = await fetch(`${API}/unites`, {
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
      const res = await fetch(`${API}/boutiques`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Erreur lors du chargement des boutiques');
      const data = await res.json();
      setBoutiques(data);
    } catch (err: any) {
      console.error('Erreur chargement boutiques:', err);
    }
  };

  useEffect(() => {
    fetchUnites();
    fetchBoutiques();
  }, []);

  const handleCreateOrUpdate = async () => {
    if (!newUnite.libelle.trim() || !newUnite.symbole.trim()) {
      setMessage('Veuillez remplir tous les champs.');
      return;
    }
    
    if (isSuperAdmin && !newUnite.boutiqueId) {
      setMessage('Sélectionnez une boutique.');
      return;
    }

    const isEdit = !!newUnite.id;
    setCreating(true);
    setMessage('');
    
    try {
      const token = localStorage.getItem('smb_token');
      const method = isEdit ? 'PUT' : 'POST';
      const url = isEdit 
        ? `${API}/unites/${newUnite.id}` 
        : `${API}/unites`;
      
      const payload: any = {
        libelle: newUnite.libelle,
        symbole: newUnite.symbole,
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
        throw new Error(errData.message || `Erreur lors de la ${isEdit ? 'modification' : 'création'}`);
      }
      
      setShowModal(false);
      resetForm();
      setMessage(`Unité ${isEdit ? 'modifiée' : 'créée'} avec succès !`);
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
      const res = await fetch(`${API}/unites/${id}`, {
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

  const handleEdit = (unite: any) => {
    setNewUnite({
      id: unite.id,
      libelle: unite.libelle || '',
      symbole: unite.symbole || '',
      boutiqueId: unite.boutique?.id ? unite.boutique.id.toString() : (currentBoutique?.id?.toString() || '')
    });
    setShowModal(true);
  };

  const filteredUnites = useMemo(() => {
    if (!search.trim()) return unites;
    
    const searchTerm = search.toLowerCase();
    return unites.filter((unite: any) => {
      const libelle = (unite.libelle || '').toLowerCase();
      const symbole = (unite.symbole || '').toLowerCase();
      const boutique = (unite.boutique?.nom || '').toLowerCase();
      
      return libelle.includes(searchTerm) || 
             symbole.includes(searchTerm) || 
             boutique.includes(searchTerm);
    });
  }, [unites, search]);

  if (loading) return (
    <div className="text-center p-5">
      <div className="spinner-border text-primary" role="status">
        <span className="visually-hidden">Chargement...</span>
      </div>
    </div>
  );
  
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
          <h5>Unités</h5>
          <button 
            className="btn btn-light" 
            onClick={() => { 
              resetForm(); 
              setShowModal(true); 
            }}
          >
            + Unité
          </button>
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
          
          <div className="table-responsive">
            <table className="table table-striped table-hover">
              <thead>
                <tr>
                  <th>N°</th>
                  <th>Libellé</th>
                  <th>Symbole</th>
                  <th>Boutique</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUnites.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center text-muted py-3">
                      {search ? "Aucune unité trouvée" : "Aucune unité"}
                    </td>
                  </tr>
                ) : (
                  filteredUnites.map((unite: any, index: number) => (
                    <tr key={unite.id}>
                      <td>{index + 1}</td>
                      <td>{unite.libelle}</td>
                      <td>{unite.symbole}</td>
                      <td>{unite.boutique?.nom || 'N/A'}</td>
                      <td>
                        <div className="btn-group" role="group">
                          <button 
                            className="btn btn-sm btn-outline-warning" 
                            title="Modifier" 
                            onClick={() => handleEdit(unite)}
                          >
                            <i className="ti ti-pencil"></i>
                          </button>
                          <button 
                            className="btn btn-sm btn-outline-danger ms-1" 
                            title="Supprimer" 
                            onClick={() => handleDelete(unite.id)}
                          >
                            <i className="ti ti-trash"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal pour créer/modifier unité */}
      {showModal && (
        <>
          <div className="modal fade show" style={{ display: 'block' }} tabIndex={-1}>
            <div className="modal-dialog modal-fullscreen-sm-down">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">
                    {newUnite.id ? 'Modifier l\'unité' : 'Créer une unité'}
                  </h5>
                  <button 
                    type="button" 
                    className="btn-close" 
                    onClick={() => { 
                      setShowModal(false); 
                      resetForm(); 
                    }}
                  ></button>
                </div>
                
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Libellé *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={newUnite.libelle}
                      onChange={(e) => setNewUnite({ ...newUnite, libelle: e.target.value })}
                      placeholder="Ex: Kilogramme"
                      required
                    />
                  </div>
                  
                  <div className="mb-3">
                    <label className="form-label">Symbole *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={newUnite.symbole}
                      onChange={(e) => setNewUnite({ ...newUnite, symbole: e.target.value })}
                      placeholder="Ex: kg"
                      required
                    />
                  </div>
                  
                  <div className="mb-3">
                    <label className="form-label">Boutique</label>
                    {isSuperAdmin ? (
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
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={() => { 
                      setShowModal(false); 
                      resetForm(); 
                    }}
                  >
                    Annuler
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-primary" 
                    onClick={handleCreateOrUpdate} 
                    disabled={creating}
                  >
                    {creating ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                        {newUnite.id ? 'Modification...' : 'Création...'}
                      </>
                    ) : (
                      newUnite.id ? 'Modifier' : 'Créer'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show"></div>
        </>
      )}
    </>
  );
};

const Magasins = () => {
  const [magasins, setMagasins] = useState([]);
  const [boutiques, setBoutiques] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [newMagasin, setNewMagasin] = useState({ 
    id: null as number | null,
    nom: '', 
    adresse: '', 
    boutiqueId: '' 
  });
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');

  const fetchMagasins = async () => {
    try {
      const token = localStorage.getItem('smb_token');
      const res = await fetch(`${API}/magasins`, {
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
      const res = await fetch(`${API}/boutiques`, {
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
    
    const isEdit = !!newMagasin.id;
    setCreating(true);
    setMessage('');
    
    try {
      const token = localStorage.getItem('smb_token');
      const method = isEdit ? 'PUT' : 'POST';
      const url = isEdit 
        ? `${API}/magasins/${newMagasin.id}` 
        : `${API}/magasins`;
      
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
        throw new Error(errData.message || `Erreur lors de la ${isEdit ? 'modification' : 'création'}`);
      }
      
      setShowModal(false);
      setNewMagasin({ id: null, nom: '', adresse: '', boutiqueId: '' });
      setMessage(`Magasin ${isEdit ? 'modifié' : 'créé'} avec succès !`);
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
      const res = await fetch(`${API}/magasins/${id}`, {
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

  const handleEdit = (magasin: any) => {
    setNewMagasin({
      id: magasin.id,
      nom: magasin.nom,
      adresse: magasin.adresse,
      boutiqueId: magasin.boutique?.id || ''
    });
    setShowModal(true);
  };

  const filteredMagasins = useMemo(() => {
    if (!search.trim()) return magasins;
    
    const searchTerm = search.toLowerCase();
    return magasins.filter((magasin: any) =>
      (magasin.nom || '').toLowerCase().includes(searchTerm) ||
      (magasin.adresse || '').toLowerCase().includes(searchTerm) ||
      (magasin.boutique?.nom || '').toLowerCase().includes(searchTerm)
    );
  }, [magasins, search]);

  if (loading) return (
    <div className="text-center p-5">
      <div className="spinner-border text-primary" role="status">
        <span className="visually-hidden">Chargement...</span>
      </div>
    </div>
  );
  
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
          <h5>Magasins</h5>
          <button 
            className="btn btn-light" 
            onClick={() => { 
              setNewMagasin({ id: null, nom: '', adresse: '', boutiqueId: '' }); 
              setShowModal(true); 
            }}
          >
            + Nouveau Magasin
          </button>
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
          
          <div className="table-responsive">
            <table className="table table-striped table-hover">
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
                {filteredMagasins.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center text-muted py-3">
                      {search ? "Aucun magasin trouvé" : "Aucun magasin"}
                    </td>
                  </tr>
                ) : (
                  filteredMagasins.map((magasin: any, index: number) => (
                    <tr key={magasin.id}>
                      <td>{index + 1}</td>
                      <td>{magasin.nom}</td>
                      <td>{magasin.adresse}</td>
                      <td>{magasin.boutique?.nom || 'N/A'}</td>
                      <td>
                        <div className="btn-group" role="group">
                          <button 
                            className="btn btn-sm btn-outline-warning" 
                            title="Modifier" 
                            onClick={() => handleEdit(magasin)}
                          >
                            <i className="ti ti-pencil"></i>
                          </button>
                          <button 
                            className="btn btn-sm btn-outline-danger ms-1" 
                            title="Supprimer" 
                            onClick={() => handleDelete(magasin.id)}
                          >
                            <i className="ti ti-trash"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal pour créer/modifier magasin */}
      {showModal && (
        <>
          <div className="modal fade show" style={{ display: 'block' }} tabIndex={-1}>
            <div className="modal-dialog modal-fullscreen-sm-down">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">
                    {newMagasin.id ? 'Modifier le Magasin' : 'Créer un Magasin'}
                  </h5>
                  <button 
                    type="button" 
                    className="btn-close" 
                    onClick={() => { 
                      setShowModal(false); 
                      setNewMagasin({ id: null, nom: '', adresse: '', boutiqueId: '' }); 
                    }}
                  ></button>
                </div>
                
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Nom *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={newMagasin.nom}
                      onChange={(e) => setNewMagasin({ ...newMagasin, nom: e.target.value })}
                      placeholder="Nom du magasin"
                      required
                    />
                  </div>
                  
                  <div className="mb-3">
                    <label className="form-label">Adresse *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={newMagasin.adresse}
                      onChange={(e) => setNewMagasin({ ...newMagasin, adresse: e.target.value })}
                      placeholder="Adresse complète"
                      required
                    />
                  </div>
                  
                  <div className="mb-3">
                    <label className="form-label">Boutique *</label>
                    <select
                      className="form-control"
                      value={newMagasin.boutiqueId}
                      onChange={(e) => setNewMagasin({ ...newMagasin, boutiqueId: e.target.value })}
                      required
                    >
                      <option value="">Sélectionner une boutique</option>
                      {boutiques.map((boutique: any) => (
                        <option key={boutique.id} value={boutique.id}>{boutique.nom}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div className="modal-footer">
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={() => { 
                      setShowModal(false); 
                      setNewMagasin({ id: null, nom: '', adresse: '', boutiqueId: '' }); 
                    }}
                  >
                    Annuler
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-primary" 
                    onClick={handleCreateOrUpdate} 
                    disabled={creating}
                  >
                    {creating ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                        {newMagasin.id ? 'Modification...' : 'Création...'}
                      </>
                    ) : (
                      newMagasin.id ? 'Modifier' : 'Créer'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show"></div>
        </>
      )}
    </>
  );
};

const OWNER_TIER_TYPES = ['PROPRIETAIRE', 'ADMINISTRATEUR', 'ADMIN', 'OWNER'];
const MANAGER_TIER_TYPES = ['GERANT_BOUTIQUE', 'GERANT', 'MANAGER'];
const SUBORDINATE_TIER_TYPES = ['GERANT_BOUTIQUE', 'GERANT', 'MANAGER', 'MAGASINIER', 'STOREKEEPER', 'CAISSIER', 'CASHIER'];
const MANAGER_TARGET_TIER_TYPES = ['MAGASINIER', 'STOREKEEPER', 'CAISSIER', 'CASHIER'];

const AssignerPermissions = ({ initialUserId, onInitialUserConsumed }: { initialUserId?: number | null; onInitialUserConsumed?: () => void }) => {
  const { user, roles, permissions: sessionPermissions, currentBoutique } = useUser();
  const [users, setUsers] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedUserPermissions, setSelectedUserPermissions] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const normalizeRole = (value: string) => (value || '').replace(/^ROLE_/i, '').toUpperCase();

  const getUserRoleLabel = (user: any) => {
    if (user?.typeUtilisateur) return normalizeRole(user.typeUtilisateur);
    if (Array.isArray(user?.roles) && user.roles.length > 0) {
      const firstRole = user.roles[0];
      if (firstRole?.name) return normalizeRole(firstRole.name);
    }
    return normalizeRole(user?.role || '');
  };

  // Tous les tokens de rôle de l'utilisateur courant (typeUtilisateur + rôles assignés)
  const currentTokens = useMemo(() => {
    const tokens = new Set<string>();
    if (user?.typeUtilisateur) tokens.add(normalizeRole(user.typeUtilisateur));
    if (Array.isArray(roles)) {
      roles.forEach((r: any) => {
        const name = typeof r === 'string' ? r : (r?.name || '');
        if (name) tokens.add(normalizeRole(name));
      });
    }
    return tokens;
  }, [roles, user]);

  const hasAnyToken = (candidates: string[]) => candidates.some((c) => currentTokens.has(c));
  const isSuper = currentTokens.has('SUPERADMIN');
  const isOwnerTier = hasAnyToken(OWNER_TIER_TYPES);
  const isManagerTier = hasAnyToken(MANAGER_TIER_TYPES);
  const canManageUsers = (sessionPermissions || []).some((p) => ['UTILISATEUR_GERER', 'UTILISATEUR_CREER'].includes((p || '').toUpperCase()));

  const hasAccess = isSuper || isOwnerTier || (isManagerTier && canManageUsers);

  const getUserTokens = (u: any) => {
    const tokens = new Set<string>();
    if (u?.typeUtilisateur) tokens.add(normalizeRole(u.typeUtilisateur));
    if (Array.isArray(u?.roles)) {
      u.roles.forEach((r: any) => {
        const name = typeof r === 'string' ? r : (r?.name || '');
        if (name) tokens.add(normalizeRole(name));
      });
    }
    return tokens;
  };

  const isOwnCreation = (u: any) => user?.id != null && u?.creeParId === user.id;

  // Portée de gestion des permissions, en miroir de AdminPermissionController.canManagePermissionsFor
  // côté backend : le Superadmin gère tout le monde (sauf d'autres Superadmins) ; le Propriétaire/
  // Administrateur gère tous les subalternes de sa boutique ; un Gérant délégué ne gère que les
  // utilisateurs qu'il a lui-même créés.
  const canAssignTo = (u: any) => {
    if (user?.id != null && u.id === user.id) return false;
    const targetTokens = getUserTokens(u);
    if (isSuper) return !targetTokens.has('SUPERADMIN');
    if (isOwnerTier) return SUBORDINATE_TIER_TYPES.some((t) => targetTokens.has(t));
    if (isManagerTier) return MANAGER_TARGET_TIER_TYPES.some((t) => targetTokens.has(t)) && isOwnCreation(u);
    return false;
  };

  const fetchUsers = async () => {
    const token = localStorage.getItem('smb_token');
    if (!token) {
      setError('Token non disponible. Veuillez vous reconnecter.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/utilisateurs`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error("Erreur lors du chargement des utilisateurs");
      }

      let data = await response.json();
      const boutiqueId = currentBoutique?.id;

      // Appliquer filtre boutique uniquement si l'utilisateur n'est pas SUPERADMIN
      if (!isSuper && boutiqueId) {
        data = (data || []).filter((u: any) => u.boutique?.id === boutiqueId);
      }

      // Ne garder que les utilisateurs que je suis autorisé à gérer (miroir du backend)
      data = (data || []).filter((u: any) => canAssignTo(u));

      setUsers(data);
    } catch (err: any) {
      setError(err.message || 'Erreur inconnue');
    }
  };

  const fetchPermissions = async () => {
    const token = localStorage.getItem('smb_token');
    if (!token) return;
    
    try {
      const response = await fetch(`${API_BASE}/api/admin/permissions`, {
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
      const response = await fetch(`${API_BASE}/api/admin/utilisateurs/${userId}/permissions`, {
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
      if (initialUserId) {
        await handleUserSelect(initialUserId);
        onInitialUserConsumed?.();
      }
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAccess, currentBoutique]);

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users;
    
    const searchTerm = search.toLowerCase();
    return users.filter((user: any) => {
      const fullName = `${user.prenom || ''} ${user.nom || ''}`.toLowerCase();
      const email = (user.email || '').toLowerCase();
      
      return fullName.includes(searchTerm) || 
             email.includes(searchTerm);
    });
  }, [users, search]);

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

  // Filter for permissions list and helpers to select/deselect visible permissions
  const [permissionSearch, setPermissionSearch] = useState('');

  const visiblePermissionsByModule = useMemo(() => {
    if (!permissionSearch.trim()) return permissionsByModule;
    const s = permissionSearch.toLowerCase();
    const grouped: Record<string, any[]> = {};
    Object.keys(permissionsByModule).forEach(m => {
      const items = (permissionsByModule[m] || []).filter((p: any) => {
        const name = (p.name || p.code || '').toLowerCase();
        const desc = (p.description || '').toLowerCase();
        return name.includes(s) || desc.includes(s);
      });
      if (items.length > 0) grouped[m] = items;
    });
    return grouped;
  }, [permissionsByModule, permissionSearch]);

  const visibleCount = useMemo(() => Object.values(visiblePermissionsByModule).reduce((a: number, b: any[]) => a + b.length, 0), [visiblePermissionsByModule]);

  const allVisibleChecked = useMemo(() => {
    const ids = Object.values(visiblePermissionsByModule).flat().map((p: any) => p.id);
    if (ids.length === 0) return false;
    return ids.every((id: number) => selectedUserPermissions.has(id));
  }, [visiblePermissionsByModule, selectedUserPermissions]);

  const someVisibleChecked = useMemo(() => {
    const ids = Object.values(visiblePermissionsByModule).flat().map((p: any) => p.id);
    if (ids.length === 0) return false;
    const any = ids.some((id: number) => selectedUserPermissions.has(id));
    const all = ids.every((id: number) => selectedUserPermissions.has(id));
    return any && !all;
  }, [visiblePermissionsByModule, selectedUserPermissions]);

  const toggleSelectAllVisible = (checked: boolean) => {
    if (checked) selectAllVisible(); else deselectAllVisible();
  };

  const selectAllVisible = () => {
    setSelectedUserPermissions(prev => {
      const next = new Set(prev);
      Object.values(visiblePermissionsByModule).forEach(arr => arr.forEach(p => next.add(p.id)));
      return next;
    });
  };

  const deselectAllVisible = () => {
    setSelectedUserPermissions(prev => {
      const next = new Set(prev);
      Object.values(visiblePermissionsByModule).forEach(arr => arr.forEach(p => next.delete(p.id)));
      return next;
    });
  };

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
      const response = await fetch(`${API_BASE}/api/admin/utilisateurs/${selectedUserId}/permissions`, {
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

  // Precompute permissions content (helps keep JSX tidy and avoids nested ternaries inline)
  const permissionsContent = !selectedUserId ? (
    <div className="text-center text-muted py-5">
      <i className="fas fa-user-lock fa-2x mb-2"></i>
      <p className="mb-0">Sélectionnez un utilisateur pour gérer ses permissions</p>
    </div>
  ) : (
    visibleCount === 0 ? (
      <div className="text-center text-muted py-4">
        {permissionSearch ? "Aucune permission trouvée pour ce filtre" : "Aucune permission disponible"}
      </div>
    ) : (
      Object.keys(visiblePermissionsByModule).sort().map((module) => {
        const modulePermissions = visiblePermissionsByModule[module];
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
                      <td style={{ width: '160px' }} className="text-uppercase small fw-bold">
                        {action}
                      </td>
                      <td className="small">{permission.description || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })
    )
  );

  return (
    <div className="row">
      <div className="col-md-4">
        <div className="card h-100">
          <div className="card-header d-flex justify-content-between align-items-center bg-primary text-white">
            <div>
              <h6 className="mb-0">Utilisateurs</h6>
              <small className="text-white">Sélectionnez un utilisateur</small>
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
              {filteredUsers.length === 0 ? (
                <div className="text-muted text-center py-3">
                  {search ? "Aucun utilisateur trouvé" : "Aucun utilisateur"}
                </div>
              ) : (
                filteredUsers.map((user: any) => (
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
                    <div className="mt-1">
                      <small className="text-muted">{user.boutique?.nom || 'N/A'}</small>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="col-md-8">
        <div className="card h-100">
          <div className="card-header d-flex justify-content-between align-items-center bg-primary text-white">
            <div>
              <h6 className="mb-0">Permissions</h6>
              <small className="text-white">
                {selectedUserId ? 'Sélectionnez les permissions à attribuer' : 'Choisissez un utilisateur'}
              </small>
            </div>
            <div className="d-flex align-items-center gap-2">
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="Filtrer permissions..."
                value={permissionSearch}
                onChange={(e) => setPermissionSearch(e.target.value)}
                style={{ minWidth: 'min(200px, 90vw)' }}
                disabled={!selectedUserId}
              />

              <div className="form-check form-check-inline text-white ms-2">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="selectAllVisible"
                  checked={allVisibleChecked}
                  ref={(el) => { if (el) (el as HTMLInputElement).indeterminate = !allVisibleChecked && someVisibleChecked; }}
                  onChange={(e) => toggleSelectAllVisible(e.target.checked)}
                  disabled={!selectedUserId || visibleCount === 0}
                />
                <label className="form-check-label ms-1" htmlFor="selectAllVisible">Sélectionner tout</label>
              </div>

              <span className="badge bg-primary ms-2">{selectedCount}/{totalCount}</span>
            </div>
          </div>
          
          <div className="card-body" style={{ maxHeight: '520px', overflowY: 'auto' }}>
            {permissionsContent}
          </div>
                

          
          <div className="card-footer d-flex justify-content-between align-items-center">
            <small className="text-muted">{selectedCount} permission(s) sélectionnée(s)</small>
            <button 
              className="btn btn-primary" 
              onClick={savePermissions} 
              disabled={saving || !selectedUserId}
            >
              {saving ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                  Enregistrement...
                </>
              ) : (
                'Enregistrer'
              )}
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
  const [newPerm, setNewPerm] = useState({ 
    id: null as number | null,
    name: '', 
    description: '' 
  });
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');

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
      const res = await fetch(`${API}/permissions`, {
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
    if (!newPerm.name.trim() || !newPerm.description.trim()) {
      setMessage('Veuillez remplir tous les champs.');
      return;
    }
    
    const isEdit = !!newPerm.id;
    setCreating(true);
    setMessage('');
    
    try {
      const token = localStorage.getItem('smb_token');
      const method = isEdit ? 'PUT' : 'POST';
      const url = isEdit 
        ? `${API}/permissions/${newPerm.id}` 
        : `${API}/permissions`;
      
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: newPerm.name, description: newPerm.description })
      });
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Erreur lors de la ${isEdit ? 'modification' : 'création'}`);
      }
      
      setShowModal(false);
      setNewPerm({ id: null, name: '', description: '' });
      setMessage(`Permission ${isEdit ? 'modifiée' : 'créée'} avec succès !`);
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
      const res = await fetch(`${API}/permissions/${id}`, {
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

  const handleEdit = (perm: any) => {
    setNewPerm({
      id: perm.id,
      name: perm.name,
      description: perm.description
    });
    setShowModal(true);
  };

  const sortedPermissions = useMemo(() => {
    return [...permissions].sort((a: any, b: any) => {
      const moduleA = getModuleName(a.name);
      const moduleB = getModuleName(b.name);
      return moduleA.localeCompare(moduleB);
    });
  }, [permissions]);

  const filteredPermissions = useMemo(() => {
    if (!search.trim()) return sortedPermissions;
    
    const searchTerm = search.toLowerCase();
    return sortedPermissions.filter((perm: any) =>
      (perm.name || '').toLowerCase().includes(searchTerm) ||
      (perm.description || '').toLowerCase().includes(searchTerm)
    );
  }, [sortedPermissions, search]);

  if (loading) return (
    <div className="text-center p-5">
      <div className="spinner-border text-primary" role="status">
        <span className="visually-hidden">Chargement...</span>
      </div>
    </div>
  );
  
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
          <h5>Permissions</h5>
          <button 
            className="btn btn-light" 
            onClick={() => { 
              setNewPerm({ id: null, name: '', description: '' }); 
              setShowModal(true); 
            }}
          >
            + Nouvelle Permission
          </button>
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
          
          <div className="table-responsive">
            <table className="table table-striped table-hover">
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
                {filteredPermissions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center text-muted py-3">
                      {search ? "Aucune permission trouvée" : "Aucune permission"}
                    </td>
                  </tr>
                ) : (
                  filteredPermissions.map((perm: any, index: number) => (
                    <tr key={perm.id}>
                      <td>{index + 1}</td>
                      <td>{getModuleName(perm.name)}</td>
                      <td>
                        <code>{perm.name}</code>
                      </td>
                      <td>{perm.description}</td>
                      <td>
                        <div className="btn-group" role="group">
                          <button 
                            className="btn btn-sm btn-outline-warning" 
                            title="Modifier" 
                            onClick={() => handleEdit(perm)}
                          >
                            <i className="ti ti-pencil"></i>
                          </button>
                          <button 
                            className="btn btn-sm btn-outline-danger ms-1" 
                            title="Supprimer" 
                            onClick={() => handleDelete(perm.id)}
                          >
                            <i className="ti ti-trash"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal pour créer/modifier permission */}
      {showModal && (
        <>
          <div className="modal fade show" style={{ display: 'block' }} tabIndex={-1}>
            <div className="modal-dialog modal-fullscreen-sm-down">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">
                    {newPerm.id ? 'Modifier la Permission' : 'Créer une Permission'}
                  </h5>
                  <button 
                    type="button" 
                    className="btn-close" 
                    onClick={() => { 
                      setShowModal(false); 
                      setNewPerm({ id: null, name: '', description: '' }); 
                    }}
                  ></button>
                </div>
                
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Nom de la Permission *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={newPerm.name}
                      onChange={(e) => setNewPerm({ ...newPerm, name: e.target.value })}
                      placeholder="Ex: NOUVELLE_PERMISSION"
                      required
                    />
                  </div>
                  
                  <div className="mb-3">
                    <label className="form-label">Description *</label>
                    <textarea
                      className="form-control"
                      value={newPerm.description}
                      onChange={(e) => setNewPerm({ ...newPerm, description: e.target.value })}
                      placeholder="Description de la permission"
                      rows={3}
                      required
                    ></textarea>
                  </div>
                </div>
                
                <div className="modal-footer">
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={() => { 
                      setShowModal(false); 
                      setNewPerm({ id: null, name: '', description: '' }); 
                    }}
                  >
                    Annuler
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-primary" 
                    onClick={handleCreateOrUpdate} 
                    disabled={creating}
                  >
                    {creating ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                        {newPerm.id ? 'Modification...' : 'Création...'}
                      </>
                    ) : (
                      newPerm.id ? 'Modifier' : 'Créer'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show"></div>
        </>
      )}
    </>
  );
};

const ConfigurationAbonnementTarifs = () => {
  const { roles } = useUser();
  const normalizedRoles = roles.map(r => (r || '').replace(/^ROLE_/i, '').toUpperCase());
  const isSuperAdmin = normalizedRoles.includes('SUPERADMIN');

  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingCode, setSavingCode] = useState<string | null>(null);
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [edits, setEdits] = useState<Record<string, { libelle: string; dureeMois: string; prix: string; devise: string; actif: boolean }>>({});
  const [newPlan, setNewPlan] = useState<{ code: string; libelle: string; dureeMois: string; prix: string; devise: string; actif: boolean }>({
    code: '', libelle: '', dureeMois: '1', prix: '', devise: 'XOF', actif: true
  });

  const loadPlans = async () => {
    const token = localStorage.getItem('smb_token');
    if (!token) {
      setError('Authentification requise');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch(`${API}/admin/subscriptions/plans`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(await res.text());
      const rows = await res.json();
      const data = Array.isArray(rows) ? rows : [];
      setPlans(data);

      const nextEdits: Record<string, { libelle: string; dureeMois: string; prix: string; devise: string; actif: boolean }> = {};
      data.forEach((p: any) => {
        const code = String(p?.code || '');
        if (!code) return;
        nextEdits[code] = {
          libelle: p?.libelle != null ? String(p.libelle) : '',
          dureeMois: p?.duree_mois != null ? String(p.duree_mois) : '',
          prix: p?.prix != null ? String(p.prix) : '',
          devise: p?.devise != null ? String(p.devise) : 'XOF',
          actif: Boolean(p?.actif ?? true),
        };
      });
      setEdits(nextEdits);
    } catch (e: any) {
      setError(e?.message || 'Erreur chargement des tarifs abonnement');
      setPlans([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlans();
  }, []);

  const onSave = async (code: string) => {
    const token = localStorage.getItem('smb_token');
    if (!token) return;
    const current = edits[code];
    if (!current) return;

    const prixNum = Number(current.prix);
    const dureeNum = Number(current.dureeMois);
    if (!current.libelle.trim()) {
      setError('Le libellé est obligatoire');
      return;
    }
    if (!Number.isFinite(dureeNum) || dureeNum < 0) {
      setError('La durée (mois) ne peut pas être négative (0 = licence à vie)');
      return;
    }
    if (!Number.isFinite(prixNum) || prixNum < 0) {
      setError('Le prix ne peut pas être négatif');
      return;
    }

    setSavingCode(code);
    setError('');
    setMessage('');
    try {
      const res = await fetch(`${API}/admin/subscriptions/plans/${encodeURIComponent(code)}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          libelle: current.libelle.trim(),
          dureeMois: dureeNum,
          prix: prixNum,
          devise: (current.devise || 'XOF').trim().toUpperCase(),
          actif: current.actif,
        })
      });
      if (!res.ok) throw new Error(await res.text());

      setMessage(`Tarif ${code} mis à jour avec succès.`);
      await loadPlans();
    } catch (e: any) {
      setError(e?.message || `Erreur mise à jour du tarif ${code}`);
    } finally {
      setSavingCode(null);
    }
  };

  const onCreate = async () => {
    const token = localStorage.getItem('smb_token');
    if (!token) return;
    const code = newPlan.code.trim().toUpperCase();
    const libelle = newPlan.libelle.trim();
    const dureeNum = Number(newPlan.dureeMois);
    const prixNum = Number(newPlan.prix);

    if (!code) return setError('Le code est obligatoire');
    if (!libelle) return setError('Le libellé est obligatoire');
    if (!Number.isFinite(dureeNum) || dureeNum < 0) return setError('Durée invalide (0 = licence à vie)');
    if (!Number.isFinite(prixNum) || prixNum < 0) return setError('Prix invalide');

    setError('');
    setMessage('');
    try {
      const res = await fetch(`${API}/admin/subscriptions/plans`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          code,
          libelle,
          dureeMois: dureeNum,
          prix: prixNum,
          devise: (newPlan.devise || 'XOF').trim().toUpperCase(),
          actif: newPlan.actif,
        })
      });
      if (!res.ok) throw new Error(await res.text());
      setMessage(`Plan ${code} créé avec succès.`);
      setNewPlan({ code: '', libelle: '', dureeMois: '1', prix: '', devise: 'XOF', actif: true });
      await loadPlans();
    } catch (e: any) {
      setError(e?.message || 'Erreur création du plan');
    }
  };

  const onDelete = async (code: string) => {
    const token = localStorage.getItem('smb_token');
    if (!token) return;
    const confirm = await Swal.fire({
      icon: 'warning',
      title: `Supprimer le plan ${code} ?`,
      text: 'Si ce plan a déjà été utilisé, il sera désactivé automatiquement.',
      showCancelButton: true,
      confirmButtonText: 'Oui, continuer',
      cancelButtonText: 'Annuler',
    });
    if (!confirm.isConfirmed) return;

    setError('');
    setMessage('');
    try {
      const res = await fetch(`${API}/admin/subscriptions/plans/${encodeURIComponent(code)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(await res.text());
      const out = await res.json().catch(() => ({}));
      setMessage(out?.disabled ? `Plan ${code} désactivé (historique conservé).` : `Plan ${code} supprimé.`);
      await loadPlans();
    } catch (e: any) {
      setError(e?.message || `Erreur suppression du plan ${code}`);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="card">
        <div className="card-body">
          <div className="alert alert-warning mb-0">Accès réservé au superadmin.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header d-flex justify-content-between align-items-center bg-primary text-white">
        <h6 className="mb-0">Configuration des tarifs d'abonnement</h6>
        <button className="btn btn-sm btn-light" onClick={loadPlans}>
          <i className="bi bi-arrow-clockwise me-1"></i>Rafraîchir
        </button>
      </div>
      <div className="card-body">
        {message && <div className="alert alert-success py-2">{message}</div>}
        {error && <div className="alert alert-danger py-2">{error}</div>}

        <div className="border rounded p-3 mb-3">
          <h6 className="mb-3">Créer un plan d'abonnement</h6>
          <div className="row g-2">
            <div className="col-md-2">
              <input className="form-control form-control-sm" placeholder="Code" value={newPlan.code} onChange={(e) => setNewPlan(prev => ({ ...prev, code: e.target.value }))} />
            </div>
            <div className="col-md-3">
              <input className="form-control form-control-sm" placeholder="Libellé" value={newPlan.libelle} onChange={(e) => setNewPlan(prev => ({ ...prev, libelle: e.target.value }))} />
            </div>
            <div className="col-md-2">
              <input type="number" min={0} className="form-control form-control-sm" placeholder="Durée (0 = à vie)" value={newPlan.dureeMois} onChange={(e) => setNewPlan(prev => ({ ...prev, dureeMois: e.target.value }))} />
            </div>
            <div className="col-md-2">
              <input type="number" min={0} className="form-control form-control-sm" placeholder="Montant" value={newPlan.prix} onChange={(e) => setNewPlan(prev => ({ ...prev, prix: e.target.value }))} />
            </div>
            <div className="col-md-1">
              <input className="form-control form-control-sm" placeholder="Devise" value={newPlan.devise} onChange={(e) => setNewPlan(prev => ({ ...prev, devise: e.target.value }))} />
            </div>
            <div className="col-md-1 d-flex align-items-center">
              <div className="form-check form-switch m-0">
                <input className="form-check-input" type="checkbox" checked={newPlan.actif} onChange={(e) => setNewPlan(prev => ({ ...prev, actif: e.target.checked }))} />
              </div>
            </div>
            <div className="col-md-1">
              <button className="btn btn-sm btn-primary w-100" onClick={onCreate}>Créer</button>
            </div>
          </div>
          <small className="text-muted d-block mt-2">
            Astuce : mettez <strong>Durée = 0</strong> pour une <strong>licence à vie</strong> (plan acheté, ex. code <code>ACHAT</code>) — la boutique ne sera jamais bloquée. Le <strong>Montant</strong> = prix de vente unique.
          </small>
        </div>

        {loading ? (
          <div className="text-muted">Chargement des plans...</div>
        ) : (
          <div className="table-responsive">
            <table className="table table-sm align-middle">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Libellé</th>
                  <th>Durée (mois)</th>
                  <th>Montant</th>
                  <th>Devise</th>
                  <th>Actif</th>
                  <th style={{ width: 120 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((p: any) => {
                  const code = String(p?.code || '');
                  const row = edits[code] || { libelle: '', dureeMois: '', prix: '', devise: 'XOF', actif: true };
                  return (
                    <tr key={`sub-plan-${code}`}>
                      <td><strong>{code}</strong></td>
                      <td>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          value={row.libelle}
                          onChange={(e) => setEdits(prev => ({
                            ...prev,
                            [code]: { ...row, libelle: e.target.value }
                          }))}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          step="1"
                          className="form-control form-control-sm"
                          value={row.dureeMois}
                          onChange={(e) => setEdits(prev => ({
                            ...prev,
                            [code]: { ...row, dureeMois: e.target.value }
                          }))}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          step="1"
                          className="form-control form-control-sm"
                          value={row.prix}
                          onChange={(e) => setEdits(prev => ({
                            ...prev,
                            [code]: { ...row, prix: e.target.value }
                          }))}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          value={row.devise}
                          maxLength={8}
                          onChange={(e) => setEdits(prev => ({
                            ...prev,
                            [code]: { ...row, devise: e.target.value }
                          }))}
                        />
                      </td>
                      <td>
                        <div className="form-check form-switch m-0">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            checked={row.actif}
                            onChange={(e) => setEdits(prev => ({
                              ...prev,
                              [code]: { ...row, actif: e.target.checked }
                            }))}
                          />
                        </div>
                      </td>
                      <td>
                        <div className="d-flex gap-2">
                          <button
                            className="btn btn-sm btn-success"
                            onClick={() => onSave(code)}
                            disabled={savingCode === code}
                          >
                            {savingCode === code ? '...' : 'Enregistrer'}
                          </button>
                          <button className="btn btn-sm btn-outline-danger" onClick={() => onDelete(code)}>
                            Supprimer
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {plans.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-muted text-center py-3">Aucun plan trouvé</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Configuration;
