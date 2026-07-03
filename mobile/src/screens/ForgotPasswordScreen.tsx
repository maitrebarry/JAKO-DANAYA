import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { forgotPassword } from '../services/auth';

export default function ForgotPasswordScreen() {
  const navigation = useNavigation<any>();
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
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#f8fafc' }}>
      <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 20, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 3 }}>
        <Text style={{ fontSize: 20, fontWeight: '700', marginBottom: 6, textAlign: 'center' }}>Mot de passe oublié</Text>

        {sent ? (
          <>
            <Text style={{ color: '#334155', textAlign: 'center', lineHeight: 20, marginTop: 8, marginBottom: 16 }}>
              Si cet email existe, un lien de réinitialisation a été envoyé. Ouvrez-le depuis votre boîte mail (il s'ouvrira dans votre navigateur) pour définir un nouveau mot de passe, puis revenez ici pour vous connecter.
            </Text>
            <Pressable
              onPress={() => navigation.navigate('Login')}
              style={{ backgroundColor: '#2563eb', padding: 14, borderRadius: 8, alignItems: 'center' }}
            >
              <Text style={{ color: '#fff', fontWeight: '600' }}>Retour à la connexion</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={{ marginBottom: 16, color: '#666', textAlign: 'center' }}>
              Saisissez votre email, un lien de réinitialisation vous sera envoyé.
            </Text>

            <Text style={{ marginBottom: 6 }}>Email</Text>
            <TextInput
              placeholder="ex: user@domaine.com"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, marginBottom: 12 }}
            />

            {error ? (
              <Text style={{ color: '#c0392b', marginBottom: 12 }}>{error}</Text>
            ) : null}

            <Pressable
              onPress={onSubmit}
              disabled={loading}
              style={{ backgroundColor: '#2563eb', padding: 14, borderRadius: 8, alignItems: 'center' }}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '600' }}>Envoyer</Text>}
            </Pressable>

            <Pressable onPress={() => navigation.navigate('Login')} style={{ marginTop: 14, alignItems: 'center' }}>
              <Text style={{ color: '#2563eb' }}>Retour à la connexion</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}
