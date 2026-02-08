import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { useApp } from '../store/AppContext';
import {
  fetchCommandeFournisseurById,
  fetchHistoriqueBoutique,
  type CommandeFournisseurDTO,
} from '../services/achat';
import { downloadAndSharePdf } from '../services/pdf';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AchatStackParamList } from '../navigation/achatTypes';
import { showError, showInfo } from '../utils/notify';
import { useAccess } from '../utils/access';

function formatThousands(n: number) {
  const s = String(Math.trunc(Number(n) || 0));
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function supplierLabel(cmd: CommandeFournisseurDTO | null) {
  const f = cmd?.fournisseur;
  if (!f) return '';
  const name = [f.prenom, f.nom].filter(Boolean).join(' ').trim();
  return name || `Fournisseur #${f.id}`;
}

function toPercent(v: any) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 100) return 100;
  return n;
}

export default function AchatDetailScreen() {
  const theme = useTheme();
  const { token, boutiqueId } = useApp();
  const access = useAccess();
  const navigation = useNavigation<NativeStackNavigationProp<AchatStackParamList>>();
  const route = useRoute<RouteProp<AchatStackParamList, 'AchatDetail'>>();
  const id = route.params?.id;

  const [loading, setLoading] = useState(true);
  const [cmd, setCmd] = useState<CommandeFournisseurDTO | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    if (!access.achats) {
      setCmd(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchCommandeFournisseurById(id, token);
      setCmd(data);
    } catch (e: any) {
      showError('Erreur', e?.message || 'Impossible de charger la commande');
    } finally {
      setLoading(false);
    }
  }, [token, id, access.achats]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      // Refresh whenever we come back from paiement/réception
      load();
    }, [load])
  );

  const received = toPercent(cmd?.pourcentageRecu);
  const paid = toPercent(cmd?.pourcentagePaye);

  const lines = useMemo(() => (Array.isArray(cmd?.lignes) ? cmd!.lignes! : []), [cmd]);

  const printCommandePdf = useCallback(async () => {
    if (!token || !id) return;
    try {
      await downloadAndSharePdf({
        apiPath: `commandes-fournisseurs/${id}/pdf`,
        token,
        filename: `${cmd?.reference || `commande-${id}`}.pdf`,
      });
    } catch (e: any) {
      showError('Erreur', e?.message || "Impossible d'ouvrir le PDF");
    }
  }, [cmd?.reference, id, token]);

  const printLastReceptionPdf = useCallback(async () => {
    if (!token || !id) return;
    try {
      await downloadAndSharePdf({
        apiPath: `receptions/commande/${id}/last/pdf`,
        token,
        filename: `reception-last-${cmd?.reference || id}.pdf`,
      });
    } catch (e: any) {
      showError('Erreur', e?.message || "Impossible d'ouvrir le PDF");
    }
  }, [cmd?.reference, id, token]);

  const printLastPaiementPdf = useCallback(async () => {
    if (!token || !id) return;
    if (!boutiqueId) {
      showInfo('Boutique', 'Boutique inconnue.');
      return;
    }
    try {
      const hist = await fetchHistoriqueBoutique(boutiqueId, token);
      const items = (hist || [])
        .filter((it: any) => String(it?.type || '').toUpperCase() === 'PAIEMENT' && Number(it?.referenceCommandeId) === Number(id))
        .sort((a: any, b: any) => String(b?.dateIso || '').localeCompare(String(a?.dateIso || '')));
      const paiementId = Number(items?.[0]?.id || 0);
      if (!paiementId) {
        showInfo('Paiement', 'Aucun paiement trouvé pour cette commande.');
        return;
      }
      await downloadAndSharePdf({
        apiPath: `paiements/${paiementId}/pdf`,
        token,
        filename: `paiement-${cmd?.reference || id}-${paiementId}.pdf`,
      });
    } catch (e: any) {
      showError('Erreur', e?.message || "Impossible d'ouvrir le PDF");
    }
  }, [boutiqueId, cmd?.reference, id, token]);

  if (!token) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background, padding: 16 }}>
        <Text style={{ color: theme.text, fontWeight: '900' }}>Authentification requise</Text>
      </View>
    );
  }

  if (token && !access.achats) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background, padding: 16 }}>
        <Text style={{ color: theme.text, fontWeight: '900' }}>Permission requise</Text>
        <Text style={{ marginTop: 8, color: theme.muted, textAlign: 'center' }}>
          Vous n'avez pas la permission de voir les commandes fournisseur.
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
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator />
          <Text style={{ color: theme.muted, marginTop: 8 }}>Chargement...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
          <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: theme.isDark ? '#1f2937' : '#e5e7eb' }}>
            <Text style={{ color: theme.text, fontSize: 18, fontWeight: '900' }} numberOfLines={1}>
              {cmd?.reference || `Commande #${id}`}
            </Text>
            <Text style={{ color: theme.muted, marginTop: 4 }} numberOfLines={1}>
              {supplierLabel(cmd)}
            </Text>
            {!!cmd?.dateCommande && (
              <Text style={{ color: theme.muted, marginTop: 4 }} numberOfLines={1}>
                {cmd.dateCommande}
              </Text>
            )}

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
              <Text style={{ color: theme.muted, fontWeight: '700' }}>Total</Text>
              <Text style={{ color: theme.text, fontWeight: '900' }}>{formatThousands(Number(cmd?.total) || 0)}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
              <Text style={{ color: theme.muted, fontWeight: '700' }}>Payé</Text>
              <Text style={{ color: theme.text, fontWeight: '900' }}>{formatThousands(Number(cmd?.montantPaye) || 0)}</Text>
            </View>

            <View style={{ marginTop: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: theme.muted, fontWeight: '700' }}>% Reçu</Text>
                <Text style={{ color: theme.muted, fontWeight: '700' }}>{received.toFixed(0)}%</Text>
              </View>
              <View style={{ height: 10, borderRadius: 999, overflow: 'hidden', backgroundColor: theme.isDark ? '#111827' : '#f3f4f6', marginTop: 6 }}>
                <View style={{ width: `${received}%`, height: 10, backgroundColor: received >= 100 ? theme.success : theme.primary }} />
              </View>
            </View>

            <View style={{ marginTop: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: theme.muted, fontWeight: '700' }}>% Payé</Text>
                <Text style={{ color: theme.muted, fontWeight: '700' }}>{paid.toFixed(0)}%</Text>
              </View>
              <View style={{ height: 10, borderRadius: 999, overflow: 'hidden', backgroundColor: theme.isDark ? '#111827' : '#f3f4f6', marginTop: 6 }}>
                <View style={{ width: `${paid}%`, height: 10, backgroundColor: paid >= 100 ? theme.success : theme.primary }} />
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <Pressable
                onPress={() =>
                  navigation.navigate('AchatPaiement', {
                    id,
                    reference: cmd?.reference,
                    total: Number(cmd?.total) || 0,
                    montantPaye: Number(cmd?.montantPaye) || 0,
                  })
                }
                style={{ flex: 1, backgroundColor: theme.primary, paddingVertical: 12, borderRadius: 14, alignItems: 'center' }}
              >
                <Text style={{ color: 'white', fontWeight: '900' }}>Paiement</Text>
              </Pressable>
              <Pressable
                onPress={() => navigation.navigate('AchatReception', { id })}
                style={{ flex: 1, backgroundColor: theme.surface, paddingVertical: 12, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: theme.isDark ? '#1f2937' : '#e5e7eb' }}
              >
                <Text style={{ color: theme.text, fontWeight: '900' }}>Réception</Text>
              </Pressable>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <Pressable
                onPress={printCommandePdf}
                style={{ flex: 1, backgroundColor: theme.surface, paddingVertical: 10, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: theme.isDark ? '#1f2937' : '#e5e7eb' }}
              >
                <Text style={{ color: theme.text, fontWeight: '900' }}>PDF commande</Text>
              </Pressable>
              <Pressable
                onPress={printLastPaiementPdf}
                style={{ flex: 1, backgroundColor: theme.surface, paddingVertical: 10, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: theme.isDark ? '#1f2937' : '#e5e7eb' }}
              >
                <Text style={{ color: theme.text, fontWeight: '900' }}>PDF paiement</Text>
              </Pressable>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <Pressable
                onPress={printLastReceptionPdf}
                style={{ flex: 1, backgroundColor: theme.surface, paddingVertical: 10, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: theme.isDark ? '#1f2937' : '#e5e7eb' }}
              >
                <Text style={{ color: theme.text, fontWeight: '900' }}>PDF dernière réception</Text>
              </Pressable>
            </View>
          </View>

          <Text style={{ color: theme.text, fontSize: 16, fontWeight: '900', marginTop: 14, marginBottom: 10 }}>Lignes</Text>

          {lines.length === 0 ? (
            <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: theme.isDark ? '#1f2937' : '#e5e7eb' }}>
              <Text style={{ color: theme.muted }}>Aucune ligne.</Text>
            </View>
          ) : (
            lines.map((l) => (
              <View key={String(l.id)} style={{ backgroundColor: theme.card, borderRadius: 16, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: theme.isDark ? '#1f2937' : '#e5e7eb' }}>
                <Text style={{ color: theme.text, fontWeight: '900' }} numberOfLines={2}>
                  {l.nom || `Ligne #${l.id}`}
                </Text>
                {!!l.depot && (
                  <Text style={{ color: theme.muted, marginTop: 2 }} numberOfLines={1}>
                    Dépôt: {l.depot}
                  </Text>
                )}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                  <Text style={{ color: theme.muted, fontWeight: '700' }}>Qté</Text>
                  <Text style={{ color: theme.text, fontWeight: '900' }}>{Number(l.quantite) || 0}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                  <Text style={{ color: theme.muted, fontWeight: '700' }}>Prix U</Text>
                  <Text style={{ color: theme.text, fontWeight: '900' }}>{formatThousands(Number(l.prix) || 0)}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                  <Text style={{ color: theme.muted, fontWeight: '700' }}>Montant</Text>
                  <Text style={{ color: theme.text, fontWeight: '900' }}>{formatThousands(Number(l.montant) || (Number(l.quantite) || 0) * (Number(l.prix) || 0))}</Text>
                </View>
              </View>
            ))
          )}

          <Pressable onPress={load} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 6 }}>
            <Ionicons name="refresh" size={18} color={theme.muted} />
            <Text style={{ color: theme.muted, fontWeight: '800', marginLeft: 8 }}>Rafraîchir</Text>
          </Pressable>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
