import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTheme } from '../theme';
import { useApp } from '../store/AppContext';
import {
  createPaiementCommandeFournisseur,
  fetchCommandeFournisseurById,
} from '../services/achat';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AchatStackParamList } from '../navigation/achatTypes';
import { showError, showSuccess } from '../utils/notify';
import { hasPermission, isSuperAdmin } from '../utils/permissions';

function digitsOnly(input: string) {
  return (input || '').replace(/\D+/g, '');
}

function formatThousandsFromDigits(digits: string) {
  const d = digitsOnly(digits);
  if (!d) return '';
  return d.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function formatThousands(n: number) {
  const s = String(Math.trunc(Number(n) || 0));
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function buildReference() {
  const now = new Date();
  return `PAY-${now.toISOString().replace(/[:.]/g, '').slice(0, 15)}`;
}

export default function AchatPaiementScreen() {
  const theme = useTheme();
  const { token, profile } = useApp();
  const navigation = useNavigation<NativeStackNavigationProp<AchatStackParamList>>();
  const route = useRoute<RouteProp<AchatStackParamList, 'AchatPaiement'>>();

  const canPay = useMemo(() => {
    if (!profile) return false;
    return isSuperAdmin(profile) || hasPermission(profile, 'PAIEMENT_CREER');
  }, [profile]);

  const id = route.params?.id;
  const referenceCmd = route.params?.reference;
  const routeTotal = route.params?.total;
  const routeMontantPaye = route.params?.montantPaye;

  const [montant, setMontant] = useState('');
  const [reference, setReference] = useState(buildReference());
  const [submitting, setSubmitting] = useState(false);
  const [loadingCmd, setLoadingCmd] = useState(false);

  const [cmdTotal, setCmdTotal] = useState<number | null>(
    typeof routeTotal === 'number' ? routeTotal : routeTotal != null ? Number(routeTotal) : null
  );
  const [cmdMontantPaye, setCmdMontantPaye] = useState<number | null>(
    typeof routeMontantPaye === 'number' ? routeMontantPaye : routeMontantPaye != null ? Number(routeMontantPaye) : null
  );

  const remainingToPay = useMemo(() => {
    const total = Number(cmdTotal || 0);
    const paid = Number(cmdMontantPaye || 0);
    const remaining = Math.max(0, Math.trunc(total - paid));
    return Number.isFinite(remaining) ? remaining : 0;
  }, [cmdTotal, cmdMontantPaye]);

  const montantInt = useMemo(() => {
    const n = Number(digitsOnly(montant) || 0);
    return Number.isFinite(n) ? Math.trunc(n) : 0;
  }, [montant]);

  useEffect(() => {
    if (!token || !id) return;
    let cancelled = false;
    (async () => {
      setLoadingCmd(true);
      try {
        const cmd = await fetchCommandeFournisseurById(id, token);
        if (cancelled) return;
        setCmdTotal(Number((cmd as any)?.total) || 0);
        setCmdMontantPaye(Number((cmd as any)?.montantPaye) || 0);

        // Prefill montant with remaining-to-pay if empty
        setMontant((prev) => {
          if (digitsOnly(prev)) return prev;
          const remaining = Math.max(0, Math.trunc((Number((cmd as any)?.total) || 0) - (Number((cmd as any)?.montantPaye) || 0)));
          return remaining > 0 ? String(remaining) : '';
        });
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoadingCmd(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, token]);

  const submit = useCallback(async () => {
    if (!token) {
      showError('Connexion', 'Vous devez être connecté.');
      return;
    }
    if (!canPay) {
      showError('Permission', "Vous n'avez pas la permission d'enregistrer un paiement.");
      return;
    }
    if (!id) {
      showError('Erreur', 'Commande inconnue');
      return;
    }
    if (montantInt <= 0) {
      showError('Montant', 'Montant invalide');
      return;
    }

    // If we know remaining-to-pay, forbid exceeding it (backend rejects anyway).
    if (cmdTotal != null && cmdMontantPaye != null && montantInt > remainingToPay) {
      showError('Montant', `Le montant dépasse le reste à payer (${formatThousands(remainingToPay)}).`);
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

      showSuccess('Paiement enregistré', `Montant: ${formatThousands(montantInt)} • Reste: ${formatThousands(Math.max(0, remainingToPay - montantInt))}`);
      navigation.goBack();
    } catch (e: any) {
      showError('Erreur', e?.message || 'Paiement impossible');
    } finally {
      setSubmitting(false);
    }
  }, [token, canPay, id, montantInt, reference, navigation, referenceCmd, remainingToPay]);

  if (!token) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background, padding: 16 }}>
        <Text style={{ color: theme.text, fontWeight: '900' }}>Authentification requise</Text>
      </View>
    );
  }

  if (token && !canPay) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background, padding: 16 }}>
        <Text style={{ color: theme.text, fontWeight: '900' }}>Permission requise</Text>
        <Text style={{ marginTop: 8, color: theme.muted, textAlign: 'center' }}>
          Vous n'avez pas la permission d'enregistrer un paiement.
        </Text>
        <Pressable
          onPress={() => navigation.goBack()}
          style={{ marginTop: 12, backgroundColor: theme.surface, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, borderColor: theme.isDark ? '#1f2937' : '#e5e7eb' }}
        >
          <Text style={{ color: theme.text, fontWeight: '900' }}>Retour</Text>
        </Pressable>
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

        {loadingCmd ? (
          <Text style={{ color: theme.muted, marginTop: 8 }}>Chargement du reste à payer...</Text>
        ) : cmdTotal != null ? (
          <View style={{ marginTop: 10, backgroundColor: theme.surface, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: theme.isDark ? '#1f2937' : '#e5e7eb' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: theme.muted, fontWeight: '800' }}>Total</Text>
              <Text style={{ color: theme.text, fontWeight: '900' }}>{formatThousands(cmdTotal || 0)}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
              <Text style={{ color: theme.muted, fontWeight: '800' }}>Déjà payé</Text>
              <Text style={{ color: theme.text, fontWeight: '900' }}>{formatThousands(cmdMontantPaye || 0)}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
              <Text style={{ color: theme.muted, fontWeight: '800' }}>Reste à payer</Text>
              <Text style={{ color: theme.text, fontWeight: '900' }}>{formatThousands(remainingToPay)}</Text>
            </View>

            <Text style={{ color: theme.muted, marginTop: 8 }}>
              Paiement partiel possible: vous payez ce que vous avez.
            </Text>

            <Pressable
              onPress={() => setMontant(String(remainingToPay))}
              disabled={remainingToPay <= 0}
              style={{ marginTop: 10, alignSelf: 'flex-start', backgroundColor: remainingToPay <= 0 ? theme.muted : theme.primary, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12 }}
            >
              <Text style={{ color: 'white', fontWeight: '900' }}>Mettre le reste</Text>
            </Pressable>
          </View>
        ) : null}

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
          disabled={submitting || remainingToPay <= 0}
          style={{ marginTop: 14, backgroundColor: submitting ? theme.muted : theme.primary, paddingVertical: 12, borderRadius: 14, alignItems: 'center' }}
        >
          {submitting ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <ActivityIndicator color="white" />
              <Text style={{ color: 'white', fontWeight: '900', marginLeft: 10 }}>Enregistrement...</Text>
            </View>
          ) : (
            <Text style={{ color: 'white', fontWeight: '900' }}>{remainingToPay <= 0 ? 'Déjà payé' : 'Valider'}</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
