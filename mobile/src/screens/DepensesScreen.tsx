import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { useApp } from '../store/AppContext';
import { useAccess } from '../utils/access';
import { listDepenses, type DepenseDTO } from '../services/depenses';
import { showError } from '../utils/notify';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';

function fmtMoney(n: number | null | undefined, devise?: string) {
  if (n == null) return '—';
  const v = Math.trunc(Number(n) || 0);
  const out = String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return out + (devise ? ` ${devise}` : '');
}

export default function DepensesScreen() {
  const theme = useTheme();
  const { token, boutiqueId } = useApp();
  const access = useAccess();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<DepenseDTO[]>([]);
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const list = await listDepenses({ boutiqueId: boutiqueId ? Number(boutiqueId) : undefined, token });
      setItems(Array.isArray(list) ? list : []);
    } catch (e: any) {
      showError('Erreur', e?.message || 'Impossible de charger les dépenses');
    } finally {
      setLoading(false);
    }
  }, [token, boutiqueId]);

  useFocusEffect(
    useCallback(() => {
      if (!access.depenses) return;
      load();
    }, [access.depenses, load])
  );

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return items;
    return (items || []).filter((d) => {
      const ref = String(d.reference || '').toLowerCase();
      const lib = String(d.libelle || '').toLowerCase();
      const st = String(d.status || '').toLowerCase();
      return ref.includes(qq) || lib.includes(qq) || st.includes(qq);
    });
  }, [items, q]);

  if (!token) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
        <Text style={{ color: theme.text }}>Non authentifié</Text>
      </View>
    );
  }

  if (!access.depenses) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background, padding: 16 }}>
        <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text }}>Dépenses</Text>
        <Text style={{ marginTop: 8, color: theme.muted, textAlign: 'center' }}>
          Vous n'avez pas la permission d'accéder à cet écran.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ padding: 14 }}>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <View style={{ flex: 1, backgroundColor: theme.surface, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }}>
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Rechercher (réf, libellé, statut)"
              placeholderTextColor={theme.muted}
              style={{ color: theme.text }}
            />
          </View>
          <Pressable
            onPress={load}
            style={{ backgroundColor: theme.primary, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12 }}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <MaterialCommunityIcons name="refresh" size={20} color="#fff" />}
          </Pressable>
        </View>

        {access.depensesCreate ? (
          <Pressable
            onPress={() => {
              navigation.navigate('DepenseForm', { mode: 'create' });
            }}
            style={{ marginTop: 10, backgroundColor: '#16a34a', paddingVertical: 12, borderRadius: 12, alignItems: 'center' }}
          >
            <Text style={{ color: '#fff', fontWeight: '900' }}>Nouvelle dépense</Text>
          </Pressable>
        ) : null}
      </View>

      <FlatList
        contentContainerStyle={{ padding: 14, paddingBottom: 24 }}
        data={filtered}
        keyExtractor={(it) => String(it.id)}
        ListEmptyComponent={!loading ? <Text style={{ color: theme.muted, textAlign: 'center' }}>Aucune dépense</Text> : null}
        renderItem={({ item }) => {
          const status = String(item.status || '').toUpperCase();
          const statusColor = status === 'VALIDEE' ? '#16a34a' : status === 'REJETEE' ? '#dc2626' : status === 'ANNULEE' ? '#6b7280' : '#f59e0b';
          return (
            <Pressable
              onPress={() => navigation.navigate('DepenseDetail', { id: item.id })}
              style={{ backgroundColor: theme.card, padding: 12, borderRadius: 14, marginBottom: 10, borderWidth: 1, borderColor: theme.isDark ? '#1f2937' : '#e5e7eb' }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: theme.text, fontWeight: '900' }}>{item.reference || `Dépense #${item.id}`}</Text>
                <View style={{ backgroundColor: statusColor, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }}>
                  <Text style={{ color: '#fff', fontWeight: '900', fontSize: 12 }}>{status || '—'}</Text>
                </View>
              </View>
              {!!item.libelle && <Text style={{ color: theme.muted, marginTop: 6 }}>{item.libelle}</Text>}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
                <Text style={{ color: theme.muted }}>Montant</Text>
                <Text style={{ color: theme.text, fontWeight: '900' }}>{fmtMoney(item.montant, item.deviseSymbole)}</Text>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}
