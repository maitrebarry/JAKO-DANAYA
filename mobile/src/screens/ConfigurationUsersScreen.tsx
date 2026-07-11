import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme';
import { useApp } from '../store/AppContext';
import { createUser, listAssignableRoles, listUsers, RoleDTO, updateUser, updateUserStatut, UserDTO } from '../services/admin';
import { getRoleNames, hasPermission, isSuperAdmin } from '../utils/permissions';
import { showError, showSuccess } from '../utils/notify';

function roleName(r: any): string {
  if (!r) return '';
  if (typeof r === 'string') return r;
  return String(r?.name || '');
}

const TYPE_OPTIONS = [
  { value: 'SUPERADMIN', label: 'Super admin' },
  { value: 'ADMINISTRATEUR', label: 'Administrateur' },
  { value: 'GERANT_BOUTIQUE', label: 'Gérant boutique' },
  { value: 'CAISSIER', label: 'Caissier' },
  { value: 'MAGASINIER', label: 'Magasinier' },
];

const ROLE_CANDIDATES_BY_TYPE: Record<string, string[]> = {
  SUPERADMIN: ['SUPERADMIN'],
  ADMINISTRATEUR: ['ADMINISTRATEUR', 'ADMIN'],
  GERANT_BOUTIQUE: ['GERANT_BOUTIQUE', 'GERANT', 'MANAGER'],
  CAISSIER: ['CAISSIER', 'CASHIER'],
  MAGASINIER: ['MAGASINIER', 'STOREKEEPER'],
};

function normalizeRoleValue(value: string): string {
  return (value || '').replace(/^ROLE_/i, '').toUpperCase();
}

function isEnabledStatut(statut?: string | null): boolean {
  const s = String(statut || '').trim().toUpperCase();
  return ['ACTIF', 'ON', 'ACTIVE', 'TRUE', '1'].includes(s);
}

