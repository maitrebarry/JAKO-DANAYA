import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { useApp } from '../store/AppContext';
import { deleteCommandeClient, getCommandeClient } from '../services/commandesClients';
import { downloadAndSharePdf } from '../services/pdf';
import { showError, showInfo, showSuccess } from '../utils/notify';
import { hasPermission, isSuperAdmin } from '../utils/permissions';
import { useNavigation } from '@react-navigation/native';

function formatThousands(n: number) {
  const s = String(Math.trunc(Number(n) || 0));
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function toPercent(v: any) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 100) return 100;
  return n;
}

function computePaidPercent(cmd: any) {
  const total = Number(cmd?.total) || 0;
  const paid = Number(cmd?.paie) || 0;
  if (total <= 0) return 0;
  return toPercent((paid / total) * 100);
}

function computeDeliveredPercent(cmd: any) {
  const lines = Array.isArray(cmd?.lignes) ? cmd.lignes : [];
  let totalQty = 0;
  let deliveredQty = 0;
  for (const l of lines) {
    const q = Number(l?.quantite ?? l?.qte ?? l?.qty ?? 0) || 0;
    const d = Number(l?.quantiteLivre ?? l?.qteLivre ?? l?.delivered ?? 0) || 0;
    if (q > 0) {
      totalQty += q;
      deliveredQty += Math.max(0, Math.min(q, d));
    }
  }
  if (totalQty <= 0) return 0;
  return toPercent((deliveredQty / totalQty) * 100);
}

function clientLabel(cmd: any) {
  const c: any = cmd?.client;
  if (!c) return '';
  const name = [c.prenom, c.nom].filter(Boolean).join(' ').trim();
  return name || c.nomClient || '';
}

