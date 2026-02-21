import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert, TextInput, ScrollView, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useApp } from '../store/AppContext';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import {
  fetchCurrentSubscriptionStatus,
  fetchSubscriptionPlans,
  submitManualSubscriptionPayment,
  type SubscriptionPlanDTO,
} from '../services/subscription';

const MOBILE_NUMBERS = {
  ORANGE_MONEY: '74745669',
  WAVE: '74745669',
  MOBICASH: '67205736',
};

type ModePaiement = 'ORANGE_MONEY' | 'WAVE' | 'MOBICASH';

export default function SubscriptionRenewScreen() {
  const { token, refreshSubscriptionStatus, setToken, setBoutiqueId } = useApp();
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [subMessage, setSubMessage] = useState<string>('Votre abonnement a expiré. Veuillez vous réabonner pour accéder à l\'application.');
  const [plans, setPlans] = useState<SubscriptionPlanDTO[]>([]);
  const [planCode, setPlanCode] = useState<string>('MENSUEL');
  const [modePaiement, setModePaiement] = useState<ModePaiement>('ORANGE_MONEY');
  const [transactionRef, setTransactionRef] = useState('');
  const [ownerNote, setOwnerNote] = useState('');
  const [proof, setProof] = useState<{ uri: string; name?: string; type?: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedPlan = useMemo(
    () => plans.find((p) => String(p.code).toUpperCase() === String(planCode).toUpperCase()) || null,
    [plans, planCode]
  );

  const loadData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [sub, planRows] = await Promise.all([
        fetchCurrentSubscriptionStatus(token),
        fetchSubscriptionPlans(token).catch(() => []),
      ]);

      if (sub?.message) setSubMessage(sub.message);
      const list = Array.isArray(planRows) ? planRows : [];
      setPlans(list);

      const defaultCode = (sub?.planCode || list[0]?.code || 'MENSUEL') as string;
      setPlanCode(defaultCode);
    } catch (e: any) {
      Alert.alert('Erreur', e?.message || 'Impossible de charger les informations abonnement');
    } finally {
      await refreshSubscriptionStatus().catch(() => undefined);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

  const openCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Caméra', 'Permission caméra refusée');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.9,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const a = result.assets[0];
    setProof({ uri: a.uri, name: `recu-${Date.now()}.jpg`, type: a.mimeType || 'image/jpeg' });
  };

  const openGallery = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Galerie', 'Permission galerie refusée');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      quality: 0.9,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const a = result.assets[0];
    setProof({ uri: a.uri, name: a.fileName || `recu-${Date.now()}.jpg`, type: a.mimeType || 'image/jpeg' });
  };

  const submit = async () => {
    if (!token) return;
    if (!planCode) {
      Alert.alert('Validation', 'Veuillez choisir une formule');
      return;
    }
    if (!proof) {
      Alert.alert('Validation', 'Veuillez ajouter la preuve de paiement');
      return;
    }

    setSubmitting(true);
    try {
      const res = await submitManualSubscriptionPayment(token, {
        planCode,
        modePaiement,
        receipt: proof,
        transactionRef: transactionRef.trim() || undefined,
        ownerNote: ownerNote.trim() || undefined,
      });

      Alert.alert(
        'Demande envoyée',
        `Référence: ${res?.reference || 'N/A'}\nEn attente de validation SuperAdmin.`
      );
    } catch (e: any) {
      Alert.alert('Erreur', e?.message || 'Échec soumission');
    } finally {
      await refreshSubscriptionStatus().catch(() => undefined);
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
        <Pressable
          onPress={() => {
            setToken(null);
            setBoutiqueId(null);
            navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
          }}
          style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#fff' }}
        >
          <Ionicons name="arrow-back" size={18} color="#2563eb" />
          <Text style={{ marginLeft: 6, color: '#2563eb', fontWeight: '700' }}>Retour au login</Text>
        </Pressable>
      </View>

      <View style={{ backgroundColor: '#fff3cd', borderColor: '#ffe69c', borderWidth: 1, borderRadius: 10, padding: 12 }}>
        <Text style={{ fontWeight: '700', color: '#664d03', marginBottom: 4 }}>Abonnement expiré</Text>
        <Text style={{ color: '#664d03' }}>{subMessage}</Text>
      </View>

      <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#eee' }}>
        <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 10 }}>Se réabonner (manuel)</Text>

        <Text style={{ fontWeight: '600', marginBottom: 6 }}>Formule</Text>
        <View style={{ gap: 8, marginBottom: 10 }}>
          {plans.map((p) => {
            const active = String(p.code).toUpperCase() === String(planCode).toUpperCase();
            return (
              <Pressable
                key={p.code}
                onPress={() => setPlanCode(p.code)}
                style={{
                  borderWidth: 1,
                  borderColor: active ? '#2563eb' : '#ddd',
                  backgroundColor: active ? '#eff6ff' : '#fff',
                  borderRadius: 8,
                  padding: 10,
                }}
              >
                <Text style={{ fontWeight: '600' }}>{p.libelle} ({p.code})</Text>
                <Text style={{ color: '#666' }}>{p.prix} {p.devise} • {p.duree_mois} mois</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={{ marginBottom: 10 }}>
          <Text style={{ fontWeight: '700' }}>Montant à payer: </Text>
          {selectedPlan ? `${selectedPlan.prix} ${selectedPlan.devise}` : '—'}
        </Text>

        <Text style={{ fontWeight: '700' }}>Numéros Mobile Money du service</Text>
        <Text>Orange Money: {MOBILE_NUMBERS.ORANGE_MONEY}</Text>
        <Text>Wave: {MOBILE_NUMBERS.WAVE}</Text>
        <Text style={{ marginBottom: 10 }}>MobiCash: {MOBILE_NUMBERS.MOBICASH}</Text>

        <Text style={{ fontWeight: '600', marginBottom: 6 }}>Canal utilisé</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
          {(['ORANGE_MONEY', 'WAVE', 'MOBICASH'] as ModePaiement[]).map((m) => {
            const active = modePaiement === m;
            return (
              <Pressable
                key={m}
                onPress={() => setModePaiement(m)}
                style={{
                  borderWidth: 1,
                  borderColor: active ? '#2563eb' : '#ddd',
                  backgroundColor: active ? '#eff6ff' : '#fff',
                  borderRadius: 20,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                }}
              >
                <Text style={{ fontWeight: active ? '700' : '500' }}>{m}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={{ fontWeight: '600', marginBottom: 6 }}>Référence transfert (optionnel)</Text>
        <TextInput
          value={transactionRef}
          onChangeText={setTransactionRef}
          placeholder="Ex: OM123456"
          style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, marginBottom: 10 }}
        />

        <Text style={{ fontWeight: '600', marginBottom: 6 }}>Note (optionnel)</Text>
        <TextInput
          value={ownerNote}
          onChangeText={setOwnerNote}
          placeholder="Infos utiles"
          multiline
          style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, minHeight: 70, marginBottom: 10 }}
        />

        <Text style={{ fontWeight: '600', marginBottom: 6 }}>Preuve de paiement</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
          <Pressable onPress={openCamera} style={{ backgroundColor: '#2563eb', borderRadius: 8, padding: 10 }}>
            <Text style={{ color: '#fff', fontWeight: '600' }}>Ouvrir caméra</Text>
          </Pressable>
          <Pressable onPress={openGallery} style={{ backgroundColor: '#6b7280', borderRadius: 8, padding: 10 }}>
            <Text style={{ color: '#fff', fontWeight: '600' }}>Galerie</Text>
          </Pressable>
        </View>

        {proof?.uri ? (
          <View style={{ marginBottom: 10 }}>
            <Image source={{ uri: proof.uri }} style={{ width: '100%', height: 220, borderRadius: 8 }} resizeMode="cover" />
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable onPress={submit} disabled={submitting} style={{ backgroundColor: '#16a34a', borderRadius: 8, padding: 12, flex: 1, alignItems: 'center' }}>
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Soumettre</Text>}
          </Pressable>
          <Pressable onPress={loadData} style={{ backgroundColor: '#0ea5e9', borderRadius: 8, padding: 12, alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>Vérifier</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}
