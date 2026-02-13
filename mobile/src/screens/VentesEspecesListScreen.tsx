import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  SafeAreaView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../theme';
import { useApp } from '../store/AppContext';
import { useAccess } from '../utils/access';
import { showError } from '../utils/notify';
import { useFormatMoney } from '../utils/currency';
import {
  fetchHistoriqueVentesEspeces,
  type HistoriqueVenteEspeceItem,
} from '../services/ventesEspeces';
import type { RootStackParamList } from '../navigation/RootNavigator';

function formatDateShort(d: any) {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d);
  return dt.toLocaleString('fr-FR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function VentesEspecesListScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { token, boutiqueId } = useApp();
  const access = useAccess();
  const fmtMoney = useFormatMoney();

  const [items, setItems] = useState<HistoriqueVenteEspeceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    if (!token || !boutiqueId) return;
    if (!access.ventes) return;

    try {
      setLoading(true);
      const data = await fetchHistoriqueVentesEspeces(boutiqueId, token);
      // Only keep 'VENTE' items (backend currently returns only those, but keep safe)
      const normalized = (data || []).filter((it: any) => (it?.type || 'VENTE') === 'VENTE');
      setItems(normalized as any);
    } catch (e: any) {
      showError('Erreur', e?.message || 'Impossible de charger la liste');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, boutiqueId, access.ventes]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return items;
    return (items || []).filter((it) => {
      const hay = [it.reference, it.client, it.responsable, it.dateIso, it.date]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(query);
    });
  }, [items, q]);

  const onRefresh = () => {
    if (!token || !boutiqueId) return;
    if (!access.ventes) return;
    setRefreshing(true);
    load();
  };

  if (!token) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Non authentifié</Text>
      </View>
    );
  }

  if (!access.ventes) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background, padding: 16 }}>
        <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text }}>Ventes en espèces</Text>
        <Text style={{ marginTop: 8, color: theme.muted, textAlign: 'center' }}>
          Vous n'avez pas la permission d'accéder à cette liste.
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ padding: 16, paddingBottom: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: '900' }}>Ventes en espèces</Text>
          {access.ventesCreate ? (
            <Pressable
              onPress={() => navigation.navigate('VenteEspece')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: theme.primary,
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderRadius: 12,
              }}
            >
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '800', marginLeft: 6 }}>Nouvelle</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center' }}>
          <View
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: theme.surface,
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderWidth: 1,
              borderColor: theme.isDark ? '#1f2937' : '#e5e7eb',
            }}
          >
            <Ionicons name="search" size={18} color={theme.muted} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Rechercher (client, ref, responsable...)"
              placeholderTextColor={theme.muted}
              style={{ flex: 1, marginLeft: 8, color: theme.text }}
              autoCapitalize="none"
            />
            {q ? (
              <Pressable onPress={() => setQ('')} hitSlop={10}>
                <Ionicons name="close-circle" size={18} color={theme.muted} />
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>

      {loading ? <ActivityIndicator style={{ marginTop: 10 }} color={theme.primary} /> : null}

      <FlatList
        data={filtered}
        keyExtractor={(it) => String(it.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.primary]} />}
        contentContainerStyle={{ padding: 16, paddingTop: 6, paddingBottom: 24 }}
        renderItem={({ item }) => {
          const dateLabel = formatDateShort(item.dateIso || item.date);
          const title = item.client || 'Client';
          const subtitle = [dateLabel, item.responsable].filter(Boolean).join(' · ');
          const amount = fmtMoney(item.montant);

          return (
            <Pressable
              onPress={() => navigation.navigate('VenteEspeceDetail', { id: item.id })}
              style={{
                backgroundColor: theme.card,
                borderRadius: 14,
                padding: 12,
                marginBottom: 10,
                borderWidth: 1,
                borderColor: theme.isDark ? '#1f2937' : '#e5e7eb',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    backgroundColor: theme.surface,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                  }}
                >
                  <MaterialCommunityIcons name="cash" size={20} color={theme.primary} />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.text, fontWeight: '900' }} numberOfLines={1}>
                    {title}
                  </Text>
                  <Text style={{ color: theme.muted, marginTop: 2 }} numberOfLines={1}>
                    {subtitle || '—'}
                  </Text>
                  {item.reference ? (
                    <Text style={{ color: theme.muted, marginTop: 4 }} numberOfLines={1}>
                      Ref caisse: {item.reference}
                    </Text>
                  ) : null}
                </View>

                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: theme.text, fontWeight: '900' }}>{amount}</Text>
                  <Ionicons name="chevron-forward" size={18} color={theme.muted} style={{ marginTop: 6 }} />
                </View>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={{ paddingHorizontal: 16, marginTop: 20 }}>
            <Text style={{ color: theme.muted, textAlign: 'center' }}>
              {q ? 'Aucun résultat.' : 'Aucune vente trouvée.'}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
