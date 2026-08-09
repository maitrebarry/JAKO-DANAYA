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
  const { profile, token, boutiqueId, themePref, setThemePref, setToken, setBoutiqueId, subscriptionStatus } = useApp();
  // Licence à vie (plan ACHAT) : la boutique n'a pas à gérer d'abonnement => on masque l'entrée de menu.
  const hasLifetimeSubscription = !!subscriptionStatus?.perpetual;
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

  // Retour tactile natif Android (effet "ripple") — ignoré automatiquement sur iOS.
  const rippleColor = isDark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.12)';
  const iconRipple = { color: rippleColor, borderless: true, radius: 24 };
  const surfaceRipple = { color: rippleColor, borderless: false };

  const closeMenu = () => setMenuOpen(false);

  const menuItem = (opts: { label: string; icon: any; onPress: () => void; danger?: boolean }) => {
    const tint = opts.danger ? theme.danger : theme.text;
    return (
      <Pressable
        onPress={opts.onPress}
        android_ripple={surfaceRipple}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 12,
          paddingHorizontal: 10,
          borderRadius: 14,
          backgroundColor: theme.surface,
          borderWidth: 1,
          borderColor: opts.danger ? theme.danger + '33' : borderColor,
          marginBottom: 10,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Ionicons name={opts.icon} size={20} color={tint} />
        <Text style={{ color: tint, fontWeight: '900', marginLeft: 10, flex: 1 }}>{opts.label}</Text>
        <Ionicons name="chevron-forward" size={16} color={opts.danger ? theme.danger : theme.muted} />
      </Pressable>
    );
  };

  const logout = () => {
    closeMenu();
    setToken(null);
    setBoutiqueId(null);
  };

  return (
    <View style={{ backgroundColor: bg, paddingTop: insets.top, borderBottomWidth: 1, borderBottomColor: borderColor }}>
      <View style={{ height: barHeight, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 10 }}>
          {showBack ? (
            <Pressable
              onPress={() => navigation.goBack()}
              android_ripple={iconRipple}
              style={{ marginRight: 12, padding: 6, borderRadius: 999 }}
              hitSlop={{ top: 10, left: 10, right: 10, bottom: 10 }}
            >
              <Ionicons name="arrow-back" size={22} color={textColor} />
            </Pressable>
          ) : (
            <Pressable
              onPress={() => setMenuOpen(true)}
              android_ripple={iconRipple}
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
          <Pressable onPress={() => navigation.navigate('Notifications')} android_ripple={iconRipple} style={{ marginRight: 10, padding: 6 }}>
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
            android_ripple={iconRipple}
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
            android_ripple={iconRipple}
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
                <Pressable onPress={closeMenu} android_ripple={iconRipple} hitSlop={12} style={{ padding: 6 }}>
                  <Ionicons name="close" size={20} color={theme.text} />
                </Pressable>
              </View>

              <Pressable
                onPress={() => {
                  closeMenu();
                  navigation.navigate('Profil');
                }}
                android_ripple={surfaceRipple}
                style={({ pressed }) => ({
                  marginTop: 14,
                  backgroundColor: theme.surface,
                  borderRadius: 16,
                  padding: 12,
                  borderWidth: 1,
                  borderColor,
                  opacity: pressed ? 0.85 : 1,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: isDark ? 0.3 : 0.06,
                  shadowRadius: 8,
                  elevation: 2,
                })}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Image source={avatarSource} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#e5e7eb', borderWidth: 1, borderColor }} />
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text style={{ color: theme.text, fontWeight: '900' }} numberOfLines={1}>
                      {profile?.prenom || profile?.nom || 'Utilisateur'}
                    </Text>
                    <Text style={{ color: theme.muted, marginTop: 2 }} numberOfLines={1}>
                      {boutiqueName || profile?.boutique?.nom || 'Boutique'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={theme.muted} />
                </View>
              </Pressable>

              <Text style={{ color: theme.muted, fontWeight: '900', marginTop: 18, marginBottom: 8, letterSpacing: 0.5 }}>GÉNÉRAL</Text>

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
                label: 'Rapports & Historique',
                icon: 'stats-chart-outline',
                onPress: () => {
                  closeMenu();
                  navigation.navigate('ReportsHome');
                },
              })}

              {!hasLifetimeSubscription && menuItem({
                label: 'Abonnement',
                icon: 'card-outline',
                onPress: () => {
                  closeMenu();
                  navigation.navigate('Subscription');
                },
              })}

              <Text style={{ color: theme.muted, fontWeight: '900', marginTop: 8, marginBottom: 8, letterSpacing: 0.5 }}>COMPTE</Text>

              {menuItem({
                label: 'Profil',
                icon: 'person-outline',
                onPress: () => {
                  closeMenu();
                  navigation.navigate('Profil');
                },
              })}

              {menuItem({
                label: 'Déconnexion',
                icon: 'log-out-outline',
                danger: true,
                onPress: logout,
              })}
            </Pressable>
          </Animated.View>

          <View style={{ flex: 1 }} />
        </Pressable>
      </Modal>
    </View>
  );
}
