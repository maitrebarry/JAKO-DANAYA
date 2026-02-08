import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../theme';
import { useApp } from '../store/AppContext';
import { listCaisses, type CaisseDTO } from '../services/caisse';
import { getDepense, validateDepense } from '../services/depenses';
import { showError, showSuccess } from '../utils/notify';

import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'DepenseValidate'>;

export default function DepenseValidationScreen({ route, navigation }: Props) {
  const theme = useTheme();
  const { token, boutiqueId } = useApp();
  const depenseId = route.params?.id;

  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [caisses, setCaisses] = useState<CaisseDTO[]>([]);
  const [selectedRef, setSelectedRef] = useState<string>('');
  const [depense, setDepense] = useState<any>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [d, all] = await Promise.all([getDepense(depenseId, token), listCaisses(token)]);
      setDepense(d);
      const open = (all || [])
        .filter((c) => String(c?.statut || '').toUpperCase().includes('OUVERTE') || String(c?.statut || '').toUpperCase().includes('OPEN') || String(c?.statut || '').toUpperCase().includes('ACT'))
        .filter((c) => {
          if (!boutiqueId) return true;
          const bid = Number(boutiqueId);
          const cbid = c?.boutique?.id != null ? Number(c.boutique.id) : null;
          return cbid == null || cbid === bid;
        });
      setCaisses(open);
      // preselect if depense has referenceCaisse
      const pref = String(d?.referenceCaisse || '').trim();
      if (pref) setSelectedRef(pref);
    } catch (e: any) {
      showError('Erreur', e?.message || 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }, [token, depenseId, boutiqueId]);

  useEffect(() => {
    load();
  }, [load]);

  const canValidate = useMemo(() => !!selectedRef && !validating, [selectedRef, validating]);

  const submit = useCallback(async () => {
    if (!token || !selectedRef) return;
    setValidating(true);
    try {
      await validateDepense(depenseId, { referenceCaisse: selectedRef }, token);
      showSuccess('Succès', 'Dépense validée');
      navigation.goBack();
    } catch (e: any) {
      showError('Erreur', e?.message || 'Validation échouée');
    } finally {
      setValidating(false);
    }
  }, [token, selectedRef, depenseId, navigation]);

  if (!token) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
        <Text style={{ color: theme.text }}>Non authentifié</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ padding: 16 }}>
        <Text style={{ color: theme.text, fontSize: 18, fontWeight: '900' }}>Valider dépense</Text>
        <Text style={{ color: theme.muted, marginTop: 6 }}>
          Sélectionnez une caisse ouverte pour débiter la dépense.
        </Text>
        {depense ? (
          <Text style={{ color: theme.muted, marginTop: 6 }}>
            Dépense: {depense?.reference || `#${depenseId}`} • Montant: {depense?.montant ?? '—'}
          </Text>
        ) : null}
      </View>

      {loading ? (
        <View style={{ padding: 16 }}>
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
          data={caisses}
          keyExtractor={(it) => String(it.id)}
          ListEmptyComponent={<Text style={{ color: theme.muted, textAlign: 'center' }}>Aucune caisse ouverte</Text>}
          renderItem={({ item }) => {
            const ref = String(item.reference || '').trim();
            const selected = !!ref && ref === selectedRef;
            return (
              <Pressable
                onPress={() => setSelectedRef(ref)}
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
                <Text style={{ color: theme.muted, marginTop: 4 }}>
                  Solde: {item.montantTotal ?? '—'}
                </Text>
              </Pressable>
            );
          }}
        />
      )}

      <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: theme.isDark ? '#1f2937' : '#e5e7eb' }}>
        <Pressable
          onPress={() => {
            if (!canValidate) return;
            Alert.alert('Confirmer', `Valider la dépense avec la caisse ${selectedRef} ?`, [
              { text: 'Annuler', style: 'cancel' },
              { text: 'Valider', onPress: submit },
            ]);
          }}
          style={{
            backgroundColor: canValidate ? '#16a34a' : theme.isDark ? '#374151' : '#d1d5db',
            paddingVertical: 12,
            borderRadius: 12,
            alignItems: 'center',
          }}
        >
          {validating ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '900' }}>Valider</Text>}
        </Pressable>
      </View>
    </View>
  );
}
