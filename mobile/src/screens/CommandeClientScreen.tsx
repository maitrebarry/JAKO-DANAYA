import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  SafeAreaView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { useAccess } from '../utils/access';
import { useApp } from '../store/AppContext';
import {
  deleteCommandeClient,
  listCommandesClientsByBoutique,
  type CommandeClientDTO,
} from '../services/commandesClients';
import { showError, showInfo, showSuccess } from '../utils/notify';
import { hasPermission, isSuperAdmin } from '../utils/permissions';

function digitsOnly(input: string) {
  return (input || '').replace(/\D+/g, '');
}

function formatThousands(n: number) {
  const s = String(Math.trunc(Number(n) || 0));
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function clientLabel(cmd: CommandeClientDTO) {
  const c: any = (cmd as any)?.client;
  if (!c) return '';
  const name = [c.prenom, c.nom].filter(Boolean).join(' ').trim();
  return name || c.nomClient || '';
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

const ActionsModal = React.memo(function ActionsModal({
  visible,
  onClose,
  cmd,
  onView,
  onDeliver,
  onPay,
  onPdf,
  onDelete,
  canDeliver,
  canPay,
  canDelete,
  theme,
  deleting,
}: {
  visible: boolean;
  onClose: () => void;
  cmd: CommandeClientDTO | null;
  onView: () => void;
  onDeliver: () => void;
  onPay: () => void;
  onPdf: () => void;
  onDelete: () => void;
  canDeliver: boolean;
  canPay: boolean;
  canDelete: boolean;
  theme: ReturnType<typeof useTheme>;
  deleting: boolean;
}) {
  if (!cmd) return null;

  const title = cmd.reference || `Commande #${cmd.id}`;
  const delivered = computeDeliveredPercent(cmd);
  const paidPct = computePaidPercent(cmd);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: theme.card,
            borderTopLeftRadius: 18,
            borderTopRightRadius: 18,
            padding: 16,
            borderTopWidth: 1,
            borderTopColor: theme.isDark ? '#1f2937' : '#e5e7eb',
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ color: theme.text, fontSize: 16, fontWeight: '900' }} numberOfLines={1}>
                {title}
              </Text>
              <Text style={{ color: theme.muted, marginTop: 2 }} numberOfLines={1}>
                {clientLabel(cmd)}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={22} color={theme.text} />
            </Pressable>
          </View>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <View style={{ flex: 1, backgroundColor: theme.surface, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: theme.isDark ? '#1f2937' : '#e5e7eb' }}>
              <Text style={{ color: theme.muted, fontWeight: '700' }}>% Livré</Text>
              <Text style={{ color: theme.text, fontWeight: '900', marginTop: 4 }}>{delivered.toFixed(0)}%</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: theme.surface, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: theme.isDark ? '#1f2937' : '#e5e7eb' }}>
              <Text style={{ color: theme.muted, fontWeight: '700' }}>% Payé</Text>
              <Text style={{ color: theme.text, fontWeight: '900', marginTop: 4 }}>{paidPct.toFixed(0)}%</Text>
            </View>
          </View>

          <View style={{ marginTop: 14 }}>
            <Pressable onPress={onView} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}>
              <Ionicons name="eye-outline" size={20} color={theme.text} />
              <Text style={{ color: theme.text, marginLeft: 10, fontWeight: '800' }}>Voir détails</Text>
            </Pressable>
            <View style={{ height: 1, backgroundColor: theme.isDark ? '#1f2937' : '#e5e7eb' }} />
            <Pressable onPress={onPdf} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}>
              <MaterialCommunityIcons name="file-pdf-box" size={20} color={theme.text} />
              <Text style={{ color: theme.text, marginLeft: 10, fontWeight: '800' }}>PDF</Text>
            </Pressable>
            <View style={{ height: 1, backgroundColor: theme.isDark ? '#1f2937' : '#e5e7eb' }} />

            {canDeliver ? (
              <>
                <Pressable onPress={onDeliver} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}>
                  <MaterialCommunityIcons name="truck-delivery-outline" size={20} color={theme.text} />
                  <Text style={{ color: theme.text, marginLeft: 10, fontWeight: '800' }}>Livraison</Text>
                </Pressable>
                <View style={{ height: 1, backgroundColor: theme.isDark ? '#1f2937' : '#e5e7eb' }} />
              </>
            ) : (
              <>
                <Pressable onPress={onDeliver} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, opacity: 0.6 }}>
                  <Ionicons name="lock-closed-outline" size={20} color={theme.muted} />
                  <Text style={{ color: theme.muted, marginLeft: 10, fontWeight: '800' }}>Livraison</Text>
                </Pressable>
                <View style={{ height: 1, backgroundColor: theme.isDark ? '#1f2937' : '#e5e7eb' }} />
              </>
            )}

            {canPay ? (
              <>
                <Pressable onPress={onPay} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}>
                  <Ionicons name="card-outline" size={20} color={theme.text} />
                  <Text style={{ color: theme.text, marginLeft: 10, fontWeight: '800' }}>Paiement</Text>
                </Pressable>
                <View style={{ height: 1, backgroundColor: theme.isDark ? '#1f2937' : '#e5e7eb' }} />
              </>
            ) : null}

            {canDelete ? (
              <Pressable
                onPress={onDelete}
                disabled={deleting}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, opacity: deleting ? 0.6 : 1 }}
              >
                <Ionicons name="trash-outline" size={20} color={theme.danger} />
                <Text style={{ color: theme.danger, marginLeft: 10, fontWeight: '900' }}>
                  {deleting ? 'Suppression...' : 'Supprimer'}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
});

