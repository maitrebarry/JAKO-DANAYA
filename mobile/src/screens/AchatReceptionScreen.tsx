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
import { useTheme } from '../theme';
import { useApp } from '../store/AppContext';
import {
  createReception,
  fetchCommandeFournisseurById,
  fetchReceptionArticlesForCommande,
  type CommandeFournisseurDTO,
  type CreateReceptionPayload,
  type ReceptionArticleDTO,
} from '../services/achat';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AchatStackParamList } from '../navigation/achatTypes';
import { showError, showSuccess } from '../utils/notify';
import { useAccess } from '../utils/access';

function digitsOnly(input: string) {
  return (input || '').replace(/\D+/g, '');
}

function supplierLabel(cmd: CommandeFournisseurDTO | null) {
  const f = cmd?.fournisseur;
  if (!f) return '';
  const name = [f.prenom, f.nom].filter(Boolean).join(' ').trim();
  return name || `Fournisseur #${f.id}`;
}

type LineInput = {
  units: string;
  cartons: string;
};

type Step = 'SAISIE' | 'CONFIRMATION';

function generateRefReception() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const timeStr = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `REC-${dateStr}-${timeStr}`;
}

export default function AchatReceptionScreen() {
  const theme = useTheme();
  const { token, boutiqueId } = useApp();
  const access = useAccess();
  const navigation = useNavigation<NativeStackNavigationProp<AchatStackParamList>>();
  const route = useRoute<RouteProp<AchatStackParamList, 'AchatReception'>>();
  const id = route.params?.id;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cmd, setCmd] = useState<CommandeFournisseurDTO | null>(null);
  const [articles, setArticles] = useState<ReceptionArticleDTO[]>([]);
  const [inputs, setInputs] = useState<Record<number, LineInput>>({});
  const [step, setStep] = useState<Step>('SAISIE');
  const [reference] = useState(generateRefReception());

  const lines = useMemo(() => (Array.isArray(cmd?.lignes) ? cmd!.lignes! : []), [cmd]);

  const byProduitId = useMemo(() => {
    const m = new Map<number, any>();
    (lines || []).forEach((l: any) => {
      const pid = l?.produitId;
      if (pid != null) m.set(Number(pid), l);
    });
    return m;
  }, [lines]);

  const viewLines = useMemo(() => {
    const list = (articles || [])
      .filter((a) => a && a.idProduit != null)
      .map((a) => {
        const produitId = Number(a.idProduit);
        const l = byProduitId.get(produitId);
        const multiplicateur = Number(l?.multiplicateur || 1);
        const remainingUnits = Math.max(0, Number(a.receptionActuelle || 0));
        return {
          produitId,
          designation: (a.designation || l?.nom || '').toString(),
          depot: (a.depot || l?.depot || '').toString(),
          remainingUnits,
          multiplicateur: Number.isFinite(multiplicateur) && multiplicateur > 0 ? multiplicateur : 1,
          unitLabel: (l?.unite?.libelle || l?.unite?.symbole || 'unité').toString(),
        };
      });
    return list;
  }, [articles, byProduitId]);

  const selectedLines = useMemo(() => {
    return viewLines
      .map((l) => {
        const input = inputs[l.produitId] || { units: '', cartons: '' };
        const units = Number(digitsOnly(input.units) || 0);
        const cartons = Number(digitsOnly(input.cartons) || 0);
        const receivedUnits = Math.max(0, Math.trunc(units) + Math.trunc(cartons) * l.multiplicateur);
        return { ...l, receivedUnits };
      })
      .filter((l) => l.receivedUnits > 0);
  }, [viewLines, inputs]);

  const load = useCallback(async () => {
    if (!token) return;
    if (!access.achats) {
      setCmd(null);
      setArticles([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [commande, receivable] = await Promise.all([
        fetchCommandeFournisseurById(id, token),
        fetchReceptionArticlesForCommande(id, token),
      ]);
      setCmd(commande);
      setArticles(Array.isArray(receivable) ? receivable : []);

      const init: Record<number, LineInput> = {};
      const byPid = new Map<number, any>();
      (commande?.lignes || []).forEach((l: any) => {
        if (l?.produitId != null) byPid.set(Number(l.produitId), l);
      });

      (receivable || []).forEach((a: any) => {
        if (a?.idProduit == null) return;
        const pid = Number(a.idProduit);
        const remainingUnits = Math.max(0, Number(a.receptionActuelle || 0));
        const l = byPid.get(pid);
        const mul = Number(l?.multiplicateur || 1);
        const multiplicateur = Number.isFinite(mul) && mul > 0 ? mul : 1;

        if (multiplicateur > 1 && remainingUnits % multiplicateur === 0) {
          init[pid] = { units: '0', cartons: String(Math.floor(remainingUnits / multiplicateur)) };
        } else {
          init[pid] = { units: String(remainingUnits), cartons: multiplicateur > 1 ? '0' : '' };
        }
      });
      setInputs(init);
      setStep('SAISIE');
    } catch (e: any) {
      showError('Erreur', e?.message || 'Impossible de charger la commande');
    } finally {
      setLoading(false);
    }
  }, [token, id, access.achats]);

  useEffect(() => {
    load();
  }, [load]);

  const setLineInput = useCallback((produitId: number, patch: Partial<LineInput>) => {
    setInputs((prev) => ({
      ...prev,
      [produitId]: { ...(prev[produitId] || { units: '', cartons: '' }), ...patch },
    }));
  }, []);

  const fillAllForLine = useCallback(
    (produitId: number) => {
      const line = viewLines.find((l) => l.produitId === produitId);
      if (!line) return;
      if (line.multiplicateur > 1 && line.remainingUnits % line.multiplicateur === 0) {
        const cartons = Math.floor(line.remainingUnits / line.multiplicateur);
        setLineInput(produitId, { cartons: String(cartons), units: '0' });
      } else {
        setLineInput(produitId, { units: String(line.remainingUnits), cartons: '0' });
      }
    },
    [setLineInput, viewLines]
  );

  const continueToConfirm = useCallback(() => {
    if (selectedLines.length === 0) {
      showError('Réception', 'Renseignez au moins une ligne.');
      return;
    }
    const invalid = selectedLines.find((l) => l.receivedUnits > l.remainingUnits);
    if (invalid) {
      showError('Quantité invalide', `La quantité reçue dépasse le restant pour ${invalid.designation || 'un article'}.`);
      return;
    }
    setStep('CONFIRMATION');
  }, [selectedLines]);

  const submit = useCallback(async () => {
    if (!token) {
      showError('Connexion', 'Vous devez être connecté.');
      return;
    }
    if (!id) {
      showError('Commande', 'Commande inconnue.');
      return;
    }

    const invalid = selectedLines.find((l) => l.receivedUnits > l.remainingUnits);
    if (invalid) {
      showError('Quantité invalide', `La quantité reçue dépasse le restant pour ${invalid.designation || 'un article'}.`);
      return;
    }

    const payload: CreateReceptionPayload = {
      reference,
      dateReception: new Date().toISOString(),
      timezoneOffsetMinutes: new Date().getTimezoneOffset(),
      idCommandeFournisseur: id,
      referenceCommande: cmd?.reference,
      fournisseur: supplierLabel(cmd),
      idBoutique: boutiqueId ?? undefined,
      lignesReception: selectedLines.map((l) => ({
        idProduit: l.produitId,
        designation: l.designation,
        depot: l.depot,
        stock: null,
        qteCommande: null,
        qteRecue: null,
        receptionActuelle: l.receivedUnits,
        quantiteConditionnement:
          l.multiplicateur > 1 && l.receivedUnits % l.multiplicateur === 0
            ? Math.floor(l.receivedUnits / l.multiplicateur)
            : null,
      })),
    };

    setSubmitting(true);
    try {
      await createReception(payload, token);
      showSuccess('Réception enregistrée', `Commande: ${cmd?.reference || id}`);
      navigation.goBack();
    } catch (e: any) {
      showError('Erreur', e?.message || 'Réception impossible');
    } finally {
      setSubmitting(false);
    }
  }, [boutiqueId, cmd, id, navigation, reference, selectedLines, token]);

  if (!token) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background, padding: 16 }}>
        <Text style={{ color: theme.text, fontWeight: '900' }}>Authentification requise</Text>
      </View>
    );
  }

  if (token && !access.achats) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background, padding: 16 }}>
        <Text style={{ color: theme.text, fontWeight: '900' }}>Permission requise</Text>
        <Text style={{ marginTop: 8, color: theme.muted, textAlign: 'center' }}>
          Vous n'avez pas la permission de voir les commandes fournisseur.
        </Text>
        <Pressable
          onPress={() => navigation.goBack()}
          style={{ marginTop: 12, backgroundColor: theme.surface, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, borderColor: theme.isDark ? '#1f2937' : '#e5e7eb' }}
        >
          <Text style={{ color: theme.text, fontWeight: '900' }}>Retour</Text>
        </Pressable>
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
          <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: theme.isDark ? '#1f2937' : '#e5e7eb' }}>
            <Text style={{ color: theme.text, fontSize: 18, fontWeight: '900' }} numberOfLines={1}>
              Réception
            </Text>
            <Text style={{ color: theme.muted, marginTop: 4 }} numberOfLines={1}>
              {cmd?.reference || `Commande #${id}`} • {supplierLabel(cmd)}
            </Text>
            <Text style={{ color: theme.muted, marginTop: 8 }}>
              Réception fractionnée (restant à recevoir). Réf: {reference}
            </Text>
          </View>

          <Text style={{ color: theme.text, fontSize: 16, fontWeight: '900', marginTop: 14, marginBottom: 10 }}>Lignes</Text>

          {viewLines.length === 0 ? (
            <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: theme.isDark ? '#1f2937' : '#e5e7eb' }}>
              <Text style={{ color: theme.muted, fontWeight: '800' }}>Aucun article à recevoir (déjà complet).</Text>
            </View>
          ) : step === 'SAISIE' ? (
            viewLines.map((l) => {
              const hasCond = l.multiplicateur > 1;
              const inp = inputs[l.produitId] || { units: '', cartons: '' };
              return (
                <View key={String(l.produitId)} style={{ backgroundColor: theme.card, borderRadius: 16, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: theme.isDark ? '#1f2937' : '#e5e7eb' }}>
                  <Text style={{ color: theme.text, fontWeight: '900' }} numberOfLines={2}>
                    {l.designation || `Produit #${l.produitId}`}
                  </Text>
                  <Text style={{ color: theme.muted, marginTop: 2 }} numberOfLines={1}>
                    Restant: {l.remainingUnits} {l.unitLabel}
                    {hasCond ? ` • ${l.multiplicateur} u/carton` : ''}
                  </Text>
                  {!!l.depot && (
                    <Text style={{ color: theme.muted, marginTop: 2 }} numberOfLines={1}>
                      Dépôt: {l.depot}
                    </Text>
                  )}

                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.muted, marginBottom: 6 }}>Reçu (unités)</Text>
                      <TextInput
                        value={inp.units}
                        onChangeText={(v) => setLineInput(l.produitId, { units: digitsOnly(v) })}
                        placeholder="0"
                        placeholderTextColor={theme.muted}
                        keyboardType="numeric"
                        style={{ backgroundColor: theme.surface, color: theme.text, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: theme.isDark ? '#1f2937' : '#e5e7eb' }}
                      />
                    </View>
                    <View style={{ flex: 1, opacity: hasCond ? 1 : 0.5 }}>
                      <Text style={{ color: theme.muted, marginBottom: 6 }}>Reçu (cartons)</Text>
                      <TextInput
                        value={inp.cartons}
                        onChangeText={(v) => setLineInput(l.produitId, { cartons: digitsOnly(v) })}
                        placeholder={hasCond ? '0' : 'N/A'}
                        placeholderTextColor={theme.muted}
                        keyboardType="numeric"
                        editable={hasCond}
                        style={{ backgroundColor: theme.surface, color: theme.text, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: theme.isDark ? '#1f2937' : '#e5e7eb' }}
                      />
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 }}>
                    <Pressable
                      onPress={() => fillAllForLine(l.produitId)}
                      style={{ backgroundColor: theme.surface, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.isDark ? '#1f2937' : '#e5e7eb' }}
                    >
                      <Text style={{ color: theme.text, fontWeight: '900' }}>Tout recevoir</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })
          ) : (
            <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: theme.isDark ? '#1f2937' : '#e5e7eb' }}>
              <Text style={{ color: theme.text, fontWeight: '900' }}>Confirmation</Text>
              <Text style={{ color: theme.muted, marginTop: 6 }}>Vérifie les quantités avant validation.</Text>
              {selectedLines.map((l) => (
                <View key={String(l.produitId)} style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.isDark ? '#1f2937' : '#e5e7eb' }}>
                  <Text style={{ color: theme.text, fontWeight: '900' }} numberOfLines={2}>
                    {l.designation || `Produit #${l.produitId}`}
                  </Text>
                  <Text style={{ color: theme.muted, marginTop: 2 }}>
                    Reçu: {l.receivedUnits} • Restant: {l.remainingUnits}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {viewLines.length > 0 ? (
            step === 'SAISIE' ? (
              <Pressable
                onPress={continueToConfirm}
                disabled={submitting}
                style={{ marginTop: 8, backgroundColor: submitting ? theme.muted : theme.primary, paddingVertical: 12, borderRadius: 14, alignItems: 'center' }}
              >
                <Text style={{ color: 'white', fontWeight: '900' }}>Continuer</Text>
              </Pressable>
            ) : (
              <View style={{ marginTop: 8 }}>
                <Pressable
                  onPress={() => setStep('SAISIE')}
                  disabled={submitting}
                  style={{ backgroundColor: theme.surface, paddingVertical: 12, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: theme.isDark ? '#1f2937' : '#e5e7eb' }}
                >
                  <Text style={{ color: theme.text, fontWeight: '900' }}>Retour</Text>
                </Pressable>

                <Pressable
                  onPress={submit}
                  disabled={submitting}
                  style={{ marginTop: 10, backgroundColor: submitting ? theme.muted : theme.primary, paddingVertical: 12, borderRadius: 14, alignItems: 'center' }}
                >
                  {submitting ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <ActivityIndicator color="white" />
                      <Text style={{ color: 'white', fontWeight: '900', marginLeft: 10 }}>Envoi...</Text>
                    </View>
                  ) : (
                    <Text style={{ color: 'white', fontWeight: '900' }}>Valider la réception</Text>
                  )}
                </Pressable>
              </View>
            )
          ) : null}

          <Pressable onPress={load} style={{ marginTop: 10, alignItems: 'center' }}>
            <Text style={{ color: theme.muted, fontWeight: '800' }}>Rafraîchir</Text>
          </Pressable>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
