import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { withApi } from '../config/api';
import Swal from 'sweetalert2';
import { fetchCurrentSubscriptionStatus } from '../api/admin';
import { fetchSubscriptionPlansForOwner, submitManualSubscriptionPayment } from '../api/subscription';

import logoMark from '../../assets/images/jako-danaya-mark.png';
import slideProduits from '../../assets/images/onboarding/onboarding-produits.jpg';
import slideVentes from '../../assets/images/onboarding/onboarding-ventes.jpg';
import slideRapports from '../../assets/images/onboarding/onboarding-rapports.jpg';
import slideBoutiques from '../../assets/images/onboarding/onboarding-boutiques.jpg';

const SLIDES = [
  {
    key: 'produits',
    image: slideProduits,
    icon: 'bi-box-seam',
    badge: 'Produits',
    title: 'Produits & Stock',
    quote: 'Gérez vos produits, vos prix et suivez votre stock en temps réel, boutique par boutique.',
  },
  {
    key: 'ventes',
    image: slideVentes,
    icon: 'bi-cart3',
    badge: 'Ventes',
    title: 'Ventes & Caisse',
    quote: 'Enregistrez vos ventes en espèces ou sur commande, et suivez votre caisse au quotidien.',
  },
  {
    key: 'rapports',
    image: slideRapports,
    icon: 'bi-bar-chart',
    badge: 'Rapports',
    title: 'Rapports & Historique',
    quote: "Consultez vos rapports de ventes, de stock et l'historique complet de votre activité.",
  },
  {
    key: 'boutiques',
    image: slideBoutiques,
    icon: 'bi-shop',
    badge: 'Boutiques',
    title: 'Multi-boutiques',
    quote: 'Gérez plusieurs boutiques et magasins depuis une seule et même application.',
  },
];

const MODULES = [
  { icon: 'bi-box-seam', label: 'Produits' },
  { icon: 'bi-cart-plus', label: 'Achats' },
  { icon: 'bi-cart3', label: 'Ventes' },
  { icon: 'bi-cash-stack', label: 'Caisse' },
  { icon: 'bi-people', label: 'Fournisseurs' },
  { icon: 'bi-wallet2', label: 'Dépenses' },
  { icon: 'bi-clipboard-data', label: 'Inventaires' },
  { icon: 'bi-bar-chart', label: 'Rapports' },
  { icon: 'bi-file-earmark-text', label: 'Documents' },
  { icon: 'bi-gear', label: 'Configuration' },
];

const AUTO_ADVANCE_MS = 7000;

