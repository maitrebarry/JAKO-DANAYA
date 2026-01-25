import React, { useState, useEffect, useRef } from 'react';
import { useUser } from '../contexts/UserContext';
import * as authApi from '../api/auth';
import Swal from 'sweetalert2';
import PhoneWithDial from './PhoneWithDial';
import { API, API_BASE } from '../config/api';
import avatarImg from '../../assets/images/avatar.jpg';

const Profile: React.FC = () => {
  const { user, setUserData } = useUser();
  const [form, setForm] = useState<any>({});
  const [profileCodePays, setProfileCodePays] = useState<string | null>(null);
  const [profileTelephoneValid, setProfileTelephoneValid] = useState<boolean | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [activeTab, setActiveTab] = useState<'info' | 'password'>('info');
  const inputFileRef = useRef<HTMLInputElement | null>(null);
  const mobileFileRef = useRef<HTMLInputElement | null>(null);

  // Camera refs & state
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // On mount, refresh profile to ensure latest contact/adresse are loaded
  useEffect(() => {
    loadProfile();
    // cleanup camera if still open
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (user) {
      setForm({
        nom: (user as any).nom || '',
        prenom: (user as any).prenom || '',
        pseudo: (user as any).pseudo || '',
        contact: (user as any).contact || '',
        adresse: (user as any).adresse || '',
        email: (user as any).email || ''
      });
    }
  }, [user]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, [previewUrl]);

  const loadProfile = async () => {
    try {
      const res = await authApi.getProfile();
      setUserData(res);
      localStorage.setItem('smb_user_data', JSON.stringify(res));
      setForm({
        nom: res.user.nom || '',
        prenom: res.user.prenom || '',
        pseudo: res.user.pseudo || '',
        contact: res.user.contact || '',
        adresse: res.user.adresse || '',
        email: res.user.email || ''
      });
    } catch (err: any) {
      console.error('Failed loading profile', err);
      Swal.fire('Erreur', 'Impossible de charger votre profil', 'error');
    }
  };

  const handleSave = async () => {
    try {
      // validate phone if present — must be explicitly valid
      if (form.contact && form.contact.trim() && profileTelephoneValid !== true) { Swal.fire('Erreur', 'Le numéro de téléphone est invalide ou incomplet pour le pays sélectionné', 'error'); return; }
      const payload = { ...form, codePays: profileCodePays || form.codePays };
      const res = await authApi.updateProfile(payload);
      setUserData(res);
      localStorage.setItem('smb_user_data', JSON.stringify(res));
      Swal.fire('Succès', 'Profil mis à jour', 'success');
    } catch (err: any) {
      console.error('Update failed', err);
      Swal.fire('Erreur', 'Impossible de mettre à jour le profil', 'error');
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) { Swal.fire('Erreur', 'Les mots de passe ne correspondent pas', 'error'); return; }
    try {
      await authApi.changePassword(oldPassword, newPassword);
      Swal.fire('Succès', 'Mot de passe changé', 'success');
      setOldPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (err: any) {
      console.error('Password change failed', err);
      let txt = 'Impossible de changer le mot de passe';
      if (err && err.status === 400) txt = 'Mot de passe actuel incorrect';
      Swal.fire('Erreur', txt, 'error');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files ? e.target.files[0] : null;
    setAvatarFile(file);
    if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const handleFileChangeMobile = (e: React.ChangeEvent<HTMLInputElement>) => {
    // mobile capture will come here
    handleFileChange(e);
  };

  const openCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsCameraOpen(true);
    } catch (err) {
      console.error('Camera access denied or not available', err);
      Swal.fire('Erreur', 'Impossible d\'accéder à la caméra. Assurez-vous d\'avoir autorisé l\'accès.', 'error');
    }
  };

  const closeCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      try { videoRef.current.pause(); videoRef.current.srcObject = null; } catch(e) {}
    }
    setIsCameraOpen(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    if (!canvasRef.current) canvasRef.current = document.createElement('canvas');
    const canvas = canvasRef.current;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    canvas.toBlob(blob => {
      if (!blob) return;
      const file = new File([blob], `camera-${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' });
      setAvatarFile(file);
      if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      closeCamera();
    }, 'image/jpeg', 0.9);
  };

  const uploadWithProgress = (file: File) => {
    return new Promise<void>((resolve, reject) => {
      const token = localStorage.getItem('smb_token');
      const xhr = new XMLHttpRequest();
      const fd = new FormData();
      fd.append('file', file);
      xhr.open('POST', `${API}/auth/me/avatar`);
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) {
          const pct = Math.round((ev.loaded / ev.total) * 100);
          setUploadProgress(pct);
        }
      };
      xhr.onload = async () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try { await loadProfile(); } catch (e) { }
          setUploadProgress(null);
          setAvatarFile(null);
          if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }
          resolve();
        } else if (xhr.status === 401) {
          setUploadProgress(null);
          reject({ status: 401, message: 'Authentification requise' });
        } else {
          setUploadProgress(null);
          let body = null;
          try { body = JSON.parse(xhr.responseText); } catch (e) { }
          reject({ status: xhr.status, body });
        }
      };
      xhr.onerror = () => { setUploadProgress(null); reject({ status: 0 }); };
      xhr.send(fd);
    });
  };

  const handleAvatarUpload = async () => {
    if (!avatarFile) return;
    try {
      setUploadProgress(0);
      await uploadWithProgress(avatarFile);
      Swal.fire('Succès', 'Photo mise à jour', 'success');
    } catch (err: any) {
      console.error('Avatar upload failed', err);
      if (err && err.status === 401) {
        Swal.fire('Authentification requise', 'Votre session est expirée. Veuillez vous reconnecter.', 'warning');
      } else {
        Swal.fire('Erreur', 'Impossible d\'uploader la photo', 'error');
      }
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <ul className="nav nav-tabs card-header-tabs">
          <li className="nav-item">
            <button className={`nav-link ${activeTab === 'info' ? 'active' : ''}`} onClick={() => setActiveTab('info')}>Informations personnelles</button>
          </li>
          <li className="nav-item">
            <button className={`nav-link ${activeTab === 'password' ? 'active' : ''}`} onClick={() => setActiveTab('password')}>Changer le mot de passe</button>
          </li>
        </ul>
      </div>
      <div className="card-body">
        {activeTab === 'info' && (
          <div className="row">
            <div className="col-md-4 text-center">
              <div style={{ position: 'relative', display: 'inline-block' }}>
                {/** resolve avatar so '/uploads/...' paths point to backend server */}
                {(() => {
                  const resolveAvatar = (a?: string | null) => {
                    if (previewUrl) return previewUrl;
                    if (!a) return avatarImg;
                    if (a.startsWith('http')) return a;
                    if (a.startsWith('/uploads') || a.startsWith('uploads')) return a.startsWith('/') ? API_BASE + a : API_BASE + '/' + a;
                    return a;
                  };
                  return <img src={resolveAvatar((user as any)?.avatar)} alt="avatar" style={{ width: '100%', maxWidth: 160, height: 'auto', objectFit: 'cover', borderRadius: '50%', border: '2px solid #f0f0f0' }} />;
                })()}
              </div>
              <div className="mt-3">
                <input ref={inputFileRef} type="file" accept="image/*" onChange={handleFileChange} />
                {/* Hidden input to trigger native camera capture on mobile devices */}
                <input ref={mobileFileRef} type="file" accept="image/*" capture="environment" onChange={handleFileChangeMobile} style={{ display: 'none' }} />

                <div className="mt-2 d-flex gap-2 justify-content-center">
                  <button className="btn btn-sm btn-primary" onClick={handleAvatarUpload} disabled={!avatarFile || uploadProgress !== null}>Uploader</button>
                  <button className="btn btn-sm btn-outline-secondary" onClick={() => { if (mobileFileRef.current) mobileFileRef.current.click(); }}>Prendre une photo (mobile)</button>
                  <button className="btn btn-sm btn-secondary" onClick={() => { setAvatarFile(null); if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); } if (inputFileRef.current) inputFileRef.current.value = ''; }}>Annuler</button>
                </div>

                <div className="mt-2 d-flex gap-2 justify-content-center">
                  <button className="btn btn-sm btn-outline-primary" onClick={openCamera} disabled={isCameraOpen}>Ouvrir la caméra</button>
                </div>

                {isCameraOpen && (
                  <div className="mt-3 text-center">
                    <video ref={videoRef} style={{ width: '100%', maxWidth: 320, borderRadius: 6, border: '1px solid #ddd' }} />
                    <div className="mt-2 d-flex gap-2 justify-content-center">
                      <button className="btn btn-sm btn-success" onClick={capturePhoto}>Prendre</button>
                      <button className="btn btn-sm btn-danger" onClick={closeCamera}>Annuler</button>
                    </div>
                  </div>
                )}

                {uploadProgress !== null && (
                  <div className="mt-2">
                    <div className="progress" style={{ height: '8px' }}>
                      <div className="progress-bar" role="progressbar" style={{ width: `${uploadProgress}%` }} aria-valuenow={uploadProgress} aria-valuemin={0} aria-valuemax={100} />
                    </div>
                    <small className="text-muted">{uploadProgress}%</small>
                  </div>
                )}
              </div>
            </div>
            <div className="col-md-8">
              <div className="mb-3">
                <label className="form-label">Email</label>
                <input className="form-control" value={form.email || ''} readOnly />
              </div>
              <div className="mb-3 row">
                <div className="col-md-6">
                  <label className="form-label">Nom</label>
                  <input className="form-control" value={form.nom || ''} onChange={e => setForm({ ...form, nom: e.target.value })} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Prénom</label>
                  <input className="form-control" value={form.prenom || ''} onChange={e => setForm({ ...form, prenom: e.target.value })} />
                </div>
              </div>
              <div className="mb-3 row">
                <div className="col-md-6">
                  <label className="form-label">Pseudo</label>
                  <input className="form-control" value={form.pseudo || ''} onChange={e => setForm({ ...form, pseudo: e.target.value })} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Contact</label>
                  <PhoneWithDial value={form.contact || ''} defaultCountry={(user && (user as any).boutique && (user as any).boutique.pays && (user as any).boutique.pays.codeIso) ? (user as any).boutique.pays.codeIso : 'ML'} onChange={(tel, code, valid) => { setForm({ ...form, contact: tel || '' }); setProfileCodePays(code || null); setProfileTelephoneValid(typeof valid === 'boolean' ? valid : null); }} />
                </div>
              </div>
              <div className="mb-3">
                <label className="form-label">Adresse</label>
                <input className="form-control" value={form.adresse || ''} onChange={e => setForm({ ...form, adresse: e.target.value })} />
              </div>
              <div className="d-flex gap-2 mt-3">
                <button className="btn btn-primary" onClick={handleSave}>Enregistrer</button>
                <button className="btn btn-outline-secondary" onClick={loadProfile}>Recharger</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'password' && (
          <div>
            <h5 className="mb-3">Changer le mot de passe</h5>
            <div className="mb-3">
              <label className="form-label">Ancien mot de passe</label>
              <input type="password" className="form-control" value={oldPassword} onChange={e => setOldPassword(e.target.value)} />
            </div>
            <div className="mb-3">
              <label className="form-label">Nouveau mot de passe</label>
              <input type="password" className="form-control" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
            </div>
            <div className="mb-3">
              <label className="form-label">Confirmer le mot de passe</label>
              <input type="password" className="form-control" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
            </div>
            <div className="d-flex gap-2">
              <button className="btn btn-warning" onClick={handleChangePassword}>Changer le mot de passe</button>
              <button className="btn btn-outline-secondary" onClick={() => { setOldPassword(''); setNewPassword(''); setConfirmPassword(''); }}>Réinitialiser</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;
