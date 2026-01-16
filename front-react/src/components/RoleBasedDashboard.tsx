import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bar } from 'react-chartjs-2';
import { 
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { 
  getDashboard, 
  getSubordinatesDashboards,
  DashboardPayload, 
  getBoutiques,
  getMagasins,
  Boutique,
  Magasin
} from '../api/dashboardClient';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const formatNumber = (n?: number) => n == null ? '—' : new Intl.NumberFormat('fr-FR').format(n);
import { useFormatMoney } from '../utils/currency';

// Note: formatting hook will be used inside components (hook rules)


// Composant pour afficher un widget joliment
const WidgetCard = ({ title, value, icon, color, type = 'number', subtitle = '', action, onClick }: any) => {
  const getIcon = () => {
    switch(icon) {
      case 'money': return 'bi bi-currency-dollar';
      case 'shop': return 'bi bi-shop';
      case 'box': return 'bi bi-box-seam';
      case 'cart': return 'bi bi-cart-check';
      case 'people': return 'bi bi-people';
      case 'alert': return 'bi bi-exclamation-triangle';
      case 'cash': return 'bi bi-cash-coin';
      case 'graph': return 'bi bi-graph-up';
      case 'inventory': return 'bi bi-clipboard-check';
      default: return 'bi bi-info-circle';
    }
  };

  const getColorClass = () => {
    switch(color) {
      case 'primary': return 'bg-primary text-white';
      case 'success': return 'bg-success text-white';
      case 'warning': return 'bg-warning text-white';
      case 'danger': return 'bg-danger text-white';
      case 'info': return 'bg-info text-white';
      case 'secondary': return 'bg-secondary text-white';
      default: return 'bg-primary text-white';
    }
  };

  const fmt = useFormatMoney();
  const displayValue = () => {
    if (type === 'currency') return fmt(value);
    if (type === 'number') return formatNumber(value);
    if (type === 'percent') return `${value}%`;
    if (type === 'boolean') return value ? 'OUI' : 'NON';
    if (type === 'text') return value;
    return value;
  };

  return (
    <div className={`card h-100 ${onClick ? 'cursor-pointer' : ''}`} onClick={onClick} style={onClick ? { cursor: 'pointer' } : {}}>
      <div className="card-body">
        {type === 'button' ? (
          // Affichage spécial pour les boutons pleine largeur
          <div className="h-100">
            {action}
          </div>
        ) : (
          // Affichage normal pour les autres types
          <>
            <div className="d-flex align-items-center justify-content-between mb-3">
              <div className="d-flex align-items-center">
                <div className={`${getColorClass()} rounded d-flex align-items-center justify-content-center me-3`} style={{ width: 48, height: 48 }}>
                  <i className={`${getIcon()} fs-4`}></i>
                </div>
                <div>
                  <h6 className="mb-0">{title}</h6>
                  {subtitle && <small className="text-muted">{subtitle}</small>}
                </div>
              </div>
              {action && (
                <div className="ms-auto">
                  {action}
                </div>
              )}
            </div>
            <div className="d-flex align-items-end justify-content-between">
              <div>
                <h3 className="mb-0">{displayValue()}</h3>
              </div>
              {type === 'trend' && (
                <span className={`badge ${value > 0 ? 'bg-success' : 'bg-danger'}`}>
                  <i className={`bi ${value > 0 ? 'bi-arrow-up' : 'bi-arrow-down'} me-1`}></i>
                  {Math.abs(value)}%
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// Composant pour afficher le dashboard d'un subalterne
const SubordinateDashboardCard = ({ role, name, widgets, shopName }: any) => {
  const getRoleIcon = (role: string) => {
    switch(role) {
      case 'GERANT': return '👨‍💼';
      case 'MAGASINIER': return '📦';
      case 'CAISSIER': return '💰';
      default: return '👤';
    }
  };

  const getRoleColor = (role: string) => {
    switch(role) {
      case 'GERANT': return 'success';
      case 'MAGASINIER': return 'warning';
      case 'CAISSIER': return 'info';
      default: return 'secondary';
    }
  };
  const fmt = useFormatMoney();

  const getKeyWidgets = () => {
    const keyWidgets: any = {};
    
    widgets?.forEach((widget: any) => {
      const key = widget.key.toLowerCase();
      const value = widget.data?.value;
      
      if (key.includes('ventes_jour') || key.includes('sales_today')) {
        keyWidgets.ventes = value;
      } else if (key.includes('stock_critique') || key.includes('alert_stock')) {
        keyWidgets.stockAlert = value;
      } else if (key.includes('valeur_stock')) {
        keyWidgets.stockValue = value;
      } else if (key.includes('inventaire_actif')) {
        keyWidgets.inventory = value;
      } else if (key.includes('produits_rupture')) {
        keyWidgets.rupture = value;
      }
    });
    
    return keyWidgets;
  };

  const keyWidgets = getKeyWidgets();

  return (
    <div className="card h-100">
      <div className="card-header">
        <div className="d-flex align-items-center justify-content-between">
          <div>
            <h6 className="mb-0">
              <span className="me-2 fs-5">{getRoleIcon(role)}</span>
              {name}
            </h6>
            <small className="text-muted">{shopName}</small>
          </div>
          <span className={`badge bg-${getRoleColor(role)}`}>{role}</span>
        </div>
      </div>
      <div className="card-body">
        <div className="row g-2">
          {keyWidgets.ventes !== undefined && (
            <div className="col-6">
              <div className="bg-light rounded p-2 text-center">
                <small className="text-muted d-block">Ventes</small>
                <strong className="text-primary">{fmt(keyWidgets.ventes)}</strong>
              </div>
            </div>
          )}
          
          {keyWidgets.stockAlert !== undefined && (
            <div className="col-6">
              <div className="bg-light rounded p-2 text-center">
                <small className="text-muted d-block">Alertes stock</small>
                <strong className={`${keyWidgets.stockAlert > 0 ? 'text-danger' : 'text-success'}`}>
                  {keyWidgets.stockAlert}
                </strong>
              </div>
            </div>
          )}
          
          {keyWidgets.rupture !== undefined && (
            <div className="col-6">
              <div className="bg-light rounded p-2 text-center">
                <small className="text-muted d-block">Ruptures</small>
                <strong className="text-danger">{keyWidgets.rupture}</strong>
              </div>
            </div>
          )}
          
          {keyWidgets.stockValue !== undefined && (
            <div className="col-6">
              <div className="bg-light rounded p-2 text-center">
                <small className="text-muted d-block">Valeur stock</small>
                <strong className="text-success">{fmt(keyWidgets.stockValue)}</strong>
              </div>
            </div>
          )}
          
          {keyWidgets.inventory !== undefined && (
            <div className="col-12">
              <div className={`rounded p-2 text-center ${keyWidgets.inventory ? 'bg-warning' : 'bg-light'}`}>
                <small className={keyWidgets.inventory ? 'text-dark' : 'text-muted'}>
                  Inventaire {keyWidgets.inventory ? 'en cours' : 'à jour'}
                </small>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const RoleBasedDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<DashboardPayload | null>(null);
  const [subordinates, setSubordinates] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<'own' | 'subordinates'>('own');
  const [boutiques, setBoutiques] = useState<Boutique[]>([]);
  const [magasins, setMagasins] = useState<Magasin[]>([]);
  const [selectedBoutiqueId, setSelectedBoutiqueId] = useState<number | null>(null);
  const [selectedMagasinId, setSelectedMagasinId] = useState<number | null>(null);
  const navigate = useNavigate();
  const fmt = useFormatMoney();

  const load = async (shopId?: number, magasinId?: number) => {
    console.log('🔄 Starting dashboard load for shopId:', shopId, 'magasinId:', magasinId);

    // Vérifier si l'utilisateur est connecté
    const token = localStorage.getItem('smb_token');
    if (!token) {
      console.log('❌ No authentication token found');
      setError('Utilisateur non connecté');
      setLoading(false);
      navigate('/login');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      console.log('📡 Calling getDashboard API...');
      // Charger le dashboard de l'utilisateur connecté
      const p = await getDashboard(shopId, magasinId);
      console.log('✅ Dashboard data received:', p);
      console.log('📊 Top products data:', p.widgets?.top_products);
      setPayload(p);

      // Si c'est un ADMIN, charger les dashboards des subalternes
      if (p.role === 'ADMIN' || p.role === 'PROPRIETAIRE') {
        console.log('👥 Loading subordinates dashboards...');
        const subs = await getSubordinatesDashboards();
        console.log('✅ Subordinates data received:', subs);
        setSubordinates(subs);
      }

      setLastRefresh(new Date());
      console.log('🎉 Dashboard load completed successfully');
    } catch (e) {
      console.error('❌ Error in dashboard load:', e);
      const error = e as Error;
      console.error('Error details:', error.message, error.stack);
      setError(error?.message || 'Erreur lors du chargement du dashboard');
    } finally {
      console.log('🏁 Setting loading to false');
      setLoading(false);
    }
  };

  const loadLocations = async () => {
    console.log('🏪 Starting locations load...');

    // Vérifier si l'utilisateur est connecté
    const token = localStorage.getItem('smb_token');
    if (!token) {
      console.log('❌ No authentication token found for locations');
      return;
    }

    try {
      // Charger les boutiques
      const boutiquesList = await getBoutiques();
      console.log('✅ Boutiques data received:', boutiquesList);
      setBoutiques(boutiquesList);

      // Charger les magasins
      const magasinsList = await getMagasins();
      console.log('✅ Magasins data received:', magasinsList);
      setMagasins(magasinsList);

      // Sélectionner la première boutique par défaut (celle de l'utilisateur)
      if (boutiquesList.length > 0 && selectedBoutiqueId === null) {
        console.log('🎯 Setting default boutique:', boutiquesList[0].id);
        setSelectedBoutiqueId(boutiquesList[0].id);
      }
    } catch (e) {
      console.error('❌ Error loading locations:', e);
      // Pour les rôles qui n'ont pas accès aux boutiques, c'est normal
      // Le dashboard se chargera quand même avec la boutique de l'utilisateur
      console.log('ℹ️ Locations loading failed, dashboard will use user\'s boutique');
    }
  };

  const handleLocationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value.startsWith('boutique-')) {
      const boutiqueId = parseInt(value.replace('boutique-', ''));
      console.log('🏪 Changing to boutique:', boutiqueId);
      setSelectedBoutiqueId(boutiqueId);
      setSelectedMagasinId(null);
    } else if (value.startsWith('magasin-')) {
      const magasinId = parseInt(value.replace('magasin-', ''));
      console.log('🏪 Changing to magasin:', magasinId);
      setSelectedMagasinId(magasinId);
      // Trouver la boutique associée à ce magasin
      const magasin = magasins.find(m => m.id === magasinId);
      if (magasin && magasin.boutique) {
        setSelectedBoutiqueId(magasin.boutique.id);
      }
    }
  };

  const getSelectedLocationName = () => {
    if (selectedMagasinId) {
      const magasin = magasins.find(m => m.id === selectedMagasinId);
      return magasin ? `${magasin.nom} (Magasin)` : 'Magasin inconnu';
    } else if (selectedBoutiqueId) {
      const boutique = boutiques.find(b => b.id === selectedBoutiqueId);
      return boutique ? `${boutique.nom} (Boutique)` : 'Votre boutique';
    }
    return 'Chargement...';
  };

  useEffect(() => {
    loadLocations();
  }, []);

  // Charger le dashboard initialement
  useEffect(() => {
    if (!payload) {
      load(undefined, undefined);
    }
  }, []);

  useEffect(() => {
    // Charger le dashboard quand la sélection change
    load(selectedBoutiqueId ?? undefined, selectedMagasinId ?? undefined);
  }, [selectedBoutiqueId, selectedMagasinId]);

  const exportJson = () => {
    // TODO: Implement JSON export functionality
  };

  // Récupérer les widgets pour le rôle actuel
  const getWidgetsForCurrentRole = () => {
    if (!payload) return [];
    
    console.log('🔍 getWidgetsForCurrentRole - payload:', payload);
    console.log('🔍 payload.sections:', payload.sections);
    console.log('🔍 payload.widgets:', payload.widgets);
    
    // Si des sections existent, utiliser la logique actuelle
    if (payload.sections && payload.sections.length && payload.role !== 'SUPERADMIN') {
      console.log('📋 Using sections logic');
      // Trouver la section correspondant au rôle de l'utilisateur
      const userSection = payload.sections.find(section => 
        section.role === payload.role || 
        section.role === 'ADMIN' && payload.role === 'PROPRIETAIRE' ||
        section.role === 'GERANT' && payload.role === 'GÉRANT'
      );
      
      console.log('👤 Found userSection:', userSection);
      return userSection?.widgets || [];
    }
    
    // Pour SUPERADMIN ou si pas de sections, convertir payload.widgets en format WidgetDTO[]
    if (payload.widgets) {
      console.log('🔄 Converting payload.widgets to WidgetDTO[]');
      const convertedWidgets = Object.entries(payload.widgets).map(([key, value]) => ({
        key,
        data: { value }
      }));
      console.log('📊 Converted widgets:', convertedWidgets);
      return convertedWidgets;
    }
    
    console.log('❌ No widgets found');
    return [];
  };

  // Fonction pour déterminer quels widgets afficher selon le rôle
  const getWidgetsConfig = () => {
    if (!payload) return [];
    
    const role = payload.role;
    const widgets = getWidgetsForCurrentRole();
    
    console.log('🎯 getWidgetsConfig - role:', role);
    console.log('📋 widgets:', widgets);
    
    // Configuration des widgets par rôle
    const config: any[] = [];
    
    widgets.forEach(widget => {
      const key = widget.key.toLowerCase();
      const value = widget.data?.value;
      
      console.log('🔍 Processing widget:', { key, value, originalKey: widget.key });
      
      // SUPERADMIN/DÉVELOPPEUR - Widgets techniques uniquement
      if (role === 'SUPERADMIN' || role === 'DEVELOPPEUR') {
        if (key.includes('shopscount') || key.includes('boutiques_actives')) {
          console.log('✅ Found shopsCount widget:', value);
          config.push({
            title: 'Boutiques actives',
            value: value,
            icon: 'shop',
            color: 'primary',
            type: 'number',
            subtitle: 'Nombre total de boutiques'
          });
        } else if (key.includes('userscount') || key.includes('utilisateurs_inscrits')) {
          console.log('✅ Found usersCount widget:', value);
          config.push({
            title: 'Utilisateurs inscrits',
            value: value,
            icon: 'people',
            color: 'info',
            type: 'number',
            subtitle: 'Total des comptes utilisateur'
          });
        } else if (key.includes('transactionscount') || key.includes('transactions_totales')) {
          console.log('✅ Found transactionsCount widget:', value);
          config.push({
            title: 'Transactions totales',
            value: value,
            icon: 'cash',
            color: 'success',
            type: 'number',
            subtitle: 'Nombre de transactions'
          });
        } else if (key.includes('systemerrors') || key.includes('erreurs_systeme')) {
          config.push({
            title: 'Erreurs système',
            value: value,
            icon: 'alert',
            color: value > 0 ? 'danger' : 'success',
            type: 'number',
            subtitle: value > 0 ? 'Erreurs détectées' : 'Système stable'
          });
        } else if (key.includes('servicesstatus') || key.includes('etat_services')) {
          const services = value;
          const apiStatus = services?.api || 'OK';
          const dbStatus = services?.db || 'OK';
          config.push({
            title: 'État des services',
            value: apiStatus === 'OK' && dbStatus === 'OK' ? 'Tous OK' : 'Problèmes détectés',
            icon: 'graph',
            color: apiStatus === 'OK' && dbStatus === 'OK' ? 'success' : 'warning',
            type: 'text',
            subtitle: `API: ${apiStatus} • DB: ${dbStatus}`
          });
        }
      }
      
      // ADMIN/PROPRIETAIRE - Widgets stratégiques
      if (role === 'ADMIN' || role === 'PROPRIETAIRE') {
        if (key.includes('chiffre_affaires_total') || key.includes('ca_total')) {
          config.push({
            title: 'Chiffre d\'affaires total',
            value: value,
            icon: 'money',
            color: 'primary',
            type: 'currency'
          });
        } else if (key.includes('valeur_stock') && !key.includes('magasin') && !key.includes('boutique')) {
          config.push({
            title: 'Valeur totale du stock',
            value: value,
            icon: 'box',
            color: 'success',
            type: 'currency'
          });
        } else if (key.includes('produits_forte_valeur') || key.includes('top_products')) {
          config.push({
            title: 'Produits à forte valeur',
            value: value?.length || 0,
            icon: 'alert',
            color: 'warning',
            type: 'number',
            subtitle: 'Produits stockés'
          });
        } else if (key.includes('resume_caisse') || key.includes('caisse_total')) {
          const entrees = value?.entrees || 0;
          const paiementsComplets = value?.paiements_complets || 0;
          const ventesCredit = value?.ventes_credit || 0;
          config.push({
            title: 'Résumé caisse',
            value: entrees,
            icon: 'cash',
            color: 'info',
            type: 'currency',
            subtitle: `Paiements: ${fmt(paiementsComplets)} • Crédit: ${ventesCredit}`
          });
        } else if (key.includes('evolution_ventes')) {
          config.push({
            title: 'Évolution ventes',
            value: value?.trend || 0,
            icon: 'graph',
            color: value?.trend > 0 ? 'success' : 'danger',
            type: 'trend'
          });
        } else if (key.includes('total_articles') || key.includes('articles_total')) {
          config.push({
            title: 'Total articles',
            value: value,
            icon: 'bricks',
            color: 'secondary',
            type: 'number',
            subtitle: 'Articles en stock'
          });
        } else if (key.includes('alerte_stock') || key.includes('stock_alerte')) {
          config.push({
            title: 'Alerte stock article',
            value: value,
            icon: 'alert',
            color: 'danger',
            type: 'number',
            subtitle: 'Articles en rupture'
          });
        } else if (key.includes('commande_fournisseur') || key.includes('orders_supplier')) {
          config.push({
            title: 'Commande Fournisseur',
            value: value,
            icon: 'cart',
            color: 'warning',
            type: 'number',
            subtitle: 'Commandes en cours',
            onClick: () => navigate('/liste-commandes')
          });
        } else if (key.includes('commande_client') || key.includes('orders_client')) {
          config.push({
            title: 'Commandes Client',
            value: value,
            icon: 'clipboard-check',
            color: 'primary',
            type: 'number',
            subtitle: 'Commandes clients',
            onClick: () => navigate('/liste-commandes?mode=vente')
          });
        } else if (key.includes('vente_credit') || key.includes('sales_credit')) {
          config.push({
            title: 'Vente en Credit',
            value: value,
            icon: 'cart-check',
            color: 'info',
            type: 'number',
            subtitle: 'Ventes à crédit',
            onClick: () => navigate('/liste-paiements')
          });
        }
      }
      
      // GÉRANT - Widgets opérationnels
      if (role === 'GERANT' || role === 'GÉRANT') {
        if (key.includes('ventes_jour') || key.includes('sales_today')) {
          config.push({
            title: 'Ventes du jour',
            value: value,
            icon: 'money',
            color: 'primary',
            type: 'currency'
          });
        } else if (key.includes('stock_critique') || key.includes('alertes_stock')) {
          config.push({
            title: 'Stock critique',
            value: value,
            icon: 'alert',
            color: 'danger',
            type: 'number'
          });
        } else if (key.includes('valeur_stock_boutique')) {
          config.push({
            title: 'Valeur stock boutique',
            value: value,
            icon: 'box',
            color: 'success',
            type: 'currency'
          });
        } else if (key.includes('inventaire_actif')) {
          config.push({
            title: 'Inventaire en cours',
            value: value,
            icon: 'inventory',
            color: value ? 'warning' : 'success',
            type: 'boolean'
          });
        } else if (key.includes('resume_caisse_jour')) {
          config.push({
            title: 'Résumé caisse du jour',
            value: value?.total || 0,
            icon: 'cash',
            color: 'info',
            type: 'currency'
          });
        }
      }
      
      // MAGASINIER - Widgets stock
      if (role === 'MAGASINIER') {
        if (key.includes('produits_rupture')) {
          config.push({
            title: 'Produits en rupture',
            value: value,
            icon: 'alert',
            color: 'danger',
            type: 'number'
          });
        } else if (key.includes('produits_seuil') || key.includes('sous_seuil')) {
          config.push({
            title: 'Produits sous seuil',
            value: value,
            icon: 'alert',
            color: 'warning',
            type: 'number'
          });
        } else if (key.includes('valeur_stock_magasin')) {
          config.push({
            title: 'Valeur du stock magasin',
            value: value,
            icon: 'box',
            color: 'success',
            type: 'currency'
          });
        }
      }
      
      // CAISSIER - Widgets vente
      if (role === 'CAISSIER') {
        if (key.includes('ventes_jour_personnelles') || key.includes('mes_ventes')) {
          config.push({
            title: 'Ventes du jour (perso)',
            value: value,
            icon: 'money',
            color: 'primary',
            type: 'currency'
          });
        } else if (key.includes('etat_caisse')) {
          config.push({
            title: 'État de la caisse',
            value: value?.status === 'ouvert' ? 'Ouverte' : 'Fermée',
            icon: 'cash',
            color: value?.status === 'ouvert' ? 'success' : 'secondary',
            type: 'text'
          });
        }
      }
    });
    
    // Ajouter une carte d'accès à la caisse pour ADMIN/PROPRIETAIRE
    if (role === 'ADMIN' || role === 'PROPRIETAIRE') {
      config.push({
        title: 'Accès caisse',
        value: 'Clickez pour accéder',
        icon: 'cash',
        color: 'primary',
        type: 'button',
        action: (
          <div className="card-body text-center" style={{ cursor: 'pointer' }} onClick={() => navigate('/caisses')}>
            <div className="d-flex align-items-center justify-content-between mb-3">
              <div className="d-flex align-items-center">
                <div className="bg-primary text-white rounded d-flex align-items-center justify-content-center me-3" style={{ width: 48, height: 48 }}>
                  <i className="bi bi-cash-coin fs-4"></i>
                </div>
                <div>
                  <h6 className="mb-0">Accès caisse</h6>
                  <small className="text-muted">Gestion financière</small>
                </div>
              </div>
            </div>
            <div className="text-center">
              <button className="btn btn-primary btn-sm">
                <i className="bi bi-arrow-right-circle me-1"></i>
                Accéder
              </button>
            </div>
          </div>
        )
      });
    }
    
    return config;
  };

  // Fonction pour calculer la classe de colonne optimale selon le nombre de widgets
  const getOptimalColumnClass = (widgetCount: number) => {
    if (widgetCount === 1) return 'col-12';
    if (widgetCount === 2) return 'col-md-6';
    if (widgetCount === 3) return 'col-md-4';
    if (widgetCount === 4) return 'col-md-3';
    if (widgetCount === 5) return 'col-md-4'; // 5 widgets: 3 en première ligne, 2 en deuxième
    if (widgetCount === 6) return 'col-md-4';
    if (widgetCount >= 7) return 'col-md-3'; // Pour 7+ widgets, utiliser col-3 pour un maximum de 4 par ligne
    
    return 'col-md-6'; // Par défaut
  };

  // Rendu du dashboard principal
  const renderMainDashboard = () => {
    if (!payload) return null;
    
    const role = payload.role;
    const widgetsConfig = getWidgetsConfig();
    
    return (
      <div>
        {/* Header avec info boutique */}
        <div className="card mb-4">
          <div className="card-body">
            <div className="row align-items-center">
              <div className="col">
                <div className="row align-items-center">
                  <div className="col-auto">
                    <h5 className="mb-1">
                      {role === 'ADMIN' || role === 'PROPRIETAIRE' ? 'Votre boutique' :
                       role === 'GERANT' ? 'Votre point de vente' :
                       role === 'MAGASINIER' ? 'Votre magasin' :
                       role === 'CAISSIER' ? 'Votre caisse' : 'Tableau de bord'}
                    </h5>
                  </div>
                  <div className="col">
                    <select
                      className="form-select form-select-sm"
                      value={selectedMagasinId ? `magasin-${selectedMagasinId}` : (selectedBoutiqueId ? `boutique-${selectedBoutiqueId}` : '')}
                      onChange={handleLocationChange}
                      style={{ maxWidth: '300px' }}
                      disabled={boutiques.length === 0}
                    >
                      {boutiques.length === 0 ? (
                        <option value="">
                          {getSelectedLocationName()} • Dernière mise à jour: {lastRefresh ? lastRefresh.toLocaleTimeString('fr-FR') : '--:--'}
                        </option>
                      ) : (
                        <>
                          <option value="">
                            {getSelectedLocationName()} • Dernière mise à jour: {lastRefresh ? lastRefresh.toLocaleTimeString('fr-FR') : '--:--'}
                          </option>
                          <optgroup label="🏪 Boutiques">
                            {boutiques.map(boutique => (
                              <option key={`boutique-${boutique.id}`} value={`boutique-${boutique.id}`}>
                                {boutique.nom} (Boutique principale)
                              </option>
                            ))}
                          </optgroup>
                          {magasins.length > 0 && (
                            <optgroup label="🏬 Magasins">
                              {magasins.map(magasin => (
                                <option key={`magasin-${magasin.id}`} value={`magasin-${magasin.id}`}>
                                  {magasin.nom} ({magasin.typeMagasin || 'Magasin'})
                                </option>
                              ))}
                            </optgroup>
                          )}
                        </>
                      )}
                    </select>
                  </div>
                </div>
                <p className="text-muted mb-0 mt-2">
                  Sélectionnez une boutique pour afficher ses données
                </p>
              </div>
              <div className="col-auto">
                <button className="btn btn-outline-primary btn-sm" onClick={() => load()}>
                  <i className="bi bi-arrow-clockwise me-1"></i> Rafraîchir
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Widgets principaux */}
        {widgetsConfig.length > 0 ? (
          <div className="row g-4">
            {widgetsConfig.map((widget, index) => (
              <div key={index} className={getOptimalColumnClass(widgetsConfig.length)}>
                <WidgetCard {...widget} />
              </div>
            ))}
          </div>
        ) : (
          <div className="alert alert-info">
            <i className="bi bi-info-circle me-2"></i>
            Aucun widget disponible pour votre rôle ({role}).
          </div>
        )}

        {/* Card: nationalité des boutiques (SUPERADMIN seulement) */}
        {role === 'SUPERADMIN' && boutiques && boutiques.length > 0 && (
          <div className="row g-4 mt-3">
            <div className="col-12">
              <div className="card">
                <div className="card-header d-flex align-items-center justify-content-between">
                  <h6 className="mb-0">Nationalité des boutiques</h6>
                  <small className="text-muted">{boutiques.length} boutiques</small>
                </div>
                <div className="card-body">
                  <div className="row g-2">
                    {boutiques.map((b) => (
                      <div key={b.id} className="col-sm-6 col-md-4">
                        <div className="d-flex align-items-center gap-3">
                          {b.pays?.codeIso ? (
                            <span className={`fi fi-${b.pays.codeIso.toLowerCase()}`} style={{ fontSize: 22 }} aria-hidden></span>
                          ) : (
                            <i className="bi bi-geo-alt fs-4 text-muted"></i>
                          )}
                          <div>
                            <div className="fw-semibold">{b.nom}</div>
                            <div className="text-muted small">{b.pays?.nom || b.pays?.codeIso || 'Inconnue'}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Graphique Top 5 produits pour ADMIN */}
        {(role === 'ADMIN' || role === 'PROPRIETAIRE') && (
          <div className="mt-4">
            <div className="card">
              <div className="card-body">
                <h5 className="card-title">Top 5 des Produits les plus vendus</h5>
                {payload.widgets?.top_products && Array.isArray(payload.widgets.top_products) && payload.widgets.top_products.length > 0 ? (
                  <div style={{ height: '350px' }}>
                    <Bar
                      data={{
                        labels: payload.widgets.top_products.map((p: any) => p.name || `Produit ${p.id}`),
                        datasets: [
                          {
                            label: 'Quantité vendue',
                            data: payload.widgets.top_products.map((p: any) => p.sold || 0),
                            backgroundColor: '#4154f1',
                          },
                        ],
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            position: 'top' as const,
                          },
                          title: {
                            display: false,
                          },
                        },
                        scales: {
                          y: {
                            beginAtZero: true,
                          },
                        },
                      }}
                    />
                  </div>
                ) : (
                  <div className="text-center py-5">
                    <i className="bi bi-bar-chart-line fs-1 text-muted mb-3"></i>
                    <p className="text-muted">Aucune donnée de vente disponible pour le moment</p>
                    <small className="text-muted">
                      Données reçues: {JSON.stringify(payload.widgets?.top_products)}
                    </small>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Bilan des ventes et trimestriel pour ADMIN */}
        {(role === 'ADMIN' || role === 'PROPRIETAIRE') && (
          <div className="row mt-4">
            {payload.widgets?.bilan_ventes && (
              <div className="col-xxl-6 col-md-6 col-sm-12">
                <div className="card info-card revenue-card">
                  <div className="card-header bg-primary text-white text-center">
                    <h5>Bilan des ventes</h5>
                  </div>
                  <div className="card-body d-flex justify-content-around mt-3">
                    <div className="text-center">
                      <p>Ventes journalières</p>
                      <i className="bi bi-camera"></i>
                      <p><span className="text-primary">Vente totale</span></p>
                      <p>{fmt(payload.widgets.bilan_ventes.dailyTotal || 0)}</p>
                      <p><span className="text-primary">Créance totale</span></p>
                      <p>{fmt(payload.widgets.bilan_ventes.dailyCredit || 0)}</p>
                      <p><span className="text-primary">Montant en caisse</span></p>
                      <p>{fmt(payload.widgets.bilan_ventes.dailyCash || 0)}</p>
                      <p className="text-primary">{new Date().toLocaleDateString('fr-FR')}</p>
                    </div>
                    <div className="text-center">
                      <p>Ventes mensuelles</p>
                      <i className="bi bi-camera"></i>
                      <p><span className="text-primary">Vente totale</span></p>
                      <p>{fmt(payload.widgets.bilan_ventes.monthlyTotal || 0)}</p>
                      <p><span className="text-primary">Créance totale</span></p>
                      <p>{fmt(payload.widgets.bilan_ventes.monthlyCredit || 0)}</p>
                      <p><span className="text-primary">Montant en caisse</span></p>
                      <p>{fmt(payload.widgets.bilan_ventes.monthlyCash || 0)}</p>
                      <p className="text-primary">{new Date().toLocaleDateString('fr-FR', { month: 'numeric', year: 'numeric' })}</p>
                    </div>
                    <div className="text-center">
                      <p>Ventes annuelles</p>
                      <i className="bi bi-camera"></i>
                      <p><span className="text-primary">Vente totale</span></p>
                      <p>{fmt(payload.widgets.bilan_ventes.annualTotal || 0)}</p>
                      <p><span className="text-primary">Créance totale</span></p>
                      <p>{fmt(payload.widgets.bilan_ventes.annualCredit || 0)}</p>
                      <p><span className="text-primary">Montant en caisse</span></p>
                      <p>{fmt(payload.widgets.bilan_ventes.annualCash || 0)}</p>
                      <p className="text-primary">{new Date().getFullYear()}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {payload.widgets?.bilan_trimestriel && (
              <div className="col-xxl-6 col-md-6 col-sm-12">
                <div className="card info-card revenue-card">
                  <div className="card-header bg-primary text-white text-center">
                    <h5>Bilan Trimestriel</h5>
                  </div>
                  <div className="card-body">
                    <div className="row">
                      <div className="col-md-6 text-center">
                        <p className="text-primary">Total des ventes du trimestre</p>
                        <p><strong>{fmt(payload.widgets.bilan_trimestriel.totalVentesTrimestre || 0)}</strong></p>
                      </div>
                      <div className="col-md-6 text-center">
                        <p className="text-primary">Bénéfice du trimestre</p>
                        <p><strong>{fmt(payload.widgets.bilan_trimestriel.beneficeTrimestriel || 0)}</strong></p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Rendu des dashboards des subalternes (pour ADMIN uniquement)
  const renderSubordinatesDashboard = () => {
    if (subordinates.length === 0) {
      return (
        <div className="alert alert-info">
          <i className="bi bi-info-circle me-2"></i>
          Aucun subalterne trouvé ou aucun dashboard disponible.
        </div>
      );
    }
    
    return (
      <div>
        <div className="row g-4">
          {subordinates.map((sub, index) => (
            <div key={index} className="col-xl-4 col-lg-6 col-md-6">
              <SubordinateDashboardCard 
                role={sub.role}
                name={sub.name || `Subalterne ${index + 1}`}
                widgets={sub.widgets}
                shopName={sub.shopName || 'Boutique'}
              />
            </div>
          ))}
        </div>
        
        <div className="mt-4">
          <div className="card">
            <div className="card-header">
              <h6 className="mb-0">Résumé des performances</h6>
            </div>
            <div className="card-body">
              <div className="table-responsive">
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>Rôle</th>
                      <th>Nombre</th>
                      <th>Ventes moyennes</th>
                      <th>Alertes stock</th>
                      <th>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {['GERANT', 'MAGASINIER', 'CAISSIER'].map(role => {
                      const subsByRole = subordinates.filter(s => s.role === role);
                      const avgSales = subsByRole.length > 0 
                        ? subsByRole.reduce((sum, sub) => {
                            const ventes = sub.widgets?.find((w: any) => 
                              w.key.toLowerCase().includes('ventes'))?.data?.value || 0;
                            return sum + ventes;
                          }, 0) / subsByRole.length
                        : 0;
                      
                      const totalAlerts = subsByRole.reduce((sum, sub) => {
                        const alerts = sub.widgets?.find((w: any) => 
                          w.key.toLowerCase().includes('alert'))?.data?.value || 0;
                        return sum + alerts;
                      }, 0);
                      
                      return (
                        <tr key={role}>
                          <td>
                            <span className="me-2">
                              {role === 'GERANT' ? '👨‍💼' : 
                               role === 'MAGASINIER' ? '📦' : '💰'}
                            </span>
                            {role}
                          </td>
                          <td><strong>{subsByRole.length}</strong></td>
                          <td className="text-primary">{fmt(avgSales)}</td>
                          <td className={totalAlerts > 0 ? 'text-danger' : 'text-success'}>
                            <strong>{totalAlerts}</strong>
                          </td>
                          <td>
                            <span className={`badge ${subsByRole.length > 0 ? 'bg-success' : 'bg-secondary'}`}>
                              {subsByRole.length > 0 ? 'Actif' : 'Inactif'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) return (
    <div className="d-flex justify-content-center align-items-center" style={{ height: '50vh' }}>
      <div className="text-center">
        <div className="spinner-border text-primary mb-3" role="status"></div>
        <p>Chargement du tableau de bord...</p>
      </div>
    </div>
  );
  
  if (error) return (
    <div className="alert alert-danger">
      <i className="bi bi-exclamation-triangle me-2"></i>
      {error}
      <button className="btn btn-sm btn-outline-danger ms-3" onClick={() => load()}>
        Réessayer
      </button>
    </div>
  );
  
  if (!payload) return (
    <div className="alert alert-info">
      <i className="bi bi-info-circle me-2"></i>
      Aucune donnée disponible pour le tableau de bord.
    </div>
  );

  const role = payload.role;
  const shopInfo = payload.sections?.[0]?.shops?.[0] || {};

  return (
    <div className="container-fluid">
      <style dangerouslySetInnerHTML={{
        __html: `
          .bi.bi-cart, .ri-caravan-line, .bi-cart-check, .bi-cart-x-fill, .bi-exclamation-triangle, .bi-person-fill {
            font-size: 50px;
          }
        `
      }} />
      {/* Header principal */}
      <div className="page-breadcrumb mb-4">
        <nav aria-label="breadcrumb">
          <ol className="breadcrumb">
            <li className="breadcrumb-item"><a href="/"><i className="bi bi-house-door"></i></a></li>
            <li className="breadcrumb-item active">
              {role === 'ADMIN' || role === 'PROPRIETAIRE' ? 'Tableau de bord propriétaire' : 
               role === 'SUPERADMIN' || role === 'DEVELOPPEUR' ? 'Tableau de bord développeur' :
               role === 'GERANT' ? 'Tableau de bord gérant' : 
               role === 'MAGASINIER' ? 'Tableau de bord magasinier' : 
               role === 'CAISSIER' ? 'Tableau de bord caissier' : 
               'Tableau de bord'}
            </li>
          </ol>
        </nav>
        
        <div className="d-flex justify-content-between align-items-center">
          {/* Sélecteur de boutique */}
          {boutiques.length > 1 && (
            <div className="d-flex align-items-center me-3">
              <label htmlFor="boutiqueSelect" className="form-label me-2 mb-0 fw-bold">
                Boutique:
              </label>
              <select
                id="boutiqueSelect"
                className="form-select form-select-sm"
                value={selectedBoutiqueId || ''}
                onChange={(e) => setSelectedBoutiqueId(Number(e.target.value))}
                style={{ minWidth: '200px' }}
              >
                {boutiques.map(boutique => (
                  <option key={boutique.id} value={boutique.id}>
                    {boutique.nom}
                  </option>
                ))}
              </select>
            </div>
          )}
          
          <div className="d-flex align-items-center">
            {(role === 'ADMIN' || role === 'PROPRIETAIRE' || role === 'SUPERADMIN') && (
              <button className="btn btn-outline-primary me-2" onClick={exportJson}>
                <i className="bi bi-download me-1"></i> Exporter
              </button>
            )}
            <button className="btn btn-primary" onClick={() => load()}>
              <i className="bi bi-arrow-clockwise me-1"></i> Actualiser
            </button>
          </div>
        </div>
      </div>

      {/* Navigation par onglets pour ADMIN */}
      {(role === 'ADMIN' || role === 'PROPRIETAIRE') && (
        <div className="card mb-4">
          <div className="card-body">
            <ul className="nav nav-tabs nav-tabs-bordered">
              <li className="nav-item">
                <button 
                  className={`nav-link ${activeTab === 'own' ? 'active' : ''}`}
                  onClick={() => setActiveTab('own')}
                >
                  <i className="bi bi-speedometer2 me-2"></i>
                  Mon tableau de bord
                </button>
              </li>
              <li className="nav-item">
                <button 
                  className={`nav-link ${activeTab === 'subordinates' ? 'active' : ''}`}
                  onClick={() => setActiveTab('subordinates')}
                >
                  <i className="bi bi-people me-2"></i>
                  Vision globale ({subordinates.length})
                </button>
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* Contenu principal */}
      <div className="row">
        <div className="col-12">
          {(role === 'ADMIN' || role === 'PROPRIETAIRE') ? (
            <>
              {activeTab === 'own' && renderMainDashboard()}
              {activeTab === 'subordinates' && renderSubordinatesDashboard()}
            </>
          ) : (
            renderMainDashboard()
          )}
        </div>
      </div>

      {/* Footer avec informations */}
      <div className="mt-5 pt-4 border-top">
        <div className="row">
          <div className="col-md-6">
            <small className="text-muted">
              <i className="bi bi-shield-check me-1"></i>
              Système sécurisé • Dernière mise à jour: {lastRefresh ? lastRefresh.toLocaleString('fr-FR') : '--'}
            </small>
          </div>
          <div className="col-md-6 text-end">
            <small className="text-muted">
              Rôle: <strong>{role}</strong> • 
              {shopInfo.nom && ` Boutique: ${shopInfo.nom}`}
            </small>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoleBasedDashboard;