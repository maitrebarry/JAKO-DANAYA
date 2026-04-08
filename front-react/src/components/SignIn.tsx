import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { withApi } from '../config/api';
import Swal from 'sweetalert2';
import { fetchCurrentSubscriptionStatus } from '../api/admin';
import { fetchSubscriptionPlansForOwner, submitManualSubscriptionPayment } from '../api/subscription';

import bg1 from '../../assets/images/jako_danaya.png';
import bg2 from '../../assets/images/jako_danaya2.png';

const SignIn = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { setUserData } = useUser();

  const openRenewSubscriptionModal = async () => {
    try {
      const sub = await fetchCurrentSubscriptionStatus();
      if (!sub || !sub.configured) return;

      const currentPlanCode = (sub.planCode || 'MENSUEL').toUpperCase();
      let capturedFile: File | null = null;
      let stream: MediaStream | null = null;

      const stopCamera = () => {
        if (stream) {
          stream.getTracks().forEach((t) => t.stop());
          stream = null;
        }
      };

      const plans = await fetchSubscriptionPlansForOwner().catch(() => [] as any[]);
      const planList = Array.isArray(plans) ? plans : [];
      const defaultPlanCode = (planList.find((p: any) => String(p?.code || '').toUpperCase() === currentPlanCode)?.code || planList[0]?.code || currentPlanCode || 'MENSUEL') as string;
      const amountFor = (code: string) => {
        const p = planList.find((x: any) => String(x?.code || '').toUpperCase() === String(code || '').toUpperCase());
        const price = p?.prix != null ? Number(p.prix) : null;
        const currency = p?.devise || 'XOF';
        return price != null ? `${price} ${currency}` : 'Voir plan actif';
      };
      const planSelectOptions = planList.map((p: any) => {
        const code = String(p?.code || '');
        const label = String(p?.libelle || code || 'Plan');
        return `<option value="${code}" ${String(code).toUpperCase() === String(defaultPlanCode).toUpperCase() ? 'selected' : ''}>${label} (${code})</option>`;
      }).join('');

      const ask = await Swal.fire({
        title: 'Soumettre une preuve de réabonnement',
        html: `
          <div class="text-start">
            <label class="form-label mt-1">Formule d'abonnement</label>
            <select id="swal-sub-plan" class="swal2-input" style="margin:0 0 10px 0;width:100%">
              ${planSelectOptions || `<option value="${defaultPlanCode}" selected>${defaultPlanCode}</option>`}
            </select>
            <div class="mb-2"><strong>Montant à payer</strong>: <span id="swal-sub-amount">${amountFor(defaultPlanCode)}</span></div>
            <label class="form-label mt-1">Canal utilisé</label>
            <select id="swal-sub-mode" class="swal2-input" style="margin:0 0 10px 0;width:100%">
              <option value="ORANGE_MONEY">Orange Money</option>
              <option value="WAVE">Wave</option>
              <option value="MOBICASH">MobiCash</option>
            </select>
            <label class="form-label">Référence transfert (optionnel)</label>
            <input id="swal-sub-ref" class="swal2-input" style="margin:0 0 10px 0;width:100%" placeholder="Ex: OM123456" />
            <label class="form-label">Photo reçu / message de transfert</label>
            <button id="swal-open-camera" type="button" class="swal2-confirm swal2-styled" style="display:inline-block;margin:0 8px 10px 0">Ouvrir caméra</button>
            <input id="swal-sub-proof" type="file" accept="image/*" capture="environment" class="swal2-file" style="display:block;width:100%;margin:0 0 10px 0" />
            <div id="swal-camera-wrap" style="display:none;border:1px solid #dbe2ea;border-radius:8px;padding:8px;margin:0 0 10px 0">
              <video id="swal-camera-video" style="width:100%;max-height:220px;background:#111;border-radius:6px" autoplay playsinline muted></video>
              <canvas id="swal-camera-canvas" style="display:none"></canvas>
              <img id="swal-camera-preview" alt="Aperçu capture" style="display:none;width:100%;max-height:220px;object-fit:contain;border-radius:6px;margin-top:8px" />
              <div style="margin-top:8px">
                <button id="swal-camera-shot" type="button" class="swal2-confirm swal2-styled" style="display:inline-block;margin-right:8px">Capturer</button>
              </div>
            </div>
            <label class="form-label">Note (optionnel)</label>
            <input id="swal-sub-note" class="swal2-input" style="margin:0;width:100%" placeholder="Infos utiles" />
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Soumettre',
        cancelButtonText: 'Annuler',
        didOpen: () => {
          const planEl = document.getElementById('swal-sub-plan') as HTMLSelectElement | null;
          const amountEl = document.getElementById('swal-sub-amount') as HTMLSpanElement | null;
          const refreshAmount = () => {
            if (amountEl) amountEl.textContent = amountFor(planEl?.value || defaultPlanCode);
          };
          planEl?.addEventListener('change', refreshAmount);
          refreshAmount();

          const openBtn = document.getElementById('swal-open-camera') as HTMLButtonElement | null;
          const shotBtn = document.getElementById('swal-camera-shot') as HTMLButtonElement | null;
          const wrap = document.getElementById('swal-camera-wrap') as HTMLDivElement | null;
          const video = document.getElementById('swal-camera-video') as HTMLVideoElement | null;
          const canvas = document.getElementById('swal-camera-canvas') as HTMLCanvasElement | null;
          const preview = document.getElementById('swal-camera-preview') as HTMLImageElement | null;

          openBtn?.addEventListener('click', async () => {
            try {
              if (!navigator.mediaDevices?.getUserMedia) {
                Swal.showValidationMessage('Caméra non supportée sur ce navigateur.');
                return;
              }
              stopCamera();
              stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
              if (wrap) wrap.style.display = 'block';
              if (video) {
                video.srcObject = stream;
                await video.play().catch(() => null);
              }
            } catch {
              Swal.showValidationMessage('Impossible d’ouvrir la caméra. Vérifiez les permissions.');
            }
          });

          shotBtn?.addEventListener('click', () => {
            if (!video || !canvas) return;
            const width = video.videoWidth || 1280;
            const height = video.videoHeight || 720;
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            ctx.drawImage(video, 0, 0, width, height);
            canvas.toBlob((blob) => {
              if (!blob) return;
              capturedFile = new File([blob], `recu-${Date.now()}.jpg`, { type: 'image/jpeg' });
              if (preview) {
                preview.src = URL.createObjectURL(capturedFile);
                preview.style.display = 'block';
              }
              stopCamera();
            }, 'image/jpeg', 0.92);
          });
        },
        willClose: () => {
          stopCamera();
        },
        preConfirm: () => {
          const selectedPlanCode = (document.getElementById('swal-sub-plan') as HTMLSelectElement | null)?.value;
          const mode = (document.getElementById('swal-sub-mode') as HTMLSelectElement | null)?.value as 'ORANGE_MONEY' | 'WAVE' | 'MOBICASH' | undefined;
          const ref = (document.getElementById('swal-sub-ref') as HTMLInputElement | null)?.value;
          const note = (document.getElementById('swal-sub-note') as HTMLInputElement | null)?.value;
          const fileFromInput = (document.getElementById('swal-sub-proof') as HTMLInputElement | null)?.files?.[0];
          const file = capturedFile || fileFromInput;
          if (!selectedPlanCode) {
            Swal.showValidationMessage('Veuillez choisir la formule');
            return null;
          }
          if (!mode) {
            Swal.showValidationMessage('Veuillez choisir le canal de paiement');
            return null;
          }
          if (!file) {
            Swal.showValidationMessage('Veuillez joindre la photo du reçu/message');
            return null;
          }
          return { selectedPlanCode, mode, ref: ref || '', note: note || '', file };
        },
      });

      if (!ask.isConfirmed || !ask.value) return;
      const res = await submitManualSubscriptionPayment(ask.value.selectedPlanCode, ask.value.mode, ask.value.file, ask.value.ref, ask.value.note);
      await Swal.fire({
        icon: 'success',
        title: 'Demande envoyée',
        text: `Référence: ${res?.reference || 'N/A'} (en attente de validation SuperAdmin)`
      });
    } catch (e: any) {
      await Swal.fire({ icon: 'error', title: 'Erreur', text: e?.message || 'Impossible de soumettre la preuve de paiement.' });
    }
  };

  const showBlockedSubscriptionFlow = async () => {
    const r = await Swal.fire({
      icon: 'warning',
      title: 'Abonnement expiré',
      text: 'Votre abonnement est expiré. Veuillez renouveler pour continuer.',
      confirmButtonText: 'Se réabonner',
      allowOutsideClick: false,
      allowEscapeKey: false,
    });
    if (r.isConfirmed) {
      await openRenewSubscriptionModal();
    }
  };

  // Background image rotation for login page (switch every 60s)
  const [bgImage, setBgImage] = useState<string>(bg1);
  useEffect(() => {
    const interval = setInterval(() => {
      setBgImage(prev => prev === bg1 ? bg2 : bg1);
    }, 60000); // switch every 60s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const blocked = localStorage.getItem('smb_sub_blocked') === '1';
    const token = localStorage.getItem('smb_token');
    if (!token || !blocked) return;
    void showBlockedSubscriptionFlow();
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

        const normalizeRoleName = (value?: string | null) =>
          (value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/^ROLE_/i, '')
            .trim()
            .toUpperCase();
        const roles = Array.isArray(profileData?.roles) ? profileData.roles.map((r: any) => normalizeRoleName(String(r))) : [];
        const userType = normalizeRoleName(profileData?.user?.typeUtilisateur);
        const bypass = roles.includes('SUPERADMIN') || roles.includes('DEVELOPPEUR') || userType === 'SUPERADMIN' || userType === 'DEVELOPPEUR';

        if (!bypass) {
          const sub = await fetchCurrentSubscriptionStatus();
          if (sub?.blocked) {
            localStorage.setItem('smb_sub_blocked', '1');
            await showBlockedSubscriptionFlow();
            return;
          }
        }

        localStorage.removeItem('smb_sub_blocked');
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
                <span className="fw-bold text-white brand-title" style={{
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
                  <p className="text-muted mb-4">Entrez votre email et mot de passe pour accéder à JÀGO DÁNAYA.</p>
                </div>
                {error && <div className="alert alert-danger">{error}</div>}
                <form onSubmit={handleSubmit}>
                  <div className="mb-3">
                    <label htmlFor="emailaddress" className="form-label">Adresse email</label>
                    <input
                      className="form-control form-control-lg"
                      type="email"
                      id="emailaddress"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="Entrez votre email"
                      autoComplete="username"
                      required
                    />
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