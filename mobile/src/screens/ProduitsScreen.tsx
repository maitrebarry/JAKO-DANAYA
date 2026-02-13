import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, Image, Pressable, TextInput, ActivityIndicator, RefreshControl } from 'react-native';
import { useApp } from '../store/AppContext';
import { fetchProduits } from '../services/produit';
import { useTheme } from '../theme';
import { resolveMediaUrl } from '../utils/urls';
import { Ionicons } from '@expo/vector-icons';
import { useAccess } from '../utils/access';
import { showInfo } from '../utils/notify';
import { useFormatMoney } from '../utils/currency';

export default function ProduitsScreen({ navigation, route }: any) {
  const { token } = useApp();
  const theme = useTheme();
  const access = useAccess();
  const fmtMoney = useFormatMoney();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState(route.params?.q || '');
  const [items, setItems] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [sortBy, setSortBy] = useState<'name'|'stock'|'price'>('name');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  const load = useCallback(async () => {
    if (!access.produits) {
      setItems([]);
      setFiltered([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      setLoading(true);
      const res = await fetchProduits(token as string);
      setItems(res || []);
      setFiltered(res || []);
    } catch (e:any) {
      console.warn('fetch produits', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, access.produits]);

  useEffect(() => { load(); }, [load]);

  // Reload list when screen gains focus to reflect creations/edits/deletes
  const { useFocusEffect } = require('@react-navigation/native');
  useFocusEffect(
    React.useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    const term = (q || '').toString().toLowerCase().trim();
    let f = items.slice();
    if (term) {
      f = f.filter(it => (it.nomProduit || '').toString().toLowerCase().includes(term) || (it.caracteristique || '').toString().toLowerCase().includes(term));
    }
    if (lowStockOnly) {
      f = f.filter(it => (it.alerteStock != null) && (Number(it.quantiteInitialeConditionnements || 0) <= Number(it.alerteStock || 0)) );
    }
    if (sortBy === 'name') f.sort((a: any, b: any) => String(a.nomProduit || '').localeCompare(String(b.nomProduit || '')));
    if (sortBy === 'stock') f.sort((a: any, b: any) => (Number(b.quantiteInitialeConditionnements || 0) - Number(a.quantiteInitialeConditionnements || 0)));
    if (sortBy === 'price') f.sort((a: any, b: any) => (Number(b.prixDetail || 0) - Number(a.prixDetail || 0)));
    setFiltered(f);
  }, [q, items, sortBy, lowStockOnly]);

  const onRefresh = () => { setRefreshing(true); load(); };

  if (!access.produits) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center', padding: 16 }}>
        <Text style={{ color: theme.text, fontSize: 18, fontWeight: '800' }}>Produits</Text>
        <Text style={{ color: theme.muted, marginTop: 8, textAlign: 'center' }}>
          Vous n'avez pas la permission de voir les produits.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ padding: 12, gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name="search" size={20} color={theme.muted} />
          <TextInput placeholder="Rechercher produit" placeholderTextColor={theme.muted} style={{ flex: 1, color: theme.text }} value={q} onChangeText={setQ} />
          {access.produitsCreate ? (
            <Pressable onPress={() => navigation.navigate('ProductForm', { mode: 'create' })} style={{ marginLeft: 8, padding: 8, backgroundColor: theme.primary, borderRadius: 8 }}>
              <Text style={{ color: '#fff' }}>Ajouter</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => {
              if (!access.produits && !access.produitsCreate) {
                showInfo('Permission', "Vous n'avez pas accès aux produits.");
                return;
              }
              console.log('BARCODE_PRESS');
              navigation.navigate('BarcodeScanner');
            }}
            style={{
              marginLeft: 8,
              paddingHorizontal: 10,
              paddingVertical: 8,
              backgroundColor: theme.surface,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: theme.primary,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
            hitSlop={{ top: 8, left: 8, right: 8, bottom: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Scanner code-barres"
          >
            <Ionicons name="barcode" size={18} color={theme.primary} />
            <Text style={{ color: theme.primary, fontWeight: '800' }}>Scanner</Text>
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          <Pressable onPress={() => setSortBy('name')} style={{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: sortBy === 'name' ? theme.primary : theme.surface, borderRadius: 8 }}>
            <Text style={{ color: sortBy === 'name' ? '#fff' : theme.text }}>A→Z</Text>
          </Pressable>
          <Pressable onPress={() => setSortBy('stock')} style={{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: sortBy === 'stock' ? theme.primary : theme.surface, borderRadius: 8 }}>
            <Text style={{ color: sortBy === 'stock' ? '#fff' : theme.text }}>Stock</Text>
          </Pressable>
          <Pressable onPress={() => setSortBy('price')} style={{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: sortBy === 'price' ? theme.primary : theme.surface, borderRadius: 8 }}>
            <Text style={{ color: sortBy === 'price' ? '#fff' : theme.text }}>Prix</Text>
          </Pressable>
          <Pressable onPress={() => setLowStockOnly(s => !s)} style={{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: lowStockOnly ? '#f97316' : theme.surface, borderRadius: 8 }}>
            <Text style={{ color: lowStockOnly ? '#fff' : theme.text }}>Faible stock</Text>
          </Pressable>
        </View>
      </View>

      {loading ? <ActivityIndicator style={{ marginTop: 20 }} color={theme.primary} /> : (
        <FlatList
          data={filtered}
          keyExtractor={(it:any) => String(it.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.primary]} />}
          renderItem={({ item }) => (
            <Pressable onPress={() => navigation.navigate('ProductDetail', { id: item.id })} style={{ flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: theme.surface, margin: 8, borderRadius: 8 }}>
              {item.productImage ? (
                (() => {
                  const imgUrl = resolveMediaUrl(item.productImage);
                  console.debug('Product image URL:', imgUrl);
                  return <Image source={{ uri: imgUrl }} style={{ width: 64, height: 64, borderRadius: 6, marginRight: 12 }} />;
                })()
              ) : <View style={{ width: 64, height: 64, borderRadius: 6, backgroundColor: theme.background, marginRight: 12 }} />}
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.text, fontWeight: '700' }}>{item.nomProduit}</Text>
                <Text style={{ color: theme.muted, marginTop: 6 }}>{item.prixDetail != null ? fmtMoney(item.prixDetail) : ''}</Text>
              </View>
              <View>
                <Text style={{ color: theme.muted }}>{item.quantiteInitialeConditionnements ?? '—'}</Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}
