import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { useApp } from '../store/AppContext';
import { useAccess } from '../utils/access';
import { deleteUtilisationMouvement, listUtilisationPertes, type UtilisationMovementDTO } from '../services/utilisationPertes';
import { showError } from '../utils/notify';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';

export default function UtilisationPertesScreen() {
  const theme = useTheme();
  const { token, boutiqueId } = useApp();
  const access = useAccess();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<UtilisationMovementDTO[]>([]);
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const list = await listUtilisationPertes(token);
      const bid = boutiqueId ? Number(boutiqueId) : 0;
      const filtered = bid ? (list || []).filter((x) => Number((x as any)?.boutique?.id) === bid) : (list || []);
      setItems(filtered);
    } catch (e: any) {
      showError('Erreur', e?.message || 'Impossible de charger les utilisations / pertes');
    } finally {
      setLoading(false);
    }
  }, [token, boutiqueId]);

  useFocusEffect(
    useCallback(() => {
      if (!access.utilisationPertes) return;
      load();
    }, [access.utilisationPertes, load])
  );

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return items;
    return (items || []).filter((u) => {
      const motif = String((u as any).description || '').toLowerCase();
      const type = String(u.sousType || '').toLowerCase();
      const prod = String((u as any)?.produit?.nomProduit || (u as any)?.produit?.nom || '').toLowerCase();
      return motif.includes(qq) || type.includes(qq) || prod.includes(qq);
    });
  }, [items, q]);

  if (!token) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
        <Text style={{ color: theme.text }}>Non authentifié</Text>
      </View>
    );
  }

  if (!access.utilisationPertes) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background, padding: 16 }}>
        <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text }}>Utilisation / Pertes</Text>
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
              placeholder="Rechercher (motif, type, produit)"
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

        {access.utilisationPertesCreate ? (
          <Pressable
            onPress={() => navigation.navigate('UtilisationPertesForm', { mode: 'create' })}
            style={{ marginTop: 10, backgroundColor: '#16a34a', paddingVertical: 12, borderRadius: 12, alignItems: 'center' }}
          >
            <Text style={{ color: '#fff', fontWeight: '900' }}>Nouvelle utilisation/perte</Text>
          </Pressable>
        ) : null}
      </View>

      <FlatList
        contentContainerStyle={{ padding: 14, paddingBottom: 24 }}
        data={filtered}
        keyExtractor={(it) => String(it.id)}
        ListEmptyComponent={!loading ? <Text style={{ color: theme.muted, textAlign: 'center' }}>Aucune donnée</Text> : null}
        renderItem={({ item }) => {
          const type = String(item.sousType || '').toUpperCase();
          const badgeColor = type.includes('PERTE') ? '#dc2626' : '#2563eb';
          const produit = (item as any)?.produit?.nomProduit || (item as any)?.produit?.nom || '';
          return (
            <Pressable
              onPress={() => {
                if (!access.utilisationPertesModify && !access.utilisationPertesDelete) return;
                Alert.alert('Actions', produit || `#${item.id}`, [
                  access.utilisationPertesModify
                    ? {
                        text: 'Modifier',
                        onPress: () => navigation.navigate('UtilisationPertesForm', { mode: 'edit', mouvementId: item.id }),
                      }
                    : null,
                  access.utilisationPertesDelete
                    ? {
                        text: 'Supprimer',
                        style: 'destructive',
                        onPress: () => {
                          Alert.alert('Confirmer', 'Supprimer cette utilisation/perte ?', [
                            { text: 'Annuler', style: 'cancel' },
                            {
                              text: 'Supprimer',
                              style: 'destructive',
                              onPress: async () => {
                                try {
                                  await deleteUtilisationMouvement(item.id, token);
                                  await load();
                                } catch (e: any) {
                                  showError('Erreur', e?.message || 'Suppression échouée');
                                }
                              },
                            },
                          ]);
                        },
                      }
                    : null,
                  { text: 'Fermer', style: 'cancel' },
                ].filter(Boolean) as any);
              }}
              style={{ backgroundColor: theme.card, padding: 12, borderRadius: 14, marginBottom: 10, borderWidth: 1, borderColor: theme.isDark ? '#1f2937' : '#e5e7eb' }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: theme.text, fontWeight: '900' }} numberOfLines={1}>
                  {produit || `#${item.id}`}
                </Text>
                <View style={{ backgroundColor: badgeColor, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }}>
                  <Text style={{ color: '#fff', fontWeight: '900', fontSize: 12 }}>{type || '—'}</Text>
                </View>
              </View>
              {!!(item as any).description && <Text style={{ color: theme.muted, marginTop: 6 }}>{String((item as any).description)}</Text>}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
                <Text style={{ color: theme.muted }}>Quantité</Text>
                <Text style={{ color: theme.text, fontWeight: '900' }}>{item.quantite ?? '—'}</Text>
              </View>
              {!!item.dateMouvement && <Text style={{ color: theme.muted, marginTop: 6 }}>Date: {String(item.dateMouvement)}</Text>}
            </Pressable>
          );
        }}
      />
    </View>
  );
}