export default function CommandeClientDetailScreen() {
  const theme = useTheme();
  const { token, profile } = useApp();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const id = Number(route?.params?.id || 0);
  const openPdf = !!route?.params?.openPdf;

  const canPay = useMemo(() => {
    if (!profile) return false;
    return isSuperAdmin(profile) || hasPermission(profile, 'PAIEMENT_CREER');
  }, [profile]);

  const canDelete = useMemo(() => {
    if (!profile) return false;
    return isSuperAdmin(profile) || hasPermission(profile, 'COMMANDE_SUPPRIMER');
  }, [profile]);

  const canDeliver = useMemo(() => {
    if (!profile) return false;
    return isSuperAdmin(profile) || hasPermission(profile, 'LIVRAISON_ECRITURE');
  }, [profile]);

  const [loading, setLoading] = useState(false);
  const [cmd, setCmd] = useState<any>(null);

  const load = useCallback(async () => {
    if (!token) return;
    if (!id) return;
    setLoading(true);
    try {
      const data = await getCommandeClient(id, token);
      setCmd(data);
    } catch (e: any) {
      showError('Erreur', e?.message || 'Impossible de charger la commande');
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => {
    load();
  }, [load]);

  const handlePdf = useCallback(async () => {
    try {
      if (!token || !id) return;
      await downloadAndSharePdf({ apiPath: `commandes-clients/${id}/pdf`, token, filename: `commande_client_${id}.pdf` });
    } catch (e: any) {
      showError('PDF', e?.message || 'Impossible de générer le PDF');
    }
  }, [token, id]);

  useEffect(() => {
    if (!openPdf) return;
    handlePdf();
  }, [openPdf, handlePdf]);

  const handleDelete = useCallback(() => {
    if (!token || !id) return;
    if (!canDelete) {
      showError('Permission', "Vous n'avez pas la permission de supprimer une commande.");
      return;
    }

    Alert.alert('Suppression', 'Supprimer cette commande client ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteCommandeClient(id, token);
            showSuccess('Commande supprimée', 'La commande client a été supprimée.');
            navigation.goBack();
          } catch (e: any) {
            showError('Erreur', e?.message || 'Suppression impossible');
          }
        },
      },
    ]);
  }, [token, id, canDelete, navigation]);

  if (!token) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
        <Text style={{ color: theme.text }}>Non authentifié</Text>
      </View>
    );
  }

  const deliveredPct = computeDeliveredPercent(cmd);
  const paidPct = computePaidPercent(cmd);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator />
          <Text style={{ color: theme.muted, marginTop: 8 }}>Chargement...</Text>
        </View>
      ) : (
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
        <View style={{ backgroundColor: theme.card, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: theme.isDark ? '#1f2937' : '#e5e7eb' }}>
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: '900' }} numberOfLines={1}>
            {cmd?.reference || `Commande #${id}`}
          </Text>
          {!!clientLabel(cmd) && (
            <Text style={{ color: theme.muted, marginTop: 4 }} numberOfLines={1}>
              {clientLabel(cmd)}
            </Text>
          )}
          {!!cmd?.dateCommande && (
            <Text style={{ color: theme.muted, marginTop: 4 }} numberOfLines={1}>
              {String(cmd.dateCommande)}
            </Text>
          )}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
            <Text style={{ color: theme.muted, fontWeight: '700' }}>Total</Text>
            <Text style={{ color: theme.text, fontWeight: '900' }}>{formatThousands(Number(cmd?.total) || 0)}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
            <Text style={{ color: theme.muted, fontWeight: '700' }}>Payé</Text>
            <Text style={{ color: theme.text, fontWeight: '900' }}>{formatThousands(Number(cmd?.paie) || 0)}</Text>
          </View>

          <View style={{ marginTop: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: theme.muted, fontWeight: '700' }}>% Livré</Text>
              <Text style={{ color: theme.muted, fontWeight: '700' }}>{deliveredPct.toFixed(0)}%</Text>
            </View>
            <View style={{ height: 10, borderRadius: 999, overflow: 'hidden', backgroundColor: theme.isDark ? '#111827' : '#f3f4f6', marginTop: 6 }}>
              <View style={{ width: `${deliveredPct}%`, height: 10, backgroundColor: deliveredPct >= 100 ? theme.success : theme.primary }} />
            </View>
          </View>

          <View style={{ marginTop: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: theme.muted, fontWeight: '700' }}>% Payé</Text>
              <Text style={{ color: theme.muted, fontWeight: '700' }}>{paidPct.toFixed(0)}%</Text>
            </View>
            <View style={{ height: 10, borderRadius: 999, overflow: 'hidden', backgroundColor: theme.isDark ? '#111827' : '#f3f4f6', marginTop: 6 }}>
              <View style={{ width: `${paidPct}%`, height: 10, backgroundColor: paidPct >= 100 ? theme.success : theme.primary }} />
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            <Pressable
              onPress={() => {
                if (!canPay) {
                  showError('Permission', "Vous n'avez pas la permission d'enregistrer un paiement.");
                  return;
                }
                navigation.navigate('CommandeClientPaiement', {
                  id,
                  reference: cmd?.reference,
                  total: Number(cmd?.total) || 0,
                  paie: Number(cmd?.paie) || 0,
                });
              }}
              style={{ flex: 1, backgroundColor: canPay ? theme.primary : theme.muted, paddingVertical: 12, borderRadius: 14, alignItems: 'center' }}
            >
              <Text style={{ color: 'white', fontWeight: '900' }}>Paiement</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                if (!canDeliver) {
                  showInfo('Permission', "Vous n'avez pas la permission d'enregistrer une livraison.");
                  return;
                }
                navigation.navigate('CommandeClientLivraison', { id });
              }}
              style={{ flex: 1, backgroundColor: theme.surface, paddingVertical: 12, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: theme.isDark ? '#1f2937' : '#e5e7eb' }}
            >
              <Text style={{ color: theme.text, fontWeight: '900' }}>Livraison</Text>
            </Pressable>
          </View>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            <Pressable
              onPress={handlePdf}
              style={{ flex: 1, backgroundColor: theme.surface, paddingVertical: 10, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: theme.isDark ? '#1f2937' : '#e5e7eb' }}
            >
              <Text style={{ color: theme.text, fontWeight: '900' }}>PDF commande</Text>
            </Pressable>
            <Pressable
              onPress={handleDelete}
              style={{ flex: 1, backgroundColor: canDelete ? theme.danger : theme.muted, paddingVertical: 10, borderRadius: 14, alignItems: 'center' }}
            >
              <Text style={{ color: 'white', fontWeight: '900' }}>Supprimer</Text>
            </Pressable>
          </View>
        </View>

        <View style={{ marginTop: 14, backgroundColor: theme.card, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: theme.isDark ? '#1f2937' : '#e5e7eb' }}>
          <Text style={{ color: theme.text, fontWeight: '900', fontSize: 16 }}>Lignes</Text>

          {Array.isArray(cmd?.lignes) && cmd.lignes.length > 0 ? (
            <View style={{ marginTop: 10 }}>
              {cmd.lignes.map((l: any, idx: number) => {
                const produit = l?.produit?.nomProduit || l?.produit?.nom || l?.nomProduit || '';
                const qte = l?.quantite ?? l?.qte ?? l?.qty;
                const livre = l?.quantiteLivre ?? l?.qteLivre ?? l?.delivered;
                const prix = l?.prix ?? l?.prixUnitaire ?? l?.pu;
                const qInt = Number(qte ?? 0) || 0;
                const lInt = Number(livre ?? 0) || 0;
                const remaining = Math.max(0, qInt - lInt);
                return (
                  <View key={String(l?.id || idx)} style={{ backgroundColor: theme.surface, padding: 12, borderRadius: 14, marginBottom: 10 }}>
                    <Text style={{ color: theme.text, fontWeight: '800' }}>{produit || `Ligne ${idx + 1}`}</Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                      <Text style={{ color: theme.muted }}>Qté</Text>
                      <Text style={{ color: theme.text, fontWeight: '800' }}>{qte ?? '—'}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                      <Text style={{ color: theme.muted }}>Livré</Text>
                      <Text style={{ color: theme.text, fontWeight: '800' }}>{livre ?? 0}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                      <Text style={{ color: theme.muted }}>Reste</Text>
                      <Text style={{ color: theme.text, fontWeight: '800' }}>{Number.isFinite(remaining) ? remaining : '—'}</Text>
                    </View>
                    {prix != null ? (
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                        <Text style={{ color: theme.muted }}>PU</Text>
                        <Text style={{ color: theme.text, fontWeight: '800' }}>{formatThousands(Number(prix) || 0)}</Text>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={{ color: theme.muted, marginTop: 10 }}>Aucune ligne</Text>
          )}
        </View>
      </ScrollView>
      )}
    </SafeAreaView>
  );
}
