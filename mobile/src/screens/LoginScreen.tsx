import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, ImageBackground } from 'react-native';
import { login } from '../services/auth';
import { useApp } from '../store/AppContext';

export default function LoginScreen() {
  const { setToken } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
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
    } catch (e: any) {
      setError(e.message || 'Erreur de connexion');
    } finally {
      setLoading(false);
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

          <Text style={{ marginTop: 12, color: '#666', fontSize: 12, textAlign: 'center' }}>
            Google OAuth sera ajouté à l’étape suivante.
          </Text>
        </View>
      </View>
    </ImageBackground>
  );
}
