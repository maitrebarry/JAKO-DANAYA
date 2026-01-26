import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import SignIn from './components/SignIn';
import Layout from './components/Layout';
// Dashboard component: role-based implementation
import Configuration from './components/Configuration';
import Documentation from './components/Documentation';
import ErrorBoundary from './components/ErrorBoundary';
import RoleBasedDashboard from './components/RoleBasedDashboard';
import Fournisseurs from './components/Fournisseurs';
import Produits from './components/Produits';
import CommandeFournisseur from './components/CommandeFournisseur';
import CommandeClient from './components/CommandeClient';
import CommandeApercu from './components/CommandeApercu';
import ApercuCommandeClient from './components/ApercuCommandeClient';
import ListeCommandes from './components/ListeCommandes';
import Reception from './components/Reception';
import PaiementCommande from './components/PaiementCommande';
import CaisseRegistre from './components/CaisseRegistre';
import CaisseMovements from './components/CaisseMovements';
import DepenseList from './components/DepenseList';
import DepenseDetail from './components/DepenseDetail';
import DetailReception from './components/DetailReception';
import Historique from './components/Historique';
import VentesHistorique from './components/VentesHistorique';
import VentesEspeces from './components/VentesEspeces';
import VenteLivraison from './components/VenteLivraison';
import VenteEnEspece from './components/VenteEnEspece';
import VenteApercuEspece from './components/VenteApercuEspece';
import Transfert from './components/Transfert';
import Mouvements from './components/Mouvements';
import Inventaires from './components/Inventaires';
import InventaireDetail from './components/InventaireDetail';
import InventaireCreate from './components/InventaireCreate';
import Profile from './components/Profile';
import Documents from './components/Documents';
import Rapports from './components/Rapports';
import { UserProvider } from './contexts/UserContext';
const UtilisationsPage = React.lazy(() => import('./components/UtilisationsPage'));


// Composant pour protéger les routes
const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem('smb_token');
  return token ? <>{children}</> : <Navigate to="/" />;
};

