import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { useApp } from '../store/AppContext';
import {
  createUtilisationPerte,
  getUtilisationPerteByMouvement,
  updateUtilisationPerte,
  type UtilisationPertePayload,
} from '../services/utilisationPertes';
import { listBoutiqueStocks, listMagasins, listStocksForMagasin, type MagasinDTO, type StockDTO } from '../services/magasins';
import { showError, showSuccess } from '../utils/notify';

import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'UtilisationPertesForm'>;

function productNameFromStock(s: StockDTO): string {
  return String(s?.produit?.nomProduit || s?.produit?.nom || s?.produitId || s?.id || 'Produit');
}

const ProductPickerModal = React.memo(function ProductPickerModal({
  visible,
  onClose,
  stocks,
  onPick,
  theme,
}: {
  visible: boolean;
  onClose: () => void;
  stocks: StockDTO[];
  onPick: (s: StockDTO) => void;
  theme: ReturnType<typeof useTheme>;
}) {
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!visible) setQ('');
  }, [visible]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const base = Array.isArray(stocks) ? stocks : [];
    if (!query) return base.slice(0, 50);
    return base
      .filter((s) => productNameFromStock(s).toLowerCase().includes(query))
      .slice(0, 50);
  }, [q, stocks]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
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
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700' }}>Choisir un produit</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={22} color={theme.text} />
          </Pressable>
        </View>

        <View style={{ padding: 16 }}>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Rechercher un produit..."
            placeholderTextColor={theme.muted}
            style={{
              backgroundColor: theme.isDark ? '#0f1724' : '#f8fbff',
              color: theme.text,
              borderRadius: 14,
              paddingHorizontal: 12,
              paddingVertical: Platform.OS === 'android' ? 8 : 10,
              minHeight: 50,
              borderWidth: 1,
              borderColor: theme.isDark ? '#1f2937' : '#e5e7eb',
              fontWeight: '800',
            }}
            autoFocus
          />
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item?.id ?? Math.random())}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          renderItem={({ item }) => {
            const name = productNameFromStock(item);
            const available = Number(item?.quantiteDisponible) || 0;
            const lineBorder = theme.isDark ? '#1f2937' : '#dbeafe';
            const softPrimary = theme.isDark ? '#0b3b57' : '#d9f3ff';
            return (
              <Pressable
                onPress={() => onPick(item)}
                style={{
                  backgroundColor: theme.card,
                  borderRadius: 18,
                  padding: 14,
                  marginBottom: 12,
                  borderWidth: 1,
                  borderColor: lineBorder,
                  shadowColor: '#0f172a',
                  shadowOpacity: theme.isDark ? 0 : 0.08,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 4 },
                  elevation: 2,
                }}
              >
                <Text style={{ color: theme.text, fontWeight: '900', fontSize: 16 }} numberOfLines={1}>
                  {name}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  <View style={{ backgroundColor: softPrimary, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
                    <Text style={{ color: theme.isDark ? '#bae6fd' : '#0369a1', fontWeight: '800', fontSize: 12 }}>
                      Stock actuel: {available}
                    </Text>
                  </View>
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={{ paddingHorizontal: 16 }}>
              <Text style={{ color: theme.muted }}>Aucun produit trouvé.</Text>
            </View>
          }
        />
      </SafeAreaView>
    </Modal>
  );
});

const MagasinPickerModal = React.memo(function MagasinPickerModal({
  visible,
  onClose,
  magasins,
  onPick,
  theme,
}: {
  visible: boolean;
  onClose: () => void;
  magasins: MagasinDTO[];
  onPick: (m: MagasinDTO | null) => void;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
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
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700' }}>Choisir un magasin</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={22} color={theme.text} />
          </Pressable>
        </View>

        <FlatList
          data={[{ id: 0, nom: 'Boutique (stock global)' } as any, ...(magasins || [])]}
          keyExtractor={(item) => String(item?.id ?? Math.random())}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 }}
          renderItem={({ item }) => {
            const isBoutique = Number(item.id) === 0;
            const label = isBoutique ? 'Boutique (stock global)' : String(item.nom || item.nomMagasin || `Magasin #${item.id}`);
            return (
              <Pressable
                onPress={() => onPick(isBoutique ? null : item)}
                style={{
                  backgroundColor: theme.card,
                  borderRadius: 14,
                  padding: 12,
                  marginBottom: 10,
                  borderWidth: 1,
                  borderColor: theme.isDark ? '#1f2937' : '#e5e7eb',
                }}
              >
                <Text style={{ color: theme.text, fontWeight: '800' }}>{label}</Text>
              </Pressable>
            );
          }}
        />
      </SafeAreaView>
    </Modal>
  );
});