export default function CommandeClientScreen() {
  const theme = useTheme();
  const access = useAccess();
  const { token, boutiqueId, profile } = useApp();
  const navigation = useNavigation<any>();

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<CommandeClientDTO[]>([]);
  const [q, setQ] = useState('');

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

  const [selected, setSelected] = useState<CommandeClientDTO | null>(null);
  const [showActions, setShowActions] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    const bid = Number(boutiqueId || 0);
    if (!bid) return;
    setLoading(true);
    try {
      const list = await listCommandesClientsByBoutique(bid, token);
      const arr = Array.isArray(list) ? list : [];
      arr.sort((a: any, b: any) => (Number(b?.id) || 0) - (Number(a?.id) || 0));
      setItems(arr);
    } catch (e: any) {
      showError('Erreur', e?.message || 'Impossible de charger les commandes');
    } finally {
      setLoading(false);
    }
  }, [token, boutiqueId]);

  useEffect(() => {
    if (!access.commandes) return;
    load();
  }, [access.commandes, load]);

  useFocusEffect(
    useCallback(() => {
      if (!access.commandes) return;
      load();
    }, [access.commandes, load])
  );

  const onRefresh = useCallback(async () => {
    if (!token) return;
    if (!access.commandes) {
      setItems([]);
      setRefreshing(false);
      return;
    }
    setRefreshing(true);
    try {
      const bid = Number(boutiqueId || 0);
      if (!bid) return;
      const list = await listCommandesClientsByBoutique(bid, token);
      const arr = Array.isArray(list) ? list : [];
      arr.sort((a: any, b: any) => (Number(b?.id) || 0) - (Number(a?.id) || 0));
      setItems(arr);
    } catch (e: any) {
      showError('Erreur', e?.message || 'Rafraîchissement impossible');
    } finally {
      setRefreshing(false);
    }
  }, [token, access.commandes, boutiqueId]);

  const openActions = useCallback((cmd: CommandeClientDTO) => {
    setSelected(cmd);
    setShowActions(true);
  }, []);

  const closeActions = useCallback(() => {
    setShowActions(false);
  }, []);

  const handleDelete = useCallback(async () => {
    if (!token || !selected) return;
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
          setDeleting(true);
          try {
            await deleteCommandeClient(selected.id, token);
            setItems((prev) => (prev || []).filter((c) => c.id !== selected.id));
            setShowActions(false);
            showSuccess('Commande supprimée', 'La commande client a été supprimée.');
          } catch (e: any) {
            showError('Erreur', e?.message || 'Suppression impossible');
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  }, [token, selected, canDelete]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return items;
    return (items || []).filter((c) => {
      const ref = String(c.reference || '').toLowerCase();
      const client = String((c as any)?.client?.nom || (c as any)?.client?.prenom || (c as any)?.client?.nomClient || '').toLowerCase();
      return ref.includes(qq) || client.includes(qq);
    });
  }, [items, q]);

  const totals = useMemo(() => {
    const totalGeneral = (filtered || []).reduce((sum, c: any) => sum + (Number(c?.total) || 0), 0);
    const totalPaye = (filtered || []).reduce((sum, c: any) => sum + (Number(c?.paie) || 0), 0);
    return { totalGeneral, totalPaye };
  }, [filtered]);

  if (!token) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
        <Text style={{ color: theme.text }}>Non authentifié</Text>
      </View>
    );
  }

  if (!access.commandes) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background, padding: 16 }}>
        <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text }}>Commande client</Text>
        <Text style={{ marginTop: 8, color: theme.muted, textAlign: 'center' }}>
          Vous n'avez pas la permission d'accéder à cet écran.
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <ActionsModal
        visible={showActions}
        onClose={closeActions}
        cmd={selected}
        theme={theme}
        deleting={deleting}
        canPay={canPay}
        canDelete={canDelete}
        canDeliver={canDeliver}
        onView={() => {
          if (!selected) return;
          setShowActions(false);
          navigation.navigate('CommandeClientDetail', { id: selected.id });
        }}
        onDeliver={() => {
          if (!selected) return;
          if (!canDeliver) {
            showInfo('Permission', "Vous n'avez pas la permission d'enregistrer une livraison.");
            return;
          }
          setShowActions(false);
          navigation.navigate('CommandeClientLivraison', { id: selected.id });
        }}
        onPdf={() => {
          if (!selected) return;
          setShowActions(false);
          navigation.navigate('CommandeClientDetail', { id: selected.id, openPdf: true });
        }}
        onPay={() => {
          if (!selected) return;
          if (!canPay) {
            showError('Permission', "Vous n'avez pas la permission d'enregistrer un paiement.");
            return;
          }
          setShowActions(false);
          navigation.navigate('CommandeClientPaiement', {
            id: selected.id,
            reference: selected.reference,
            total: Number((selected as any)?.total) || 0,
            paie: Number((selected as any)?.paie) || 0,
          });
        }}
        onDelete={handleDelete}
      />

      <View style={{ padding: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: '900' }}>Commandes clients</Text>
          {access.ventesCreate ? (
            <Pressable
              onPress={() => navigation.navigate('CommandeClientCreate')}
              style={{ backgroundColor: theme.primary, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, flexDirection: 'row', alignItems: 'center' }}
            >
              <Ionicons name="add" size={18} color="white" />
              <Text style={{ color: 'white', fontWeight: '900', marginLeft: 6 }}>Nouveau</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => showInfo('Permission', "Vous n'avez pas la permission de créer une commande client.")}
              style={{ backgroundColor: theme.surface, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: theme.isDark ? '#374151' : '#d1d5db' }}
            >
              <Ionicons name="lock-closed-outline" size={18} color={theme.muted} />
              <Text style={{ color: theme.muted, fontWeight: '900', marginLeft: 6 }}>Nouveau</Text>
            </Pressable>
          )}
        </View>

        <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.isDark ? '#1f2937' : '#e5e7eb', paddingHorizontal: 10 }}>
          <Ionicons name="search" size={18} color={theme.muted} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Rechercher (référence, client...)"
            placeholderTextColor={theme.muted}
            style={{ flex: 1, color: theme.text, paddingVertical: 10, paddingHorizontal: 10 }}
          />
          {!!q && (
            <Pressable onPress={() => setQ('')} hitSlop={10}>
              <Ionicons name="close-circle" size={18} color={theme.muted} />
            </Pressable>
          )}
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator />
          <Text style={{ color: theme.muted, marginTop: 8 }}>Chargement...</Text>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          data={filtered}
          keyExtractor={(it) => String(it.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={!loading ? <Text style={{ color: theme.muted, textAlign: 'center' }}>Aucune commande</Text> : null}
          renderItem={({ item }) => {
            const ref = item.reference || `Commande #${item.id}`;
            const client = clientLabel(item);
            const delivered = computeDeliveredPercent(item as any);
            const paidPct = computePaidPercent(item as any);
            return (
              <Pressable
                onPress={() => openActions(item)}
                style={{ backgroundColor: theme.card, padding: 12, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: theme.isDark ? '#1f2937' : '#e5e7eb' }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={{ color: theme.text, fontWeight: '900' }} numberOfLines={1}>
                      {ref}
                    </Text>
                    {!!client && <Text style={{ color: theme.muted, marginTop: 2 }} numberOfLines={1}>{client}</Text>}
                    {!!item.dateCommande && <Text style={{ color: theme.muted, marginTop: 2 }} numberOfLines={1}>{String(item.dateCommande)}</Text>}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ color: theme.text, fontWeight: '900' }}>{formatThousands(Number((item as any)?.total) || 0)}</Text>
                    <Text style={{ color: theme.muted, marginTop: 2 }}>Payé: {formatThousands(Number((item as any)?.paie) || 0)}</Text>
                  </View>
                </View>

                <View style={{ marginTop: 10 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: theme.muted, fontWeight: '700' }}>% Livré</Text>
                    <Text style={{ color: theme.muted, fontWeight: '700' }}>{delivered.toFixed(0)}%</Text>
                  </View>
                  <View style={{ height: 10, borderRadius: 999, overflow: 'hidden', backgroundColor: theme.isDark ? '#111827' : '#f3f4f6', marginTop: 6 }}>
                    <View style={{ width: `${delivered}%`, height: 10, backgroundColor: delivered >= 100 ? theme.success : theme.primary }} />
                  </View>
                </View>

                <View style={{ marginTop: 10 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: theme.muted, fontWeight: '700' }}>% Payé</Text>
                    <Text style={{ color: theme.muted, fontWeight: '700' }}>{paidPct.toFixed(0)}%</Text>
                  </View>
                  <View style={{ height: 10, borderRadius: 999, overflow: 'hidden', backgroundColor: theme.isDark ? '#111827' : '#f3f4f6', marginTop: 6 }}>
                    <View style={{ width: `${paidPct}%`, height: 10, backgroundColor: paidPct >= 100 ? theme.success : theme.primary }} />
                  </View>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 10 }}>
                  <MaterialCommunityIcons name="dots-horizontal" size={20} color={theme.muted} />
                  <Text style={{ color: theme.muted, marginLeft: 6, fontWeight: '700' }}>Actions</Text>
                </View>
              </Pressable>
            );
          }}
        />
      )}

      {!loading && (
        <View
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            bottom: 16,
            backgroundColor: theme.card,
            borderRadius: 16,
            padding: 12,
            borderWidth: 1,
            borderColor: theme.isDark ? '#1f2937' : '#e5e7eb',
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: theme.muted, fontWeight: '700' }}>Total général</Text>
            <Text style={{ color: theme.text, fontWeight: '900' }}>{formatThousands(totals.totalGeneral)}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
            <Text style={{ color: theme.muted, fontWeight: '700' }}>Montant payé</Text>
            <Text style={{ color: theme.text, fontWeight: '900' }}>{formatThousands(totals.totalPaye)}</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
