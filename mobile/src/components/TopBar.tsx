import React, { useEffect, useState } from 'react';
import { SafeAreaView, View, Text, Pressable, Image } from 'react-native';
import { useTheme } from '../theme';
import { useApp } from '../store/AppContext';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { API_BASE_URL } from '../utils/env';
import { resolveMediaUrl } from '../utils/urls';

export default function TopBar({ showBack = false }: { showBack?: boolean }) {
  const { profile, token, boutiqueId, themePref, setThemePref } = useApp();
  const navigation = useNavigation<any>();
  const theme = useTheme();
  const isDark = (theme as any).isDark;
  const bg = theme.background;
  const textColor = theme.primary;
  const subText = theme.muted;

  const [unread, setUnread] = useState<number>(0);
  const [boutiqueName, setBoutiqueName] = useState<string | null>(profile?.boutique?.nom || null);

  const loadUnread = async () => {
    try {
      if (!token) return;
      const res = await fetch(`${API_BASE_URL}/api/notifications`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setUnread(Array.isArray(data) ? data.length : 0);
      }
    } catch (e) { /* ignore */ }
  };

  const loadBoutique = async () => {
    try {
      if (profile?.boutique?.nom) return; // already have
      const id = boutiqueId || profile?.boutique?.id;
      if (!id || !token) return;
      const res = await fetch(`${API_BASE_URL}/api/boutiques/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setBoutiqueName(data?.nom || null);
      }
    } catch (e) { /* ignore */ }
  };

  useEffect(() => { loadUnread(); loadBoutique(); }, [profile, token, boutiqueId]);

  useEffect(() => {
    // keep boutiqueName in sync when profile changes
    if (profile?.boutique?.nom) setBoutiqueName(profile.boutique.nom);
  }, [profile]);

  // debug helper
  useEffect(() => { try { console.log('TOPBAR PROFILE', { profile, boutiqueId, boutiqueName, unread }); } catch (e) {} }, [profile, boutiqueId, boutiqueName, unread]);

  const rawAvatar = profile?.photoUrl || profile?.photo || profile?.avatar || null;
  const avatarUri = rawAvatar ? resolveMediaUrl(rawAvatar) : '';
  const avatarSource = avatarUri ? ({ uri: avatarUri } as any) : require('../assets/logo.png');

  return (
    <SafeAreaView style={{ backgroundColor: bg }}>
      <View style={{ padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: isDark ? '#1f2937' : '#eee', backgroundColor: 'transparent' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {showBack && (
            <Pressable onPress={() => navigation.goBack()} style={{ marginRight: 12 }} hitSlop={{ top: 10, left: 10, right: 10, bottom: 10 }}>
              <Ionicons name="arrow-back" size={24} color={textColor} />
            </Pressable>
          )}
          {!showBack && (
            <View>
              <Text style={{ fontWeight: '800', fontSize: 18, color: textColor }}>{boutiqueName || profile?.boutique?.nom || 'Boutique'}</Text>
              <Text style={{ color: subText, marginTop: 4 }}>Bonjour {profile?.prenom || profile?.nom || 'Utilisateur'}</Text>
            </View>
          )}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={() => navigation.navigate('Notifications')} style={{ marginRight: 12 }}>
            <View>
              <Ionicons name="notifications-outline" size={26} color={textColor} />
              {unread > 0 && (
                <View style={{ position: 'absolute', right: -6, top: -6, backgroundColor: '#ef4444', borderRadius: 8, paddingHorizontal: 4, paddingVertical: 1 }}>
                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{unread}</Text>
                </View>
              )}
            </View>
          </Pressable>

          {/* Theme toggle (sun/moon) */}
          <Pressable
            onPress={() => { console.log('THEME_PRESSED'); try { const next = (themePref === 'dark' ? 'light' : 'dark'); setThemePref(next); console.log('THEME_TOGGLE', next); } catch (e) { console.warn('THEME_TOGGLE_FAILED', e); } }}
            style={{ marginRight: 12, padding: 6 }}
            hitSlop={{ top: 10, left: 10, right: 10, bottom: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Basculer le thème"
          >
            <Ionicons name={isDark ? 'moon' : 'sunny'} size={22} color={textColor} />
          </Pressable>

          <Pressable onPress={() => navigation.navigate('Profil', { openAvatarPicker: true }) }>
            <Image
              key={avatarUri || 'logo'}
              source={avatarSource}
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#e5e7eb' }}
            />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
