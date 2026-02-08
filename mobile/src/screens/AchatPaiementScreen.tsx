import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTheme } from '../theme';
import { useApp } from '../store/AppContext';
import { createPaiementCommandeFournisseur, fetchHistoriqueBoutique } from '../services/achat';
import { downloadAndSharePdf } from '../services/pdf';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AchatStackParamList } from '../navigation/achatTypes';

function digitsOnly(input: string) {
  return (input || '').replace(/\D+/g, '');
}

function formatThousandsFromDigits(digits: string) {
  const d = digitsOnly(digits);
  if (!d) return '';
  return d.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function buildReference() {
  const now = new Date();
  return `PAY-${now.toISOString().replace(/[:.]/g, '').slice(0, 15)}`;
}

export default function AchatPaiementScreen() {
  const theme = useTheme();
  const { token, boutiqueId } = useApp();
  const navigation = useNavigation<NativeStackNavigationProp<AchatStackParamList>>();
  const route = useRoute<RouteProp<AchatStackParamList, 'AchatPaiement'>>();

  const id = route.params?.id;
  const referenceCmd = route.params?.reference;

  const [montant, setMontant] = useState('');
  const [reference, setReference] = useState(buildReference());
  const [submitting, setSubmitting] = useState(false);

  const montantInt = useMemo(() => {
    const n = Number(digitsOnly(montant) || 0);
    return Number.isFinite(n) ? Math.trunc(n) : 0;
  }, [montant]);

  const submit = useCallback(async () => {
    if (!token) {
      Alert.alert('Connexion', 'Vous devez être connecté.');
      return;
    }
    if (!id) {
      Alert.alert('Erreur', 'Commande inconnue');
      return;
    }
    if (montantInt <= 0) {
      Alert.alert('Montant', 'Montant invalide');
      return;
    }

    setSubmitting(true);
    try {
      await createPaiementCommandeFournisseur(
        id,
        {
          montant: montantInt,
          reference: reference || undefined,
          date: new Date().toISOString(),
          timezoneOffsetMinutes: new Date().getTimezoneOffset(),
        },
        token
      );

      // Optional: propose payment PDF printing (requires paiementId)
      let paiementId = 0;
      if (boutiqueId) {
        try {
          const hist = await fetchHistoriqueBoutique(boutiqueId, token);
          const payments = (hist || []).filter(
            (it: any) => String(it?.type || '').toUpperCase() === 'PAIEMENT' && Number(it?.referenceCommandeId) === Number(id)
          );
          const byRef = payments.find((p: any) => String(p?.reference || '') === String(reference || ''));
          if (byRef?.id) paiementId = Number(byRef.id);
          if (!paiementId) {
            const last = payments
              .slice()
              .sort((a: any, b: any) => String(b?.dateIso || '').localeCompare(String(a?.dateIso || '')))[0];
            if (last?.id) paiementId = Number(last.id);
          }
        } catch {
          // ignore lookup errors
        }
      }

      if (paiementId) {
        Alert.alert('Succès', 'Paiement enregistré.', [
          {
            text: 'Imprimer PDF',
            onPress: async () => {
              try {
                await downloadAndSharePdf({
                  apiPath: `paiements/${paiementId}/pdf`,
                  token,
                  filename: `paiement-${referenceCmd || id}-${paiementId}.pdf`,
                });
              } catch (e: any) {
                Alert.alert('Erreur', e?.message || "Impossible d'ouvrir le PDF");
              }
            },
          },
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        Alert.alert('Succès', 'Paiement enregistré.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
      }
    } catch (e: any) {
      Alert.alert('Erreur', e?.message || 'Paiement impossible');
    } finally {
      setSubmitting(false);
    }
  }, [token, id, montantInt, reference, navigation, boutiqueId, referenceCmd]);

  if (!token) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background, padding: 16 }}>
        <Text style={{ color: theme.text, fontWeight: '900' }}>Authentification requise</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background, padding: 16 }}>
      <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: theme.isDark ? '#1f2937' : '#e5e7eb' }}>
        <Text style={{ color: theme.text, fontSize: 18, fontWeight: '900' }}>Paiement commande</Text>
        {!!referenceCmd && (
          <Text style={{ color: theme.muted, marginTop: 4 }} numberOfLines={1}>
            {referenceCmd}
          </Text>
        )}

        <Text style={{ color: theme.muted, marginTop: 12, marginBottom: 6 }}>Montant</Text>
        <TextInput
          value={formatThousandsFromDigits(montant)}
          onChangeText={setMontant}
          placeholder="0"
          placeholderTextColor={theme.muted}
          keyboardType="numeric"
          style={{ backgroundColor: theme.surface, color: theme.text, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: theme.isDark ? '#1f2937' : '#e5e7eb' }}
        />

        <Text style={{ color: theme.muted, marginTop: 12, marginBottom: 6 }}>Référence paiement (optionnel)</Text>
        <TextInput
          value={reference}
          onChangeText={setReference}
          placeholder="Référence"
          placeholderTextColor={theme.muted}
          style={{ backgroundColor: theme.surface, color: theme.text, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: theme.isDark ? '#1f2937' : '#e5e7eb' }}
        />

        <Pressable
          onPress={submit}
          disabled={submitting}
          style={{ marginTop: 14, backgroundColor: submitting ? theme.muted : theme.primary, paddingVertical: 12, borderRadius: 14, alignItems: 'center' }}
        >
          {submitting ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <ActivityIndicator color="white" />
              <Text style={{ color: 'white', fontWeight: '900', marginLeft: 10 }}>Enregistrement...</Text>
            </View>
          ) : (
            <Text style={{ color: 'white', fontWeight: '900' }}>Valider</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
