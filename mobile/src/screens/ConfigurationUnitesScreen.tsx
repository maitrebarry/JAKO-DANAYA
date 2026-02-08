import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { useApp } from '../store/AppContext';
import { createUnite, deleteUnite, listUnites, UniteDTO, updateUnite } from '../services/unites';
import { showError, showSuccess } from '../utils/notify';

export default function ConfigurationUnitesScreen() {
  const theme = useTheme();
  const { token } = useApp();
  const borderColor = (theme as any).isDark ? '#1f2937' : '#e5e7eb';

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<UniteDTO[]>([]);
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<UniteDTO | null>(null);

  const [libelle, setLibelle] = useState('');
  const [symbole, setSymbole] = useState('');
  const [code, setCode] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((u) => {
      const s = `${u.libelle || ''} ${u.symbole || ''} ${u.code || ''}`.toLowerCase();
      return s.includes(q);
    });
  }, [items, search]);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await listUnites(token);
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

  const openCreate = () => {
    setEditing(null);
    setLibelle('');
    setSymbole('');
    setCode('');
    setModalOpen(true);
  };

  const openEdit = (u: UniteDTO) => {
    setEditing(u);
    setLibelle(String(u.libelle || ''));
    setSymbole(String(u.symbole || ''));
    setCode(String(u.code || ''));
    setModalOpen(true);
  };

  const save = async () => {
    if (!token) return;
    if (!libelle.trim()) {
      showError('Erreur', 'Libellé requis');
      return;
    }
    setSaving(true);
    try {
      const payload = { libelle: libelle.trim(), symbole: symbole.trim() || null, code: code.trim() || null };
      if (editing?.id) {
        await updateUnite(editing.id, payload, token);
        showSuccess('Succès', 'Unité mise à jour');
      } else {
        await createUnite(payload, token);
        showSuccess('Succès', 'Unité créée');
      }
      setModalOpen(false);
      await load();
    } catch (e: any) {
      showError('Erreur', e.message || 'Sauvegarde impossible');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (u: UniteDTO) => {
    if (!token) return;
    try {
      await deleteUnite(u.id, token);
      showSuccess('Succès', 'Unité supprimée');
      await load();
    } catch (e: any) {
      showError('Erreur', e.message || 'Suppression impossible');
    }
  };

  const card = (child: any) => (
    <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor, marginBottom: 12 }}>{child}</View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <Text style={{ color: theme.text, fontSize: 20, fontWeight: '900' }}>Unités</Text>
          <Pressable onPress={openCreate} style={{ backgroundColor: theme.primary, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12 }}>
            <Text style={{ color: theme.text, fontWeight: '900' }}>Ajouter</Text>
          </Pressable>
        </View>

        {card(
          <View>
            <Text style={{ color: theme.muted, fontWeight: '900', marginBottom: 8 }}>Recherche</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, borderRadius: 12, paddingHorizontal: 10, borderWidth: 1, borderColor }}>
              <Ionicons name="search" size={18} color={theme.muted} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Rechercher (libellé, symbole, code)"
                placeholderTextColor={theme.muted}
                style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 10, color: theme.text }}
              />
            </View>
          </View>
        )}

        {loading ? (
          <ActivityIndicator />
        ) : filtered.length === 0 ? (
          <Text style={{ color: theme.muted }}>Aucune unité.</Text>
        ) : (
          filtered.map((u) => (
            <View key={u.id} style={{ backgroundColor: theme.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor, marginBottom: 12 }}>
              <Text style={{ color: theme.text, fontWeight: '900' }}>{u.libelle || '—'}</Text>
              <Text style={{ color: theme.muted, marginTop: 4 }}>
                Symbole: {u.symbole || '—'}  •  Code: {u.code || '—'}
              </Text>

              <View style={{ flexDirection: 'row', gap: 10 as any, marginTop: 12 }}>
                <Pressable onPress={() => openEdit(u)} style={{ flex: 1, backgroundColor: theme.surface, borderWidth: 1, borderColor, paddingVertical: 10, borderRadius: 12, alignItems: 'center' }}>
                  <Text style={{ color: theme.text, fontWeight: '900' }}>Modifier</Text>
                </Pressable>
                <Pressable onPress={() => remove(u)} style={{ flex: 1, backgroundColor: theme.danger, paddingVertical: 10, borderRadius: 12, alignItems: 'center' }}>
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
            <Text style={{ color: theme.text, fontWeight: '900', fontSize: 16 }}>{editing ? 'Modifier unité' : 'Nouvelle unité'}</Text>

            <Text style={{ color: theme.muted, marginTop: 12, marginBottom: 6 }}>Libellé *</Text>
            <TextInput value={libelle} onChangeText={setLibelle} placeholder="Ex: Pièce" placeholderTextColor={theme.muted} style={{ backgroundColor: theme.surface, borderRadius: 12, padding: 10, color: theme.text, borderWidth: 1, borderColor }} />

            <Text style={{ color: theme.muted, marginTop: 12, marginBottom: 6 }}>Symbole</Text>
            <TextInput value={symbole} onChangeText={setSymbole} placeholder="Ex: pcs" placeholderTextColor={theme.muted} style={{ backgroundColor: theme.surface, borderRadius: 12, padding: 10, color: theme.text, borderWidth: 1, borderColor }} />

            <Text style={{ color: theme.muted, marginTop: 12, marginBottom: 6 }}>Code</Text>
            <TextInput value={code} onChangeText={setCode} placeholder="Ex: PCS" placeholderTextColor={theme.muted} style={{ backgroundColor: theme.surface, borderRadius: 12, padding: 10, color: theme.text, borderWidth: 1, borderColor }} />

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
