import React, { ReactNode, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';


interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="wrapper">
      <Sidebar />
      <Topbar />
      <div className="content-page">
        <div className="content">
          <div className="container-fluid" style={{ paddingBottom: '80px' }}>
            {children}
          </div>
        </div>
        <Footer />
      </div>
    </div>
  );
};

const Footer = () => {
  return (
    <footer className="footer fixed-bottom w-100 bg-white shadow-sm">
      <div className="container-fluid">
        <div className="row px-4 py-2">
          <div className="col-md-6 text-center text-md-start">
            © te@che@b@rry@
          </div>
          <div className="col-md-6">
            <div className="text-md-end d-none d-md-block">
              Version 1.0
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

const Topbar = () => {
  const navigate = useNavigate();
  const { user } = useUser();

  const [notifications, setNotifications] = React.useState<any[]>([]);

  React.useEffect(() => {
    let mounted = true;
    let timer: any = null;
    const fetchNotifs = async () => {
      try {
        const notifApi = await import('../api/notification');
        const list = await notifApi.default.getUnreadNotifications();
        if (!mounted) return;
        setNotifications(list || []);
      } catch (err) {
        // ignore
      }
    };
    fetchNotifs();
    // poll every 25s for new notifications to provide near-real-time updates
    timer = setInterval(fetchNotifs, 25000);
    return () => { mounted = false; if (timer) clearInterval(timer); };
  }, [user]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/');
  };

  const initials = () => {
    const n = `${user?.prenom || ''} ${user?.nom || ''}`.trim();
    if (!n) return 'U';
    const parts = n.split(' ').filter(Boolean);
    return (parts[0]?.[0] || 'U').toUpperCase();
  };

  const displayName = `${user?.prenom || ''} ${user?.nom || ''}`.trim() || user?.pseudo || user?.email || 'Profil';
  const defaultAvatar = `assets/images/avatar.jpg`;
  const avatarUrl = (user as any)?.avatar || defaultAvatar || `https://via.placeholder.com/64x64/0d6efd/ffffff?text=${initials()}`;

  const unreadCount = notifications.length;

  const openNotification = async (n: any) => {
    try {
      const notifApi = await import('../api/notification');
      await notifApi.default.markRead(n.id);
      setNotifications(prev => prev.filter(x => x.id !== n.id));
      // navigate to depenses
      navigate('/depenses');
    } catch (err) {
      console.warn('Failed to mark notification read', err);
    }
  };

  return (
    <header className="app-topbar">
      <div className="container-fluid topbar-menu d-flex justify-content-between align-items-center">
        <div className="d-flex align-items-center gap-2">
          <div className="logo-topbar">
            <a href="/" className="logo-light">
              <span className="logo-lg">
                <img src="assets/images/logo.png" alt="logo" />
              </span>
              <span className="logo-sm">
                <img src="assets/images/logo-sm.png" alt="small logo" />
              </span>
            </a>
            <a href="/" className="logo-dark">
              <span className="logo-lg">
                <img src="assets/images/logo-black.png" alt="dark logo" />
              </span>
              <span className="logo-sm">
                <img src="assets/images/logo-sm.png" alt="small logo" />
              </span>
            </a>
          </div>
          <button className="sidenav-toggle-button btn btn-primary btn-icon d-md-none d-flex">
            <i className="ti ti-menu-2 fs-22"></i>
          </button>
        </div>
        <div className="d-flex align-items-center gap-2">
          <div className="dropdown me-2">
            <button className="btn btn-icon btn-light position-relative" data-bs-toggle="dropdown" aria-expanded="false">
              <i className="ti ti-bell fs-20"></i>
              {unreadCount > 0 && <span className="topbar-badge badge bg-danger">{unreadCount}</span>}
            </button>
            <ul className="dropdown-menu dropdown-menu-end p-2" style={{ minWidth: 320 }}>
              {notifications.length === 0 ? (
                <li className="p-2 text-muted">Aucune notification</li>
              ) : (
                notifications.map(n => (
                  <li key={n.id} className="notification-item p-2" onClick={() => openNotification(n)} style={{ cursor: 'pointer' }}>
                    <div className="fw-semibold">{n.type}</div>
                    <div className="text-muted small">{n.payload}</div>
                  </li>
                ))
              )}
            </ul>
          </div>

          <div className="dropdown d-flex align-items-center gap-2">
            <img
              src={avatarUrl}
              alt="profile"
              className="rounded-circle dropdown-toggle"
              data-bs-toggle="dropdown"
              aria-expanded="false"
              style={{ cursor: 'pointer', width: '40px', height: '40px', objectFit: 'cover' }}
            />
            <span className="fw-semibold d-none d-sm-inline">{displayName}</span>
            <ul className="dropdown-menu dropdown-menu-end">
              <li><span className="dropdown-item-text fw-semibold">{displayName}</span></li>
              <li><a className="dropdown-item" href="/profile">Profil</a></li>
              <li><hr className="dropdown-divider" /></li>
              <li><a className="dropdown-item" href="#" onClick={handleLogout}>Déconnexion</a></li>
            </ul>
          </div>
        </div>
      </div>
    </header>
  );
};

const Sidebar = () => {
  const { permissions } = useUser();
  // Only use explicit permissions to show/hide UI elements. No role-based bypass here.
  const normalizedPermissions = permissions.map(p => p.toUpperCase());

  const hasAnyPermission = (codes: string[]) => {
    return codes.some(code => normalizedPermissions.includes(code.toUpperCase()));
  };

  const can = {
    dashboard: hasAnyPermission(['TABLEAU_DE_BORD_VOIR', 'TABLEAU_DE_BORD_LECTURE']),
    inventaire: hasAnyPermission(['INVENTAIRE_VOIR', 'INVENTAIRE_LECTURE']),
    fournisseurs: hasAnyPermission(['FOURNISSEUR_VOIR', 'FOURNISSEUR_LECTURE']),
    produits: hasAnyPermission(['PRODUIT_VOIR', 'PRODUIT_LECTURE']),
    achats: hasAnyPermission(['ACHAT_VOIR', 'COMMANDE_LECTURE']),
    venteEspece: hasAnyPermission(['VENTE_ESPECE_VOIR', 'VENTE_LECTURE']),
    venteCredit: hasAnyPermission(['VENTE_CREDIT_VOIR', 'VENTE_LECTURE']),
    caisse: hasAnyPermission(['CAISSE_VOIR', 'CAISSE_LECTURE', 'PARAMETRES_LECTURE']),
    depense: hasAnyPermission(['DEPENSE_LECTURE']),
    configuration: hasAnyPermission(['CONFIGURATION_VOIR', 'PARAMETRES_LECTURE', 'UTILISATEUR_LECTURE']),
  };

  // Diagnostic: log permissions and computed menu visibility to help debug mismatches
  useEffect(() => {
    try {
      console.debug('Sidebar permissions raw:', permissions);
      console.debug('Sidebar normalizedPermissions:', normalizedPermissions);
      console.debug('Sidebar computed can:', can);
    } catch (e) {
      console.warn('Error logging sidebar diagnostics', e);
    }
  }, [permissions]);
  return (
    <div className="sidenav-menu">
      <div className="navbar-brand-box">
        <a href="/" className="logo logo-dark">
          <span className="logo-sm">
            <img src="/images/logo-sm.png" alt="logo" height="22" />
          </span>
          <span className="logo-lg">
            <img src="/images/logo.png" alt="logo" height="24" />
            <span className="logo-txt">SMBOUTIQUE</span>
          </span>
        </a>
      </div>
      <div className="scrollbar" style={{ height: 'calc(100vh - 70px)' }}>
        <ul className="side-nav" id="sidebar-nav">
          <li className="side-nav-title">Navigation</li>
          {can.dashboard && (
          <li className="side-nav-item">
            <Link to="/dashboard" className="side-nav-link">
              <span className="menu-icon"><i className="ti ti-dashboard"></i></span>
              <span className="menu-text">Tableau de bord</span>
            </Link>
          </li>
          )}
          {can.inventaire && (
          <li className="side-nav-item">
            <a className="side-nav-link" data-bs-target="#inventaire-nav" data-bs-toggle="collapse" href="#">
              <span className="menu-icon"><i className="ti ti-clipboard-list"></i></span>
              <span className="menu-text">Inventaire</span>
              <i className="ti ti-chevron-down ms-auto"></i>
            </a>
            <ul id="inventaire-nav" className="collapse" data-bs-parent="#sidebar-nav">
              <li>
                <a href="#" className="side-nav-link" style={{ paddingLeft: '40px' }}>
                  <span>Liste des Inventaires</span>
                </a>
              </li>
            </ul>
          </li>
          )}
          {can.fournisseurs && (
          <li className="side-nav-item">
            <a className="side-nav-link" data-bs-target="#fournisseur-nav" data-bs-toggle="collapse" href="#">
              <span className="menu-icon"><i className="ti ti-truck"></i></span>
              <span className="menu-text">Fournisseur</span>
              <i className="ti ti-chevron-down ms-auto"></i>
            </a>
            <ul id="fournisseur-nav" className="collapse" data-bs-parent="#sidebar-nav">
              <li>
                <Link to="/fournisseurs" className="side-nav-link" style={{ paddingLeft: '40px' }}>
                  <span>Liste des fournisseurs</span>
                </Link>
              </li>
            </ul>
          </li>
          )}
          {can.produits && (
          <li className="side-nav-item">
            <a className="side-nav-link" data-bs-target="#produits-nav" data-bs-toggle="collapse" href="#">
              <span className="menu-icon"><i className="ti ti-package"></i></span>
              <span className="menu-text">Produits</span>
              <i className="ti ti-chevron-down ms-auto"></i>
            </a>
            <ul id="produits-nav" className="collapse" data-bs-parent="#sidebar-nav">
              <li>
                <Link to="/produits" className="side-nav-link" style={{ paddingLeft: '40px' }}>
                  <span>Liste produits</span>
                </Link>
              </li>
              <li>
                <a href="#" className="side-nav-link" style={{ paddingLeft: '40px' }}>
                  <span>Mouvement</span>
                </a>
              </li>
              <li>
                <a href="#" className="side-nav-link" style={{ paddingLeft: '40px' }}>
                  <span>Utilisations/pertes</span>
                </a>
              </li>
            </ul>
          </li>
          )}
          {can.achats && (
          <li className="side-nav-item">
            <a className="side-nav-link" data-bs-target="#achats-nav" data-bs-toggle="collapse" href="#">
              <span className="menu-icon"><i className="ti ti-shopping-cart"></i></span>
              <span className="menu-text">Achats</span>
              <i className="ti ti-chevron-down ms-auto"></i>
            </a>
            <ul id="achats-nav" className="collapse" data-bs-parent="#sidebar-nav">
              <li>
                <Link to="/commande-fournisseur" className="side-nav-link" style={{ paddingLeft: '40px' }}>
                  <span>Commande</span>
                </Link>
              </li>
              <li>
                <Link to="/historique" title="Historique (Réceptions & Paiements)" className="side-nav-link" style={{ paddingLeft: '40px', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                  <span>Historique</span>
                </Link>
              </li>
            </ul>
          </li>
          )}
          {can.venteEspece && (
          <li className="side-nav-item">
            <a href="#" className="side-nav-link">
              <span className="menu-icon"><i className="ti ti-cash"></i></span>
              <span className="menu-text">Vente en Espèce</span>
            </a>
          </li>
          )}
          {can.venteCredit && (
          <li className="side-nav-item">
            <a className="side-nav-link" data-bs-target="#ventes-nav" data-bs-toggle="collapse" href="#">
              <span className="menu-icon"><i className="ti ti-credit-card"></i></span>
              <span className="menu-text">Ventes</span>
              <i className="ti ti-chevron-down ms-auto"></i>
            </a>
            <ul id="ventes-nav" className="collapse" data-bs-parent="#sidebar-nav">
              <li>
                <Link to="/ventes" className="side-nav-link" style={{ paddingLeft: '5px' }}>
                  <span>Ajouter Vente</span>
                </Link>
              </li>
              <li>
                <Link to="/ventes/historique" className="side-nav-link" style={{ paddingLeft: '5px' }}>
                  <span>Historique Ventes</span>
                </Link>
              </li>
              
            </ul>
          </li>
          )}
          {can.caisse && (
          <li className="side-nav-item">
            <a className="side-nav-link" data-bs-target="#caisse-nav" data-bs-toggle="collapse" href="#">
              <span className="menu-icon"><i className="ti ti-wallet"></i></span>
              <span className="menu-text">Caisse</span>
              <i className="ti ti-chevron-down ms-auto"></i>
            </a>
            <ul id="caisse-nav" className="collapse" data-bs-parent="#sidebar-nav">
              <li>
                <Link to="/caisses" className="side-nav-link" style={{ paddingLeft: '40px' }}>
                  <span>Régistre de caisse</span>
                </Link>
              </li>
              {can.depense && (
              <li>
                <Link to="/depenses" className="side-nav-link" style={{ paddingLeft: '40px' }}>
                  <span>Dépenses</span>
                </Link>
              </li>
              )}
            </ul>
          </li>
          )}
          {can.configuration && (
          <li className="side-nav-item">
            <a href="/configuration" className="side-nav-link">
              <span className="menu-icon"><i className="ti ti-settings"></i></span>
              <span className="menu-text">Configuration</span>
            </a>
          </li>
          )}
        </ul>
      </div>
    </div>
  );
};

export default Layout;