function App() {
  return (
    <Router>
      <UserProvider>
        <Routes>
          <Route path="/" element={<SignIn />} />
          <Route 
            path="/configuration" 
            element={
              <PrivateRoute>
                <Layout><Configuration /></Layout>
              </PrivateRoute>
            } 
          />
          <Route 
            path="/documentation" 
            element={
              <PrivateRoute>
                <Layout><Documentation /></Layout>
              </PrivateRoute>
            } 
          />
          <Route 
            path="/dashboard" 
            element={
              <PrivateRoute>
                <Layout><RoleBasedDashboard /></Layout>
              </PrivateRoute>
            } 
          />
          <Route 
            path="/fournisseurs" 
            element={
              <PrivateRoute>
                <Layout><Fournisseurs /></Layout>
              </PrivateRoute>
            }
          />
          <Route 
            path="/produits" 
            element={
              <PrivateRoute>
                <Layout>
                  <React.Suspense fallback={<div>Chargement...</div>}>
                    <ErrorBoundary>
                      <Produits />
                    </ErrorBoundary>
                  </React.Suspense>
                </Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/produits/transfert"
            element={
              <PrivateRoute>
                <Layout><Transfert /></Layout>
              </PrivateRoute>
            }
          />
          <Route 
            path="/commande-fournisseur" 
            element={
              <PrivateRoute>
                <Layout><CommandeFournisseur /></Layout>
              </PrivateRoute>
            }
          />
          <Route 
            path="/commandes/update/:id" 
            element={
              <PrivateRoute>
                <Layout><CommandeFournisseur /></Layout>
              </PrivateRoute>
            }
          />
          {/* Commande client (vente) - nouveau composant */}
          <Route 
            path="/commande-client" 
            element={
              <PrivateRoute>
                <Layout><CommandeClient /></Layout>
              </PrivateRoute>
            } 
          />
          <Route 
            path="/commandes-clients/update/:id" 
            element={
              <PrivateRoute>
                <Layout><CommandeClient /></Layout>
              </PrivateRoute>
            } 
          />          <Route 
            path="/liste-commandes" 
            element={
              <PrivateRoute>
                <Layout><ListeCommandes /></Layout>
              </PrivateRoute>
            }
          />
          <Route 
            path="/commandes/reception/:id" 
            element={
              <PrivateRoute>
                <Layout><Reception /></Layout>
              </PrivateRoute>
            }
          />
          <Route 
            path="/commandes/appercu/:id" 
            element={
              <PrivateRoute>
                <Layout><CommandeApercu /></Layout>
              </PrivateRoute>
            }
          />
          <Route 
            path="/commandes/paiement/:id" 
            element={
              <PrivateRoute>
                <Layout><PaiementCommande /></Layout>
              </PrivateRoute>
            }
          />
          <Route 
            path="/liste-receptions" 
            element={
              <PrivateRoute>
                <Layout><Historique /></Layout>
              </PrivateRoute>
            }
          />
          <Route 
            path="/historique" 
            element={
              <PrivateRoute>
                <Layout><Historique /></Layout>
              </PrivateRoute>
            }
          />
          <Route 
            path="/receptions/:id" 
            element={
              <PrivateRoute>
                <Layout><DetailReception /></Layout>
              </PrivateRoute>
            }
          />
          <Route 
            path="/liste-paiements" 
            element={
              <PrivateRoute>
                <Layout><Historique /></Layout>
              </PrivateRoute>
            }
          />

          <Route
            path="/caisses"
            element={
              <PrivateRoute>
                <Layout><CaisseRegistre /></Layout>
              </PrivateRoute>
            }
          />

          <Route
            path="/caisses/movements"
            element={
              <PrivateRoute>
                <Layout><CaisseMovements /></Layout>
              </PrivateRoute>
            }
          />

          <Route
            path="/utilisations"
            element={
              <PrivateRoute>
                <Layout>
                  <React.Suspense fallback={<div>Chargement...</div>}>
                    <UtilisationsPage />
                  </React.Suspense>
                </Layout>
              </PrivateRoute>
            }
          />

          <Route
            path="/depenses"
            element={
              <PrivateRoute>
                <Layout><DepenseList /></Layout>
              </PrivateRoute>
            }
          />

          <Route
            path="/documents"
            element={
              <PrivateRoute>
                <Layout><Documents /></Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/rapports"
            element={
              <PrivateRoute>
                <Layout><Rapports /></Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/depenses/:id"
            element={
              <PrivateRoute>
                <Layout><DepenseDetail /></Layout>
              </PrivateRoute>
            }
          />

          {/* Ventes */}
          <Route
            path="/ventes"
            element={
              <PrivateRoute>
                <Layout><CommandeClient /></Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/ventes/update/:id"
            element={
              <PrivateRoute>
                <Layout><CommandeClient /></Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/ventes/livraisons"
            element={
              <PrivateRoute>
                <Layout><VenteLivraison /></Layout>
              </PrivateRoute>
            }
          />

          <Route
            path="/ventes/espece"
            element={
              <PrivateRoute>
                <Layout><VenteEnEspece /></Layout>
              </PrivateRoute>
            }
          />
          <Route 
            path="/ventes/appercu/:id"
            element={
              <PrivateRoute>
                <Layout><CommandeApercu /></Layout>
              </PrivateRoute>
            }
          />
          <Route 
            path="/commandes-clients/appercu/:id"
            element={
              <PrivateRoute>
                <Layout><ApercuCommandeClient /></Layout>
              </PrivateRoute>
            }
          />
          <Route 
            path="/ventes/espece/appercu/:id"
            element={
              <PrivateRoute>
                <Layout><VenteApercuEspece /></Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/ventes/historique"
            element={
              <PrivateRoute>
                <Layout><VentesHistorique /></Layout>
              </PrivateRoute>
            }
          />

          <Route
            path="/mouvements"
            element={
              <PrivateRoute>
                <Layout><Mouvements /></Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/inventaires"
            element={
              <PrivateRoute>
                <Layout><Inventaires /></Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/inventaires/new"
            element={
              <PrivateRoute>
                <Layout><InventaireCreate /></Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/inventaires/:id"
            element={
              <PrivateRoute>
                <Layout><InventaireDetail /></Layout>
              </PrivateRoute>
            }
          />
          <Route 
            path="/profile" 
            element={
              <PrivateRoute>
                <Layout><Profile /></Layout>
              </PrivateRoute>
            } 
          />
          <Route
            path="/ventes/especes"
            element={
              <PrivateRoute>
                <Layout><VentesEspeces /></Layout>
              </PrivateRoute>
            }
          />
        </Routes>
      </UserProvider>
    </Router>
  );
}

export default App;