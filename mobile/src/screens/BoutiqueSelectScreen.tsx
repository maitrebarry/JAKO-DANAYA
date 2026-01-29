import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, FlatList } from 'react-native';
import { fetchBoutiques } from '../services/auth';
import { useApp } from '../store/AppContext';

export default function BoutiqueSelectScreen() {
  const { token, setBoutiqueId } = useApp();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!token) return;
      try {
        setLoading(true);
        const data = await fetchBoutiques(token);
        if (!mounted) return;
        setItems(data || []);
        if ((data || []).length === 1) {
          setBoutiqueId(data[0].id);
        }
      } catch (e: any) {
        if (!mounted) return;
        setError(e.message || 'Erreur');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [token]);

  return (
    <View style={{ flex: 1, padding: 24 }}>
      <Text style={{ fontSize: 22, fontWeight: '700', marginBottom: 8 }}>Sélection boutique</Text>
      <Text style={{ marginBottom: 16, color: '#666' }}>Choisissez votre boutique</Text>

      {loading && <ActivityIndicator />}
      {error ? <Text style={{ color: '#c0392b', marginBottom: 12 }}>{error}</Text> : null}

      {!loading && items.length === 0 ? (
        <Text style={{ color: '#666' }}>Aucune boutique disponible</Text>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setBoutiqueId(item.id)}
              style={{ padding: 14, borderWidth: 1, borderColor: '#eee', borderRadius: 10, marginBottom: 10 }}
            >
              <Text style={{ fontWeight: '600' }}>{item.nom || 'Boutique'}</Text>
              {item?.pays?.nom ? <Text style={{ color: '#666' }}>{item.pays.nom}</Text> : null}
            </Pressable>
          )}
        />
      )}
    </View>
  );
}
