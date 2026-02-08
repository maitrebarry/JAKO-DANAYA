import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../store/AppContext';
import { showError } from '../utils/notify';
import { MaterialIcons } from '@expo/vector-icons';
import { API_BASE_URL } from '../utils/env';
import { useTheme } from '../theme';

export default function NotificationsScreen() {
  const { token } = useApp();
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<any[]>([]);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/notifications`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setItems(Array.isArray(data) ? data : []);
      } else {
        const t = await res.text().catch(()=>'');
        showError('Erreur', t || 'Impossible de charger les notifications');
      }
    } catch (e:any) {
      showError('Erreur', e?.message || 'Erreur réseau');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [token])
  );

  const markRead = async (id:number) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/notifications/${id}/read`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) load(); else showError('Erreur', 'Impossible de marquer comme lu');
    } catch (e:any) { showError('Erreur', e?.message || 'Erreur réseau'); }
  };

  if (loading) return <View style={{ flex:1, justifyContent:'center', alignItems:'center', backgroundColor: theme.background }}><ActivityIndicator /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: theme.background, padding: 16 }}>
      {items.length === 0 ? (
        <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: theme.isDark ? '#1f2937' : '#e5e7eb' }}>
          <Text style={{ color: theme.text, fontWeight: '900' }}>Notifications</Text>
          <Text style={{ color: theme.muted, marginTop: 6 }}>Aucune notification non lue</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => String(it.id)}
          contentContainerStyle={{ paddingBottom: 12 }}
          renderItem={({ item }) => (
            <View
              style={{
                padding: 12,
                backgroundColor: theme.card,
                borderRadius: 16,
                marginBottom: 10,
                borderWidth: 1,
                borderColor: theme.isDark ? '#1f2937' : '#e5e7eb',
              }}
            >
              <Text style={{ fontWeight: '900', color: theme.text }} numberOfLines={1}>
                {item.title || item.type || 'Notification'}
              </Text>
              <Text style={{ color: theme.muted, marginTop: 6 }}>
                {item.message || item.payload || JSON.stringify(item.data || {})}
              </Text>
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
                <Pressable
                  onPress={() => markRead(item.id)}
                  style={{ paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.isDark ? '#1f2937' : '#e5e7eb' }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <MaterialIcons name="done" size={18} color={theme.success} />
                    <Text style={{ color: theme.text, fontWeight: '900', marginLeft: 6 }}>Marquer lu</Text>
                  </View>
                </Pressable>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}
