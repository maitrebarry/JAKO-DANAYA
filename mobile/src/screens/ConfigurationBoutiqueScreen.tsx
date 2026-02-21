import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../theme';
import { useApp } from '../store/AppContext';
import { BoutiqueDTO, createBoutique, listBoutiques, updateBoutique } from '../services/boutiques';
import { fetchAllPays, type PaysDTO } from '../services/pays';
import { isSuperAdmin } from '../utils/permissions';
import { resolveMediaUrl } from '../utils/urls';
import { showError, showSuccess } from '../utils/notify';

export default function ConfigurationBoutiqueScreen() {
  const theme = useTheme();
  const { token, boutiqueId, profile, setBoutiqueId } = useApp();
  const borderColor = (theme as any).isDark ? '#1f2937' : '#e5e7eb';

  const [loading, setLoading] = useState(true);
  const [boutiques, setBoutiques] = useState<BoutiqueDTO[]>([]);
  const [saving, setSaving] = useState(false);

  const selected = useMemo(() => {
    if (!boutiques.length) return null;
    const b = boutiqueId ? boutiques.find((x) => x.id === boutiqueId) : null;
    return b || boutiques[0];
  }, [boutiques, boutiqueId]);

  const [editing, setEditing] = useState(false);
  const [creatingNew, setCreatingNew] = useState(false);
  const [nom, setNom] = useState('');
  const [quartier, setQuartier] = useState('');
  const [adresse, setAdresse] = useState('');
  const [indicatif, setIndicatif] = useState('');
  const [codePays, setCodePays] = useState('');
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const [paysLoading, setPaysLoading] = useState(false);
  const [paysList, setPaysList] = useState<PaysDTO[]>([]);
  const [paysModalOpen, setPaysModalOpen] = useState(false);
  const [paysSearch, setPaysSearch] = useState('');

  const canEdit = isSuperAdmin(profile);

  const selectedPays = useMemo(() => {
    const code = String(codePays || '').trim().toUpperCase();
    if (!code) return null;
    return (paysList || []).find((p) => String(p.codeIso || '').toUpperCase() === code) || null;
  }, [codePays, paysList]);

  const filteredPays = useMemo(() => {
    const q = paysSearch.trim().toLowerCase();
    if (!q) return paysList;
    return (paysList || []).filter((p) => {
      const s = `${p.nom || ''} ${p.codeIso || ''} ${p.indicatif || ''}`.toLowerCase();
      return s.includes(q);
    });
  }, [paysList, paysSearch]);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const b = await listBoutiques(token);
      setBoutiques(b);
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

  useEffect(() => {
    let mounted = true;
    const loadPays = async () => {
      if (!token) return;
      setPaysLoading(true);
      try {
        const list = await fetchAllPays(token);
        if (!mounted) return;
        setPaysList(list || []);
      } catch {
        if (!mounted) return;
        setPaysList([]);
      } finally {
        if (mounted) setPaysLoading(false);
      }
    };
    loadPays();
    return () => {
      mounted = false;
    };
  }, [token]);

  useEffect(() => {
    if (!selected) return;
    // When switching boutique, exit creation mode
    setCreatingNew(false);
    setEditing(false);
    setNom(String(selected.nom || ''));
    setQuartier(String(selected.quartier || ''));
    setAdresse(String(selected.adresse || ''));
    setIndicatif(String(selected.indicatif || ''));
    setCodePays(String(selected.pays?.codeIso || ''));
    setLogoPreview(null);
  }, [selected?.id]);

  const openCreate = () => {
    if (!canEdit) {
      showError('Accès refusé', 'Superadmin requis');
      return;
    }
    setCreatingNew(true);
    setEditing(true);
    setNom('');
    setQuartier('');
    setAdresse('');
    setIndicatif('');
    setCodePays('');
    setLogoPreview(null);
  };

  const pickLogo = async () => {
    try {
      const res: any = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions?.Images || ImagePicker.MediaTypeOptions.Images, quality: 0.75 });
      const cancelled = res.cancelled ?? res.canceled ?? false;
      if (cancelled) return;
      const uri = res.uri || (res.assets && res.assets[0] && res.assets[0].uri);
      if (!uri) return;
      setLogoPreview(uri);
    } catch (e: any) {
      showError('Erreur', e.message || 'Sélection impossible');
    }
  };

  const save = async () => {
    if (!token) return;
    if (!selected && !creatingNew) return;
    if (!canEdit) {
      showError('Accès refusé', 'Superadmin requis');
      return;
    }
    if (!nom.trim() || !adresse.trim()) {
      showError('Erreur', 'Nom et adresse requis');
      return;
    }

    setSaving(true);
    try {
      let logoFile: any = undefined;
      if (logoPreview) {
        const name = logoPreview.split('/').pop() || 'logo.jpg';
        const ext = (name.split('.').pop() || 'jpg').toLowerCase();
        const type = `image/${ext}`;
        logoFile = { uri: logoPreview, name, type };
      }
      const payload = {
        nom: nom.trim(),
        quartier: quartier.trim(),
        adresse: adresse.trim(),
        indicatif: indicatif.trim() || null,
        codePays: codePays.trim() || null,
        logoFile,
      };

      if (creatingNew) {
        const created = await createBoutique(payload, token);
        showSuccess('Succès', 'Boutique créée');
        if (created?.id != null) {
          try {
            setBoutiqueId(Number(created.id));
          } catch {
            // ignore
          }
        }
      } else {
        await updateBoutique(selected!.id, payload, token);
        showSuccess('Succès', 'Boutique mise à jour');
      }
      setEditing(false);
      setCreatingNew(false);
      setLogoPreview(null);
      await load();
    } catch (e: any) {
      showError('Erreur', e.message || 'Sauvegarde impossible');
    } finally {
      setSaving(false);
    }
  };

  const logoUri = logoPreview || (selected?.logo ? resolveMediaUrl(selected.logo) : null);

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <Text style={{ color: theme.text, fontSize: 20, fontWeight: '900' }}>Boutique</Text>
          {canEdit ? (
            <View style={{ flexDirection: 'row', gap: 10 as any }}>
              <Pressable
                onPress={openCreate}
                style={{ backgroundColor: theme.primary, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12 }}
              >
                <Text style={{ color: theme.text, fontWeight: '900' }}>+ Ajouter</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setCreatingNew(false);
                  setEditing((v) => !v);
                }}
                style={{ backgroundColor: theme.surface, borderWidth: 1, borderColor, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12 }}
              >
                <Text style={{ color: theme.text, fontWeight: '900' }}>{editing ? 'Fermer' : 'Modifier'}</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        {loading ? (
          <ActivityIndicator />
        ) : !selected && !creatingNew ? (
          <Text style={{ color: theme.muted }}>Aucune boutique.</Text>
        ) : (
          <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor }}>
            {creatingNew ? (
              <View style={{ backgroundColor: theme.surface, borderRadius: 14, padding: 12, borderWidth: 1, borderColor, marginBottom: 12 }}>
                <Text style={{ color: theme.text, fontWeight: '900' }}>Création boutique</Text>
                <Text style={{ color: theme.muted, marginTop: 6 }}>Seul le SUPERADMIN peut ajouter une boutique.</Text>
              </View>
            ) : null}
            <View style={{ alignItems: 'center', marginBottom: 12 }}>
              {logoUri ? (
                <Image source={{ uri: logoUri }} style={{ width: 96, height: 96, borderRadius: 18, borderWidth: 1, borderColor }} />
              ) : (
                <View style={{ width: 96, height: 96, borderRadius: 18, backgroundColor: theme.surface, borderWidth: 1, borderColor }} />
              )}
              {editing && canEdit ? (
                <Pressable onPress={pickLogo} style={{ marginTop: 10, backgroundColor: theme.surface, borderWidth: 1, borderColor, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12 }}>
                  <Text style={{ color: theme.text, fontWeight: '900' }}>Changer logo</Text>
                </Pressable>
              ) : null}
            </View>

            <Text style={{ color: theme.muted, marginBottom: 6 }}>Nom</Text>
            <TextInput editable={editing && canEdit} value={nom} onChangeText={setNom} placeholder="Nom" placeholderTextColor={theme.muted} style={{ backgroundColor: editing ? theme.surface : theme.background, borderRadius: 12, padding: 10, color: theme.text, borderWidth: 1, borderColor }} />

            <Text style={{ color: theme.muted, marginTop: 12, marginBottom: 6 }}>Quartier</Text>
            <TextInput editable={editing && canEdit} value={quartier} onChangeText={setQuartier} placeholder="Quartier" placeholderTextColor={theme.muted} style={{ backgroundColor: editing ? theme.surface : theme.background, borderRadius: 12, padding: 10, color: theme.text, borderWidth: 1, borderColor }} />

            <Text style={{ color: theme.muted, marginTop: 12, marginBottom: 6 }}>Adresse *</Text>
            <TextInput editable={editing && canEdit} value={adresse} onChangeText={setAdresse} placeholder="Adresse" placeholderTextColor={theme.muted} style={{ backgroundColor: editing ? theme.surface : theme.background, borderRadius: 12, padding: 10, color: theme.text, borderWidth: 1, borderColor }} />

            <Text style={{ color: theme.muted, marginTop: 12, marginBottom: 6 }}>Indicatif</Text>
            <TextInput editable={editing && canEdit} value={indicatif} onChangeText={setIndicatif} placeholder="Ex: +223" placeholderTextColor={theme.muted} style={{ backgroundColor: editing ? theme.surface : theme.background, borderRadius: 12, padding: 10, color: theme.text, borderWidth: 1, borderColor }} />

            <Text style={{ color: theme.muted, marginTop: 12, marginBottom: 6 }}>Pays</Text>
            <Pressable
              onPress={() => {
                if (!editing || !canEdit) return;
                setPaysSearch('');
                setPaysModalOpen(true);
              }}
              style={{ backgroundColor: editing ? theme.surface : theme.background, borderRadius: 12, padding: 10, borderWidth: 1, borderColor }}
            >
              <Text style={{ color: theme.text, fontWeight: '900' }}>
                {selectedPays?.nom ? `${selectedPays.nom} (${selectedPays.codeIso})` : codePays ? codePays.toUpperCase() : 'Choisir un pays'}
              </Text>
              {paysLoading ? <Text style={{ color: theme.muted, marginTop: 4 }}>Chargement des pays…</Text> : null}
            </Pressable>
            {selectedPays?.indicatif ? <Text style={{ color: theme.muted, marginTop: 6 }}>Indicatif suggéré: {selectedPays.indicatif}</Text> : null}

            {editing && canEdit ? (
              <Pressable onPress={save} disabled={saving} style={{ marginTop: 14, backgroundColor: saving ? theme.muted : theme.primary, paddingVertical: 14, borderRadius: 14, alignItems: 'center' }}>
                <Text style={{ color: theme.text, fontWeight: '900' }}>{saving ? 'En cours…' : 'Enregistrer'}</Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </ScrollView>

      <Modal visible={paysModalOpen} transparent animationType="fade" onRequestClose={() => setPaysModalOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 16 }}>
          <View style={{ backgroundColor: theme.card, borderRadius: 18, padding: 14, borderWidth: 1, borderColor, maxHeight: '85%' as any }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: theme.text, fontWeight: '900', fontSize: 16 }}>Choisir un pays</Text>
              <Pressable onPress={() => setPaysModalOpen(false)} style={{ padding: 8 }}>
                <Text style={{ color: theme.text, fontWeight: '900' }}>Fermer</Text>
              </Pressable>
            </View>

            <TextInput
              value={paysSearch}
              onChangeText={setPaysSearch}
              placeholder="Rechercher (nom, code, indicatif)…"
              placeholderTextColor={theme.muted}
              style={{ marginTop: 12, backgroundColor: theme.surface, borderRadius: 12, padding: 10, color: theme.text, borderWidth: 1, borderColor }}
            />

            <ScrollView style={{ marginTop: 12 }}>
              {filteredPays.length === 0 ? (
                <Text style={{ color: theme.muted }}>Aucun pays.</Text>
              ) : (
                filteredPays.map((p) => (
                  <Pressable
                    key={String(p.codeIso)}
                    onPress={() => {
                      setCodePays(String(p.codeIso || '').toUpperCase());
                      if (p.indicatif) setIndicatif(String(p.indicatif));
                      setPaysModalOpen(false);
                    }}
                    style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: borderColor }}
                  >
                    <Text style={{ color: theme.text, fontWeight: '900' }}>{p.nom || p.codeIso}</Text>
                    <Text style={{ color: theme.muted, marginTop: 2 }}>{p.codeIso}{p.indicatif ? `  •  ${p.indicatif}` : ''}</Text>
                  </Pressable>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
