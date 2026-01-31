import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { withApi } from '../config/api';
import Swal from 'sweetalert2';

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

  // Ensure the SignIn page respects the user's stored theme preference
  useEffect(() => {
    try {
      const stored = localStorage.getItem('__D_THEME__');
      const html = document.documentElement;
      if (stored === 'dark') {
        html.setAttribute('data-bs-theme', 'dark');
        html.setAttribute('data-topbar-color', 'dark');
      } else {
        html.setAttribute('data-bs-theme', 'light');
        html.setAttribute('data-topbar-color', 'light');
      }
    } catch (e) {
      // ignore (server-side rendering or restricted storage)
    }
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

  const handleForgotPassword = async () => {
    const { value: emailInput } = await Swal.fire({
      title: 'Mot de passe oublié',
      input: 'email',
      inputLabel: 'Adresse email',
      inputPlaceholder: 'Entrez votre email',
      confirmButtonText: 'Envoyer',
      showCancelButton: true,
      cancelButtonText: 'Annuler'
    });

    if (!emailInput) return;

    try {
      const res = await fetch(withApi('auth/forgot-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput })
      });
      if (!res.ok) throw new Error('Fonctionnalité non activée');
      Swal.fire('Succès', 'Un lien de réinitialisation a été envoyé si l’email existe.', 'success');
    } catch (e: any) {
      Swal.fire('Info', e.message || 'Fonctionnalité non activée', 'info');
    }
  };

  return (
    <div className="account-pages pt-2 pt-sm-5 pb-4 pb-sm-5 d-flex align-items-center" style={{
      backgroundImage: `url(${bgImage})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      minHeight: '100vh'
    }}>
      <div className="container-fluid">
        <div className="row justify-content-end">
          <div className="col-12 col-sm-10 col-md-8 col-lg-6 col-xl-5 col-xxl-4 me-lg-4 me-xl-5">
            <div className="card">
              <div className="card-header pt-4 pb-4 text-center bg-primary">
                <span className="fw-bold text-white" style={{
                  background: 'linear-gradient(45deg, #007bff, #6610f2)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  textShadow: '1px 1px 0px #ccc, 2px 2px 0px #bbb, 3px 3px 0px #aaa',
                  fontFamily: 'Arial, sans-serif',
                  fontSize: '3rem',
                  lineHeight: '1',
                  whiteSpace: 'nowrap'
                }}>
                  JÀGO DÁNNAYA
                </span>
              </div>
              <div className="card-body p-4">
                <div className="text-center w-75 m-auto">
                  <h4 className="text-dark-50 text-center pb-0 fw-bold">Connexion</h4>
                  <p className="text-muted mb-4">Entrez votre adresse email et mot de passe pour accéder à JÀGO DÁNAYA.</p>
                </div>
                {error && <div className="alert alert-danger">{error}</div>}
                <form onSubmit={handleSubmit}>
                  <div className="mb-3">
                    <label htmlFor="emailaddress" className="form-label">Adresse email</label>
                    <input className="form-control form-control-lg" type="email" id="emailaddress" value={email} onChange={e => setEmail(e.target.value)} placeholder="Entrez votre email" required />
                  </div>
                  <div className="mb-3">
                    <label htmlFor="password" className="form-label">Mot de passe</label>
                    <input className="form-control form-control-lg" type="password" id="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Entrez votre mot de passe" required />
                  </div>
                  <div className="mb-3 mb-0 text-center">
                    <button className="btn btn-primary btn-lg w-100" type="submit" disabled={loading}>{loading ? 'Connexion...' : 'Se connecter'}</button>
                  </div>
                  <div className="text-center my-3">
                    <span className="text-muted">ou</span>
                  </div>

                  <a className="btn btn-outline-secondary w-100" href={`${withApi('')}`.replace(/\/api\/?$/, '') + '/oauth2/authorization/google'}>
                    <i className="bi bi-google me-2"></i> Se connecter avec Google
                  </a>

                  <div className="mt-3 text-center">
                    <button type="button" className="btn btn-link text-muted p-0" onClick={handleForgotPassword}>
                      Mot de passe oublié ?
                    </button>
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