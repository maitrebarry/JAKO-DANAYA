import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, ImageBackground } from 'react-native';
import { login, fetchCurrentUser } from '../services/auth';
import { useApp } from '../store/AppContext';
import * as WebBrowser from 'expo-web-browser';
import { API_BASE_URL, OAUTH_REDIRECT_URL } from '../utils/env';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const { setToken, setBoutiqueId } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
        if (profile && profile.boutique && profile.boutique.id) {
          setBoutiqueId(Number(profile.boutique.id));
        }
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
        if (profile && profile.boutique && profile.boutique.id) {
          setBoutiqueId(Number(profile.boutique.id));
        }
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
    <ImageBackground
      source={require('../assets/logo.png')}
      style={{ flex: 1 }}
      resizeMode="cover"
    >
      <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(255,255,255,0.78)' }}>
        <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 20, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 3 }}>
          <Text style={{ fontSize: 20, fontWeight: '700', marginBottom: 6, textAlign: 'center' }}>JAKO DANAYA</Text>
          <Text style={{ marginBottom: 16, color: '#666', textAlign: 'center' }}>Connexion</Text>

          <Text style={{ marginBottom: 6 }}>Email</Text>
          <TextInput
            placeholder="ex: user@domaine.com"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, marginBottom: 12 }}
          />

          <Text style={{ marginBottom: 6 }}>Mot de passe</Text>
          <TextInput
            placeholder="Votre mot de passe"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, marginBottom: 12 }}
          />

          {error ? (
            <Text style={{ color: '#c0392b', marginBottom: 12 }}>{error}</Text>
          ) : null}

          <Pressable
            onPress={onLogin}
            disabled={loading}
            style={{ backgroundColor: '#2563eb', padding: 14, borderRadius: 8, alignItems: 'center' }}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '600' }}>Se connecter</Text>}
          </Pressable>

          <View style={{ marginTop: 12, alignItems: 'center' }}>
            <Text style={{ color: '#666', marginBottom: 8 }}>ou</Text>
            <Pressable
              onPress={onGoogleLogin}
              disabled={googleLoading}
              style={{ borderWidth: 1, borderColor: '#ddd', padding: 14, borderRadius: 8, alignItems: 'center', width: '100%' }}
            >
              {googleLoading ? (
                <ActivityIndicator />
              ) : (
                <Text style={{ fontWeight: '600' }}>Se connecter avec Google</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </ImageBackground>
  );
}
