import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { withApi } from '../config/api';

import bg1 from '../../assets/images/jako_danaya.png';
import bg2 from '../../assets/images/jako_danaya2.png';

const SignIn = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { setUserData } = useUser();

  // Background image rotation for login page (switch every 60s)
  const [bgImage, setBgImage] = useState<string>(bg1);
  useEffect(() => {
    const interval = setInterval(() => {
      setBgImage(prev => prev === bg1 ? bg2 : bg1);
    }, 60000); // switch every 60s
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(withApi('auth/login'), {
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

        const profileRes = await fetch(withApi('auth/me'), {
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
        navigate('/dashboard');
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
    <div className="account-pages pt-2 pt-sm-5 pb-4 pb-sm-5" style={{
      backgroundImage: `url(${bgImage})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      minHeight: '100vh'
    }}>
      <div className="container">
        <div className="row justify-content-end">
          <div className="col-xxl-4 col-lg-5 ms-md-4 ms-lg-5">
            <div className="card">
              <div className="card-header pt-4 pb-4 text-center bg-primary">
                <span className="fw-bold text-white" style={{
                  background: 'linear-gradient(45deg, #007bff, #6610f2)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  textShadow: '1px 1px 0px #ccc, 2px 2px 0px #bbb, 3px 3px 0px #aaa',
                  fontFamily: 'Arial, sans-serif',
                  fontSize: '3.3rem',
                  lineHeight: '1',
                  whiteSpace: 'nowrap'
                }}>
                  JÀGO DÁNAYA
                </span>
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
                    <input className="form-control" type="email" id="emailaddress" value={email} onChange={e => setEmail(e.target.value)} placeholder="Entrez votre email" required />
                  </div>
                  <div className="mb-3">
                    <label htmlFor="password" className="form-label">Mot de passe</label>
                    <input className="form-control" type="password" id="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Entrez votre mot de passe" required />
                  </div>
                  <div className="mb-3 mb-0 text-center">
                    <button className="btn btn-primary" type="submit" disabled={loading}>{loading ? 'Connexion...' : 'Se connecter'}</button>
                  </div>
                  <div className="mt-3 text-center">
                    <p className="text-muted mb-0">Vous n'avez pas de compte ? <a href="#" className="text-muted ms-1"><b>Mot de passe oublié ?</b></a></p>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignIn;