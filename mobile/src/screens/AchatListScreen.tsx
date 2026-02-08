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
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { useApp } from '../store/AppContext';
import {
  deleteCommandeFournisseur,
  fetchCommandesFournisseurs,
  type CommandeFournisseurDTO,
} from '../services/achat';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AchatStackParamList } from '../navigation/achatTypes';

function digitsOnly(input: string) {
  return (input || '').replace(/\D+/g, '');
}

function formatThousands(n: number) {
  const s = String(Math.trunc(Number(n) || 0));
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function supplierLabel(cmd: CommandeFournisseurDTO) {
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

const ActionsModal = React.memo(function ActionsModal({
  visible,
  onClose,
  cmd,
  onView,
  onPay,
  onReceive,
  onDelete,
  theme,
  deleting,
}: {
  visible: boolean;
  onClose: () => void;
  cmd: CommandeFournisseurDTO | null;
  onView: () => void;
  onPay: () => void;
  onReceive: () => void;
  onDelete: () => void;
  theme: ReturnType<typeof useTheme>;
  deleting: boolean;
}) {
  if (!cmd) return null;

  const title = cmd.reference || `Commande #${cmd.id}`;
  const received = toPercent(cmd.pourcentageRecu);
  const paid = toPercent(cmd.pourcentagePaye);

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
                {supplierLabel(cmd)}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={22} color={theme.text} />
            </Pressable>
          </View>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <View style={{ flex: 1, backgroundColor: theme.surface, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: theme.isDark ? '#1f2937' : '#e5e7eb' }}>
              <Text style={{ color: theme.muted, fontWeight: '700' }}>% Reçu</Text>
              <Text style={{ color: theme.text, fontWeight: '900', marginTop: 4 }}>{received.toFixed(0)}%</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: theme.surface, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: theme.isDark ? '#1f2937' : '#e5e7eb' }}>
              <Text style={{ color: theme.muted, fontWeight: '700' }}>% Payé</Text>
              <Text style={{ color: theme.text, fontWeight: '900', marginTop: 4 }}>{paid.toFixed(0)}%</Text>
            </View>
          </View>

          <View style={{ marginTop: 14 }}>
            <Pressable
              onPress={onView}
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}
            >
              <Ionicons name="eye-outline" size={20} color={theme.text} />
              <Text style={{ color: theme.text, marginLeft: 10, fontWeight: '800' }}>Voir détails</Text>
            </Pressable>
            <View style={{ height: 1, backgroundColor: theme.isDark ? '#1f2937' : '#e5e7eb' }} />
            <Pressable
              onPress={onPay}
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}
            >
              <Ionicons name="card-outline" size={20} color={theme.text} />
              <Text style={{ color: theme.text, marginLeft: 10, fontWeight: '800' }}>Paiement</Text>
            </Pressable>
            <View style={{ height: 1, backgroundColor: theme.isDark ? '#1f2937' : '#e5e7eb' }} />
            <Pressable
              onPress={onReceive}
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}
            >
              <Ionicons name="cube-outline" size={20} color={theme.text} />
              <Text style={{ color: theme.text, marginLeft: 10, fontWeight: '800' }}>Réception</Text>
            </Pressable>
            <View style={{ height: 1, backgroundColor: theme.isDark ? '#1f2937' : '#e5e7eb' }} />
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
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
});

export default function AchatListScreen() {
  const theme = useTheme();
  const { token } = useApp();
  const navigation = useNavigation<NativeStackNavigationProp<AchatStackParamList>>();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState('');
  const [items, setItems] = useState<CommandeFournisseurDTO[]>([]);

  const [selected, setSelected] = useState<CommandeFournisseurDTO | null>(null);
  const [showActions, setShowActions] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchCommandesFournisseurs(token);
      const list = Array.isArray(data) ? data : [];
      // newest first: try id desc
      list.sort((a: any, b: any) => (Number(b?.id) || 0) - (Number(a?.id) || 0));
      setItems(list);
    } catch (e: any) {
      Alert.alert('Erreur', e?.message || 'Impossible de charger les commandes');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const base = Array.isArray(items) ? items : [];
    if (!query) return base;
    return base.filter((cmd) => {
      const ref = (cmd.reference || '').toLowerCase();
      const sup = supplierLabel(cmd).toLowerCase();
      return ref.includes(query) || sup.includes(query) || String(cmd.id).includes(query);
    });
  }, [items, q]);

  const totals = useMemo(() => {
    const totalGeneral = filtered.reduce((sum, c) => sum + (Number(c.total) || 0), 0);
    const totalPaye = filtered.reduce((sum, c) => sum + (Number(c.montantPaye) || 0), 0);
    return { totalGeneral, totalPaye };
  }, [filtered]);

  const onRefresh = useCallback(async () => {
    if (!token) return;
    setRefreshing(true);
    try {
      const data = await fetchCommandesFournisseurs(token);
      const list = Array.isArray(data) ? data : [];
      list.sort((a: any, b: any) => (Number(b?.id) || 0) - (Number(a?.id) || 0));
      setItems(list);
    } catch (e: any) {
      Alert.alert('Erreur', e?.message || 'Rafraîchissement impossible');
    } finally {
      setRefreshing(false);
    }
  }, [token]);

  const openActions = useCallback((cmd: CommandeFournisseurDTO) => {
    setSelected(cmd);
    setShowActions(true);
  }, []);

  const closeActions = useCallback(() => {
    setShowActions(false);
  }, []);

  const handleDelete = useCallback(async () => {
    if (!token || !selected) return;
    Alert.alert('Suppression', 'Supprimer cette commande ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await deleteCommandeFournisseur(selected.id, token);
            setItems((prev) => (prev || []).filter((c) => c.id !== selected.id));
            setShowActions(false);
            Alert.alert('OK', 'Commande supprimée.');
          } catch (e: any) {
            Alert.alert('Erreur', e?.message || 'Suppression impossible');
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  }, [token, selected]);

  if (!token) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background, padding: 16 }}>
        <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text }}>Achats</Text>
        <Text style={{ marginTop: 8, color: theme.muted, textAlign: 'center' }}>Connectez-vous pour voir les commandes.</Text>
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
        onView={() => {
          if (!selected) return;
          setShowActions(false);
          navigation.navigate('AchatDetail', { id: selected.id });
        }}
        onPay={() => {
          if (!selected) return;
          setShowActions(false);
          navigation.navigate('AchatPaiement', { id: selected.id, reference: selected.reference });
        }}
        onReceive={() => {
          if (!selected) return;
          setShowActions(false);
          navigation.navigate('AchatReception', { id: selected.id });
        }}
        onDelete={handleDelete}
      />

      <View style={{ padding: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: '900' }}>Commandes fournisseur</Text>
          <Pressable
            onPress={() => navigation.navigate('AchatCreate')}
            style={{ backgroundColor: theme.primary, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, flexDirection: 'row', alignItems: 'center' }}
          >
            <Ionicons name="add" size={18} color="white" />
            <Text style={{ color: 'white', fontWeight: '900', marginLeft: 6 }}>Nouveau</Text>
          </Pressable>
        </View>

        <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.isDark ? '#1f2937' : '#e5e7eb', paddingHorizontal: 10 }}>
          <Ionicons name="search" size={18} color={theme.muted} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Rechercher (référence, fournisseur...)"
            placeholderTextColor={theme.muted}
            style={{ flex: 1, color: theme.text, paddingVertical: 10, paddingHorizontal: 10 }}
          />
          {!!digitsOnly(q) && (
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
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
          renderItem={({ item }) => {
            const received = toPercent(item.pourcentageRecu);
            const paid = toPercent(item.pourcentagePaye);
            return (
              <Pressable
                onPress={() => openActions(item)}
                style={{
                  backgroundColor: theme.card,
                  borderRadius: 16,
                  padding: 12,
                  marginBottom: 10,
                  borderWidth: 1,
                  borderColor: theme.isDark ? '#1f2937' : '#e5e7eb',
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={{ color: theme.text, fontWeight: '900' }} numberOfLines={1}>
                      {item.reference || `Commande #${item.id}`}
                    </Text>
                    <Text style={{ color: theme.muted, marginTop: 2 }} numberOfLines={1}>
                      {supplierLabel(item)}
                    </Text>
                    {!!item.dateCommande && (
                      <Text style={{ color: theme.muted, marginTop: 2 }} numberOfLines={1}>
                        {item.dateCommande}
                      </Text>
                    )}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ color: theme.text, fontWeight: '900' }}>{formatThousands(Number(item.total) || 0)}</Text>
                    <Text style={{ color: theme.muted, marginTop: 2 }}>Payé: {formatThousands(Number(item.montantPaye) || 0)}</Text>
                  </View>
                </View>

                <View style={{ marginTop: 10 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: theme.muted, fontWeight: '700' }}>% Reçu</Text>
                    <Text style={{ color: theme.muted, fontWeight: '700' }}>{received.toFixed(0)}%</Text>
                  </View>
                  <View style={{ height: 10, borderRadius: 999, overflow: 'hidden', backgroundColor: theme.isDark ? '#111827' : '#f3f4f6', marginTop: 6 }}>
                    <View style={{ width: `${received}%`, height: 10, backgroundColor: received >= 100 ? theme.success : theme.primary }} />
                  </View>
                </View>

                <View style={{ marginTop: 10 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: theme.muted, fontWeight: '700' }}>% Payé</Text>
                    <Text style={{ color: theme.muted, fontWeight: '700' }}>{paid.toFixed(0)}%</Text>
                  </View>
                  <View style={{ height: 10, borderRadius: 999, overflow: 'hidden', backgroundColor: theme.isDark ? '#111827' : '#f3f4f6', marginTop: 6 }}>
                    <View style={{ width: `${paid}%`, height: 10, backgroundColor: paid >= 100 ? theme.success : theme.primary }} />
                  </View>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 10 }}>
                  <MaterialCommunityIcons name="dots-horizontal" size={20} color={theme.muted} />
                  <Text style={{ color: theme.muted, marginLeft: 6, fontWeight: '700' }}>Actions</Text>
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={{ paddingHorizontal: 16, paddingTop: 20 }}>
              <Text style={{ color: theme.muted }}>Aucune commande trouvée.</Text>
            </View>
          }
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