export default function UtilisationPertesFormScreen({ route, navigation }: Props) {
  const theme = useTheme();
  const { token } = useApp();

  const mode = route.params?.mode;
  const mouvementId = route.params?.mouvementId;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [magasins, setMagasins] = useState<MagasinDTO[]>([]);
  const [selectedMagasin, setSelectedMagasin] = useState<MagasinDTO | null>(null);
  const [stocks, setStocks] = useState<StockDTO[]>([]);
  const [selectedStock, setSelectedStock] = useState<StockDTO | null>(null);

  const [type, setType] = useState<'UTILISATION' | 'PERTE'>('UTILISATION');
  const [quantiteStr, setQuantiteStr] = useState('');
  const [motif, setMotif] = useState('');

  const [showMagasinPicker, setShowMagasinPicker] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);

  const [editingUpId, setEditingUpId] = useState<number | null>(null);

  const title = mode === 'edit' ? 'Modifier utilisation/perte' : 'Nouvelle utilisation/perte';

  // Prevent the initial "prefill magasin" (edit mode) from triggering the magasin-change effect
  // that would otherwise clear stock/quantity.
  const hasAppliedInitialMagasinRef = useRef(false);
  const initialMagasinIdRef = useRef<number | null>(null);

  const loadMagasins = useCallback(async () => {
    if (!token) return;
    const mags = await listMagasins(token);
    setMagasins(mags || []);
  }, [token]);

  const loadStocks = useCallback(
    async (magasin: MagasinDTO | null) => {
      if (!token) return;
      if (magasin?.id) {
        const st = await listStocksForMagasin(magasin.id, token);
        setStocks(st || []);
        return st || [];
      } else {
        const st = await listBoutiqueStocks(token);
        setStocks(st || []);
        return st || [];
      }
    },
    [token]
  );

  const loadEditing = useCallback(async () => {
    if (!token) return;
    if (mode !== 'edit' || !mouvementId) return;

    const up = await getUtilisationPerteByMouvement(mouvementId, token);
    if (!up) throw new Error('Utilisation/perte introuvable');

    setEditingUpId(Number(up.id));
    setType((String(up.type || 'UTILISATION').toUpperCase() as any) === 'PERTE' ? 'PERTE' : 'UTILISATION');
    setQuantiteStr(up.quantite != null ? String(up.quantite) : '');
    setMotif(String(up.motif || ''));

    // preselect magasin and stock
    const mag = up.magasin?.id ? { id: Number(up.magasin.id), nom: up.magasin.nom } : null;
    setSelectedMagasin(mag);
    initialMagasinIdRef.current = mag?.id ?? null;
    const st = (await loadStocks(mag)) || [];

    // mark that the initial magasin has been applied (so we don't clear prefilled fields)
    hasAppliedInitialMagasinRef.current = true;

    const produitId = up.produit?.id ? Number(up.produit.id) : null;
    if (produitId) {
      const found = (st || []).find((s) => Number(s?.produit?.id || s?.produitId) === produitId);
      if (found) setSelectedStock(found);
    }
  }, [token, mode, mouvementId, loadStocks]);

  const bootstrap = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      await loadMagasins();
      if (mode === 'edit') {
        await loadEditing();
      } else {
        await loadStocks(null);
        hasAppliedInitialMagasinRef.current = true;
        initialMagasinIdRef.current = null;
      }
    } catch (e: any) {
      showError('Erreur', e?.message || 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }, [token, mode, loadMagasins, loadEditing, loadStocks]);

  useFocusEffect(
    useCallback(() => {
      bootstrap();
    }, [bootstrap])
  );

  // when magasin changes, reload stocks and clear selection
  useEffect(() => {
    if (!token) return;
    if (loading) return;

    // In edit mode, the first magasin assignment is done by prefill; do not wipe prefilled values.
    if (mode === 'edit' && !hasAppliedInitialMagasinRef.current) {
      return;
    }

    loadStocks(selectedMagasin)
      .then(() => {
        const currentId = selectedMagasin?.id ?? null;
        const initialId = initialMagasinIdRef.current;

        // Clear when creating OR when the user changed magasin compared to the initial edit value.
        const shouldClear = mode !== 'edit' || (initialId !== currentId);
        if (shouldClear) {
          setSelectedStock(null);
          setQuantiteStr('');
        }
      })
      .catch((e: any) => showError('Erreur', e?.message || 'Stocks indisponibles'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMagasin?.id]);

  const canSubmit = useMemo(() => {
    const q = Number(String(quantiteStr || '').replace(/[^0-9]/g, '')) || 0;
    const available = selectedStock?.quantiteDisponible != null ? Number(selectedStock.quantiteDisponible) : null;
    if (!selectedStock) return false;
    if (!q || q <= 0) return false;
    if (available != null && q > available) return false;
    return true;
  }, [selectedStock, quantiteStr]);

  const submit = useCallback(async () => {
    if (!token) return;
    if (!selectedStock) return;

    const q = Number(String(quantiteStr || '').replace(/[^0-9]/g, '')) || 0;
    const available = selectedStock?.quantiteDisponible != null ? Number(selectedStock.quantiteDisponible) : null;
    if (!q || q <= 0) {
      showError('Erreur', 'Quantité invalide');
      return;
    }
    if (available != null && q > available) {
      showError('Erreur', `Quantité disponible insuffisante (${available})`);
      return;
    }

    const produitId = Number(selectedStock?.produit?.id || selectedStock?.produitId);
    if (!produitId) {
      showError('Erreur', 'Produit invalide');
      return;
    }

    const payload: UtilisationPertePayload = {
      motif: motif.trim() || null,
      quantite: q,
      date: null,
      type,
      produit: { id: produitId },
      magasin: selectedMagasin?.id ? { id: selectedMagasin.id } : null,
    };

    setSaving(true);
    try {
      if (mode === 'edit') {
        if (!editingUpId) throw new Error('ID modification manquant');
        await updateUtilisationPerte(editingUpId, payload, token);
        showSuccess('Succès', 'Utilisation/perte modifiée');
      } else {
        await createUtilisationPerte(payload, token);
        showSuccess('Succès', 'Utilisation/perte enregistrée');
      }
      navigation.goBack();
    } catch (e: any) {
      showError('Erreur', e?.message || 'Échec enregistrement');
    } finally {
      setSaving(false);
    }
  }, [token, selectedStock, quantiteStr, motif, type, selectedMagasin, mode, editingUpId, navigation]);

  if (!token) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
        <Text style={{ color: theme.text }}>Non authentifié</Text>
      </View>
    );
  }

  const borderColor = theme.isDark ? '#1f2937' : '#dbeafe';
  const mutedBorder = theme.isDark ? '#1f2937' : '#e5e7eb';
  const inputBackground = theme.isDark ? '#0f1724' : '#f8fbff';
  const softPrimary = theme.isDark ? '#0b3b57' : '#d9f3ff';
  const fieldStyle = {
    backgroundColor: inputBackground,
    color: theme.text,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'android' ? 8 : 10,
    minHeight: 50,
    borderWidth: 1,
    borderColor: mutedBorder,
    fontWeight: '800' as const,
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
        >
          <Text style={{ color: theme.text, fontSize: 20, fontWeight: '900' }}>{title}</Text>

          {loading ? (
            <View style={{ paddingVertical: 16 }}>
              <ActivityIndicator />
            </View>
          ) : null}

          {!loading ? (
            <View>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <Pressable
              onPress={() => setType('UTILISATION')}
              style={{
                flex: 1,
                minHeight: 48,
                backgroundColor: type === 'UTILISATION' ? '#2563eb' : inputBackground,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: type === 'UTILISATION' ? '#2563eb' : mutedBorder,
              }}
            >
              <Text style={{ color: type === 'UTILISATION' ? '#fff' : theme.text, fontWeight: '900' }}>Utilisation</Text>
            </Pressable>
            <Pressable
              onPress={() => setType('PERTE')}
              style={{
                flex: 1,
                minHeight: 48,
                backgroundColor: type === 'PERTE' ? '#dc2626' : inputBackground,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: type === 'PERTE' ? '#dc2626' : mutedBorder,
              }}
            >
              <Text style={{ color: type === 'PERTE' ? '#fff' : theme.text, fontWeight: '900' }}>Perte</Text>
            </Pressable>
          </View>

          <View style={{ backgroundColor: theme.card, borderRadius: 18, padding: 14, marginTop: 12, borderWidth: 1, borderColor, shadowColor: '#0f172a', shadowOpacity: theme.isDark ? 0 : 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 }}>
          <Pressable
            onPress={() => setShowMagasinPicker(true)}
            style={{
              backgroundColor: inputBackground,
              paddingVertical: 12,
              paddingHorizontal: 12,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: mutedBorder,
            }}
          >
            <Text style={{ color: theme.muted, fontSize: 12 }}>Magasin</Text>
            <Text style={{ color: theme.text, fontWeight: '900', marginTop: 2 }}>
              {selectedMagasin?.nom || selectedMagasin?.nomMagasin || 'Boutique (stock global)'}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setShowProductPicker(true)}
            style={{
              marginTop: 12,
              backgroundColor: inputBackground,
              paddingVertical: 12,
              paddingHorizontal: 12,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: mutedBorder,
            }}
          >
            <Text style={{ color: theme.muted, fontSize: 12 }}>Produit</Text>
            <Text style={{ color: theme.text, fontWeight: '900', marginTop: 2 }} numberOfLines={1}>
              {selectedStock ? productNameFromStock(selectedStock) : 'Choisir un produit'}
            </Text>
          </Pressable>

          <View style={{ marginTop: 12 }}>
            <Text style={{ color: theme.muted, marginBottom: 6 }}>Quantité</Text>
            <TextInput
              value={quantiteStr}
              onChangeText={setQuantiteStr}
              placeholder="0"
              placeholderTextColor={theme.muted}
              keyboardType="numeric"
              style={fieldStyle}
            />
            {selectedStock?.quantiteDisponible != null ? (
              <View style={{ alignSelf: 'flex-start', marginTop: 8, backgroundColor: softPrimary, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
                <Text style={{ color: theme.isDark ? '#bae6fd' : '#0369a1', fontWeight: '800', fontSize: 12 }}>Disponible: {String(selectedStock.quantiteDisponible)}</Text>
              </View>
            ) : null}
          </View>

          <View style={{ marginTop: 12 }}>
            <Text style={{ color: theme.muted, marginBottom: 6 }}>Motif / Description (optionnel)</Text>
            <TextInput
              value={motif}
              onChangeText={setMotif}
              placeholder="Ex: casse, don, utilisation interne..."
              placeholderTextColor={theme.muted}
              multiline
              style={{
                backgroundColor: inputBackground,
                color: theme.text,
                borderRadius: 14,
                paddingHorizontal: 12,
                paddingVertical: 10,
                minHeight: 90,
                borderWidth: 1,
                borderColor: mutedBorder,
                textAlignVertical: 'top',
              }}
            />
          </View>
          </View>

          <Pressable
            onPress={() => {
              if (!canSubmit || saving) return;
              Alert.alert('Confirmer', mode === 'edit' ? 'Modifier cette opération ?' : 'Enregistrer cette opération ?', [
                { text: 'Annuler', style: 'cancel' },
                { text: 'OK', onPress: submit },
              ]);
            }}
            style={{
              marginTop: 16,
              backgroundColor: canSubmit ? theme.primary : theme.isDark ? '#374151' : '#d1d5db',
              paddingVertical: 12,
              borderRadius: 12,
              alignItems: 'center',
            }}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '900' }}>Enregistrer</Text>}
          </Pressable>

          <MagasinPickerModal
            visible={showMagasinPicker}
            onClose={() => setShowMagasinPicker(false)}
            magasins={magasins}
            onPick={(m) => {
              setShowMagasinPicker(false);
              setSelectedMagasin(m);
            }}
            theme={theme}
          />

          <ProductPickerModal
            visible={showProductPicker}
            onClose={() => setShowProductPicker(false)}
            stocks={stocks}
            onPick={(s) => {
              setSelectedStock(s);
              setShowProductPicker(false);
            }}
            theme={theme}
          />
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
