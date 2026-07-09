import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert, TextInput, ScrollView, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../store/AppContext';
import {
  fetchCurrentSubscriptionStatus,
  fetchSubscriptionPlans,
  fetchMySubscriptionPayments,
  submitManualSubscriptionPayment,
  type SubscriptionPlanDTO,
  type SubscriptionPaymentDTO,
} from '../services/subscription';
import {
  fetchAdminSubscriptionPayments,
  approveAdminSubscriptionPayment,
  rejectAdminSubscriptionPayment,
  type SubscriptionPaymentAdminDTO,
} from '../services/admin';
import { isSuperAdmin } from '../utils/permissions';
import { resolveMediaUrl } from '../utils/urls';
import { useResponsiveLayout } from '../utils/responsive';

const MOBILE_NUMBERS = {
  ORANGE_MONEY: '74745669',
  WAVE: '74745669',
  MOBICASH: '67205736',
};

type ModePaiement = 'ORANGE_MONEY' | 'WAVE' | 'MOBICASH';

export default function SubscriptionScreen() {
  const { token, refreshSubscriptionStatus, profile } = useApp();
  const superAdmin = isSuperAdmin(profile);
  const responsive = useResponsiveLayout();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<any | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlanDTO[]>([]);
  const [payments, setPayments] = useState<SubscriptionPaymentDTO[]>([]);
  const [adminPayments, setAdminPayments] = useState<SubscriptionPaymentAdminDTO[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminFilter, setAdminFilter] = useState<'PENDING' | 'PAID' | 'FAILED' | 'ALL'>('PENDING');
  const [planCode, setPlanCode] = useState<string>('MENSUEL');
  const [modePaiement, setModePaiement] = useState<ModePaiement>('ORANGE_MONEY');
  const [transactionRef, setTransactionRef] = useState('');
  const [ownerNote, setOwnerNote] = useState('');
  const [proof, setProof] = useState<{ uri: string; name?: string; type?: string } | null>(null);
  const [manualNumbers, setManualNumbers] = useState<Record<string, string> | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const [submitY, setSubmitY] = useState(0);

  const selectedPlan = useMemo(
    () => plans.find((p) => String(p.code).toUpperCase() === String(planCode).toUpperCase()) || null,
    [plans, planCode]
  );

  const paymentStatusLabel = (s?: string | null) => {
    switch ((s || '').toUpperCase()) {
      case 'PENDING': return 'En attente';
      case 'PAID': return 'Payé';
      case 'FAILED': return 'Échec';
      case 'CANCELED': return 'Annulé';
      case 'CANCELLED': return 'Annulé';
      case 'REFUNDED': return 'Remboursé';
      default: return s || '—';
    }
  };

  const subscriptionStatusLabel = (s?: string | null) => {
    switch ((s || '').toUpperCase()) {
      case 'ACTIVE': return 'Actif';
      case 'EXPIRED': return 'Expiré';
      case 'PAST_DUE': return 'Impayé';
      case 'CANCELED': return 'Annulé';
      case 'TRIAL': return 'Essai';
      default: return s || '—';
    }
  };

  const loadData = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      if (superAdmin) {
        setCurrent(null);
        setPlans([]);
        setPayments([]);
        await loadAdminPayments();
        return;
      }
      const [sub, planRows, paymentRows] = await Promise.all([
        fetchCurrentSubscriptionStatus(token),
        fetchSubscriptionPlans(token).catch(() => []),
        fetchMySubscriptionPayments(token).catch(() => []),
      ]);
      setCurrent(sub || null);
      const list = Array.isArray(planRows) ? planRows : [];
      setPlans(list);
      setPayments(Array.isArray(paymentRows) ? paymentRows : []);
      const defaultCode = (sub?.planCode || list[0]?.code || 'MENSUEL') as string;
      setPlanCode(defaultCode);
    } catch (e: any) {
      setError(e?.message || 'Impossible de charger les informations abonnement');
    } finally {
      await refreshSubscriptionStatus().catch(() => undefined);
      setLoading(false);
    }
  };

  const loadAdminPayments = async () => {
    if (!token) return;
    if (!isSuperAdmin(profile)) return;
    setAdminLoading(true);
    setAdminError(null);
    try {
      const status = adminFilter === 'ALL' ? undefined : adminFilter;
      const rows = await fetchAdminSubscriptionPayments(token, status);
      setAdminPayments(Array.isArray(rows) ? rows : []);
    } catch (e: any) {
      setAdminError(e?.message || 'Erreur chargement paiements abonnements');
    } finally {
      setAdminLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [token, superAdmin]);

  useEffect(() => {
    if (!token) return;
    if (!superAdmin) return;
    loadAdminPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, adminFilter, profile?.id, superAdmin]);

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

    setBusy(true);
    try {
      const res = await submitManualSubscriptionPayment(token, {
        planCode,
        modePaiement,
        receipt: proof,
        transactionRef: transactionRef.trim() || undefined,
        ownerNote: ownerNote.trim() || undefined,
      });
      setManualNumbers(res?.manualPaymentNumbers || null);
      Alert.alert('Demande envoyée', `Référence: ${res?.reference || 'N/A'}\nEn attente de validation SuperAdmin.`);
      setTransactionRef('');
      setOwnerNote('');
      setProof(null);
      await loadData();
    } catch (e: any) {
      Alert.alert('Erreur', e?.message || 'Échec soumission');
    } finally {
      await refreshSubscriptionStatus().catch(() => undefined);
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  const numbers = manualNumbers || MOBILE_NUMBERS;

  return (
    <ScrollView
      ref={scrollRef}
      contentContainerStyle={{
        width: '100%',
        maxWidth: responsive.contentMaxWidth,
        alignSelf: 'center',
        paddingHorizontal: responsive.horizontalPadding,
        paddingVertical: 16,
        paddingBottom: 36,
        gap: 12,
      }}
    >
      {superAdmin ? (
        <View style={{ backgroundColor: '#eff6ff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#bfdbfe' }}>
          <Text style={{ color: '#1e3a8a', fontSize: 16, fontWeight: '800' }}>Administration des abonnements</Text>
          <Text style={{ color: '#1e40af', marginTop: 5 }}>
            Le compte SuperAdmin est exempté d’abonnement. Cet espace sert uniquement à valider ou rejeter les paiements des boutiques.
          </Text>
        </View>
      ) : null}

      {error ? (
        <View style={{ backgroundColor: '#fef3c7', borderColor: '#fde68a', borderWidth: 1, borderRadius: 10, padding: 12 }}>
          <Text style={{ color: '#92400e' }}>{error}</Text>
        </View>
      ) : null}

      {!superAdmin && (
      <>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
        <Pressable
          onPress={() => scrollRef.current?.scrollTo({ y: submitY, animated: true })}
          style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#fff' }}
        >
          <Ionicons name="arrow-up" size={18} color="#2563eb" />
          <Text style={{ marginLeft: 6, color: '#2563eb', fontWeight: '700' }}>Retour soumission</Text>
        </Pressable>
      </View>

      <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#eee' }}>
        <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 10 }}>État actuel</Text>
        {current ? (
          <View style={{ gap: 6 }}>
            <Text><Text style={{ fontWeight: '700' }}>Boutique:</Text> {current.boutiqueNom || '—'}</Text>
            <Text><Text style={{ fontWeight: '700' }}>Plan:</Text> {current.planLibelle || current.planCode || '—'}</Text>
            <Text><Text style={{ fontWeight: '700' }}>Statut:</Text> {subscriptionStatusLabel(current.status)}</Text>
            <Text><Text style={{ fontWeight: '700' }}>Fin:</Text> {current.dateFin ? new Date(current.dateFin).toLocaleDateString('fr-FR') : '—'}</Text>
          </View>
        ) : (
          <Text style={{ color: '#6b7280' }}>Aucune donnée</Text>
        )}
      </View>

      <View
        onLayout={(e) => setSubmitY(e.nativeEvent.layout.y)}
        style={{ backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#eee' }}
      >
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
        <Text>Orange Money: {numbers.ORANGE_MONEY || '—'}</Text>
        <Text>Wave: {numbers.WAVE || '—'}</Text>
        <Text style={{ marginBottom: 10 }}>MobiCash: {numbers.MOBICASH || '—'}</Text>

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
          <Pressable onPress={submit} disabled={busy} style={{ backgroundColor: '#16a34a', borderRadius: 8, padding: 12, flex: 1, alignItems: 'center' }}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Soumettre</Text>}
          </Pressable>
          <Pressable onPress={loadData} style={{ backgroundColor: '#0ea5e9', borderRadius: 8, padding: 12, alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>Rafraîchir</Text>
          </Pressable>
        </View>
      </View>

      <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#eee' }}>
        <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 10 }}>Historique des paiements</Text>
        {payments.length === 0 ? (
          <Text style={{ color: '#6b7280' }}>Aucun paiement</Text>
        ) : (
          payments.map((p) => (
            <View key={p.id} style={{ borderBottomWidth: 1, borderBottomColor: '#f3f4f6', paddingVertical: 8 }}>
              <Text style={{ fontWeight: '700' }}>{p.reference || '—'}</Text>
              <Text>Plan: {p.plan_code || '—'} • {p.montant} {p.devise}</Text>
              <Text>Statut: {paymentStatusLabel(p.statut)}</Text>
              <Text>Créé: {p.created_at ? new Date(p.created_at).toLocaleString('fr-FR') : '—'}</Text>
              <Text>Payé: {p.paid_at ? new Date(p.paid_at).toLocaleString('fr-FR') : '—'}</Text>
            </View>
          ))
        )}
      </View>
      </>
      )}

      {superAdmin && (
        <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#eee' }}>
          <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 10 }}>Validation paiements (SuperAdmin)</Text>

          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            {(['PENDING', 'PAID', 'FAILED', 'ALL'] as const).map((s) => {
              const active = adminFilter === s;
              return (
                <Pressable
                  key={s}
                  onPress={() => setAdminFilter(s)}
                  style={{
                    borderWidth: 1,
                    borderColor: active ? '#2563eb' : '#ddd',
                    backgroundColor: active ? '#eff6ff' : '#fff',
                    borderRadius: 20,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                  }}
                >
                  <Text style={{ fontWeight: active ? '700' : '500' }}>{s === 'ALL' ? 'Tous' : s}</Text>
                </Pressable>
              );
            })}
            <Pressable onPress={loadAdminPayments} style={{ backgroundColor: '#0ea5e9', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 }}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>Rafraîchir</Text>
            </Pressable>
          </View>

          {adminError ? (
            <Text style={{ color: '#b45309', marginBottom: 8 }}>{adminError}</Text>
          ) : null}

          {adminLoading ? (
            <View style={{ paddingVertical: 10 }}><ActivityIndicator /></View>
          ) : adminPayments.length === 0 ? (
            <Text style={{ color: '#6b7280' }}>Aucun paiement</Text>
          ) : (
            adminPayments.map((p) => {
              const pending = String(p.statut || '').toUpperCase() === 'PENDING';
              const proofUrl = resolveMediaUrl(p.preuve_url || undefined);
              return (
                <View key={`admin-pay-${p.id}`} style={{ borderBottomWidth: 1, borderBottomColor: '#f3f4f6', paddingVertical: 10 }}>
                  <Text style={{ fontWeight: '700' }}>{p.reference || '—'} • {p.boutique_nom || '—'}</Text>
                  <Text>Plan: {p.plan_code || '—'} • {p.montant} {p.devise}</Text>
                  <Text>Statut: {paymentStatusLabel(p.statut)}</Text>
                  <Text>Provider: {p.provider || '—'} • Canal: {p.mode_paiement || '—'}</Text>
                  <Text>Réf transfert: {p.transaction_ref || '—'}</Text>
                  {proofUrl ? (
                    <Image source={{ uri: proofUrl }} style={{ width: '100%', height: 200, borderRadius: 8, marginTop: 8 }} resizeMode="cover" />
                  ) : null}
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                    <Pressable
                      disabled={!pending}
                      onPress={() => {
                        Alert.alert('Valider paiement', 'Confirmer la validation du paiement ?', [
                          { text: 'Annuler', style: 'cancel' },
                          {
                            text: 'Valider',
                            style: 'default',
                            onPress: async () => {
                              if (!token) return;
                              try {
                                await approveAdminSubscriptionPayment(token, p.id);
                                await loadAdminPayments();
                              } catch (e: any) {
                                Alert.alert('Erreur', e?.message || 'Validation impossible');
                              }
                            }
                          },
                        ]);
                      }}
                      style={{ backgroundColor: pending ? '#16a34a' : '#9ca3af', borderRadius: 8, padding: 10, flex: 1, alignItems: 'center' }}
                    >
                      <Text style={{ color: '#fff', fontWeight: '700' }}>Valider</Text>
                    </Pressable>
                    <Pressable
                      disabled={!pending}
                      onPress={() => {
                        Alert.alert('Rejeter paiement', 'Confirmer le rejet du paiement ?', [
                          { text: 'Annuler', style: 'cancel' },
                          {
                            text: 'Rejeter',
                            style: 'destructive',
                            onPress: async () => {
                              if (!token) return;
                              try {
                                await rejectAdminSubscriptionPayment(token, p.id);
                                await loadAdminPayments();
                              } catch (e: any) {
                                Alert.alert('Erreur', e?.message || 'Rejet impossible');
                              }
                            }
                          },
                        ]);
                      }}
                      style={{ backgroundColor: pending ? '#dc2626' : '#9ca3af', borderRadius: 8, padding: 10, flex: 1, alignItems: 'center' }}
                    >
                      <Text style={{ color: '#fff', fontWeight: '700' }}>Rejeter</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })
          )}
        </View>
      )}
    </ScrollView>
  );
}
