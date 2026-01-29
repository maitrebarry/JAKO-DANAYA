import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { fetchCurrentUser } from '../services/auth';
import { useApp } from '../store/AppContext';

export default function ProfilScreen() {
  const { token, setToken, setBoutiqueId } = useApp();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!token) return;
      try {
        setLoading(true);
        const data = await fetchCurrentUser(token);
        if (!mounted) return;
        setProfile(data?.user || data);
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

  const logout = () => {
    setToken(null);
    setBoutiqueId(null);
  };

  return (
    <View style={{ flex: 1, padding: 24 }}>
      <Text style={{ fontSize: 22, fontWeight: '700', marginBottom: 12 }}>Profil</Text>

      {loading && <ActivityIndicator />}
      {error ? <Text style={{ color: '#c0392b', marginBottom: 12 }}>{error}</Text> : null}

      {!loading && profile && (
        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontWeight: '600' }}>{profile.prenom} {profile.nom}</Text>
          <Text style={{ color: '#666' }}>{profile.email}</Text>
        </View>
      )}

      <Pressable
        onPress={logout}
        style={{ backgroundColor: '#ef4444', padding: 12, borderRadius: 8, alignItems: 'center' }}
      >
        <Text style={{ color: '#fff', fontWeight: '600' }}>Déconnexion</Text>
      </Pressable>
    </View>
  );
}
