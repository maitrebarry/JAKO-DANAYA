import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, Image, Pressable, TextInput, ActivityIndicator, RefreshControl } from 'react-native';
import { useApp } from '../store/AppContext';
import { fetchProduits } from '../services/produit';
import { useTheme } from '../theme';
import { Ionicons } from '@expo/vector-icons';

export default function ProduitsScreen({ navigation, route }: any) {
  const { token } = useApp();
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState(route.params?.q || '');
  const [items, setItems] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [sortBy, setSortBy] = useState<'name'|'stock'|'price'>('name');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [createMissingUnitsImport, setCreateMissingUnitsImport] = useState<boolean>(true);

  const load = useCallback(async () => {
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
  }, [token]);

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

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ padding: 12, gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name="search" size={20} color={theme.muted} />
          <TextInput placeholder="Rechercher produit" placeholderTextColor={theme.muted} style={{ flex: 1, color: theme.text }} value={q} onChangeText={setQ} />
          <Pressable onPress={() => navigation.navigate('ProductForm', { mode: 'create' })} style={{ marginLeft: 8, padding: 8, backgroundColor: theme.primary, borderRadius: 8 }}>
            <Text style={{ color: '#fff' }}>Ajouter</Text>
          </Pressable>
        <Pressable onPress={() => { console.log('BARCODE_PRESS'); navigation.navigate('BarcodeScanner'); }} style={{ marginLeft: 8, padding: 8, backgroundColor: theme.primary, borderRadius: 8, alignItems: 'center', justifyContent: 'center', width: 40, height: 40 }} hitSlop={{ top: 8, left: 8, right: 8, bottom: 8 }} accessibilityRole="button" accessibilityLabel="Scanner code-barres">
          <Ionicons name="barcode" size={20} color="#fff" />
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

      <View style={{ paddingHorizontal: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pressable onPress={() => setCreateMissingUnitsImport((s: boolean) => !s)} style={{ padding: 8, backgroundColor: createMissingUnitsImport ? '#10b981' : theme.surface, borderRadius: 8 }}>
            <Text style={{ color: createMissingUnitsImport ? '#fff' : theme.text }}>{createMissingUnitsImport ? 'Créer unités manquantes: Oui' : 'Créer unités manquantes: Non'}</Text>
          </Pressable>
          <Pressable onPress={async () => {
            try {
              // dynamic import document picker
              const dp = require('expo-document-picker');
              const res = await dp.getDocumentAsync({ type: '*/*' });
              if (res.type === 'success') {
                const blob = await fetch(res.uri).then(r => r.blob());
                const file = new File([blob], res.name);
                const job = await require('../services/produit').importProduitsAsync(file, token as string, createMissingUnitsImport);
                console.log('IMPORT_JOB', job);
                alert('Import lancé: job ' + (job.jobId || 'unknown'));
              }
            } catch (e:any) { alert('Import impossible: ' + (e.message || e)); }
          }} style={{ padding: 10, borderRadius: 8, backgroundColor: '#f59e0b', alignItems: 'center', marginBottom: 8 }}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>Importer depuis Excel</Text>
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
              {item.productImage ? <Image source={{ uri: item.productImage }} style={{ width: 64, height: 64, borderRadius: 6, marginRight: 12 }} /> : <View style={{ width: 64, height: 64, borderRadius: 6, backgroundColor: theme.background, marginRight: 12 }} />}
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.text, fontWeight: '700' }}>{item.nomProduit}</Text>
                <Text style={{ color: theme.muted, marginTop: 6 }}>{item.prixDetail ? `${item.prixDetail} FCFA` : ''}</Text>
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
