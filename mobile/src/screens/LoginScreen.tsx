import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, ImageBackground, ScrollView, KeyboardAvoidingView, Platform, StatusBar } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { login, fetchCurrentUser, LoginError } from '../services/auth';
import { useApp } from '../store/AppContext';
import * as WebBrowser from 'expo-web-browser';
import { API_BASE_URL, OAUTH_REDIRECT_URL } from '../utils/env';
import { useResponsiveLayout } from '../utils/responsive';
import { getItem, removeItem, setItem } from '../utils/storage';

WebBrowser.maybeCompleteAuthSession();

const ACCENT = '#0ea5e9';
const PANEL_BG = '#14161a';
const MUTED = '#9ca3af';
const BORDER = '#2d2f36';
const LOGIN_LOCK_STORAGE_KEY = 'login_lock_until';

export default function LoginScreen() {
  const responsive = useResponsiveLayout();
  const navigation = useNavigation<any>();
  const goBackToSlides = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Onboarding');
  };
  const { setToken, setBoutiqueId } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [lockUntil, setLockUntil] = useState(0);
  const [lockSeconds, setLockSeconds] = useState(0);

  useEffect(() => {
    let mounted = true;
    getItem(LOGIN_LOCK_STORAGE_KEY).then((stored) => {
      if (!mounted) return;
      const until = Number(stored || 0);
      if (until > Date.now()) setLockUntil(until);
      else removeItem(LOGIN_LOCK_STORAGE_KEY);
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const refresh = () => {
      if (!lockUntil) {
        setLockSeconds(0);
        return;
      }
      const seconds = Math.max(0, Math.ceil((lockUntil - Date.now()) / 1000));
      setLockSeconds(seconds);
      if (seconds === 0) {
        setLockUntil(0);
        setRemainingAttempts(null);
        setError(null);
        removeItem(LOGIN_LOCK_STORAGE_KEY);
      }
    };
    refresh();
    const timer = setInterval(refresh, 1000);
    return () => clearInterval(timer);
  }, [lockUntil]);

  const onLogin = async () => {
    if (lockSeconds > 0) return;
    setError(null);
    if (!email || !password) {
      setError('Email et mot de passe requis');
      return;
    }
    try {
      setLoading(true);
      const res = await login(email.trim(), password);
      setRemainingAttempts(null);
      setLockUntil(0);
      await removeItem(LOGIN_LOCK_STORAGE_KEY);
      const token = res.token || res.accessToken;
      if (!token) throw new Error('Token manquant');
      setToken(token);

      // Auto-fetch profile to improve UX: if user already tied to a boutique, set it immediately
      try {
        const profile = await fetchCurrentUser(token);
        const inferred =
          profile?.currentBoutique?.id ??
          profile?.boutique?.id ??
          profile?.user?.currentBoutique?.id ??
          profile?.user?.boutique?.id ??
          null;
        if (inferred != null) setBoutiqueId(Number(inferred));
      } catch (e) {
        // Don't block login UX if profile fetch fails; the user will be asked to select boutique
      }

    } catch (e: any) {
      if (e instanceof LoginError) {
        if (e.status === 429) {
          const retrySeconds = Math.max(1, e.retryAfterSeconds || 180);
          const until = Date.now() + retrySeconds * 1000;
          setLockUntil(until);
          setRemainingAttempts(0);
          await setItem(LOGIN_LOCK_STORAGE_KEY, String(until));
        } else if (e.remainingAttempts !== null) {
          setRemainingAttempts(e.remainingAttempts);
        }
      }
      setError(e.message || 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  const loginLocked = lockSeconds > 0;
  const lockClock = `${String(Math.floor(lockSeconds / 60)).padStart(2, '0')}:${String(lockSeconds % 60).padStart(2, '0')}`;

  const onGoogleLogin = async () => {
    if (googleLoading) return;
    setError(null);
    try {
      setGoogleLoading(true);
      const base = String(API_BASE_URL || '').replace(/\/$/, '');
      const authUrl = base + '/oauth2/authorization/google';
      const returnUrl = OAUTH_REDIRECT_URL;

      const result = await WebBrowser.openAuthSessionAsync(authUrl, returnUrl);
      if (result.type !== 'success' || !('url' in result) || !result.url) {
        // cancelled/dismissed
        return;
      }

      const redirectedUrl = result.url;
      const params = new URL(redirectedUrl).searchParams;
      const oauthError = params.get('error');
      const token = params.get('token');

      if (oauthError) {
        const msg =
          oauthError === 'not_authorized' ? 'Compte non autorisé' :
          oauthError === 'account_disabled' ? 'Compte désactivé' :
          oauthError === 'missing_email' ? 'Email Google manquant' :
          'Connexion Google échouée';
        setError(msg);
        return;
      }

      if (!token) {
        setError('Token manquant (OAuth2)');
        return;
      }

      setToken(token);

      try {
        const profile = await fetchCurrentUser(token);
        const inferred =
          profile?.currentBoutique?.id ??
          profile?.boutique?.id ??
          profile?.user?.currentBoutique?.id ??
          profile?.user?.boutique?.id ??
          null;
        if (inferred != null) setBoutiqueId(Number(inferred));
      } catch (e) {
        // ignore
      }
    } catch (e: any) {
      setError(e?.message || 'Erreur connexion Google');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: PANEL_BG }}>
      <StatusBar barStyle="light-content" />

      <View style={{ height: responsive.isTablet ? '38%' : responsive.isCompact ? '35%' : '42%' }}>
        <ImageBackground source={require('../assets/onboarding/onboarding-ventes.jpg')} style={{ flex: 1 }} resizeMode="cover">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.18)' }} />
        </ImageBackground>

        <Pressable
          onPress={goBackToSlides}
          hitSlop={12}
          style={{ position: 'absolute', top: 50, left: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'android' ? 8 : 0}
      >
        <View
          style={{
            flex: 1,
            marginTop: -28,
            backgroundColor: PANEL_BG,
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
          }}
        >
          <ScrollView
            contentContainerStyle={{
              width: '100%',
              maxWidth: responsive.formMaxWidth,
              alignSelf: 'center',
              paddingHorizontal: responsive.horizontalPadding,
              paddingTop: responsive.isCompact ? 18 : 24,
              paddingBottom: 40,
            }}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={{ color: '#fff', fontSize: 26, fontWeight: '800' }}>Authentification</Text>
            <Text style={{ color: MUTED, marginTop: 6, marginBottom: 28 }}>Connectez-vous à votre compte JÀGO DÁNAYA</Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: BORDER, paddingBottom: 10, marginBottom: 24 }}>
              <Ionicons name="mail-outline" size={20} color={MUTED} style={{ marginRight: 10 }} />
              <TextInput
                placeholder="Adresse email"
                placeholderTextColor={MUTED}
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                editable={!loginLocked}
                style={{ flex: 1, color: '#fff', paddingVertical: 4 }}
              />
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: BORDER, paddingBottom: 10, marginBottom: 8 }}>
              <Ionicons name="lock-closed-outline" size={20} color={MUTED} style={{ marginRight: 10 }} />
              <TextInput
                placeholder="Mot de passe"
                placeholderTextColor={MUTED}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                editable={!loginLocked}
                style={{ flex: 1, color: '#fff', paddingVertical: 4 }}
              />
              <Pressable disabled={loginLocked} onPress={() => setShowPassword((s) => !s)} hitSlop={8}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={MUTED} />
              </Pressable>
            </View>

            {error ? (
              <Text style={{ color: '#f87171', marginTop: 8, marginBottom: 4 }}>{error}</Text>
            ) : null}

            {loginLocked ? (
              <View style={{ marginTop: 12, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#92400e', backgroundColor: '#451a03' }}>
                <Text style={{ color: '#fdba74', fontWeight: '800' }}>
                  <Ionicons name="shield-outline" size={16} color="#fdba74" /> Connexion temporairement bloquée
                </Text>
                <Text style={{ color: '#fed7aa', marginTop: 5 }}>Réessayez dans {lockClock}.</Text>
              </View>
            ) : remainingAttempts !== null && remainingAttempts > 0 ? (
              <Text style={{ color: '#fbbf24', marginTop: 10, fontWeight: '700' }}>
                {remainingAttempts} tentative{remainingAttempts > 1 ? 's' : ''} restante{remainingAttempts > 1 ? 's' : ''} avant le blocage.
              </Text>
            ) : null}

            <Pressable
              onPress={onLogin}
              disabled={loading || loginLocked}
              style={{ backgroundColor: loginLocked ? '#475569' : ACCENT, paddingVertical: 15, borderRadius: 999, alignItems: 'center', marginTop: 24, opacity: loading ? 0.75 : 1 }}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>
                    {loginLocked ? `Bloqué (${lockClock})` : 'Se connecter'}
                  </Text>}
            </Pressable>

            <View style={{ marginTop: 20, alignItems: 'center' }}>
              <Text style={{ color: MUTED, marginBottom: 14 }}>ou</Text>
              <Pressable
                onPress={onGoogleLogin}
                disabled={googleLoading}
                style={{ borderWidth: 1, borderColor: BORDER, paddingVertical: 15, borderRadius: 999, alignItems: 'center', width: '100%', flexDirection: 'row', justifyContent: 'center', gap: 10 as any }}
              >
                {googleLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="logo-google" size={18} color="#fff" />
                    <Text style={{ color: '#fff', fontWeight: '700' }}>Se connecter avec Google</Text>
                  </>
                )}
              </Pressable>
            </View>

            <Pressable onPress={() => navigation.navigate('ForgotPassword')} style={{ marginTop: 22, alignItems: 'center' }}>
              <Text style={{ color: ACCENT, fontWeight: '600' }}>Mot de passe oublié ?</Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
