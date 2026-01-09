import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';

const SignIn = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { setUserData } = useUser();

  useEffect(() => {
    // Removed redirect if token, to always show sign-in
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('http://localhost:8085/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Échec de la connexion');
      }
      const data = await res.json();
      if (data.token) {
        localStorage.setItem('smb_token', data.token);

        const profileRes = await fetch('http://localhost:8085/api/auth/me', {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${data.token}`
          }
        });

        if (!profileRes.ok) {
          throw new Error('Impossible de charger votre profil');
        }

        const profileData = await profileRes.json();
        setUserData(profileData);
        localStorage.setItem('smb_user_data', JSON.stringify(profileData));
        navigate('/produits');
      } else {
        throw new Error('Aucun jeton renvoyé');
      }
    } catch (err: any) {
      localStorage.removeItem('smb_token');
      setError(err.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="account-pages pt-2 pt-sm-5 pb-4 pb-sm-5">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-xxl-4 col-lg-5">
            <div className="card">
              <div className="card-header pt-4 pb-4 text-center bg-primary">
                <a href="/">
                  <span>
                    <img src="/images/logo.png" alt="logo" height="18" />
                  </span>
                </a>
              </div>
              <div className="card-body p-4">
                <div className="text-center w-75 m-auto">
                  <h4 className="text-dark-50 text-center pb-0 fw-bold">Connexion</h4>
                  <p className="text-muted mb-4">Entrez votre adresse email et mot de passe pour accéder au panneau d'administration.</p>
                </div>
                {error && <div className="alert alert-danger">{error}</div>}
                <form onSubmit={handleSubmit}>
                  <div className="mb-3">
                    <label htmlFor="emailaddress" className="form-label">Adresse email</label>
                    <input
                      className="form-control"
                      type="email"
                      id="emailaddress"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="Entrez votre email"
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label htmlFor="password" className="form-label">Mot de passe</label>
                    <input
                      className="form-control"
                      type="password"
                      id="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Entrez votre mot de passe"
                      required
                    />
                  </div>
                  <div className="mb-3 mb-0 text-center">
                    <button className="btn btn-primary" type="submit" disabled={loading}>
                      {loading ? 'Connexion...' : 'Se connecter'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
            <div className="row mt-3">
              <div className="col-12 text-center">
                <p className="text-muted">Vous n'avez pas de compte ? <a href="#" className="text-muted ms-1"><b>Mot de passe oublié ?</b></a></p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignIn;