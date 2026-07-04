import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, ImageBackground, ScrollView, KeyboardAvoidingView, Platform, StatusBar } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { login, fetchCurrentUser } from '../services/auth';
import { useApp } from '../store/AppContext';
import * as WebBrowser from 'expo-web-browser';
import { API_BASE_URL, OAUTH_REDIRECT_URL } from '../utils/env';

WebBrowser.maybeCompleteAuthSession();

const ACCENT = '#0ea5e9';
const PANEL_BG = '#14161a';
const MUTED = '#9ca3af';
const BORDER = '#2d2f36';

export default function LoginScreen() {
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

  const onLogin = async () => {
    setError(null);
    if (!email || !password) {
      setError('Email et mot de passe requis');
      return;
    }
    try {
      setLoading(true);
      const res = await login(email.trim(), password);
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
      setError(e.message || 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

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

      <View style={{ height: '42%' }}>
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

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View
          style={{
            flex: 1,
            marginTop: -28,
            backgroundColor: PANEL_BG,
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
          }}
        >
          <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
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
                style={{ flex: 1, color: '#fff', paddingVertical: 4 }}
              />
              <Pressable onPress={() => setShowPassword((s) => !s)} hitSlop={8}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={MUTED} />
              </Pressable>
            </View>

            {error ? (
              <Text style={{ color: '#f87171', marginTop: 8, marginBottom: 4 }}>{error}</Text>
            ) : null}

            <Pressable
              onPress={onLogin}
              disabled={loading}
              style={{ backgroundColor: ACCENT, paddingVertical: 15, borderRadius: 999, alignItems: 'center', marginTop: 24 }}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>Se connecter</Text>}
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