const SignIn = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { setUserData } = useUser();

  const [activeIndex, setActiveIndex] = useState(0);
  const activeIndexRef = useRef(0);
  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIndex((activeIndexRef.current + 1) % SLIDES.length);
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(timer);
  }, []);

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
            <div class="alert alert-info p-2 mb-3">
              <div class="fw-semibold">Numéros de paiement</div>
              <div>OrangeMoney et Wave: 74745669</div>
              <div>Moov: 67205736</div>
            </div>
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

  const year = new Date().getFullYear();

  return (
    <div className="jd-login-page">
      <style>{`
        .jd-login-page {
          position: relative;
          min-height: 100vh;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          font-family: inherit;
        }
        .jd-bg-carousel { position: fixed; inset: 0; z-index: 0; overflow: hidden; background: #0b1a33; }
        .jd-bg-slide {
          position: absolute; inset: 0;
          opacity: 0; transition: opacity 1.2s ease;
          overflow: hidden;
        }
        .jd-bg-slide.active { opacity: 1; }
        .jd-bg-slide.active .jd-bg-slide-blur { animation: jdKenBurns 9s ease-in-out forwards; }
        .jd-bg-slide-blur {
          position: absolute; inset: -30px;
          background-size: cover; background-position: center;
          filter: blur(40px) brightness(0.55) saturate(1.15);
          transform: scale(1.15);
        }
        .jd-bg-slide-sharp {
          position: absolute; top: 0; bottom: 0; left: 0;
          width: min(62vw, 980px);
          background-size: cover; background-position: center 20%;
        }
        @media (max-width: 900px) { .jd-bg-slide-sharp { width: 100%; } }
        @keyframes jdKenBurns { from { transform: scale(1.15); } to { transform: scale(1.22); } }
        .jd-bg-slide::after {
          content: '';
          position: absolute; inset: 0;
          background:
            linear-gradient(180deg, rgba(8,14,28,.55) 0%, rgba(8,14,28,.2) 40%, rgba(8,14,28,.5) 75%, rgba(8,14,28,.78) 100%),
            linear-gradient(105deg, rgba(8,14,28,.35) 0%, transparent 55%);
        }
        .jd-bg-caption { position: absolute; left: 32px; bottom: 130px; max-width: 480px; z-index: 2; color: #fff; }
        .jd-bg-badge {
          display: inline-flex; align-items: center; gap: 8px;
          background: rgba(255,255,255,.14); backdrop-filter: blur(6px);
          border: 1px solid rgba(255,255,255,.25);
          padding: 6px 14px; border-radius: 999px; font-size: .8rem; font-weight: 600;
          margin-bottom: 14px;
        }
        .jd-bg-title { font-size: 2rem; font-weight: 800; margin-bottom: 10px; text-shadow: 0 2px 12px rgba(0,0,0,.4); }
        .jd-bg-quote { font-size: 1rem; opacity: .88; line-height: 1.5; font-style: italic; }
        .jd-bg-progress { position: fixed; top: 0; left: 0; right: 0; height: 3px; background: rgba(255,255,255,.15); z-index: 3; }
        .jd-bg-progress-bar { height: 100%; background: linear-gradient(90deg,#1e40af,#16a34a); width: 0%; animation: jdProgress ${AUTO_ADVANCE_MS}ms linear forwards; }
        @keyframes jdProgress { from { width: 0% } to { width: 100% } }
        .jd-bg-dots { position: absolute; left: 32px; bottom: 100px; display: flex; gap: 8px; z-index: 2; }
        .jd-bg-dot { width: 8px; height: 8px; border-radius: 999px; background: rgba(255,255,255,.4); cursor: pointer; transition: all .25s; border: none; padding: 0; }
        .jd-bg-dot.active { width: 22px; background: #fff; }
        @media (max-width: 600px) { .jd-bg-caption, .jd-bg-dots { display: none; } }

        .jd-module-wave { position: fixed; left: 0; right: 0; bottom: 0; z-index: 1; pointer-events: none; }
        .jd-module-wave svg { display: block; width: 100%; height: auto; }
        .jd-module-list {
          position: absolute; left: 0; right: 0; bottom: 0;
          display: grid; grid-template-columns: repeat(10, 1fr);
          padding: 10px 24px 16px; pointer-events: auto;
        }
        .jd-module-node { display: flex; flex-direction: column; align-items: center; gap: 4px; color: #fff; opacity: .9; }
        .jd-module-node i { font-size: 1.1rem; }
        .jd-module-node span { font-size: .65rem; font-weight: 600; text-align: center; }
        @media (max-width: 900px) { .jd-module-node span { display: none; } }
        @media (max-width: 600px) { .jd-module-list { grid-template-columns: repeat(5, 1fr); row-gap: 8px; } }

        .jd-login-main { position: relative; z-index: 4; width: 100%; display: flex; justify-content: flex-end; padding: 24px; }
        .jd-login-card {
          width: 100%; max-width: 420px;
          background: rgba(255,255,255,.94);
          backdrop-filter: blur(18px) saturate(1.4);
          border: 1px solid rgba(255,255,255,.7);
          border-radius: 16px;
          box-shadow: 0 32px 80px rgba(10,18,35,.28);
          padding: 32px 28px 24px;
          position: relative;
          overflow: hidden;
        }
        .jd-login-card::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 4px;
          background: linear-gradient(90deg, #1e40af, #16a34a 60%, #1e40af);
        }
        .jd-brand-area { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
        .jd-brand-logo { width: 52px; height: 52px; object-fit: contain; }
        .jd-brand-title { font-size: 1.3rem; font-weight: 800; line-height: 1.1; }
        .jd-brand-title .jd-blue { color: #1e40af; }
        .jd-brand-title .jd-green { color: #16a34a; }
        .jd-brand-subtitle { font-size: .68rem; letter-spacing: .06em; color: #64748b; font-weight: 600; }

        .jd-form-divider { display: flex; align-items: center; gap: 10px; margin: 4px 0 18px; color: #64748b; font-size: .85rem; font-weight: 600; }
        .jd-form-divider::before, .jd-form-divider::after { content: ''; flex: 1; height: 1px; background: #e2e8f0; }

        .jd-input-group { display: flex; align-items: center; border: 1px solid #dfe5ee; border-radius: 10px; overflow: hidden; margin-bottom: 14px; background: #fff; }
        .jd-input-group:focus-within { border-color: #1e40af; box-shadow: 0 0 0 3px rgba(30,64,175,.15); }
        .jd-input-icon { width: 42px; height: 42px; display: flex; align-items: center; justify-content: center; background: #f1f5f9; color: #64748b; flex-shrink: 0; }
        .jd-input-group input { border: none; outline: none; flex: 1; height: 42px; padding: 0 12px; font-size: .92rem; background: transparent; }
        .jd-password-toggle { border: none; background: transparent; color: #64748b; width: 42px; height: 42px; display: flex; align-items: center; justify-content: center; cursor: pointer; }

        .jd-login-button {
          width: 100%; border: none; border-radius: 10px; padding: 12px; margin-top: 4px;
          background: linear-gradient(135deg, #1e40af 0%, #16a34a 100%);
          color: #fff; font-weight: 700; font-size: .98rem;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          box-shadow: 0 8px 24px rgba(30,64,175,.25);
        }
        .jd-login-button:disabled { opacity: .7; }

        .jd-login-footer { text-align: center; margin-top: 18px; font-size: .78rem; color: #94a3b8; }
      `}</style>

      <div className="jd-bg-carousel">
        {SLIDES.map((s, i) => (
          <div key={s.key} className={`jd-bg-slide${i === activeIndex ? ' active' : ''}`}>
            <div className="jd-bg-slide-blur" style={{ backgroundImage: `url(${s.image})` }} />
            <div className="jd-bg-slide-sharp" style={{ backgroundImage: `url(${s.image})` }} />
          </div>
        ))}
        <div className="jd-bg-caption">
          <span className="jd-bg-badge"><i className={`bi ${SLIDES[activeIndex].icon}`}></i> {SLIDES[activeIndex].badge}</span>
          <h2 className="jd-bg-title">{SLIDES[activeIndex].title}</h2>
          <p className="jd-bg-quote">{SLIDES[activeIndex].quote}</p>
        </div>
        <div className="jd-bg-progress"><div key={activeIndex} className="jd-bg-progress-bar" /></div>
        <div className="jd-bg-dots">
          {SLIDES.map((s, i) => (
            <button key={s.key} type="button" aria-label={s.title} className={`jd-bg-dot${i === activeIndex ? ' active' : ''}`} onClick={() => setActiveIndex(i)} />
          ))}
        </div>
      </div>

      <div className="jd-module-wave">
        <svg viewBox="0 0 900 100" preserveAspectRatio="none">
          <path d="M900 38 C790 52 755 88 630 76 C500 64 450 18 330 38 C205 60 175 90 0 68 L0 100 L900 100 Z" fill="rgba(11,26,51,0.92)" />
        </svg>
        <div className="jd-module-list">
          {MODULES.map((m) => (
            <div className="jd-module-node" key={m.label}>
              <i className={`bi ${m.icon}`}></i>
              <span>{m.label}</span>
            </div>
          ))}
        </div>
      </div>

      <main className="jd-login-main">
        <section className="jd-login-card">
          <div className="jd-brand-area">
            <img src={logoMark} alt="JÀGO DÁNAYA" className="jd-brand-logo" />
            <div>
              <div className="jd-brand-title"><span className="jd-blue">JÀGO</span> <span className="jd-green">DÁNAYA</span></div>
              <div className="jd-brand-subtitle">GESTION DE BOUTIQUE</div>
            </div>
          </div>

          {error && <div className="alert alert-danger py-2">{error}</div>}

          <div className="jd-form-divider"><span>Connexion</span></div>

          <form onSubmit={handleSubmit}>
            <label htmlFor="emailaddress" className="form-label small text-muted">Adresse email</label>
            <div className="jd-input-group">
              <span className="jd-input-icon"><i className="bi bi-person-badge"></i></span>
              <input
                type="email"
                id="emailaddress"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Entrez votre email"
                autoComplete="username"
                required
              />
            </div>

            <label htmlFor="password" className="form-label small text-muted">Mot de passe</label>
            <div className="jd-input-group">
              <span className="jd-input-icon"><i className="bi bi-lock"></i></span>
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Entrez votre mot de passe"
                autoComplete="current-password"
                required
              />
              <button type="button" className="jd-password-toggle" onClick={() => setShowPassword((v) => !v)} aria-label="Afficher le mot de passe">
                <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
              </button>
            </div>

            <button className="jd-login-button" type="submit" disabled={loading}>
              {loading ? 'Connexion...' : <>Connexion <i className="bi bi-box-arrow-in-right"></i></>}
            </button>

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

          <div className="jd-login-footer">© {year} JÀGO DÁNAYA</div>
        </section>
      </main>
    </div>
  );
};

export default SignIn;
