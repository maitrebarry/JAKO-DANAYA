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
import { listCaisses, type CaisseDTO } from '../services/caisse';
import {
  createPaiementCommandeClient,
  getCommandeClient,
  type CommandeClientDTO,
} from '../services/commandesClients';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
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

function isOpenCaisse(c: CaisseDTO) {
  return String(c?.statut || '').toUpperCase() === 'OUVERTE';
}

export default function CommandeClientPaiementScreen() {
  const theme = useTheme();
  const { token, profile, boutiqueId } = useApp();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'CommandeClientPaiement'>>();

  const canPay = useMemo(() => {
    if (!profile) return false;
    return isSuperAdmin(profile) || hasPermission(profile, 'PAIEMENT_CREER');
  }, [profile]);

  const id = Number(route.params?.id || 0);
  const referenceCmd = route.params?.reference;
  const routeTotal = route.params?.total;
  const routePaie = route.params?.paie;

  const [montant, setMontant] = useState('');
  const [reference, setReference] = useState(buildReference());
  const [submitting, setSubmitting] = useState(false);

  const [loadingCmd, setLoadingCmd] = useState(false);
  const [cmd, setCmd] = useState<CommandeClientDTO | null>(null);

  const cmdTotal = useMemo(() => {
    if (cmd?.total != null) return Number(cmd.total) || 0;
    if (routeTotal != null) return Number(routeTotal) || 0;
    return 0;
  }, [cmd?.total, routeTotal]);

  const cmdPaie = useMemo(() => {
    if (cmd?.paie != null) return Number(cmd.paie) || 0;
    if (routePaie != null) return Number(routePaie) || 0;
    return 0;
  }, [cmd?.paie, routePaie]);

  const remainingToPay = useMemo(() => {
    const remaining = Math.max(0, Math.trunc(cmdTotal - cmdPaie));
    return Number.isFinite(remaining) ? remaining : 0;
  }, [cmdTotal, cmdPaie]);

  const montantInt = useMemo(() => {
    const n = Number(digitsOnly(montant) || 0);
    return Number.isFinite(n) ? Math.trunc(n) : 0;
  }, [montant]);

  const [loadingCaisses, setLoadingCaisses] = useState(false);
  const [caisses, setCaisses] = useState<CaisseDTO[]>([]);
  const [selectedCaisseRef, setSelectedCaisseRef] = useState<string>('');

  const openCaisses = useMemo(() => {
    const bid = Number(boutiqueId || 0);
    return (caisses || []).filter((c) => {
      if (!isOpenCaisse(c)) return false;
      const cBid = Number((c as any)?.boutique?.id || 0);
      return !bid || !cBid ? true : bid === cBid;
    });
  }, [caisses, boutiqueId]);

  useEffect(() => {
    if (!token || !id) return;
    let cancelled = false;
    (async () => {
      setLoadingCmd(true);
      try {
        const data = await getCommandeClient(id, token);
        if (cancelled) return;
        setCmd(data);

        setMontant((prev) => {
          if (digitsOnly(prev)) return prev;
          const total = Math.trunc(Number((data as any)?.total) || 0);
          const paid = Math.trunc(Number((data as any)?.paie) || 0);
          const remaining = Math.max(0, total - paid);
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

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      setLoadingCaisses(true);
      try {
        const all = await listCaisses(token);
        if (cancelled) return;
        setCaisses(Array.isArray(all) ? all : []);
      } catch {
        if (!cancelled) setCaisses([]);
      } finally {
        if (!cancelled) setLoadingCaisses(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (selectedCaisseRef) return;
    if (openCaisses.length > 0) {
      const ref = String(openCaisses[0]?.reference || '').trim();
      if (ref) setSelectedCaisseRef(ref);
    }
  }, [openCaisses, selectedCaisseRef]);

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
    if (!selectedCaisseRef) {
      showError('Caisse', 'Sélectionnez une caisse ouverte avant de valider.');
      return;
    }
    if (montantInt <= 0) {
      showError('Montant', 'Montant invalide');
      return;
    }
    if (montantInt > remainingToPay) {
      showError('Montant', `Le montant dépasse le reste à payer (${formatThousands(remainingToPay)}).`);
      return;
    }

    setSubmitting(true);
    try {
      const updated = await createPaiementCommandeClient(
        id,
        {
          montant: montantInt,
          reference: reference || undefined,
          date: new Date().toISOString(),
          timezoneOffsetMinutes: new Date().getTimezoneOffset(),
          referenceCaisse: selectedCaisseRef,
        },
        token
      );

      setCmd(updated);
      showSuccess(
        'Paiement enregistré',
        `Montant: ${formatThousands(montantInt)} • Reste: ${formatThousands(Math.max(0, remainingToPay - montantInt))}`
      );
      navigation.goBack();
    } catch (e: any) {
      showError('Erreur', e?.message || 'Paiement impossible');
    } finally {
      setSubmitting(false);
    }
  }, [token, canPay, id, selectedCaisseRef, montantInt, remainingToPay, reference, navigation]);

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
        <Text style={{ color: theme.text, fontSize: 18, fontWeight: '900' }}>Paiement commande client</Text>
        {!!referenceCmd && (
          <Text style={{ color: theme.muted, marginTop: 4 }} numberOfLines={1}>
            {referenceCmd}
          </Text>
        )}

        {loadingCmd ? (
          <Text style={{ color: theme.muted, marginTop: 8 }}>Chargement du reste à payer...</Text>
        ) : (
          <View style={{ marginTop: 10, backgroundColor: theme.surface, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: theme.isDark ? '#1f2937' : '#e5e7eb' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: theme.muted, fontWeight: '800' }}>Total</Text>
              <Text style={{ color: theme.text, fontWeight: '900' }}>{formatThousands(cmdTotal || 0)}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
              <Text style={{ color: theme.muted, fontWeight: '800' }}>Déjà payé</Text>
              <Text style={{ color: theme.text, fontWeight: '900' }}>{formatThousands(cmdPaie || 0)}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
              <Text style={{ color: theme.muted, fontWeight: '800' }}>Reste à payer</Text>
              <Text style={{ color: theme.text, fontWeight: '900' }}>{formatThousands(remainingToPay)}</Text>
            </View>

            <Pressable
              onPress={() => setMontant(String(remainingToPay))}
              disabled={remainingToPay <= 0}
              style={{ marginTop: 10, alignSelf: 'flex-start', backgroundColor: remainingToPay <= 0 ? theme.muted : theme.primary, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12 }}
            >
              <Text style={{ color: 'white', fontWeight: '900' }}>Mettre le reste</Text>
            </Pressable>
          </View>
        )}

        <Text style={{ color: theme.muted, marginTop: 12, marginBottom: 6 }}>Caisse (ouverte)</Text>
        <View style={{ backgroundColor: theme.surface, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: theme.isDark ? '#1f2937' : '#e5e7eb' }}>
          {loadingCaisses ? <Text style={{ color: theme.muted }}>Chargement des caisses...</Text> : null}
          {!loadingCaisses && openCaisses.length === 0 ? (
            <Text style={{ color: theme.muted }}>
              Aucune caisse ouverte trouvée. Ouvrez une caisse avant d'enregistrer un paiement.
            </Text>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {openCaisses.map((c) => {
                const ref = String(c.reference || '').trim();
                const active = ref && ref === selectedCaisseRef;
                return (
                  <Pressable
                    key={String(c.id)}
                    onPress={() => ref && setSelectedCaisseRef(ref)}
                    style={{
                      paddingVertical: 8,
                      paddingHorizontal: 10,
                      borderRadius: 999,
                      backgroundColor: active ? theme.primary : theme.card,
                      borderWidth: 1,
                      borderColor: active ? theme.primary : theme.isDark ? '#1f2937' : '#e5e7eb',
                      marginTop: 6,
                    }}
                  >
                    <Text style={{ color: active ? '#fff' : theme.text, fontWeight: '900' }} numberOfLines={1}>
                      {ref || `Caisse #${c.id}`}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

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
