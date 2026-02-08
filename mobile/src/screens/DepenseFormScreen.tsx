import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, SafeAreaView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../theme';
import { useApp } from '../store/AppContext';
import { listCaisses, type CaisseDTO } from '../services/caisse';
import { createDepense, DepensePayload, getDepense, updateDepense } from '../services/depenses';
import { showError, showSuccess } from '../utils/notify';

import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'DepenseForm'>;

function parseIntFromDigits(s: string): number {
  const digits = String(s || '').replace(/[^0-9]/g, '');
  if (!digits) return 0;
  return Number.parseInt(digits, 10) || 0;
}

export default function DepenseFormScreen({ route, navigation }: Props) {
  const theme = useTheme();
  const { token, boutiqueId } = useApp();

  const mode = route.params?.mode;
  const depenseId = route.params?.id;

  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);

  const [reference, setReference] = useState('');
  const [libelle, setLibelle] = useState('');
  const [note, setNote] = useState('');
  const [montantStr, setMontantStr] = useState('');
  const [referenceCaisse, setReferenceCaisse] = useState<string>('');

  const [showCaissePicker, setShowCaissePicker] = useState(false);
  const [caisses, setCaisses] = useState<CaisseDTO[]>([]);

  const title = useMemo(() => (mode === 'edit' ? 'Modifier dépense' : 'Nouvelle dépense'), [mode]);

  const load = useCallback(async () => {
    if (!token || mode !== 'edit' || !depenseId) return;
    setLoading(true);
    try {
      const d = await getDepense(depenseId, token);
      setReference(String(d?.reference || ''));
      setLibelle(String(d?.libelle || ''));
      setNote(String(d?.note || ''));
      setMontantStr(d?.montant != null ? String(d.montant) : '');
      setReferenceCaisse(String(d?.referenceCaisse || ''));
    } catch (e: any) {
      showError('Erreur', e?.message || 'Impossible de charger la dépense');
    } finally {
      setLoading(false);
    }
  }, [token, mode, depenseId]);

  React.useEffect(() => {
    load();
  }, [load]);

  const loadCaisses = useCallback(async () => {
    if (!token) return;
    try {
      const all = await listCaisses(token);
      const open = (all || [])
        .filter((c) => {
          const st = String(c?.statut || '').toUpperCase();
          return st.includes('OUVERTE') || st.includes('OPEN') || st.includes('ACT');
        })
        .filter((c) => {
          if (!boutiqueId) return true;
          const bid = Number(boutiqueId);
          const cbid = c?.boutique?.id != null ? Number(c.boutique.id) : null;
          return cbid == null || cbid === bid;
        });
      setCaisses(open);
    } catch (e: any) {
      // Keep caisse optional: do not block form if user cannot list caisses.
      setCaisses([]);
    }
  }, [token, boutiqueId]);

  const submit = useCallback(async () => {
    if (!token) return;
    const montant = parseIntFromDigits(montantStr);
    if (!montant || montant <= 0) {
      showError('Erreur', 'Montant invalide');
      return;
    }

    const payload: DepensePayload = {
      reference: reference.trim() || null,
      libelle: libelle.trim() || null,
      note: note.trim() || null,
      montant,
      date: null,
      referenceCaisse: referenceCaisse.trim() ? referenceCaisse.trim() : null,
    };

    setSaving(true);
    try {
      if (mode === 'edit' && depenseId) {
        await updateDepense(depenseId, payload, token);
        showSuccess('Succès', 'Dépense modifiée');
      } else {
        await createDepense(payload, token);
        showSuccess('Succès', 'Dépense créée');
      }
      navigation.goBack();
    } catch (e: any) {
      showError('Erreur', e?.message || 'Échec enregistrement');
    } finally {
      setSaving(false);
    }
  }, [token, reference, libelle, note, montantStr, mode, depenseId, navigation]);

  if (!token) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
        <Text style={{ color: theme.text }}>Non authentifié</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background, padding: 16 }}>
      <Text style={{ color: theme.text, fontSize: 18, fontWeight: '900' }}>{title}</Text>

      <Modal visible={showCaissePicker} animationType="slide" onRequestClose={() => setShowCaissePicker(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
          <View
            style={{
              paddingHorizontal: 16,
              paddingVertical: 12,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottomWidth: 1,
              borderBottomColor: theme.isDark ? '#1f2937' : '#e5e7eb',
            }}
          >
            <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700' }}>Choisir une caisse</Text>
            <Pressable onPress={() => setShowCaissePicker(false)} hitSlop={12}>
              <Ionicons name="close" size={22} color={theme.text} />
            </Pressable>
          </View>

          <FlatList
            data={caisses}
            keyExtractor={(it) => String(it.id)}
            contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
            ListEmptyComponent={<Text style={{ color: theme.muted, textAlign: 'center' }}>Aucune caisse ouverte</Text>}
            renderItem={({ item }) => {
              const ref = String(item.reference || '').trim();
              const selected = !!ref && ref === referenceCaisse;
              return (
                <Pressable
                  onPress={() => {
                    setReferenceCaisse(ref);
                    setShowCaissePicker(false);
                  }}
                  style={{
                    backgroundColor: theme.card,
                    padding: 12,
                    borderRadius: 14,
                    marginBottom: 10,
                    borderWidth: 2,
                    borderColor: selected ? theme.primary : theme.isDark ? '#1f2937' : '#e5e7eb',
                  }}
                >
                  <Text style={{ color: theme.text, fontWeight: '900' }}>{ref || `Caisse #${item.id}`}</Text>
                  <Text style={{ color: theme.muted, marginTop: 4 }}>Solde: {item.montantTotal ?? '—'}</Text>
                </Pressable>
              );
            }}
          />
        </SafeAreaView>
      </Modal>

      {loading ? (
        <View style={{ marginTop: 16 }}>
          <ActivityIndicator />
        </View>
      ) : (
        <>
          <View style={{ marginTop: 12 }}>
            <Text style={{ color: theme.muted, marginBottom: 6 }}>Référence (optionnel)</Text>
            <TextInput
              value={reference}
              onChangeText={setReference}
              placeholder="DEP-... (laisser vide = auto)"
              placeholderTextColor={theme.muted}
              style={{
                backgroundColor: theme.surface,
                color: theme.text,
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderWidth: 1,
                borderColor: theme.isDark ? '#1f2937' : '#e5e7eb',
              }}
            />
          </View>

          <View style={{ marginTop: 12 }}>
            <Text style={{ color: theme.muted, marginBottom: 6 }}>Libellé</Text>
            <TextInput
              value={libelle}
              onChangeText={setLibelle}
              placeholder="Ex: Transport, Ravitaillement..."
              placeholderTextColor={theme.muted}
              style={{
                backgroundColor: theme.surface,
                color: theme.text,
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderWidth: 1,
                borderColor: theme.isDark ? '#1f2937' : '#e5e7eb',
              }}
            />
          </View>

          <View style={{ marginTop: 12 }}>
            <Text style={{ color: theme.muted, marginBottom: 6 }}>Montant</Text>
            <TextInput
              value={montantStr}
              onChangeText={setMontantStr}
              placeholder="0"
              placeholderTextColor={theme.muted}
              keyboardType="numeric"
              style={{
                backgroundColor: theme.surface,
                color: theme.text,
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderWidth: 1,
                borderColor: theme.isDark ? '#1f2937' : '#e5e7eb',
              }}
            />
          </View>

          <View style={{ marginTop: 12 }}>
            <Text style={{ color: theme.muted, marginBottom: 6 }}>Référence caisse (optionnel)</Text>
            <Pressable
              onPress={async () => {
                await loadCaisses();
                setShowCaissePicker(true);
              }}
              style={{
                backgroundColor: theme.surface,
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 12,
                borderWidth: 1,
                borderColor: theme.isDark ? '#1f2937' : '#e5e7eb',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Text style={{ color: theme.text, fontWeight: '800' }}>{referenceCaisse || '—'}</Text>
              <Ionicons name="chevron-down" size={18} color={theme.muted} />
            </Pressable>
            {!!referenceCaisse ? (
              <Pressable onPress={() => setReferenceCaisse('')} style={{ marginTop: 8 }}>
                <Text style={{ color: theme.danger, fontWeight: '900' }}>Retirer la caisse</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={{ marginTop: 12 }}>
            <Text style={{ color: theme.muted, marginBottom: 6 }}>Note (optionnel)</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Détails / justification"
              placeholderTextColor={theme.muted}
              multiline
              style={{
                backgroundColor: theme.surface,
                color: theme.text,
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 10,
                minHeight: 100,
                borderWidth: 1,
                borderColor: theme.isDark ? '#1f2937' : '#e5e7eb',
                textAlignVertical: 'top',
              }}
            />
          </View>

          <Pressable
            onPress={() => {
              if (saving) return;
              Alert.alert('Confirmer', mode === 'edit' ? 'Modifier cette dépense ?' : 'Créer cette dépense ?', [
                { text: 'Annuler', style: 'cancel' },
                { text: 'OK', onPress: submit },
              ]);
            }}
            style={{
              marginTop: 16,
              backgroundColor: theme.primary,
              paddingVertical: 12,
              borderRadius: 12,
              alignItems: 'center',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '900' }}>Enregistrer</Text>}
          </Pressable>
        </>
      )}
    </View>
  );
}
