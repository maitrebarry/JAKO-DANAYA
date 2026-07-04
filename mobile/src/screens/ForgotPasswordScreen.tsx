import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, StatusBar } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { forgotPassword } from '../services/auth';

const ACCENT = '#0ea5e9';
const PANEL_BG = '#14161a';
const MUTED = '#9ca3af';
const BORDER = '#2d2f36';

export default function ForgotPasswordScreen() {
  const navigation = useNavigation<any>();
  const canGoBack = navigation.canGoBack();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const onSubmit = async () => {
    setError(null);
    if (!email.trim()) {
      setError('Email requis');
      return;
    }
    try {
      setLoading(true);
      await forgotPassword(email.trim());
      setSent(true);
    } catch (e: any) {
      setError(e?.message || 'Erreur lors de la demande');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: PANEL_BG }}>
      <StatusBar barStyle="light-content" />
      {canGoBack ? (
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          style={{ position: 'absolute', top: 50, left: 16, zIndex: 10, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </Pressable>
      ) : null}

      <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: '#fff', fontSize: 24, fontWeight: '800' }}>Mot de passe oublié</Text>

        {sent ? (
          <>
            <Text style={{ color: MUTED, lineHeight: 22, marginTop: 16, marginBottom: 24 }}>
              Si cet email existe, un lien de réinitialisation a été envoyé. Ouvrez-le depuis votre boîte mail
              (il s'ouvrira dans votre navigateur) pour définir un nouveau mot de passe, puis revenez ici pour
              vous connecter.
            </Text>
            <Pressable
              onPress={() => navigation.navigate('Login')}
              style={{ backgroundColor: ACCENT, paddingVertical: 15, borderRadius: 999, alignItems: 'center' }}
            >
              <Text style={{ color: '#fff', fontWeight: '800' }}>Retour à la connexion</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={{ color: MUTED, marginTop: 10, marginBottom: 28 }}>
              Saisissez votre email, un lien de réinitialisation vous sera envoyé.
            </Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: BORDER, paddingBottom: 10, marginBottom: 8 }}>
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

            {error ? <Text style={{ color: '#f87171', marginTop: 8, marginBottom: 4 }}>{error}</Text> : null}

            <Pressable
              onPress={onSubmit}
              disabled={loading}
              style={{ backgroundColor: ACCENT, paddingVertical: 15, borderRadius: 999, alignItems: 'center', marginTop: 24 }}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800' }}>Envoyer</Text>}
            </Pressable>

            <Pressable onPress={() => navigation.navigate('Login')} style={{ marginTop: 18, alignItems: 'center' }}>
              <Text style={{ color: ACCENT, fontWeight: '600' }}>Retour à la connexion</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}
