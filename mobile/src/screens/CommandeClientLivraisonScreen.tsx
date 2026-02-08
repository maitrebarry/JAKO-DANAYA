import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../theme';
import { useApp } from '../store/AppContext';
import { showError, showSuccess } from '../utils/notify';
import { hasPermission, isSuperAdmin } from '../utils/permissions';
import { getCommandeClient, createLivraisonCommandeClient, type CommandeClientDTO } from '../services/commandesClients';
import { listBoutiqueStocks, type StockDTO } from '../services/magasins';
import type { RootStackParamList } from '../navigation/RootNavigator';

function digitsOnly(input: string) {
  return (input || '').replace(/\D+/g, '');
}

function formatThousands(n: number) {
  const s = String(Math.trunc(Number(n) || 0));
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function generateRefLivraison() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const timeStr = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `LIV-${dateStr}-${timeStr}`;
}

type LineView = {
  ligneCommandeId: number;
  produitId: number;
  designation: string;
  orderedUnits: number;
  deliveredUnits: number;
  remainingUnits: number;
  availableUnits: number;
  stockId: number | null;
};

type LineInput = {
  units: string;
};

type Step = 'SAISIE' | 'CONFIRMATION';

export default function CommandeClientLivraisonScreen() {
  const theme = useTheme();
  const { token, profile } = useApp();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'CommandeClientLivraison'>>();
  const id = route.params?.id;

  const canDeliver = useMemo(() => {
    if (!profile) return false;
    return isSuperAdmin(profile) || hasPermission(profile, 'LIVRAISON_ECRITURE');
  }, [profile]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cmd, setCmd] = useState<CommandeClientDTO | null>(null);
  const [stocks, setStocks] = useState<StockDTO[]>([]);
  const [inputs, setInputs] = useState<Record<number, LineInput>>({});
  const [step, setStep] = useState<Step>('SAISIE');
  const [reference] = useState(generateRefLivraison());

  const stockByProduitId = useMemo(() => {
    const map = new Map<number, StockDTO>();
    const byPid: Record<number, StockDTO[]> = {};
    (stocks || []).forEach((s) => {
      const pid = s?.produitId ?? s?.produit?.id;
      if (pid == null) return;
      const key = Number(pid);
      if (!byPid[key]) byPid[key] = [];
      byPid[key].push(s);
    });
    Object.entries(byPid).forEach(([pidStr, list]) => {
      const pid = Number(pidStr);
      const best = (list || []).reduce((acc: StockDTO | null, cur: StockDTO) => {
        const a = Number(acc?.quantiteDisponible ?? -1);
        const b = Number(cur?.quantiteDisponible ?? -1);
        return b > a ? cur : acc;
      }, null);
      if (best) map.set(pid, best);
    });
    return map;
  }, [stocks]);

  const lines: LineView[] = useMemo(() => {
    const raw = Array.isArray((cmd as any)?.lignes) ? ((cmd as any).lignes as any[]) : [];
    return raw
      .map((l) => {
        const ligneCommandeId = Number(l?.id ?? l?.ligneCommandeId ?? 0) || 0;
        const produitId = Number(l?.produitId ?? l?.produit?.id ?? 0) || 0;
        const designation = String(l?.produit?.nomProduit || l?.produit?.nom || l?.nomProduit || '').trim();
        const orderedUnits = Math.max(0, Number(l?.quantite ?? l?.qte ?? l?.qty ?? 0) || 0);
        const deliveredUnits = Math.max(0, Number(l?.quantiteLivre ?? l?.qteLivre ?? l?.delivered ?? 0) || 0);
        const remainingUnits = Math.max(0, orderedUnits - deliveredUnits);

        const stock = stockByProduitId.get(produitId);
        const availableUnits = Math.max(0, Number(stock?.quantiteDisponible ?? 0) || 0);
        const stockId = stock?.id != null ? Number(stock.id) : null;

        return {
          ligneCommandeId,
          produitId,
          designation: designation || `Produit #${produitId || '?'}`,
          orderedUnits,
          deliveredUnits,
          remainingUnits,
          availableUnits,
          stockId,
        };
      })
      .filter((l) => l.ligneCommandeId > 0 && l.produitId > 0);
  }, [cmd, stockByProduitId]);

  const selectedLines = useMemo(() => {
    return (lines || [])
      .map((l) => {
        const input = inputs[l.ligneCommandeId] || { units: '' };
        const units = Math.max(0, Math.trunc(Number(digitsOnly(input.units) || 0)));
        return { ...l, deliverUnits: units };
      })
      .filter((l) => l.deliverUnits > 0);
  }, [lines, inputs]);

  const load = useCallback(async () => {
    if (!token) return;
    if (!id) {
      setCmd(null);
      setStocks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [commande, st] = await Promise.all([getCommandeClient(id, token), listBoutiqueStocks(token)]);
      setCmd(commande);
      setStocks(Array.isArray(st) ? st : []);

      const init: Record<number, LineInput> = {};
      const raw = Array.isArray((commande as any)?.lignes) ? ((commande as any).lignes as any[]) : [];
      raw.forEach((l: any) => {
        const lid = Number(l?.id ?? 0) || 0;
        if (!lid) return;
        init[lid] = { units: '' };
      });
      setInputs(init);
      setStep('SAISIE');
    } catch (e: any) {
      showError('Erreur', e?.message || 'Impossible de charger la commande');
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => {
    load();
  }, [load]);

  const setLineInput = useCallback((ligneCommandeId: number, patch: Partial<LineInput>) => {
    setInputs((prev) => ({
      ...prev,
      [ligneCommandeId]: { ...(prev[ligneCommandeId] || { units: '' }), ...patch },
    }));
  }, []);

  const fillAllForLine = useCallback(
    (ligneCommandeId: number) => {
      const line = lines.find((l) => l.ligneCommandeId === ligneCommandeId);
      if (!line) return;
      const maxPossible = Math.max(0, Math.min(line.remainingUnits, line.availableUnits));
      setLineInput(ligneCommandeId, { units: String(maxPossible) });
    },
    [lines, setLineInput]
  );

  const continueToConfirm = useCallback(() => {
    if (!canDeliver) {
      showError('Permission', "Vous n'avez pas la permission d'enregistrer une livraison.");
      return;
    }
    if (selectedLines.length === 0) {
      showError('Livraison', 'Renseignez au moins une ligne.');
      return;
    }

    const invalidNoStock = selectedLines.find((l) => !l.stockId);
    if (invalidNoStock) {
      showError('Stock', `Stock boutique introuvable pour ${invalidNoStock.designation}.`);
      return;
    }

    const invalidRemaining = selectedLines.find((l) => l.deliverUnits > l.remainingUnits);
    if (invalidRemaining) {
      showError('Quantité invalide', `La quantité livrée dépasse le restant pour ${invalidRemaining.designation}.`);
      return;
    }

    const invalidStock = selectedLines.find((l) => l.deliverUnits > l.availableUnits);
    if (invalidStock) {
      showError('Stock insuffisant', `Stock insuffisant pour ${invalidStock.designation} (dispo: ${invalidStock.availableUnits}).`);
      return;
    }

    setStep('CONFIRMATION');
  }, [canDeliver, selectedLines]);

  const submit = useCallback(async () => {
    if (!token) {
      showError('Connexion', 'Vous devez être connecté.');
      return;
    }
    if (!id) {
      showError('Commande', 'Commande inconnue.');
      return;
    }
    if (!canDeliver) {
      showError('Permission', "Vous n'avez pas la permission d'enregistrer une livraison.");
      return;
    }

    const invalidNoStock = selectedLines.find((l) => !l.stockId);
    if (invalidNoStock) {
      showError('Stock', `Stock boutique introuvable pour ${invalidNoStock.designation}.`);
      return;
    }

    const invalidRemaining = selectedLines.find((l) => l.deliverUnits > l.remainingUnits);
    if (invalidRemaining) {
      showError('Quantité invalide', `La quantité livrée dépasse le restant pour ${invalidRemaining.designation}.`);
      return;
    }

    const invalidStock = selectedLines.find((l) => l.deliverUnits > l.availableUnits);
    if (invalidStock) {
      showError('Stock insuffisant', `Stock insuffisant pour ${invalidStock.designation} (dispo: ${invalidStock.availableUnits}).`);
      return;
    }

    setSubmitting(true);
    try {
      await createLivraisonCommandeClient(
        id,
        {
          reference,
          lignes: selectedLines.map((l) => ({
            ligneCommandeId: l.ligneCommandeId,
            stockId: Number(l.stockId),
            quantite: l.deliverUnits,
          })),
        },
        token
      );
      showSuccess('Livraison enregistrée', cmd?.reference || `Commande #${id}`);
      navigation.goBack();
    } catch (e: any) {
      showError('Erreur', e?.message || 'Livraison impossible');
    } finally {
      setSubmitting(false);
    }
  }, [token, id, canDeliver, selectedLines, reference, cmd, navigation]);

  if (!token) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background, padding: 16 }}>
        <Text style={{ color: theme.text, fontWeight: '900' }}>Authentification requise</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator />
          <Text style={{ color: theme.muted, marginTop: 8 }}>Chargement...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28 }} keyboardShouldPersistTaps="handled">
          <View
            style={{
              backgroundColor: theme.card,
              borderRadius: 16,
              padding: 14,
              borderWidth: 1,
              borderColor: theme.isDark ? '#1f2937' : '#e5e7eb',
            }}
          >
            <Text style={{ color: theme.text, fontSize: 18, fontWeight: '900' }} numberOfLines={1}>
              Livraison
            </Text>
            <Text style={{ color: theme.muted, marginTop: 4 }} numberOfLines={1}>
              {cmd?.reference || (id ? `Commande #${id}` : 'Commande inconnue')}
            </Text>
            <Text style={{ color: theme.muted, marginTop: 8 }}>
              Livraison fractionnée (restant à livrer). Réf: {reference}
            </Text>
          </View>

          {!canDeliver ? (
            <View
              style={{
                marginTop: 12,
                backgroundColor: theme.card,
                borderRadius: 16,
                padding: 12,
                borderWidth: 1,
                borderColor: theme.isDark ? '#1f2937' : '#e5e7eb',
              }}
            >
              <Text style={{ color: theme.text, fontWeight: '900' }}>Permission requise</Text>
              <Text style={{ color: theme.muted, marginTop: 6 }}>
                Vous n'avez pas la permission d'enregistrer une livraison (LIVRAISON_ECRITURE).
              </Text>
            </View>
          ) : null}

          <Text style={{ color: theme.text, fontSize: 16, fontWeight: '900', marginTop: 14, marginBottom: 10 }}>Lignes</Text>

          {lines.length === 0 ? (
            <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: theme.isDark ? '#1f2937' : '#e5e7eb' }}>
              <Text style={{ color: theme.muted, fontWeight: '800' }}>Aucune ligne à livrer.</Text>
            </View>
          ) : step === 'SAISIE' ? (
            lines.map((l) => {
              const inp = inputs[l.ligneCommandeId] || { units: '' };
              const maxPossible = Math.max(0, Math.min(l.remainingUnits, l.availableUnits));
              const stockOk = l.stockId != null;
              return (
                <View
                  key={String(l.ligneCommandeId)}
                  style={{
                    backgroundColor: theme.card,
                    borderRadius: 16,
                    padding: 12,
                    marginBottom: 10,
                    borderWidth: 1,
                    borderColor: theme.isDark ? '#1f2937' : '#e5e7eb',
                    opacity: l.remainingUnits <= 0 ? 0.6 : 1,
                  }}
                >
                  <Text style={{ color: theme.text, fontWeight: '900' }} numberOfLines={2}>
                    {l.designation}
                  </Text>
                  <Text style={{ color: theme.muted, marginTop: 4 }}>
                    Commandé: {l.orderedUnits} • Livré: {l.deliveredUnits} • Reste: {l.remainingUnits}
                  </Text>
                  <Text style={{ color: theme.muted, marginTop: 4 }}>
                    Stock dispo: {formatThousands(l.availableUnits)} {stockOk ? '' : '• (stock boutique introuvable)'}
                  </Text>

                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 10, alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.muted, fontWeight: '800' }}>Quantité à livrer</Text>
                      <TextInput
                        value={inp.units}
                        onChangeText={(t) => setLineInput(l.ligneCommandeId, { units: digitsOnly(t) })}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={theme.muted}
                        editable={canDeliver && l.remainingUnits > 0 && stockOk}
                        style={{
                          marginTop: 6,
                          backgroundColor: theme.surface,
                          borderRadius: 12,
                          paddingHorizontal: 12,
                          paddingVertical: 10,
                          color: theme.text,
                          borderWidth: 1,
                          borderColor: theme.isDark ? '#1f2937' : '#e5e7eb',
                        }}
                      />
                    </View>

                    <Pressable
                      onPress={() => fillAllForLine(l.ligneCommandeId)}
                      disabled={!canDeliver || l.remainingUnits <= 0 || !stockOk}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        borderRadius: 12,
                        backgroundColor: theme.surface,
                        borderWidth: 1,
                        borderColor: theme.isDark ? '#1f2937' : '#e5e7eb',
                        opacity: !canDeliver || l.remainingUnits <= 0 || !stockOk ? 0.6 : 1,
                      }}
                    >
                      <Text style={{ color: theme.text, fontWeight: '900' }}>Tout</Text>
                      <Text style={{ color: theme.muted, fontSize: 12, marginTop: 2 }}>{maxPossible}</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })
          ) : (
            <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: theme.isDark ? '#1f2937' : '#e5e7eb' }}>
              <Text style={{ color: theme.text, fontWeight: '900' }}>Confirmation</Text>
              <Text style={{ color: theme.muted, marginTop: 6 }}>Vérifiez les quantités avant de valider.</Text>
              <View style={{ marginTop: 10 }}>
                {selectedLines.map((l) => (
                  <View key={String(l.ligneCommandeId)} style={{ backgroundColor: theme.surface, borderRadius: 14, padding: 12, marginBottom: 10 }}>
                    <Text style={{ color: theme.text, fontWeight: '900' }} numberOfLines={2}>
                      {l.designation}
                    </Text>
                    <Text style={{ color: theme.muted, marginTop: 6 }}>
                      Livrer: {formatThousands(l.deliverUnits)} • Restant: {formatThousands(l.remainingUnits)} • Dispo: {formatThousands(l.availableUnits)}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
                <Pressable
                  onPress={() => setStep('SAISIE')}
                  disabled={submitting}
                  style={{
                    flex: 1,
                    backgroundColor: theme.surface,
                    paddingVertical: 12,
                    borderRadius: 14,
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: theme.isDark ? '#1f2937' : '#e5e7eb',
                    opacity: submitting ? 0.6 : 1,
                  }}
                >
                  <Text style={{ color: theme.text, fontWeight: '900' }}>Modifier</Text>
                </Pressable>
                <Pressable
                  onPress={submit}
                  disabled={submitting || !canDeliver}
                  style={{
                    flex: 1,
                    backgroundColor: theme.primary,
                    paddingVertical: 12,
                    borderRadius: 14,
                    alignItems: 'center',
                    opacity: submitting || !canDeliver ? 0.6 : 1,
                  }}
                >
                  <Text style={{ color: 'white', fontWeight: '900' }}>{submitting ? 'Validation...' : 'Valider'}</Text>
                </Pressable>
              </View>
            </View>
          )}

          {step === 'SAISIE' ? (
            <Pressable
              onPress={continueToConfirm}
              disabled={!canDeliver || submitting}
              style={{
                marginTop: 12,
                backgroundColor: theme.primary,
                paddingVertical: 12,
                borderRadius: 14,
                alignItems: 'center',
                opacity: !canDeliver || submitting ? 0.6 : 1,
              }}
            >
              <Text style={{ color: 'white', fontWeight: '900' }}>Continuer</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
