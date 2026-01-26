import React, { ReactNode, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import 'flag-icons/css/flag-icons.min.css';
import StockNotifications from './StockNotifications';
import { API_BASE } from '../config/api';

// responsive layout styles (mobile overlay, transitions)
import '../styles/layout-responsive.css';

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  // Responsive states
  const [isMobile, setIsMobile] = React.useState<boolean>(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  const [sidebarOpen, setSidebarOpen] = React.useState<boolean>(typeof window !== 'undefined' ? window.innerWidth >= 768 : true);

  // Sync on resize: update isMobile and ensure sensible sidebar default
  React.useEffect(() => {
    const onResize = () => {
      try {
        const mobile = window.innerWidth < 768;
        setIsMobile(mobile);
        // keep sidebar open on desktop, closed on mobile by default
        setSidebarOpen(!mobile);
      } catch (e) {}
    };
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Close sidebar (useful to pass to children)
  const closeSidebar = () => setSidebarOpen(false);
  const toggleSidebar = () => setSidebarOpen(s => !s);

  const { user } = useUser();

  // Close on ESC when in mobile overlay mode
  React.useEffect(() => {
    if (!isMobile) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && sidebarOpen) closeSidebar(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isMobile, sidebarOpen]);

  React.useEffect(() => {
    const html = document.documentElement;
    const body = document.body;

    if (isMobile) {
      html.setAttribute('data-sidenav-size', 'offcanvas');
    } else {
      html.setAttribute('data-sidenav-size', 'default');
    }

    const backdropId = 'custom-backdrop';
    const removeBackdrop = () => {
      const existing = document.getElementById(backdropId);
      if (existing && existing.parentElement) existing.parentElement.removeChild(existing);
    };

    if (isMobile && sidebarOpen) {
      html.classList.add('sidebar-enable');
      if (!document.getElementById(backdropId)) {
        const backdrop = document.createElement('div');
        backdrop.id = backdropId;
        backdrop.className = 'offcanvas-backdrop fade show';
        backdrop.addEventListener('click', closeSidebar);
        document.body.appendChild(backdrop);
      }
      body.style.overflow = 'hidden';
    } else {
      html.classList.remove('sidebar-enable');
      removeBackdrop();
      body.style.overflow = '';
      body.style.paddingRight = '';
    }

    return () => {
      html.classList.remove('sidebar-enable');
      removeBackdrop();
      body.style.overflow = '';
      body.style.paddingRight = '';
    };
  }, [isMobile, sidebarOpen]);

  return (
    <div className="wrapper">
      <Sidebar isOpen={sidebarOpen} isMobile={isMobile} closeSidebar={closeSidebar} />
      <Topbar toggleSidebar={toggleSidebar} isMobile={isMobile} sidebarOpen={sidebarOpen} />
      {user && user.typeUtilisateur === 'PROPRIETAIRE' && <StockNotifications />}

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

const Topbar = ({ toggleSidebar, isMobile, sidebarOpen }: { toggleSidebar?: () => void, isMobile?: boolean, sidebarOpen?: boolean }) => {
  const navigate = useNavigate();
  const { user, logout, roles = [] } = useUser();

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
    try {
      // prefer central logout from context to clean state and navigate
      logout();
    } catch (e) {
      // fallback for safety
      localStorage.removeItem('smb_token');
      localStorage.removeItem('smb_user_data');
      navigate('/');
    }
  };

  const translateRole = (role: string) => {
    const roleMap: { [key: string]: string } = {
      'SUPERADMIN': 'Administrateur Principal',
      'ADMIN': 'Administrateur',
      'ADMINISTRATEUR': 'Administrateur',
      'MANAGER': 'Manager',
      'STOREKEEPER': 'Magasinier',
      'CASHIER': 'Caissier'
    };
    return roleMap[role.toUpperCase()] || role;
  };

  const uniqueRoles = [...new Set(roles.map(r => r.toUpperCase().trim()).filter(r => r))];
  const translatedRoles = uniqueRoles.map(r => translateRole(r));
  const displayRoles = [...new Set(translatedRoles)].join(', ');

  const initials = () => {
    const n = `${user?.prenom || ''} ${user?.nom || ''}`.trim();
    if (!n) return 'U';
    const parts = n.split(' ').filter(Boolean);
    return (parts[0]?.[0] || 'U').toUpperCase();
  };

  // Debug: print minimal user info (sanitized) and masked storage to avoid leaking permission lists
  try {
    const _sanitizedStorage = (() => {
      try {
        const s = localStorage.getItem('smb_user_data');
        if (!s) return null;
        const p = JSON.parse(s);
        if (p && p.permissions) p.permissions = `[${Array.isArray(p.permissions) ? p.permissions.length : 0} items]`;
        return p;
      } catch (ex) { return null; }
    })();
    console.debug('Topbar render - user:', { id: user?.id, name: user ? `${user.prenom || ''} ${user.nom || ''}`.trim() || user.pseudo || user.email : undefined, avatar: (user as any)?.avatar, permissionsCount: Array.isArray((user as any)?.permissions) ? (user as any).permissions.length : undefined }, 'localStorage:', _sanitizedStorage);
  } catch (e) { /* ignore in non-browser env */ }

  const displayName = `${user?.prenom || ''} ${user?.nom || ''}`.trim() || user?.pseudo || user?.email || 'Profil';
  const defaultAvatar = `/assets/images/avatar.jpg`;
  const resolveAvatarUrl = (avatar?: string) => {
    if (!avatar) return defaultAvatar || `https://via.placeholder.com/64x64/0d6efd/ffffff?text=${initials()}`;
    if (avatar.startsWith('http')) return avatar;
    if (avatar.startsWith('/uploads') || avatar.startsWith('uploads')) {
      return avatar.startsWith('/') ? API_BASE + avatar : API_BASE + '/' + avatar;
    }
    return avatar; // assume already a valid URL or relative path
  };
  const avatarUrl = resolveAvatarUrl((user as any)?.avatar);

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

          <button
            className={`sidenav-toggle-button btn btn-primary btn-icon d-md-none d-flex ${sidebarOpen && isMobile ? 'open' : ''}`}
            onClick={toggleSidebar}
            aria-label={sidebarOpen && isMobile ? 'Fermer le menu' : 'Ouvrir le menu'}
            aria-expanded={!!(isMobile && sidebarOpen)}
            type="button"
          >
            <i className={`${sidebarOpen && isMobile ? 'ti ti-x' : 'ti ti-menu-2'} fs-22`} aria-hidden />
          </button>
          {displayRoles && (
            <span className="text-primary fw-semibold d-none d-lg-inline" style={{ fontSize: '0.7rem', marginLeft: '20em' }}>
              {displayRoles}
            </span>
          )}
        </div>
        <div className="d-flex align-items-center gap-2">
          <div className="dropdown me-2">
            <button className="btn btn-icon btn-light position-relative" data-bs-toggle="dropdown" aria-expanded="false">
              <i className="ti ti-bell fs-20"></i>
              {unreadCount > 0 && <span className="topbar-badge badge bg-danger">{unreadCount}</span>}
            </button>
            <ul className="dropdown-menu dropdown-menu-end p-2" style={{ minWidth: 'min(320px, 90vw)' }}>
              {notifications.length === 0 ? (
                <li className="p-2 text-muted">Aucune notification</li>
              ) : (
                notifications.map(n => (
                  <li key={n.id} className="notification-item p-2" onClick={() => openNotification(n)} style={{ cursor: 'pointer' }}>
                    <div className="d-flex align-items-center gap-2">
                      {n.boutique?.pays?.codeIso && (
                        <span className={`fi fi-${n.boutique.pays.codeIso.toLowerCase()}`} style={{ fontSize: '16px' }}></span>
                      )}
                      <div className="flex-grow-1">
                        <div className="fw-semibold">{n.type}</div>
                        <div className="text-muted small">{n.payload}</div>
                        {n.boutique && (
                          <div className="text-muted small">
                            Boutique: {n.boutique.nom}
                          </div>
                        )}
                      </div>
                    </div>
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
              style={{ cursor: 'pointer', width: '30px', height: '30px', objectFit: 'cover' }}
              onError={(e) => {
                try {
                  console.warn('Avatar failed to load, falling back to default:', (e.currentTarget as HTMLImageElement).src);
                  (e.currentTarget as HTMLImageElement).src = defaultAvatar;
                } catch (ex) { console.error('Failed to apply avatar fallback', ex); }
              }}
              ref={el => {
                // debug: print avatar url and page when rendered to help trace intermittent issues
                try {
                  if (el && (window as any).location) {
                    // print once per render
                    console.debug('Topbar avatar src:', el.src, 'location:', (window as any).location.pathname);
                  }
                } catch (ex) {}
              }}
            />
            <span className="fw-semibold d-none d-sm-inline">{displayName}</span>
            <ul className="dropdown-menu dropdown-menu-end">
              <li><span className="dropdown-item-text fw-semibold">{displayName}</span></li>
              {displayRoles && (
                <li><span className="dropdown-item-text text-muted small">{displayRoles}</span></li>
              )}
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

const Sidebar = ({ isOpen = true, isMobile = false, closeSidebar = () => {} }: { isOpen?: boolean, isMobile?: boolean, closeSidebar?: () => void }) => {
  const { permissions, user, roles = [] } = useUser();
  // Only use explicit permissions to show/hide UI elements. Some menus (like Configuration)
  // are also visible to owners (PROPRIETAIRE) and SUPERADMIN by role.
  const normalizedPermissions = permissions.map(p => p.toUpperCase());

  const hasAnyPermission = (codes: string[]) => {
    return codes.some(code => normalizedPermissions.includes(code.toUpperCase()));
  };

  const isOwner = user && user.typeUtilisateur === 'PROPRIETAIRE';
  const isSuperAdmin = roles.some(r => r.toUpperCase() === 'SUPERADMIN');

  const can = {
    dashboard: hasAnyPermission(['TABLEAU_DE_BORD_VOIR', 'TABLEAU_DE_BORD_LECTURE']),
    inventaire: hasAnyPermission(['INVENTAIRE_VOIR', 'INVENTAIRE_LECTURE']),
    fournisseurs: hasAnyPermission(['FOURNISSEUR_VOIR', 'FOURNISSEUR_LECTURE']),
    produits: hasAnyPermission(['PRODUIT_VOIR', 'PRODUIT_LECTURE']),    mouvements: hasAnyPermission(['MOUVEMENT_AUDIT', 'CAISSE_MOUVEMENT_VIEW', 'INVENTAIRE_LECTURE']),    achats: hasAnyPermission(['ACHAT_VOIR', 'COMMANDE_LECTURE']),
    venteEspece: hasAnyPermission(['VENTE_ESPECE_VOIR', 'VENTE_LECTURE']),
    venteCredit: hasAnyPermission(['VENTE_CREDIT_VOIR', 'VENTE_LECTURE']),
    caisse: hasAnyPermission(['CAISSE_VOIR', 'CAISSE_LECTURE', 'PARAMETRES_LECTURE']),
    depense: hasAnyPermission(['DEPENSE_LECTURE']),
    // utilisations/pertes: visible to users with relevant permissions or owner
    utilisations: (hasAnyPermission(['UTILISA_PERTE_CREER','UTILISA_PERTE_VOIR','UTILISA_PERTE_MODIFIER','UTILISA_PERTE_SUPPRIMER']) || isOwner),
    // documents: generated on demand
    documents: hasAnyPermission(['DOCUMENTS_VOIR']),
    rapports: hasAnyPermission(['RAPPORT_LECTURE']),
    // configuration: visible only if explicit CONFIGURATION_VOIR permission OR owner OR superadmin
    configuration: (hasAnyPermission(['CONFIGURATION_VOIR']) || isOwner || isSuperAdmin),
  }; 

  // Diagnostic: log the reason the Configuration menu is shown or hidden to ease debugging
  useEffect(() => {
    try {
      const reasonParts: string[] = [];
      if (hasAnyPermission(['CONFIGURATION_VOIR'])) reasonParts.push('permission:CONFIGURATION_VOIR');
      if (isOwner) reasonParts.push('owner');
      if (isSuperAdmin) reasonParts.push('superadmin');
      console.debug('Configuration menu visibility:', reasonParts.length > 0 ? 'VISIBLE (' + reasonParts.join(',') + ')' : 'HIDDEN');
    } catch (e) {
      // ignore
    }
  }, [permissions, user, roles]);

  // Diagnostic: log summary (counts) to avoid printing full permission lists
  useEffect(() => {
    try {
      console.debug('Sidebar permissions: count=', Array.isArray(permissions) ? permissions.length : 0);
      console.debug('Sidebar normalizedPermissions: count=', Array.isArray(normalizedPermissions) ? normalizedPermissions.length : 0);
      console.debug('Sidebar computed can:', can);
    } catch (e) {
      console.warn('Error logging sidebar diagnostics', e);
    }
  }, [permissions]);
  return (
    <div className="sidenav-menu" role="navigation" aria-hidden={isMobile ? (!isOpen) : false}>
      <div className="text-center py-1" style={{ borderBottom: '1px solid #e9ecef' }}>
        <span className="fw-bold text-primary d-block" style={{ 
          fontSize: '1.5rem',
          background: 'linear-gradient(45deg, #007bff, #6610f2)', 
          WebkitBackgroundClip: 'text', 
          WebkitTextFillColor: 'transparent', 
          backgroundClip: 'text', 
          textShadow: '1px 1px 0px #ccc, 2px 2px 0px #bbb, 3px 3px 0px #aaa', 
          fontFamily: 'Arial Narrow, Arial, sans-serif',
         
          lineHeight: '1',
          whiteSpace: 'nowrap'
        }}>
          JÀGO DÁNAYA
        </span>
      </div>
      <div className="scrollbar" data-simplebar>
        <ul
          className="side-nav"
          id="sidebar-nav"
          onClick={(e) => {
            try {
              const a = (e.target as HTMLElement).closest('a.side-nav-link');
              if (a && isMobile && !a.hasAttribute('data-bs-toggle')) {
                // close when navigating on mobile (but not when toggling submenu)
                closeSidebar();
              }
            } catch (ex) {}
          }}
        >

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
                <Link to="/inventaires" className="side-nav-link" style={{ paddingLeft: '40px' }}>
                  <span>Liste des Inventaires</span>
                </Link>
              </li>
              <li>
                <Link to="/inventaires/new" className="side-nav-link" style={{ paddingLeft: '40px' }}>
                  <span>Nouveau Inventaire</span>
                </Link>
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
              { (normalizedPermissions.includes('TRANSFERT_VOIR') || normalizedPermissions.includes('INVENTAIRE_LECTURE')) && (
              <li>
                <Link to="/produits/transfert" className="side-nav-link" style={{ paddingLeft: '40px' }}>
                  <span>Transfert</span>
                </Link>
              </li>
              ) }
              {can.mouvements && (
              <li>
                <Link to="/mouvements" className="side-nav-link" style={{ paddingLeft: '40px' }}>
                  <span>Mouvement</span>
                </Link>
              </li>
              )}
              { can.utilisations && (
              <li>
                <Link to="/utilisations" className="side-nav-link" style={{ paddingLeft: '40px' }}>
                  <span>Utilisations/pertes</span>
                </Link>
              </li>
              ) }
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

          {(can.documents || can.rapports) && (
          <li className="side-nav-item">
            <a className="side-nav-link" data-bs-target="#documents-nav" data-bs-toggle="collapse" href="#">
              <span className="menu-icon"><i className="ti ti-file-text"></i></span>
              <span className="menu-text">Documents/Rapports</span>
              <i className="ti ti-chevron-down ms-auto"></i>
            </a>
            <ul id="documents-nav" className="collapse" data-bs-parent="#sidebar-nav">
              {can.documents && (
              <li>
                <Link to="/documents" className="side-nav-link" style={{ paddingLeft: '40px' }}>
                  <span>Documents</span>
                </Link>
              </li>
              )}
              {can.rapports && (
              <li>
                <Link to="/rapports" className="side-nav-link" style={{ paddingLeft: '40px' }}>
                  <span>Rapports</span>
                </Link>
              </li>
              )}
            </ul>
          </li>
          )}
          {can.venteEspece && (
          <li className="side-nav-item">
            <a href="#" className="side-nav-link">
              <span className="menu-icon"><i className="ti ti-cash"></i></span>
              <span className="menu-text"><Link to="/ventes/espece" className="side-nav-link" style={{ color: 'inherit', textDecoration: 'none' }}>Vente en Espèce</Link></span>
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
          <li className="side-nav-item">
            <Link to="/documentation" className="side-nav-link">
              <span className="menu-icon"><i className="ti ti-book"></i></span>
              <span className="menu-text">Documentation</span>
            </Link>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default Layout;