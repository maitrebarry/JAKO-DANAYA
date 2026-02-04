import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { useApp } from '../store/AppContext';
import { showError } from '../utils/notify';
import { MaterialIcons } from '@expo/vector-icons';

export default function NotificationsScreen() {
  const { token } = useApp();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<any[]>([]);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL_LOCAL || ''}/api/notifications`, { headers: { Authorization: `Bearer ${token}` } });
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

  const markRead = async (id:number) => {
    if (!token) return;
    try {
      const res = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL_LOCAL || ''}/api/notifications/${id}/read`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) load(); else showError('Erreur', 'Impossible de marquer comme lu');
    } catch (e:any) { showError('Erreur', e?.message || 'Erreur réseau'); }
  };

  if (loading) return <View style={{ flex:1, justifyContent:'center', alignItems:'center' }}><ActivityIndicator /></View>;

  return (
    <View style={{ flex:1, padding: 12 }}>
      <Text style={{ fontWeight: '800', fontSize: 18, marginBottom: 12 }}>Notifications</Text>
      {items.length === 0 ? <Text style={{ color: '#666' }}>Aucune notification non lue</Text> : (
        <FlatList
          data={items}
          keyExtractor={(it)=>(String(it.id))}
          renderItem={({item}) => (
            <View style={{ padding: 12, backgroundColor: '#fff', borderRadius: 8, marginBottom: 8 }}>
              <Text style={{ fontWeight: '700' }}>{item.title || item.type || 'Notification'}</Text>
              <Text style={{ color: '#666', marginTop: 6 }}>{item.message || item.payload || JSON.stringify(item.data || {})}</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
                <Pressable onPress={() => markRead(item.id)} style={{ padding: 8 }}>
                  <MaterialIcons name="done" size={20} color="#059669" />
                </Pressable>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}
