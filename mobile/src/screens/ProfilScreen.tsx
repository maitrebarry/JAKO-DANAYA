import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Image, TextInput, ScrollView, Modal, TouchableOpacity } from 'react-native';
import { fetchCurrentUser, fetchBoutiques, updateCurrentUser, changePassword, uploadAvatar, uploadAvatarWithProgress } from '../services/auth';
import { useApp } from '../store/AppContext';
import * as ImagePicker from 'expo-image-picker';
import { resolveMediaUrl } from '../utils/urls';
import { useRoute } from '@react-navigation/native';
import { showSuccess, showError } from '../utils/notify';
import { useTheme } from '../theme';
import { mergeAuthMeResponse } from '../utils/profile';
import { isSuperAdmin } from '../utils/permissions';
import { useResponsiveLayout } from '../utils/responsive';

export default function ProfilScreen() {
  const { token, setToken, setBoutiqueId, profile: ctxProfile, setProfile, themePref, setThemePref } = useApp();
  const theme = useTheme();
  const responsive = useResponsiveLayout();
  const [loading, setLoading] = useState(true);
  const [profile, setLocalProfile] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [boutiques, setBoutiques] = useState<any[]>([]);
  const [pwdModal, setPwdModal] = useState(false);
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!token) return;
      try {
        setLoading(true);
        const data = await fetchCurrentUser(token);
        if (!mounted) return;
        const user = data?.user || data;
        setLocalProfile(user);
        if (!isSuperAdmin(mergeAuthMeResponse(data))) {
          try { const b = await fetchBoutiques(token); if (mounted) setBoutiques(b); } catch (e) { /* ignore */ }
        } else if (mounted) {
          setBoutiques([]);
        }
      } catch (e: any) {
        if (!mounted) return;
        setError(e.message || 'Erreur');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [token]);

  useEffect(() => {
    // keep context profile in sync when updated elsewhere
    if (ctxProfile) setLocalProfile(ctxProfile);
  }, [ctxProfile]);

  const route = useRoute<any>();
  // If navigated with openAvatarPicker, open the image picker immediately
  useEffect(() => {
    try {
      if (route?.params?.openAvatarPicker) {
        // small timeout so screen is mounted before launching picker
        setTimeout(() => { pickAvatar(); try { route.params.openAvatarPicker = false; } catch (e) {} }, 300);
      }
    } catch (e) { /* ignore */ }
  }, [route?.params?.openAvatarPicker]);

  const logout = () => {
    setToken(null);
    setBoutiqueId(null);
  };

  const saveProfile = async () => {
    if (!token) return;
    setSaving(true);
    try {
      const payload: any = { nom: profile.nom, prenom: profile.prenom, pseudo: profile.pseudo, contact: profile.contact, adresse: profile.adresse };
      const updated = await updateCurrentUser(payload, token);
      setSuccessMsg('Profil mis à jour');
      const merged = mergeAuthMeResponse(updated);
      setProfile(merged);
      setLocalProfile(merged);
      setEditing(false);
      setTimeout(() => setSuccessMsg(null), 1400);
    } catch (e:any) {
      showError('Erreur', e.message || 'Impossible de mettre à jour');
    } finally { setSaving(false); }
  };

  const doChangePassword = async () => {
    if (!token) return;
    if (!oldPwd || !newPwd) { showError('Erreur', 'Veuillez renseigner l\'ancien et le nouveau mot de passe'); return; }
    try {
      await changePassword(oldPwd, newPwd, token);
      setPwdModal(false);
      showSuccess('Succès', 'Mot de passe changé');
      setOldPwd(''); setNewPwd('');
    } catch (e:any) {
      showError('Erreur', e.message || 'Changement impossible');
    }
  };

  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [confirmAvatar, setConfirmAvatar] = useState(false);

  const pickAvatar = async () => {
    if (!token) { showError('Erreur', 'Session invalide. Veuillez vous reconnecter.'); return; }
    try {
      const res: any = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions?.Images || ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
      const cancelled = res.cancelled ?? res.canceled ?? false;
      if (cancelled) return;
      const uri = res.uri || (res.assets && res.assets[0] && res.assets[0].uri);
      if (!uri) return;

      // show preview immediately
      setAvatarPreview(uri);
      setConfirmAvatar(true);

    } catch (e:any) {
      showError('Erreur', e.message || 'Impossible d\'uploader');
      setAvatarUploading(false);
      setUploadProgress(null);
      setAvatarPreview(null);
      setConfirmAvatar(false);
    }
  };

  const confirmAvatarUpload = async () => {
    if (!token || !avatarPreview) return;
    setUploadProgress(0);
    setAvatarUploading(true);
    setConfirmAvatar(false);

    // build a file object compatible with React Native FormData
    const uri = avatarPreview;
    const asset = {}; // since we have uri, we can assume
    const name = uri.split('/').pop() || 'avatar.jpg';
    const ext = (name.split('.').pop() || 'jpg').toLowerCase();
    const type = `image/${ext}`;

    const file: any = { uri, name, type };

    const { promise, abort } = uploadAvatarWithProgress(file, token, (p) => {
      setUploadProgress(p);
    });

    try {
      const uploaded = await promise;
      if (uploaded && uploaded.avatar) {
        const avatarPath = uploaded.avatar;
        // Add a timestamp to bust client image cache so the TopBar shows the updated image immediately
        const avatarUrlBase = resolveMediaUrl(avatarPath);
        const avatarUrl = avatarUrlBase + (avatarUrlBase.includes('?') ? '&' : '?') + 'ts=' + Date.now();
        // keep both legacy keys (`photo`, `photoUrl`) and `avatar` in sync so TopBar and other screens update immediately
        setLocalProfile((p:any)=> ({ ...p, avatar: avatarPath, photo: avatarPath, photoUrl: avatarUrl }));
        setProfile((p:any)=> ({ ...p, avatar: avatarPath, photo: avatarPath, photoUrl: avatarUrl }));
        setSuccessMsg('Avatar mis à jour');
        setTimeout(() => setSuccessMsg(null), 1400);
      }
    } catch (e:any) {
      showError('Erreur', e.message || 'Impossible d\'uploader');
    } finally {
      setUploadProgress(null);
      setAvatarUploading(false);
      setAvatarPreview(null);
    }
  };

  const switchBoutique = (id: number | null) => {
    setBoutiqueId(id);
    setSuccessMsg('Boutique sélectionnée');
    setTimeout(() => setSuccessMsg(null), 1200);
  };

  const avatarUri = avatarPreview || (profile?.avatar ? resolveMediaUrl(profile.avatar) : null);
  const superAdmin = isSuperAdmin(profile);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={{
        width: '100%',
        maxWidth: responsive.contentMaxWidth,
        alignSelf: 'center',
        paddingHorizontal: responsive.horizontalPadding,
        paddingTop: 24,
        paddingBottom: 36,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={{ fontSize: 22, fontWeight: '700', marginBottom: 12, color: theme.text }}>Profil</Text>

      {loading && <ActivityIndicator />}
      {error ? <Text style={{ color: theme.danger, marginBottom: 12 }}>{error}</Text> : null}

      {successMsg ? <View style={{ backgroundColor: theme.primary, padding: 8, borderRadius: 8, marginBottom: 12 }}><Text style={{ color: theme.text, fontWeight: '700' }}>{successMsg}</Text></View> : null}

      {!loading && profile && (
        <View>
          <View style={{ alignItems: 'center', marginBottom: 12 }}>
            <Pressable onPress={() => pickAvatar()} style={{ borderRadius: 48, overflow: 'hidden', marginBottom: 8 }}>
              {avatarUri ? <Image source={{ uri: avatarUri }} style={{ width: 96, height: 96, borderRadius: 48 }} /> : <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: '#eee' }} />}
            </Pressable>

            {uploadProgress != null ? (
              <View style={{ width: 140, marginBottom: 8 }}>
                <View style={{ height: 8, backgroundColor: '#e6e6e6', borderRadius: 6, overflow: 'hidden' }}>
                  <View style={{ height: 8, backgroundColor: '#10b981', width: `${uploadProgress}%` }} />
                </View>
                <Text style={{ color: '#666', marginTop: 6, textAlign: 'center' }}>{uploadProgress}%</Text>
              </View>
            ) : null}

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable onPress={pickAvatar} style={{ padding: 8, borderRadius: 8, borderWidth: 1, borderColor: theme.muted, backgroundColor: theme.surface }}>{avatarUploading ? <ActivityIndicator /> : <Text style={{ color: theme.text }}>Changer avatar</Text>}</Pressable>
              {confirmAvatar && !avatarUploading ? (
                <>
                  <Pressable onPress={confirmAvatarUpload} style={{ padding: 8, borderRadius: 8, backgroundColor: theme.primary }}><Text style={{ color: theme.text }}>Valider</Text></Pressable>
                  <Pressable onPress={() => { setAvatarPreview(null); setConfirmAvatar(false); }} style={{ padding: 8, borderRadius: 8, borderWidth: 1, borderColor: theme.muted, backgroundColor: theme.surface }}><Text style={{ color: theme.text }}>Annuler</Text></Pressable>
                </>
              ) : null}
            </View>
          </View>

          <Text style={{ fontWeight: '600', color: theme.text }}>{profile.prenom} {profile.nom}</Text>
          <Text style={{ color: theme.muted, marginBottom: 12 }}>{profile.email}</Text>

          <View style={{ marginBottom: 12 }}>
            <Text style={{ color: theme.muted, marginBottom: 6 }}>Rôles: {(profile.roles || []).join(', ')}</Text>
            <Text style={{ color: theme.muted }}>Dernière activité: {profile.lastSeenAt ? String(profile.lastSeenAt) : '—'}</Text>
          </View>

          {editing ? (
            <View>
              <TextInput placeholder="Prénom" value={profile.prenom} onChangeText={(v)=> setLocalProfile((p:any)=>({...p, prenom: v}))} style={{ backgroundColor: theme.surface, padding: 10, borderRadius: 6, marginBottom: 8, color: theme.text }} />
              <TextInput placeholder="Nom" value={profile.nom} onChangeText={(v)=> setLocalProfile((p:any)=>({...p, nom: v}))} style={{ backgroundColor: theme.surface, padding: 10, borderRadius: 6, marginBottom: 8, color: theme.text }} />
              <TextInput placeholder="Contact" value={profile.contact} onChangeText={(v)=> setLocalProfile((p:any)=>({...p, contact: v}))} style={{ backgroundColor: theme.surface, padding: 10, borderRadius: 6, marginBottom: 8, color: theme.text }} />
              <TextInput placeholder="Adresse" value={profile.adresse} onChangeText={(v)=> setLocalProfile((p:any)=>({...p, adresse: v}))} style={{ backgroundColor: theme.surface, padding: 10, borderRadius: 6, marginBottom: 8, color: theme.text }} />

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <Pressable onPress={() => { setEditing(false); setLocalProfile(profile); }} style={{ padding: 12, backgroundColor: theme.muted, borderRadius: 8 }}><Text style={{ color: theme.text }}>Annuler</Text></Pressable>
                <Pressable onPress={saveProfile} disabled={saving} style={{ padding: 12, backgroundColor: saving ? theme.muted : theme.primary, borderRadius: 8 }}><Text style={{ color: theme.text }}>{saving ? 'Enregistrement...' : 'Enregistrer'}</Text></Pressable>
              </View>
            </View>
          ) : (
            <View style={{ marginBottom: 12 }}>
              <Pressable onPress={() => setEditing(true)} style={{ padding: 10, backgroundColor: theme.surface, borderRadius: 8, marginBottom: 8 }}><Text style={{ color: theme.text }}>Modifier profil</Text></Pressable>
              <Pressable onPress={() => setPwdModal(true)} style={{ padding: 10, backgroundColor: theme.surface, borderRadius: 8, marginBottom: 8 }}><Text style={{ color: theme.text }}>Changer mot de passe</Text></Pressable>
            </View>
          )}

          {!superAdmin && <View style={{ marginTop: 8 }}>
            <Text style={{ color: theme.muted, marginBottom: 8 }}>Boutique</Text>
            {boutiques.map(b => (
              <Pressable key={b.id} onPress={() => switchBoutique(b.id)} style={{ padding: 10, backgroundColor: theme.card, borderRadius: 8, marginBottom: 8 }}>
                <Text style={{ color: theme.text }}>{b.nom}</Text>
              </Pressable>
            ))}
          </View>}

          <View style={{ marginTop: 12 }}>
            <Text style={{ color: theme.muted, marginBottom: 8 }}>Thème</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable onPress={() => setThemePref('system')} style={{ padding: 8, borderRadius: 6, backgroundColor: themePref === 'system' ? theme.primary : theme.surface }}><Text style={{ color: themePref === 'system' ? theme.text : theme.text }}>Système</Text></Pressable>
              <Pressable onPress={() => setThemePref('light')} style={{ padding: 8, borderRadius: 6, backgroundColor: themePref === 'light' ? theme.primary : theme.surface }}><Text style={{ color: themePref === 'light' ? theme.text : theme.text }}>Clair</Text></Pressable>
              <Pressable onPress={() => setThemePref('dark')} style={{ padding: 8, borderRadius: 6, backgroundColor: themePref === 'dark' ? theme.primary : theme.surface }}><Text style={{ color: themePref === 'dark' ? theme.text : theme.text }}>Sombre</Text></Pressable>
            </View>
          </View>

          <View style={{ marginTop: 20 }}>
            <Pressable onPress={logout} style={{ backgroundColor: theme.danger, padding: 12, borderRadius: 8, alignItems: 'center' }}>
              <Text style={{ color: theme.text, fontWeight: '600' }}>Déconnexion</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Change password modal */}
      <Modal visible={pwdModal} transparent animationType="slide" onRequestClose={() => setPwdModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ width: '86%', maxWidth: responsive.formMaxWidth, backgroundColor: theme.surface, padding: responsive.isTablet ? 24 : 16, borderRadius: 10 }}>
            <Text style={{ fontWeight: '800', marginBottom: 8, color: theme.text }}>Changer le mot de passe</Text>
            <TextInput placeholder="Mot de passe actuel" secureTextEntry value={oldPwd} onChangeText={setOldPwd} style={{ backgroundColor: theme.card, padding: 10, borderRadius: 6, marginBottom: 8, color: theme.text }} />
            <TextInput placeholder="Nouveau mot de passe" secureTextEntry value={newPwd} onChangeText={setNewPwd} style={{ backgroundColor: theme.card, padding: 10, borderRadius: 6, marginBottom: 8, color: theme.text }} />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
              <Pressable onPress={() => setPwdModal(false)} style={{ padding: 10 }}><Text style={{ color: theme.text }}>Annuler</Text></Pressable>
              <Pressable onPress={doChangePassword} style={{ padding: 10, backgroundColor: theme.primary, borderRadius: 6 }}><Text style={{ color: theme.text }}>Valider</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}
