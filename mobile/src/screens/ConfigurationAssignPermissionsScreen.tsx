import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { useApp } from '../store/AppContext';
import { getUserEffectivePermissions, listAdminPermissions, listAdminUsers, PermissionDTO, setUserPermissions, UserDTO } from '../services/admin';
import { getRoleNames, hasPermission, isSuperAdmin } from '../utils/permissions';
import { showError, showSuccess } from '../utils/notify';

function normalizeRoleName(v: any): string {
  return String(v || '')
    .replace(/^ROLE_/i, '')
    .trim()
    .toUpperCase();
}

function getUserRoleNames(u: any): string[] {
  const roles = Array.isArray(u?.roles) ? u.roles : [];
  const list = roles
    .map((r: any) => (typeof r === 'string' ? r : r?.name))
    .map(normalizeRoleName)
    .filter(Boolean);
  const tu = u?.typeUtilisateur;
  if (tu && typeof tu === 'string') {
    const t = normalizeRoleName(tu);
    if (t && !list.includes(t)) list.push(t);
  }
  return list;
}

export default function ConfigurationAssignPermissionsScreen() {
  const theme = useTheme();
  const { token, profile } = useApp();
  const borderColor = (theme as any).isDark ? '#1f2937' : '#e5e7eb';

  const myRoles = getRoleNames(profile);
  const amSuper = isSuperAdmin(profile);
  const amProprietaire = myRoles.includes('PROPRIETAIRE');
  const amAdministrateur = myRoles.includes('ADMIN') || myRoles.includes('ADMINISTRATEUR');
  const amGerant = myRoles.includes('GERANT_BOUTIQUE') || myRoles.includes('GERANT') || myRoles.includes('MANAGER');
  const canManageUsers =
    hasPermission(profile, 'UTILISATEUR_GERER') ||
    hasPermission(profile, 'UTILISATEUR_CREER');
  const canAccess = amSuper || ((amProprietaire || amAdministrateur || amGerant) && canManageUsers);

  const allowedSubRoles = new Set([
    'GERANT_BOUTIQUE', 'GERANT', 'MANAGER',
    'MAGASINIER', 'STOREKEEPER',
    'CAISSIER', 'CASHIER',
  ]);
  const allowedGerantTargets = new Set(['MAGASINIER', 'STOREKEEPER', 'CAISSIER', 'CASHIER']);

  const canAssignTo = (u: UserDTO): boolean => {
    const selfId = profile?.id;
    if (selfId != null && u.id === selfId) return false;
    const r = getUserRoleNames(u);
    if (amSuper) return !r.includes('SUPERADMIN');
    if (amProprietaire || amAdministrateur) return r.some((x) => allowedSubRoles.has(x));
    if (amGerant) return r.some((x) => allowedGerantTargets.has(x));
    return false;
  };

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<UserDTO[]>([]);
  const [permissions, setPermissions] = useState<PermissionDTO[]>([]);

  const [userSearch, setUserSearch] = useState('');
  const [permSearch, setPermSearch] = useState('');

  const [selectedUser, setSelectedUser] = useState<UserDTO | null>(null);
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<number[]>([]);
  const [loadingUserPerms, setLoadingUserPerms] = useState(false);

  const selectableUsers = useMemo(() => {
    const selfId = profile?.id;
    return (users || [])
      .filter((u) => (selfId == null ? true : u.id !== selfId))
      .filter((u) => {
        const r = getUserRoleNames(u);
        if (amSuper) {
          return !r.includes('SUPERADMIN');
        }
        if (amProprietaire || amAdministrateur) {
          return r.some((x) => allowedSubRoles.has(x));
        }
        if (amGerant) {
          return r.some((x) => allowedGerantTargets.has(x));
        }
        return false;
      });
  }, [users, profile?.id, amSuper, amProprietaire, amAdministrateur, amGerant]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return selectableUsers;
    return selectableUsers.filter((u) => `${u.nom || ''} ${u.prenom || ''} ${u.email || ''} ${u.pseudo || ''}`.toLowerCase().includes(q));
  }, [selectableUsers, userSearch]);

  const filteredPermissions = useMemo(() => {
    const q = permSearch.trim().toLowerCase();
    if (!q) return permissions;
    return permissions.filter((p) => `${p.name || ''} ${p.description || ''}`.toLowerCase().includes(q));
  }, [permissions, permSearch]);

  const load = async () => {
    if (!token) return;
    if (!canAccess) return;
    setLoading(true);
    try {
      const [u, p] = await Promise.all([listAdminUsers(token), listAdminPermissions(token)]);
      setUsers(u);
      setPermissions(p);
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

  if (!canAccess) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Text style={{ color: theme.text, fontSize: 20, fontWeight: '900', marginBottom: 10 }}>Assigner des permissions</Text>
          <View style={{ backgroundColor: theme.surface, borderRadius: 16, padding: 12, borderWidth: 1, borderColor }}>
            <Text style={{ color: theme.text, fontWeight: '900' }}>Accès refusé</Text>
            <Text style={{ color: theme.muted, marginTop: 6, lineHeight: 20 }}>
              Accès réservé au SuperAdmin, ou aux Administrateurs, Propriétaires et Gérants disposant de la permission UTILISATEUR_GERER ou UTILISATEUR_CREER.
            </Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  const selectUser = async (u: UserDTO) => {
    if (!token) return;
    setSelectedUser(u);
    setLoadingUserPerms(true);
    try {
      const perms = await getUserEffectivePermissions(u.id, token);
      const ids = perms.map((pp) => pp.id).filter((x) => typeof x === 'number') as number[];
      setSelectedPermissionIds(ids);
    } catch (e: any) {
      setSelectedPermissionIds([]);
      showError('Erreur', e.message || 'Chargement permissions utilisateur impossible');
    } finally {
      setLoadingUserPerms(false);
    }
  };

  const togglePerm = (id: number) => {
    setSelectedPermissionIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const save = async () => {
    if (!token) return;
    if (!selectedUser) {
      showError('Erreur', 'Sélectionnez un utilisateur');
      return;
    }
    if (!canAssignTo(selectedUser)) {
      showError('Erreur', 'Vous n’avez pas le droit d’assigner des permissions à cet utilisateur.');
      return;
    }
    setSaving(true);
    try {
      await setUserPermissions(selectedUser.id, selectedPermissionIds, token);
      showSuccess('Succès', 'Permissions enregistrées');
    } catch (e: any) {
      showError('Erreur', e.message || 'Enregistrement impossible');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={{ color: theme.text, fontSize: 20, fontWeight: '900', marginBottom: 10 }}>Assigner des permissions</Text>

        <View style={{ backgroundColor: theme.surface, borderRadius: 16, padding: 12, borderWidth: 1, borderColor, marginBottom: 12 }}>
          <Text style={{ color: theme.text, fontWeight: '900' }}>Note</Text>
          <Text style={{ color: theme.muted, marginTop: 6, lineHeight: 20 }}>
            Certaines permissions peuvent venir des rôles. La sauvegarde met à jour les permissions directes de l’utilisateur.
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator />
        ) : (
          <>
            <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor, marginBottom: 12 }}>
              <Text style={{ color: theme.muted, fontWeight: '900', marginBottom: 8 }}>Utilisateur</Text>
              {amSuper ? (
                <Text style={{ color: theme.muted, marginBottom: 8 }}>Cible: tous les utilisateurs, hors autres SuperAdmins</Text>
              ) : amProprietaire || amAdministrateur ? (
                <Text style={{ color: theme.muted, marginBottom: 8 }}>Cible: Gérants / Magasiniers / Caissiers</Text>
              ) : amGerant ? (
                <Text style={{ color: theme.muted, marginBottom: 8 }}>Cible: Magasiniers / Caissiers</Text>
              ) : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, borderRadius: 12, paddingHorizontal: 10, borderWidth: 1, borderColor }}>
                <Ionicons name="search" size={18} color={theme.muted} />
                <TextInput
                  value={userSearch}
                  onChangeText={setUserSearch}
                  placeholder="Rechercher un utilisateur"
                  placeholderTextColor={theme.muted}
                  style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 10, color: theme.text }}
                />
              </View>

              <View style={{ marginTop: 10 }}>
                {filteredUsers.slice(0, 20).map((u) => {
                  const selected = selectedUser?.id === u.id;
                  return (
                    <Pressable
                      key={u.id}
                      onPress={() => selectUser(u)}
                      style={{ paddingVertical: 10, paddingHorizontal: 10, borderRadius: 12, backgroundColor: selected ? theme.primary : theme.surface, borderWidth: 1, borderColor, marginBottom: 8 }}
                    >
                      <Text style={{ color: theme.text, fontWeight: '900' }}>{`${u.prenom || ''} ${u.nom || ''}`.trim() || '—'}</Text>
                      <Text style={{ color: theme.muted, marginTop: 2 }}>{u.email || u.pseudo || '—'}</Text>
                    </Pressable>
                  );
                })}
                {filteredUsers.length > 20 ? <Text style={{ color: theme.muted }}>Affichage limité à 20 résultats.</Text> : null}
                {filteredUsers.length === 0 ? <Text style={{ color: theme.muted }}>Aucun utilisateur éligible.</Text> : null}
              </View>
            </View>

            <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor, marginBottom: 12 }}>
              <Text style={{ color: theme.muted, fontWeight: '900', marginBottom: 8 }}>Permissions</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, borderRadius: 12, paddingHorizontal: 10, borderWidth: 1, borderColor }}>
                <Ionicons name="search" size={18} color={theme.muted} />
                <TextInput
                  value={permSearch}
                  onChangeText={setPermSearch}
                  placeholder="Rechercher une permission"
                  placeholderTextColor={theme.muted}
                  style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 10, color: theme.text }}
                />
              </View>

              {loadingUserPerms ? (
                <View style={{ marginTop: 12 }}><ActivityIndicator /></View>
              ) : !selectedUser ? (
                <Text style={{ color: theme.muted, marginTop: 12 }}>Sélectionnez un utilisateur pour voir ses permissions.</Text>
              ) : (
                <View style={{ marginTop: 10 }}>
                  {filteredPermissions.map((p) => {
                    const checked = selectedPermissionIds.includes(p.id);
                    return (
                      <Pressable
                        key={p.id}
                        onPress={() => togglePerm(p.id)}
                        style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: borderColor }}
                      >
                        <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={20} color={checked ? theme.primary : theme.muted} />
                        <View style={{ marginLeft: 10, flex: 1 }}>
                          <Text style={{ color: theme.text, fontWeight: '900' }}>{p.name || '—'}</Text>
                          {p.description ? <Text style={{ color: theme.muted, marginTop: 2 }} numberOfLines={2}>{p.description}</Text> : null}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>

            <Pressable
              onPress={save}
              disabled={saving || !selectedUser}
              style={{ backgroundColor: saving || !selectedUser ? theme.muted : theme.primary, paddingVertical: 14, borderRadius: 14, alignItems: 'center' }}
            >
              <Text style={{ color: theme.text, fontWeight: '900' }}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}
