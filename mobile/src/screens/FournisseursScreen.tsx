import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { useApp } from '../store/AppContext';
import {
  createFournisseur,
  deleteFournisseur,
  fetchFournisseurs,
  updateFournisseur,
  type Fournisseur,
} from '../services/fournisseurs';
import { listBoutiques, type BoutiqueDTO } from '../services/boutiques';
import { isSuperAdmin } from '../utils/permissions';
import { useAccess } from '../utils/access';
import { showError, showSuccess } from '../utils/notify';

export default function FournisseursScreen() {
  const theme = useTheme();
  const { token, profile } = useApp();
  const access = useAccess();
  const borderColor = (theme as any).isDark ? '#1f2937' : '#e5e7eb';
  const superAdmin = isSuperAdmin(profile);

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Fournisseur[]>([]);
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Fournisseur | null>(null);

  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [contact, setContact] = useState('');
  const [ville, setVille] = useState('');
  const [boutiques, setBoutiques] = useState<BoutiqueDTO[]>([]);
  const [boutiqueId, setBoutiqueId] = useState<number | null>(null);
  const [boutiquePickerOpen, setBoutiquePickerOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((f) => {
      const s = `${f.nom || ''} ${f.prenom || ''} ${f.contact || ''} ${f.ville || ''} ${f.boutique?.nom || ''}`.toLowerCase();
      return s.includes(q);
    });
  }, [items, search]);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const list = await fetchFournisseurs(token);
      setItems(list);
      if (superAdmin) {
        const b = await listBoutiques(token).catch(() => []);
        setBoutiques(b);
      }
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
    if (!access.fournisseursCreate) {
      showError('Accès refusé', 'Permission manquante');
      return;
    }
    setEditing(null);
    setNom('');
    setPrenom('');
    setContact('');
    setVille('');
    setBoutiqueId(null);
    setModalOpen(true);
  };

  const openEdit = (f: Fournisseur) => {
    if (!access.fournisseursEdit) {
      showError('Accès refusé', 'Permission manquante');
      return;
    }
    setEditing(f);
    setNom(String(f.nom || ''));
    setPrenom(String(f.prenom || ''));
    setContact(String(f.contact || ''));
    setVille(String(f.ville || ''));
    setBoutiqueId(f.boutique?.id ?? null);
    setModalOpen(true);
  };

  const save = async () => {
    if (!token) return;
    if (!nom.trim() || !prenom.trim()) {
      showError('Erreur', 'Nom et prénom sont requis');
      return;
    }
    if (superAdmin && !boutiqueId) {
      showError('Erreur', 'Boutique requise');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        nom: nom.trim(),
        prenom: prenom.trim(),
        contact: contact.trim() || undefined,
        ville: ville.trim() || undefined,
        ...(superAdmin && boutiqueId ? { boutique: { id: boutiqueId } } : {}),
      };
      if (editing?.id) {
        await updateFournisseur(editing.id, payload, token);
        showSuccess('Succès', 'Fournisseur mis à jour');
      } else {
        await createFournisseur(payload, token);
        showSuccess('Succès', 'Fournisseur créé');
      }
      setModalOpen(false);
      await load();
    } catch (e: any) {
      showError('Erreur', e.message || 'Sauvegarde impossible');
    } finally {
      setSaving(false);
    }
  };

  const remove = (f: Fournisseur) => {
    if (!access.fournisseursDelete) {
      showError('Accès refusé', 'Permission manquante');
      return;
    }
    Alert.alert('Supprimer', `Supprimer le fournisseur "${f.prenom} ${f.nom}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          if (!token) return;
          try {
            await deleteFournisseur(f.id, token);
            showSuccess('Succès', 'Fournisseur supprimé');
            await load();
          } catch (e: any) {
            showError('Erreur', e.message || 'Suppression impossible');
          }
        },
      },
    ]);
  };

  if (!token) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.background }}>
        <Text style={{ color: theme.text }}>Connectez-vous pour continuer.</Text>
      </View>
    );
  }

  if (!access.fournisseurs) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: theme.background }}>
        <Text style={{ color: theme.text, textAlign: 'center' }}>Vous n'avez pas la permission d'accéder à cet écran.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <Text style={{ color: theme.text, fontSize: 20, fontWeight: '900' }}>Fournisseurs</Text>
          <Pressable
            onPress={openCreate}
            disabled={!access.fournisseursCreate}
            style={{ backgroundColor: access.fournisseursCreate ? theme.primary : theme.muted, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12 }}
          >
            <Text style={{ color: theme.text, fontWeight: '900' }}>Ajouter</Text>
          </Pressable>
        </View>

        <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor, marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, borderRadius: 12, paddingHorizontal: 10, borderWidth: 1, borderColor }}>
            <Ionicons name="search" size={18} color={theme.muted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Rechercher (nom, contact, ville)"
              placeholderTextColor={theme.muted}
              style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 10, color: theme.text }}
            />
          </View>
        </View>

        {loading ? (
          <ActivityIndicator />
        ) : filtered.length === 0 ? (
          <Text style={{ color: theme.muted }}>Aucun fournisseur.</Text>
        ) : (
          filtered.map((f) => (
            <View key={f.id} style={{ backgroundColor: theme.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor, marginBottom: 12 }}>
              <Text style={{ color: theme.text, fontWeight: '900' }}>{`${f.prenom || ''} ${f.nom || ''}`.trim() || '—'}</Text>
              <Text style={{ color: theme.muted, marginTop: 4 }}>{f.contact || '—'}{f.ville ? `  •  ${f.ville}` : ''}</Text>
              {superAdmin && f.boutique?.nom ? <Text style={{ color: theme.muted, marginTop: 2 }}>Boutique: {f.boutique.nom}</Text> : null}

              <View style={{ flexDirection: 'row', gap: 10 as any, marginTop: 12 }}>
                <Pressable
                  onPress={() => openEdit(f)}
                  disabled={!access.fournisseursEdit}
                  style={{ flex: 1, backgroundColor: access.fournisseursEdit ? theme.surface : theme.muted, borderWidth: 1, borderColor, paddingVertical: 10, borderRadius: 12, alignItems: 'center' }}
                >
                  <Text style={{ color: theme.text, fontWeight: '900' }}>Modifier</Text>
                </Pressable>
                <Pressable
                  onPress={() => remove(f)}
                  disabled={!access.fournisseursDelete}
                  style={{ flex: 1, backgroundColor: access.fournisseursDelete ? theme.danger : theme.muted, paddingVertical: 10, borderRadius: 12, alignItems: 'center' }}
                >
                  <Text style={{ color: '#fff', fontWeight: '900' }}>Supprimer</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={modalOpen} transparent animationType="fade" onRequestClose={() => setModalOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 16 }}>
          <View style={{ backgroundColor: theme.card, borderRadius: 18, padding: 14, borderWidth: 1, borderColor, maxHeight: '85%' as any }}>
            <ScrollView>
              <Text style={{ color: theme.text, fontWeight: '900', fontSize: 16 }}>{editing ? 'Modifier fournisseur' : 'Nouveau fournisseur'}</Text>

              <Text style={{ color: theme.muted, marginTop: 12, marginBottom: 6 }}>Nom *</Text>
              <TextInput value={nom} onChangeText={setNom} placeholder="Nom" placeholderTextColor={theme.muted} style={{ backgroundColor: theme.surface, borderRadius: 12, padding: 10, color: theme.text, borderWidth: 1, borderColor }} />

              <Text style={{ color: theme.muted, marginTop: 12, marginBottom: 6 }}>Prénom *</Text>
              <TextInput value={prenom} onChangeText={setPrenom} placeholder="Prénom" placeholderTextColor={theme.muted} style={{ backgroundColor: theme.surface, borderRadius: 12, padding: 10, color: theme.text, borderWidth: 1, borderColor }} />

              <Text style={{ color: theme.muted, marginTop: 12, marginBottom: 6 }}>Contact (téléphone)</Text>
              <TextInput value={contact} onChangeText={setContact} placeholder="Ex: 74745669" keyboardType="phone-pad" placeholderTextColor={theme.muted} style={{ backgroundColor: theme.surface, borderRadius: 12, padding: 10, color: theme.text, borderWidth: 1, borderColor }} />

              <Text style={{ color: theme.muted, marginTop: 12, marginBottom: 6 }}>Ville</Text>
              <TextInput value={ville} onChangeText={setVille} placeholder="Ville" placeholderTextColor={theme.muted} style={{ backgroundColor: theme.surface, borderRadius: 12, padding: 10, color: theme.text, borderWidth: 1, borderColor }} />

              {superAdmin ? (
                <>
                  <Text style={{ color: theme.muted, marginTop: 12, marginBottom: 6 }}>Boutique *</Text>
                  <Pressable
                    onPress={() => setBoutiquePickerOpen(true)}
                    style={{ backgroundColor: theme.surface, borderRadius: 12, padding: 10, borderWidth: 1, borderColor, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                  >
                    <Text style={{ color: theme.text }}>{boutiques.find((b) => b.id === boutiqueId)?.nom || 'Sélectionner…'}</Text>
                    <Ionicons name="chevron-down" size={18} color={theme.muted} />
                  </Pressable>
                </>
              ) : null}
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

      <Modal visible={boutiquePickerOpen} animationType="slide" onRequestClose={() => setBoutiquePickerOpen(false)}>
        <View style={{ flex: 1, backgroundColor: theme.background, padding: 16 }}>
          <Text style={{ color: theme.text, fontWeight: '900', fontSize: 16, marginBottom: 12 }}>Choisir une boutique</Text>
          <ScrollView>
            {boutiques.map((b) => (
              <Pressable
                key={b.id}
                onPress={() => {
                  setBoutiqueId(b.id);
                  setBoutiquePickerOpen(false);
                }}
                style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: borderColor }}
              >
                <Text style={{ color: theme.text, fontWeight: boutiqueId === b.id ? '900' : '400' }}>{b.nom || `Boutique #${b.id}`}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable onPress={() => setBoutiquePickerOpen(false)} style={{ marginTop: 12, backgroundColor: theme.surface, borderWidth: 1, borderColor, paddingVertical: 12, borderRadius: 12, alignItems: 'center' }}>
            <Text style={{ color: theme.text, fontWeight: '900' }}>Fermer</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}
