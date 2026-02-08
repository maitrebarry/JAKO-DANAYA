import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, Modal, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const isDark = (theme as any).isDark;
  const bg = theme.background;
  const textColor = theme.primary;
  const subText = theme.muted;

  const [menuOpen, setMenuOpen] = useState(false);

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
    if (!token) return;
    const t = setInterval(() => {
      loadUnread();
    }, 25000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    // keep boutiqueName in sync when profile changes
    if (profile?.boutique?.nom) setBoutiqueName(profile.boutique.nom);
  }, [profile]);

  const drawerWidth = useMemo(() => Math.min(320, Math.max(260, Math.round(windowWidth * 0.78))), [windowWidth]);
  const drawerX = useRef(new Animated.Value(-drawerWidth)).current;
  useEffect(() => {
    // keep drawer hidden when width changes
    drawerX.setValue(menuOpen ? 0 : -drawerWidth);
  }, [drawerWidth]);

  useEffect(() => {
    Animated.timing(drawerX, {
      toValue: menuOpen ? 0 : -drawerWidth,
      duration: menuOpen ? 220 : 180,
      useNativeDriver: true,
    }).start();
  }, [menuOpen, drawerWidth, drawerX]);

  const rawAvatar = profile?.photoUrl || profile?.photo || profile?.avatar || null;
  const avatarUri = rawAvatar ? resolveMediaUrl(rawAvatar) : '';
  const avatarSource = avatarUri ? ({ uri: avatarUri } as any) : require('../assets/logo.png');

  const barHeight = 56;
  const borderColor = isDark ? '#1f2937' : '#e5e7eb';

  const closeMenu = () => setMenuOpen(false);

  const menuItem = (opts: { label: string; icon: any; onPress: () => void }) => (
    <Pressable
      onPress={opts.onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 10,
        borderRadius: 14,
        backgroundColor: theme.surface,
        borderWidth: 1,
        borderColor,
        marginBottom: 10,
      }}
    >
      <Ionicons name={opts.icon} size={20} color={theme.text} />
      <Text style={{ color: theme.text, fontWeight: '900', marginLeft: 10 }}>{opts.label}</Text>
    </Pressable>
  );

  return (
    <View style={{ backgroundColor: bg, paddingTop: insets.top, borderBottomWidth: 1, borderBottomColor: borderColor }}>
      <View style={{ height: barHeight, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 10 }}>
          {showBack ? (
            <Pressable
              onPress={() => navigation.goBack()}
              style={{ marginRight: 12, padding: 6, borderRadius: 999 }}
              hitSlop={{ top: 10, left: 10, right: 10, bottom: 10 }}
            >
              <Ionicons name="arrow-back" size={22} color={textColor} />
            </Pressable>
          ) : (
            <Pressable
              onPress={() => setMenuOpen(true)}
              style={{ marginRight: 10, padding: 6, borderRadius: 12, backgroundColor: theme.surface, borderWidth: 1, borderColor }}
              hitSlop={{ top: 10, left: 10, right: 10, bottom: 10 }}
            >
              <Ionicons name="menu" size={20} color={theme.text} />
            </Pressable>
          )}

          {!showBack ? (
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '900', fontSize: 17, color: theme.text }} numberOfLines={1}>
                {boutiqueName || profile?.boutique?.nom || 'Boutique'}
              </Text>
              <Text style={{ color: subText, marginTop: 2 }} numberOfLines={1}>
                Bonjour {profile?.prenom || profile?.nom || 'Utilisateur'}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={() => navigation.navigate('Notifications')} style={{ marginRight: 10, padding: 6 }}>
            <View>
              <Ionicons name="notifications-outline" size={24} color={textColor} />
              {unread > 0 && (
                <View style={{ position: 'absolute', right: -6, top: -6, backgroundColor: '#ef4444', borderRadius: 999, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: '900' }}>{unread}</Text>
                </View>
              )}
            </View>
          </Pressable>

          <Pressable
            onPress={() => {
              const next = themePref === 'dark' ? 'light' : 'dark';
              setThemePref(next);
            }}
            style={{ marginRight: 10, padding: 6 }}
            hitSlop={{ top: 10, left: 10, right: 10, bottom: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Basculer le thème"
          >
            <Ionicons name={isDark ? 'moon' : 'sunny'} size={20} color={textColor} />
          </Pressable>

          <Pressable
            onPress={() => navigation.navigate('Profil')}
            onLongPress={() => navigation.navigate('Profil', { openAvatarPicker: true })}
            delayLongPress={350}
            hitSlop={{ top: 8, left: 8, right: 8, bottom: 8 }}
          >
            <Image
              key={avatarUri || 'logo'}
              source={avatarSource}
              style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#e5e7eb', borderWidth: 1, borderColor }}
            />
          </Pressable>
        </View>
      </View>

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={closeMenu}>
        <Pressable onPress={closeMenu} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', flexDirection: 'row' }}>
          <Animated.View
            style={{
              width: drawerWidth,
              transform: [{ translateX: drawerX }],
              backgroundColor: theme.card,
              borderRightWidth: 1,
              borderRightColor: borderColor,
              paddingTop: Math.max(12, insets.top),
              paddingHorizontal: 16,
              paddingBottom: 16,
            }}
          >
            <Pressable onPress={() => {}} style={{}}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ color: theme.text, fontWeight: '900', fontSize: 16 }}>Menu</Text>
                <Pressable onPress={closeMenu} hitSlop={12} style={{ padding: 6 }}>
                  <Ionicons name="close" size={20} color={theme.text} />
                </Pressable>
              </View>

              <View style={{ marginTop: 14, backgroundColor: theme.surface, borderRadius: 16, padding: 12, borderWidth: 1, borderColor }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Image source={avatarSource} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#e5e7eb' }} />
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text style={{ color: theme.text, fontWeight: '900' }} numberOfLines={1}>
                      {profile?.prenom || profile?.nom || 'Utilisateur'}
                    </Text>
                    <Text style={{ color: theme.muted, marginTop: 2 }} numberOfLines={1}>
                      {boutiqueName || profile?.boutique?.nom || 'Boutique'}
                    </Text>
                  </View>
                </View>
              </View>

              <Text style={{ color: theme.muted, fontWeight: '900', marginTop: 14, marginBottom: 8 }}>Général</Text>

              {menuItem({
                label: 'Configuration',
                icon: 'settings-outline',
                onPress: () => {
                  closeMenu();
                  navigation.navigate('ConfigurationHome');
                },
              })}

              {menuItem({
                label: 'Documentation',
                icon: 'book-outline',
                onPress: () => {
                  closeMenu();
                  navigation.navigate('Documentation');
                },
              })}

              {menuItem({
                label: 'Profil',
                icon: 'person-outline',
                onPress: () => {
                  closeMenu();
                  navigation.navigate('Profil');
                },
              })}
            </Pressable>
          </Animated.View>

          <View style={{ flex: 1 }} />
        </Pressable>
      </Modal>
    </View>
  );
}
