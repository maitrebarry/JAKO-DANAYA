import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { withApi } from '../config/api';

import bg1 from '../../assets/images/jako_danaya.png';
import bg2 from '../../assets/images/jako_danaya2.png';

const ResetPassword = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const [bgImage, setBgImage] = useState<string>(bg1);
  useEffect(() => {
    const interval = setInterval(() => {
      setBgImage(prev => prev === bg1 ? bg2 : bg1);
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const t = params.get('token') || '';
    setToken(t);
  }, [location.search]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      Swal.fire('Erreur', 'Token manquant ou invalide.', 'error');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      Swal.fire('Erreur', 'Le mot de passe doit contenir au moins 6 caractères.', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      Swal.fire('Erreur', 'Les mots de passe ne correspondent pas.', 'error');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(withApi('auth/reset-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Token invalide ou expiré');
      }
      Swal.fire('Succès', 'Mot de passe mis à jour. Vous pouvez vous connecter.', 'success');
      navigate('/');
    } catch (e: any) {
      Swal.fire('Erreur', e.message || 'Impossible de réinitialiser le mot de passe', 'error');
    } finally {
      setLoading(false);
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
                  JÀGO DÁNAYA
                </span>
              </div>
              <div className="card-body p-4">
                <div className="text-center w-75 m-auto">
                  <h4 className="text-dark-50 text-center pb-0 fw-bold">Réinitialiser le mot de passe</h4>
                  <p className="text-muted mb-4">Choisissez un nouveau mot de passe sécurisé.</p>
                </div>
                <form onSubmit={handleSubmit}>
                  <div className="mb-3">
                    <label htmlFor="newPassword" className="form-label">Nouveau mot de passe</label>
                    <input className="form-control form-control-lg" type="password" id="newPassword" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Nouveau mot de passe" required />
                  </div>
                  <div className="mb-3">
                    <label htmlFor="confirmPassword" className="form-label">Confirmer le mot de passe</label>
                    <input className="form-control form-control-lg" type="password" id="confirmPassword" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirmer" required />
                  </div>
                  <div className="mb-3 mb-0 text-center">
                    <button className="btn btn-primary btn-lg w-100" type="submit" disabled={loading}>{loading ? 'En cours...' : 'Mettre à jour'}</button>
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

export default ResetPassword;
