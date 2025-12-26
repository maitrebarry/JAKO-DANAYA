import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import SignIn from './components/SignIn';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Configuration from './components/Configuration';
import Fournisseurs from './components/Fournisseurs';
import Produits from './components/Produits';
import CommandeFournisseur from './components/CommandeFournisseur';
import CommandeApercu from './components/CommandeApercu';
import ListeCommandes from './components/ListeCommandes';
import Reception from './components/Reception';
import PaiementCommande from './components/PaiementCommande';
import DetailReception from './components/DetailReception';
import Historique from './components/Historique';
import { UserProvider } from './contexts/UserContext';

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
            path="/dashboard" 
            element={
              <PrivateRoute>
                <Layout><Dashboard /></Layout>
              </PrivateRoute>
            } 
          />
          <Route 
            path="/configuration" 
            element={
              <PrivateRoute>
                <Layout><Configuration /></Layout>
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
                <Layout><Produits /></Layout>
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
          <Route 
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
        </Routes>
      </UserProvider>
    </Router>
  );
}

export default App;