export default function ConfigurationUsersScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const { token, profile } = useApp();
  const borderColor = (theme as any).isDark ? '#1f2937' : '#e5e7eb';

  const canCreate = isSuperAdmin(profile) || hasPermission(profile, 'UTILISATEUR_CREER');
  const canModify = isSuperAdmin(profile) || hasPermission(profile, 'UTILISATEUR_MODIFIER');
  const canToggle = isSuperAdmin(profile) || hasPermission(profile, 'UTILISATEUR_ACTIVER_DESACTIVER');

  // Types de compte que je suis autorisé à créer, selon mon propre rôle
  // (miroir exact de la logique web : je ne peux pas créer un compte de mon niveau ou au-dessus).
  const myTokens = useMemo(() => getRoleNames(profile).map(normalizeRoleValue), [profile]);
  const filteredTypeOptions = useMemo(() => {
    const forbidden = new Set<string>();
    if (myTokens.includes('SUPERADMIN')) {
      forbidden.add('SUPERADMIN');
    } else if (myTokens.includes('ADMINISTRATEUR') || myTokens.includes('ADMIN')) {
      forbidden.add('SUPERADMIN');
      forbidden.add('ADMINISTRATEUR');
    } else {
      forbidden.add('SUPERADMIN');
      forbidden.add('ADMINISTRATEUR');
      forbidden.add('GERANT_BOUTIQUE');
    }
    return TYPE_OPTIONS.filter((opt) => !forbidden.has(opt.value));
  }, [myTokens]);

  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserDTO[]>([]);
  const [assignableRoles, setAssignableRoles] = useState<RoleDTO[]>([]);
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<UserDTO | null>(null);

  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [email, setEmail] = useState('');
  const [pseudo, setPseudo] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [contact, setContact] = useState('');
  const [codePays, setCodePays] = useState('');
  const [adresse, setAdresse] = useState('');
  const [typeUtilisateur, setTypeUtilisateur] = useState('');
  const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>([]);
  const [statut, setStatut] = useState<'ACTIF' | 'INACTIF'>('ACTIF');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const rn = (u.roles || []).map(roleName).join(' ');
      const s = `${u.nom || ''} ${u.prenom || ''} ${u.email || ''} ${u.pseudo || ''} ${rn}`.toLowerCase();
      return s.includes(q);
    });
  }, [users, search]);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [u, r] = await Promise.all([listUsers(token), listAssignableRoles(token).catch(() => [])]);
      setUsers(u);
      setAssignableRoles(r);
    } catch (e: any) {
      showError('Erreur', e.message || 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const openCreate = () => {
    setEditing(null);
    setNom('');
    setPrenom('');
    setEmail('');
    setPseudo('');
    setMotDePasse('');
    setContact('');
    setCodePays('');
    setAdresse('');
    setTypeUtilisateur('');
    setSelectedRoleIds([]);
    setStatut('ACTIF');
    setModalOpen(true);
  };

  const openEdit = (u: UserDTO) => {
    if (profile?.id != null && u?.id === profile.id) {
      showError('Action interdite', 'Vous ne pouvez pas modifier vos informations ici. Utilisez plutôt votre Profil.');
      return;
    }
    setEditing(u);
    setNom(String(u.nom || ''));
    setPrenom(String(u.prenom || ''));
    setEmail(String(u.email || ''));
    setPseudo(String(u.pseudo || ''));
    setMotDePasse('');
    setContact(String(u.contact || ''));
    setCodePays(String(u.codePays || ''));
    setAdresse(String(u.adresse || ''));
    setTypeUtilisateur(String(u.typeUtilisateur || ''));
    setStatut(isEnabledStatut(u.statut) ? 'ACTIF' : 'INACTIF');

    const roles = Array.isArray(u.roles) ? (u.roles as any[]) : [];
    const ids = roles
      .map((rr) => (typeof rr === 'object' && rr && typeof rr.id === 'number' ? rr.id : null))
      .filter((x) => typeof x === 'number') as number[];
    setSelectedRoleIds(ids);
    setModalOpen(true);
  };

  const toggleRole = (roleId: number) => {
    setSelectedRoleIds((prev) => (prev.includes(roleId) ? prev.filter((x) => x !== roleId) : [...prev, roleId]));
  };

  const getRoleIdForType = (typeValue: string): number | undefined => {
    const candidates = ROLE_CANDIDATES_BY_TYPE[typeValue] || [typeValue];
    const match = assignableRoles.find((r) => candidates.includes(normalizeRoleValue(r?.name || '')));
    return match?.id;
  };

  // À la création, le rôle est dérivé automatiquement du type choisi (comme sur le web) :
  // les cases à cocher ne sont pas éditables manuellement tant qu'on crée un utilisateur.
  useEffect(() => {
    if (editing) return;
    const roleId = getRoleIdForType(typeUtilisateur);
    if (!roleId) return;
    setSelectedRoleIds((prev) => (prev.length === 1 && prev[0] === roleId ? prev : [roleId]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeUtilisateur, assignableRoles, editing]);

  const save = async () => {
    if (!token) return;
    if (editing) {
      if (!canModify) {
        showError('Accès refusé', 'Permission manquante');
        return;
      }
      if (profile?.id != null && editing?.id === profile.id) {
        showError('Action interdite', 'Vous ne pouvez pas modifier vos informations ici. Utilisez plutôt votre Profil.');
        return;
      }
    } else {
      if (!canCreate) {
        showError('Accès refusé', 'Permission manquante');
        return;
      }
    }

    if (!nom.trim() || !email.trim()) {
      showError('Erreur', 'Nom et email sont requis');
      return;
    }
    if (!editing && !motDePasse.trim()) {
      showError('Erreur', 'Mot de passe requis (création)');
      return;
    }
    if (contact.trim() && !codePays.trim()) {
      showError('Erreur', 'Code pays requis si contact est renseigné');
      return;
    }

    setSaving(true);
    try {
      const rolesPayload = assignableRoles
        .filter((r) => selectedRoleIds.includes(r.id))
        .map((r) => ({ id: r.id, name: r.name }));

      const payload: any = {
        nom: nom.trim(),
        prenom: prenom.trim() || null,
        email: email.trim(),
        pseudo: pseudo.trim() || email.trim().split('@')[0],
        contact: contact.trim() || null,
        codePays: codePays.trim() || null,
        adresse: adresse.trim() || null,
        typeUtilisateur: typeUtilisateur.trim() || null,
        statut,
        roles: rolesPayload,
      };

      if (motDePasse.trim()) payload.motDePasse = motDePasse.trim();

      let createdUser: UserDTO | null = null;
      if (editing?.id) {
        await updateUser(editing.id, payload, token);
        showSuccess('Succès', 'Utilisateur mis à jour');
      } else {
        createdUser = await createUser(payload, token);
        showSuccess('Succès', 'Utilisateur créé');
      }

      setModalOpen(false);
      await load();

      if (createdUser?.id) {
        navigation.navigate('ConfigurationAssignPermissions', { initialUserId: createdUser.id });
      }
    } catch (e: any) {
      showError('Erreur', e.message || 'Sauvegarde impossible');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatut = async (u: UserDTO) => {
    if (!token) return;
    if (!canToggle) {
      showError('Accès refusé', 'Permission manquante');
      return;
    }
    const enabled = isEnabledStatut(u.statut);
    const next = enabled ? 'INACTIF' : 'ACTIF';
    try {
      await updateUserStatut(u.id, next, token);
      showSuccess('Succès', `Statut: ${next}`);
      await load();
    } catch (e: any) {
      showError('Erreur', e.message || 'Mise à jour impossible');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <Text style={{ color: theme.text, fontSize: 20, fontWeight: '900' }}>Utilisateurs</Text>
          <Pressable
            onPress={openCreate}
            disabled={!canCreate}
            style={{ backgroundColor: canCreate ? theme.primary : theme.muted, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12 }}
          >
            <Text style={{ color: theme.text, fontWeight: '900' }}>Ajouter</Text>
          </Pressable>
        </View>

        <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor, marginBottom: 12 }}>
          <Text style={{ color: theme.muted, fontWeight: '900', marginBottom: 8 }}>Recherche</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, borderRadius: 12, paddingHorizontal: 10, borderWidth: 1, borderColor }}>
            <Ionicons name="search" size={18} color={theme.muted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Rechercher (nom, email, rôle)"
              placeholderTextColor={theme.muted}
              style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 10, color: theme.text }}
            />
          </View>
        </View>

        {loading ? (
          <ActivityIndicator />
        ) : filtered.length === 0 ? (
          <Text style={{ color: theme.muted }}>Aucun utilisateur.</Text>
        ) : (
          filtered.map((u) => {
            const enabled = isEnabledStatut(u.statut);
            const roles = (u.roles || []).map(roleName).filter(Boolean);
            const isSelf = profile?.id != null && u.id === profile.id;
            return (
              <View key={u.id} style={{ backgroundColor: theme.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor, marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.text, fontWeight: '900' }}>{`${u.prenom || ''} ${u.nom || ''}`.trim() || '—'}</Text>
                    <Text style={{ color: theme.muted, marginTop: 4 }}>{u.email || '—'}</Text>
                  </View>
                  <View style={{ backgroundColor: enabled ? '#10b98122' : '#ef444422', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: enabled ? '#10b981' : '#ef4444' }}>
                    <Text style={{ color: theme.text, fontWeight: '900' }}>{enabled ? 'Actif' : 'Inactif'}</Text>
                  </View>
                </View>

                <Text style={{ color: theme.muted, marginTop: 8 }}>Pseudo: {u.pseudo || '—'}  •  Rôles: {roles.length ? roles.join(', ') : '—'}</Text>

                <View style={{ flexDirection: 'row', gap: 10 as any, marginTop: 12 }}>
                  <Pressable
                    onPress={() => openEdit(u)}
                    disabled={!canModify || isSelf}
                    style={{ flex: 1, backgroundColor: !canModify || isSelf ? theme.muted : theme.surface, borderWidth: 1, borderColor, paddingVertical: 10, borderRadius: 12, alignItems: 'center' }}
                  >
                    <Text style={{ color: theme.text, fontWeight: '900' }}>Modifier</Text>
                  </Pressable>
                  {!isSelf ? (
                    <Pressable
                      onPress={() => toggleStatut(u)}
                      disabled={!canToggle}
                      style={{ flex: 1, backgroundColor: canToggle ? theme.primary : theme.muted, paddingVertical: 10, borderRadius: 12, alignItems: 'center' }}
                    >
                      <Text style={{ color: theme.text, fontWeight: '900' }}>{enabled ? 'Désactiver' : 'Activer'}</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal visible={modalOpen} transparent animationType="fade" onRequestClose={() => setModalOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 16 }}>
          <View style={{ backgroundColor: theme.card, borderRadius: 18, padding: 14, borderWidth: 1, borderColor, maxHeight: '85%' as any }}>
            <ScrollView>
              <Text style={{ color: theme.text, fontWeight: '900', fontSize: 16 }}>{editing ? 'Modifier utilisateur' : 'Nouvel utilisateur'}</Text>

              <View style={{ flexDirection: 'row', gap: 10 as any, marginTop: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.muted, marginBottom: 6 }}>Nom *</Text>
                  <TextInput value={nom} onChangeText={setNom} placeholder="Nom" placeholderTextColor={theme.muted} style={{ backgroundColor: theme.surface, borderRadius: 12, padding: 10, color: theme.text, borderWidth: 1, borderColor }} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.muted, marginBottom: 6 }}>Prénom</Text>
                  <TextInput value={prenom} onChangeText={setPrenom} placeholder="Prénom" placeholderTextColor={theme.muted} style={{ backgroundColor: theme.surface, borderRadius: 12, padding: 10, color: theme.text, borderWidth: 1, borderColor }} />
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 10 as any, marginTop: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.muted, marginBottom: 6 }}>Email *</Text>
                  <TextInput value={email} onChangeText={setEmail} placeholder="email@exemple.com" placeholderTextColor={theme.muted} autoCapitalize="none" style={{ backgroundColor: theme.surface, borderRadius: 12, padding: 10, color: theme.text, borderWidth: 1, borderColor }} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.muted, marginBottom: 6 }}>{editing ? 'Mot de passe (opt.)' : 'Mot de passe *'}</Text>
                  <TextInput value={motDePasse} onChangeText={setMotDePasse} placeholder="Mot de passe" placeholderTextColor={theme.muted} secureTextEntry style={{ backgroundColor: theme.surface, borderRadius: 12, padding: 10, color: theme.text, borderWidth: 1, borderColor }} />
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 10 as any, marginTop: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.muted, marginBottom: 6 }}>Contact</Text>
                  <TextInput value={contact} onChangeText={setContact} placeholder="Téléphone" placeholderTextColor={theme.muted} style={{ backgroundColor: theme.surface, borderRadius: 12, padding: 10, color: theme.text, borderWidth: 1, borderColor }} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.muted, marginBottom: 6 }}>Code pays</Text>
                  <TextInput value={codePays} onChangeText={setCodePays} placeholder="Ex: ML" placeholderTextColor={theme.muted} autoCapitalize="characters" style={{ backgroundColor: theme.surface, borderRadius: 12, padding: 10, color: theme.text, borderWidth: 1, borderColor }} />
                </View>
              </View>

              <Text style={{ color: theme.muted, marginTop: 12, marginBottom: 6 }}>Type utilisateur</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 as any }}>
                {(() => {
                  const optionsToShow = [...filteredTypeOptions];
                  if (typeUtilisateur && !optionsToShow.find((o) => o.value === typeUtilisateur)) {
                    optionsToShow.push({ value: typeUtilisateur, label: typeUtilisateur });
                  }
                  return optionsToShow.map((opt) => {
                    const selected = typeUtilisateur === opt.value;
                    return (
                      <Pressable
                        key={opt.value}
                        onPress={() => setTypeUtilisateur(opt.value)}
                        style={{
                          paddingVertical: 8,
                          paddingHorizontal: 14,
                          borderRadius: 999,
                          backgroundColor: selected ? theme.primary : theme.surface,
                          borderWidth: 1,
                          borderColor: selected ? theme.primary : borderColor,
                        }}
                      >
                        <Text style={{ color: theme.text, fontWeight: '900' }}>{opt.label}</Text>
                      </Pressable>
                    );
                  });
                })()}
              </View>

              <View style={{ flexDirection: 'row', gap: 10 as any, marginTop: 12 }}>
                <Pressable onPress={() => setStatut('ACTIF')} style={{ flex: 1, backgroundColor: statut === 'ACTIF' ? theme.primary : theme.surface, borderWidth: 1, borderColor, paddingVertical: 10, borderRadius: 12, alignItems: 'center' }}>
                  <Text style={{ color: theme.text, fontWeight: '900' }}>Actif</Text>
                </Pressable>
                <Pressable onPress={() => setStatut('INACTIF')} style={{ flex: 1, backgroundColor: statut === 'INACTIF' ? theme.primary : theme.surface, borderWidth: 1, borderColor, paddingVertical: 10, borderRadius: 12, alignItems: 'center' }}>
                  <Text style={{ color: theme.text, fontWeight: '900' }}>Inactif</Text>
                </Pressable>
              </View>

              <Text style={{ color: theme.muted, marginTop: 14, marginBottom: 8, fontWeight: '900' }}>Rôles (assignables)</Text>
              {!editing && (
                <Text style={{ color: theme.muted, marginBottom: 8, fontStyle: 'italic' }}>
                  Dérivé automatiquement du type choisi ci-dessus.
                </Text>
              )}
              {assignableRoles.length === 0 ? (
                <Text style={{ color: theme.muted }}>Aucun rôle disponible.</Text>
              ) : (
                assignableRoles.map((r) => {
                  const checked = selectedRoleIds.includes(r.id);
                  const creationLocked = !editing;
                  return (
                    <Pressable
                      key={r.id}
                      onPress={() => !creationLocked && toggleRole(r.id)}
                      disabled={creationLocked}
                      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: borderColor, opacity: creationLocked ? 0.6 : 1 }}
                    >
                      <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={20} color={checked ? theme.primary : theme.muted} />
                      <Text style={{ color: theme.text, marginLeft: 10, fontWeight: '900' }}>{r.name || '—'}</Text>
                      {r.description ? <Text style={{ color: theme.muted, marginLeft: 10, flex: 1 }} numberOfLines={1}>{r.description}</Text> : <View style={{ flex: 1 }} />}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 10 as any, marginTop: 14 }}>
              <Pressable onPress={() => setModalOpen(false)} style={{ flex: 1, backgroundColor: theme.surface, borderWidth: 1, borderColor, paddingVertical: 12, borderRadius: 12, alignItems: 'center' }}>
                <Text style={{ color: theme.text, fontWeight: '900' }}>Annuler</Text>
              </Pressable>
              <Pressable onPress={save} disabled={saving} style={{ flex: 1, backgroundColor: saving ? theme.muted : theme.primary, paddingVertical: 12, borderRadius: 12, alignItems: 'center' }}>
                <Text style={{ color: theme.text, fontWeight: '900' }}>{saving ? 'En cours…' : 'Enregistrer'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
