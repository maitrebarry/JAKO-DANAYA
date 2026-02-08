import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { useApp } from '../store/AppContext';
import { createPermission, deletePermission, listPermissions, PermissionDTO, updatePermission } from '../services/admin';
import { isSuperAdmin } from '../utils/permissions';
import { showError, showSuccess } from '../utils/notify';

export default function ConfigurationPermissionsScreen() {
  const theme = useTheme();
  const { token, profile } = useApp();
  const borderColor = (theme as any).isDark ? '#1f2937' : '#e5e7eb';

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<PermissionDTO[]>([]);
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<PermissionDTO | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const allowed = isSuperAdmin(profile);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((p) => `${p.name || ''} ${p.description || ''}`.toLowerCase().includes(q));
  }, [items, search]);

  const load = async () => {
    if (!token) return;
    if (!allowed) return;
    setLoading(true);
    try {
      const data = await listPermissions(token);
      setItems(data);
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

  if (!allowed) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Text style={{ color: theme.text, fontSize: 20, fontWeight: '900', marginBottom: 10 }}>Permissions</Text>
          <View style={{ backgroundColor: theme.surface, borderRadius: 16, padding: 12, borderWidth: 1, borderColor }}>
            <Text style={{ color: theme.text, fontWeight: '900' }}>Accès refusé</Text>
            <Text style={{ color: theme.muted, marginTop: 6, lineHeight: 20 }}>
              Cette section (liste + création/modification des permissions) est réservée au SUPERADMIN.
            </Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  const openCreate = () => {
    setEditing(null);
    setName('');
    setDescription('');
    setModalOpen(true);
  };

  const openEdit = (p: PermissionDTO) => {
    setEditing(p);
    setName(String(p.name || ''));
    setDescription(String(p.description || ''));
    setModalOpen(true);
  };

  const save = async () => {
    if (!token) return;
    if (!allowed) {
      showError('Accès refusé', 'Superadmin requis');
      return;
    }
    if (!name.trim()) {
      showError('Erreur', 'Nom requis');
      return;
    }
    setSaving(true);
    try {
      const payload = { name: name.trim(), description: description.trim() || null };
      if (editing?.id) {
        await updatePermission(editing.id, payload, token);
        showSuccess('Succès', 'Permission mise à jour');
      } else {
        await createPermission(payload, token);
        showSuccess('Succès', 'Permission créée');
      }
      setModalOpen(false);
      await load();
    } catch (e: any) {
      showError('Erreur', e.message || 'Sauvegarde impossible');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p: PermissionDTO) => {
    if (!token) return;
    if (!allowed) {
      showError('Accès refusé', 'Superadmin requis');
      return;
    }
    try {
      await deletePermission(p.id, token);
      showSuccess('Succès', 'Permission supprimée');
      await load();
    } catch (e: any) {
      showError('Erreur', e.message || 'Suppression impossible');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <Text style={{ color: theme.text, fontSize: 20, fontWeight: '900' }}>Permissions</Text>
          <Pressable onPress={openCreate} disabled={!allowed} style={{ backgroundColor: allowed ? theme.primary : theme.muted, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12 }}>
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
              placeholder="Rechercher une permission"
              placeholderTextColor={theme.muted}
              style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 10, color: theme.text }}
            />
          </View>
        </View>

        {loading ? (
          <ActivityIndicator />
        ) : filtered.length === 0 ? (
          <Text style={{ color: theme.muted }}>Aucune permission.</Text>
        ) : (
          filtered.map((p) => (
            <View key={p.id} style={{ backgroundColor: theme.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor, marginBottom: 12 }}>
              <Text style={{ color: theme.text, fontWeight: '900' }}>{p.name || '—'}</Text>
              {p.description ? <Text style={{ color: theme.muted, marginTop: 4 }}>{p.description}</Text> : null}
              <View style={{ flexDirection: 'row', gap: 10 as any, marginTop: 12 }}>
                <Pressable onPress={() => openEdit(p)} disabled={!allowed} style={{ flex: 1, backgroundColor: allowed ? theme.surface : theme.muted, borderWidth: 1, borderColor, paddingVertical: 10, borderRadius: 12, alignItems: 'center' }}>
                  <Text style={{ color: theme.text, fontWeight: '900' }}>Modifier</Text>
                </Pressable>
                <Pressable onPress={() => remove(p)} disabled={!allowed} style={{ flex: 1, backgroundColor: allowed ? theme.danger : theme.muted, paddingVertical: 10, borderRadius: 12, alignItems: 'center' }}>
                  <Text style={{ color: theme.text, fontWeight: '900' }}>Supprimer</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={modalOpen} transparent animationType="fade" onRequestClose={() => setModalOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 16 }}>
          <View style={{ backgroundColor: theme.card, borderRadius: 18, padding: 14, borderWidth: 1, borderColor }}>
            <Text style={{ color: theme.text, fontWeight: '900', fontSize: 16 }}>{editing ? 'Modifier permission' : 'Nouvelle permission'}</Text>

            <Text style={{ color: theme.muted, marginTop: 12, marginBottom: 6 }}>Nom *</Text>
            <TextInput value={name} onChangeText={setName} placeholder="Ex: CONFIG_MARGE_ECRITURE" placeholderTextColor={theme.muted} style={{ backgroundColor: theme.surface, borderRadius: 12, padding: 10, color: theme.text, borderWidth: 1, borderColor }} />

            <Text style={{ color: theme.muted, marginTop: 12, marginBottom: 6 }}>Description</Text>
            <TextInput value={description} onChangeText={setDescription} placeholder="Description" placeholderTextColor={theme.muted} style={{ backgroundColor: theme.surface, borderRadius: 12, padding: 10, color: theme.text, borderWidth: 1, borderColor }} />

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
