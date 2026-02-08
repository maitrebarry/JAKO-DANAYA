import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { useApp } from '../store/AppContext';
import { createMagasin, deleteMagasin, listMagasins, MagasinDTO, updateMagasin } from '../services/magasins';
import { showError, showSuccess } from '../utils/notify';

export default function ConfigurationMagasinsScreen() {
  const theme = useTheme();
  const { token } = useApp();
  const borderColor = (theme as any).isDark ? '#1f2937' : '#e5e7eb';

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<MagasinDTO[]>([]);
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<MagasinDTO | null>(null);

  const [nom, setNom] = useState('');
  const [adresse, setAdresse] = useState('');
  const [typeMagasin, setTypeMagasin] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((m) => {
      const s = `${m.nom || m.nomMagasin || ''} ${m.adresse || ''} ${m.typeMagasin || ''}`.toLowerCase();
      return s.includes(q);
    });
  }, [items, search]);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await listMagasins(token);
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
    setNom('');
    setAdresse('');
    setTypeMagasin('');
    setModalOpen(true);
  };

  const openEdit = (m: MagasinDTO) => {
    setEditing(m);
    setNom(String(m.nom || m.nomMagasin || ''));
    setAdresse(String(m.adresse || ''));
    setTypeMagasin(String(m.typeMagasin || ''));
    setModalOpen(true);
  };

  const save = async () => {
    if (!token) return;
    if (!nom.trim()) {
      showError('Erreur', 'Nom requis');
      return;
    }
    setSaving(true);
    try {
      const payload = { nom: nom.trim(), adresse: adresse.trim() || null, typeMagasin: typeMagasin.trim() || null };
      if (editing?.id) {
        await updateMagasin(editing.id, payload, token);
        showSuccess('Succès', 'Magasin mis à jour');
      } else {
        await createMagasin(payload, token);
        showSuccess('Succès', 'Magasin créé');
      }
      setModalOpen(false);
      await load();
    } catch (e: any) {
      showError('Erreur', e.message || 'Sauvegarde impossible');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (m: MagasinDTO) => {
    if (!token) return;
    try {
      await deleteMagasin(m.id, token);
      showSuccess('Succès', 'Magasin supprimé');
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
          <Text style={{ color: theme.text, fontSize: 20, fontWeight: '900' }}>Magasins</Text>
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
                placeholder="Rechercher (nom, adresse, type)"
                placeholderTextColor={theme.muted}
                style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 10, color: theme.text }}
              />
            </View>
          </View>
        )}

        {loading ? (
          <ActivityIndicator />
        ) : filtered.length === 0 ? (
          <Text style={{ color: theme.muted }}>Aucun magasin.</Text>
        ) : (
          filtered.map((m) => (
            <View key={m.id} style={{ backgroundColor: theme.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor, marginBottom: 12 }}>
              <Text style={{ color: theme.text, fontWeight: '900' }}>{m.nom || m.nomMagasin || '—'}</Text>
              <Text style={{ color: theme.muted, marginTop: 4 }} numberOfLines={2}>
                Adresse: {m.adresse || '—'}
              </Text>
              <Text style={{ color: theme.muted, marginTop: 2 }}>Type: {m.typeMagasin || '—'}</Text>

              <View style={{ flexDirection: 'row', gap: 10 as any, marginTop: 12 }}>
                <Pressable onPress={() => openEdit(m)} style={{ flex: 1, backgroundColor: theme.surface, borderWidth: 1, borderColor, paddingVertical: 10, borderRadius: 12, alignItems: 'center' }}>
                  <Text style={{ color: theme.text, fontWeight: '900' }}>Modifier</Text>
                </Pressable>
                <Pressable onPress={() => remove(m)} style={{ flex: 1, backgroundColor: theme.danger, paddingVertical: 10, borderRadius: 12, alignItems: 'center' }}>
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
            <Text style={{ color: theme.text, fontWeight: '900', fontSize: 16 }}>{editing ? 'Modifier magasin' : 'Nouveau magasin'}</Text>

            <Text style={{ color: theme.muted, marginTop: 12, marginBottom: 6 }}>Nom *</Text>
            <TextInput value={nom} onChangeText={setNom} placeholder="Ex: Magasin principal" placeholderTextColor={theme.muted} style={{ backgroundColor: theme.surface, borderRadius: 12, padding: 10, color: theme.text, borderWidth: 1, borderColor }} />

            <Text style={{ color: theme.muted, marginTop: 12, marginBottom: 6 }}>Adresse</Text>
            <TextInput value={adresse} onChangeText={setAdresse} placeholder="Adresse" placeholderTextColor={theme.muted} style={{ backgroundColor: theme.surface, borderRadius: 12, padding: 10, color: theme.text, borderWidth: 1, borderColor }} />

            <Text style={{ color: theme.muted, marginTop: 12, marginBottom: 6 }}>Type magasin</Text>
            <TextInput value={typeMagasin} onChangeText={setTypeMagasin} placeholder="Ex: DEPOT" placeholderTextColor={theme.muted} style={{ backgroundColor: theme.surface, borderRadius: 12, padding: 10, color: theme.text, borderWidth: 1, borderColor }} />

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
