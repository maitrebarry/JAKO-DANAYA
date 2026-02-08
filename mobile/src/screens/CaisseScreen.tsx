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
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { useApp } from '../store/AppContext';
import {
  createCaisse,
  getCaisse,
  listCaisses,
  listMovementsByBoutique,
  listMovementsByReference,
  updateCaisse,
  type CaisseDTO,
  type CaisseMovementDTO,
} from '../services/caisse';
import { showError, showInfo, showSuccess } from '../utils/notify';
import { hasPermission, isSuperAdmin } from '../utils/permissions';

function digitsOnly(input: string) {
  return (input || '').replace(/\D+/g, '');
}

function formatThousandsFromDigits(digits: string) {
  const d = digitsOnly(digits);
  if (!d) return '';
  return d.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function parseIntFromDigits(digitsOrFormatted: string) {
  const d = digitsOnly(digitsOrFormatted);
  if (!d) return 0;
  const n = Number(d);
  return Number.isFinite(n) ? n : 0;
}

function todayYyyyMmDd() {
  return new Date().toISOString().slice(0, 10);
}

function formatDateHuman(d?: string | null) {
  if (!d) return '-';
  // Accept yyyy-MM-dd or ISO
  const s = String(d);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.split('-').reverse().join('/');
  if (s.includes('T')) return s.split('T')[0].split('-').reverse().join('/');
  return s;
}

function badgeColorForMovementType(label?: string | null) {
  const key = String(label || '').toUpperCase();
  if (key.includes('ENTREE') || key.includes('CREDIT')) return { bg: '#16a34a', fg: '#fff' };
  if (key.includes('SORTIE') || key.includes('DEPENSE')) return { bg: '#dc2626', fg: '#fff' };
  if (key.includes('REVERSE') || key.includes('REVERSAL') || key.includes('ANNUL')) return { bg: '#f59e0b', fg: '#111827' };
  return { bg: '#6b7280', fg: '#fff' };
}

function formatMoney(n?: number | null) {
  const v = Math.trunc(Number(n || 0));
  const s = String(v);
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export default function CaisseScreen() {
  const theme = useTheme();
  const { token, boutiqueId, profile } = useApp();

  const [tab, setTab] = useState<'REGISTRE' | 'MOUVEMENTS'>('REGISTRE');

  const [loadingCaisses, setLoadingCaisses] = useState(false);
  const [caisses, setCaisses] = useState<CaisseDTO[]>([]);

  const [dateCaisse, setDateCaisse] = useState(todayYyyyMmDd());
  const [montantInitialText, setMontantInitialText] = useState('');
  const [statutOuverte, setStatutOuverte] = useState(true);
  const [creating, setCreating] = useState(false);

  const [refSearch, setRefSearch] = useState('');
  const [loadingMovements, setLoadingMovements] = useState(false);
  const [movements, setMovements] = useState<CaisseMovementDTO[]>([]);

  const canViewMovements = useMemo(() => {
    if (!profile) return false;
    return isSuperAdmin(profile) || hasPermission(profile, 'CAISSE_MOUVEMENT_VIEW');
  }, [profile]);

  const canCreateCaisse = useMemo(() => {
    if (!profile) return false;
    return isSuperAdmin(profile) || hasPermission(profile, ['CAISSE_GERER', 'CAISSE_CREER']);
  }, [profile]);

  const canManageCaisse = useMemo(() => {
    if (!profile) return false;
    return isSuperAdmin(profile) || hasPermission(profile, 'CAISSE_GERER');
  }, [profile]);

  const caissesForBoutique = useMemo(() => {
    const bid = Number(boutiqueId || 0);
    if (!bid) return [];
    return (caisses || []).filter((c) => Number(c?.boutique?.id) === bid);
  }, [caisses, boutiqueId]);

  const openCaisse = useMemo(() => {
    return caissesForBoutique.find((c) => String(c?.statut || '').toUpperCase() === 'OUVERTE') || null;
  }, [caissesForBoutique]);

  const hasOpenCaisse = !!openCaisse;

  const loadCaisses = useCallback(async () => {
    if (!token) return;
    setLoadingCaisses(true);
    try {
      const list = await listCaisses(token);
      setCaisses(Array.isArray(list) ? list : []);
    } catch (e: any) {
      showError('Erreur', e?.message || 'Impossible de charger les caisses');
    } finally {
      setLoadingCaisses(false);
    }
  }, [token]);

  useEffect(() => {
    loadCaisses();
  }, [loadCaisses]);

  useEffect(() => {
    if (tab === 'MOUVEMENTS' && !canViewMovements) setTab('REGISTRE');
  }, [tab, canViewMovements]);

  const onCreate = useCallback(async () => {
    if (!token) {
      showError('Connexion', 'Vous devez être connecté.');
      return;
    }
    if (!canCreateCaisse) {
      showError('Permission', "Vous n'avez pas la permission de créer une caisse.");
      return;
    }
    if (!boutiqueId) {
      showError('Boutique', 'Boutique inconnue.');
      return;
    }
    if (hasOpenCaisse) {
      showInfo('Caisse', `Une caisse est déjà ouverte (${openCaisse?.reference || ''}). Fermez-la avant d'en créer une nouvelle.`);
      return;
    }
    if (!dateCaisse || !/^\d{4}-\d{2}-\d{2}$/.test(dateCaisse)) {
      showError('Date', 'Renseignez une date valide (YYYY-MM-DD).');
      return;
    }

    const montantInitial = parseIntFromDigits(montantInitialText);
    if (!montantInitial || montantInitial <= 0) {
      showError('Montant initial', 'Le montant initial est requis.');
      return;
    }

    setCreating(true);
    try {
      const refCandidate = `CAISSE-${dateCaisse.replace(/-/g, '')}-${new Date().toTimeString().slice(0, 8).replace(/:/g, '')}`;
      await createCaisse(
        {
          dateCaisse,
          montantInitial: Math.round(montantInitial),
          montantTotal: Math.round(montantInitial),
          reference: refCandidate,
          statut: statutOuverte ? 'OUVERTE' : 'FERMEE',
          boutique: { id: Number(boutiqueId) },
        },
        token
      );
      showSuccess('Caisse créée', '');
      setMontantInitialText('');
      setStatutOuverte(true);
      await loadCaisses();
    } catch (e: any) {
      showError('Erreur', e?.message || 'Création impossible');
    } finally {
      setCreating(false);
    }
  }, [token, canCreateCaisse, boutiqueId, hasOpenCaisse, openCaisse?.reference, dateCaisse, montantInitialText, statutOuverte, loadCaisses]);

  const toggleStatut = useCallback(
    async (c: CaisseDTO) => {
      if (!token) return;
      if (!canManageCaisse) {
        showError('Permission', "Vous n'avez pas la permission de modifier une caisse.");
        return;
      }
      const id = Number(c?.id);
      if (!id) return;
      const current = String(c?.statut || '').toUpperCase();
      const next = current === 'OUVERTE' ? 'FERMEE' : 'OUVERTE';
      try {
        const full = await getCaisse(id, token);
        const updated = { ...full, statut: next };
        await updateCaisse(id, updated as any, token);
        showSuccess('Statut mis à jour', next);
        await loadCaisses();
      } catch (e: any) {
        showError('Erreur', e?.message || 'Impossible de mettre à jour le statut');
      }
    },
    [token, canManageCaisse, loadCaisses]
  );

  const fetchMovementsRef = useCallback(
    async (ref: string) => {
      if (!token) return;
      if (!canViewMovements) {
        showError('Permission', "Vous n'avez pas la permission de consulter les mouvements.");
        return;
      }
      const r = (ref || '').trim();
      if (!r) {
        showInfo('Référence', 'Renseignez une référence de caisse.');
        return;
      }
      setLoadingMovements(true);
      try {
        const list = await listMovementsByReference(r, token);
        setMovements(Array.isArray(list) ? list : []);
      } catch (e: any) {
        showError('Erreur', e?.message || 'Erreur chargement mouvements');
      } finally {
        setLoadingMovements(false);
      }
    },
    [token, canViewMovements]
  );

  const fetchMovementsBoutique = useCallback(async () => {
    if (!token) return;
    if (!canViewMovements) {
      showError('Permission', "Vous n'avez pas la permission de consulter les mouvements.");
      return;
    }
    if (!boutiqueId) {
      showInfo('Boutique', 'Boutique inconnue.');
      return;
    }
    setLoadingMovements(true);
    try {
      const list = await listMovementsByBoutique(Number(boutiqueId), token);
      setMovements(Array.isArray(list) ? list : []);
    } catch (e: any) {
      showError('Erreur', e?.message || 'Erreur chargement mouvements');
    } finally {
      setLoadingMovements(false);
    }
  }, [token, canViewMovements, boutiqueId]);

  if (!token) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16, backgroundColor: theme.background }}>
        <Text style={{ fontSize: 18, fontWeight: '900', color: theme.text }}>Caisse</Text>
        <Text style={{ marginTop: 8, color: theme.muted, textAlign: 'center' }}>Connectez-vous pour accéder à la caisse.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ padding: 16, paddingBottom: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: theme.text, fontSize: 22, fontWeight: '900' }}>Caisse</Text>
          <Pressable
            onPress={() => {
              if (tab === 'REGISTRE') loadCaisses();
              else {
                if (!canViewMovements) {
                  setTab('REGISTRE');
                  loadCaisses();
                  return;
                }
                fetchMovementsBoutique();
              }
            }}
            style={{ paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, backgroundColor: theme.surface }}
          >
            <Ionicons name="refresh" size={18} color={theme.text} />
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
          <Pressable
            onPress={() => setTab('REGISTRE')}
            style={{
              flex: 1,
              backgroundColor: tab === 'REGISTRE' ? theme.primary : theme.surface,
              paddingVertical: 10,
              borderRadius: 12,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: tab === 'REGISTRE' ? '#fff' : theme.text, fontWeight: '800' }}>Registre</Text>
          </Pressable>
          {canViewMovements ? (
            <Pressable
              onPress={() => setTab('MOUVEMENTS')}
              style={{
                flex: 1,
                backgroundColor: tab === 'MOUVEMENTS' ? theme.primary : theme.surface,
                paddingVertical: 10,
                borderRadius: 12,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: tab === 'MOUVEMENTS' ? '#fff' : theme.text, fontWeight: '800' }}>Mouvements</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {tab === 'REGISTRE' ? (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28 }} keyboardShouldPersistTaps="handled">
          <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: theme.isDark ? '#1f2937' : '#e5e7eb' }}>
            <Text style={{ color: theme.text, fontSize: 16, fontWeight: '900' }}>Nouvelle caisse</Text>

            {hasOpenCaisse && (
              <Text style={{ color: '#f59e0b', marginTop: 8, fontWeight: '700' }}>
                Une caisse est ouverte: {openCaisse?.reference || ''}
              </Text>
            )}

            <Text style={{ color: theme.muted, marginTop: 10, marginBottom: 6 }}>Date (YYYY-MM-DD)</Text>
            <TextInput
              value={dateCaisse}
              onChangeText={setDateCaisse}
              placeholder="2026-02-08"
              placeholderTextColor={theme.muted}
              style={{ backgroundColor: theme.surface, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, color: theme.text }}
            />

            <Text style={{ color: theme.muted, marginTop: 10, marginBottom: 6 }}>Montant initial</Text>
            <TextInput
              value={formatThousandsFromDigits(montantInitialText)}
              onChangeText={(t) => setMontantInitialText(digitsOnly(t))}
              keyboardType="numeric"
              placeholder="Ex: 50 000"
              placeholderTextColor={theme.muted}
              style={{ backgroundColor: theme.surface, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, color: theme.text }}
            />

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
              <Text style={{ color: theme.muted }}>Statut</Text>
              <Pressable
                onPress={() => setStatutOuverte((p) => !p)}
                style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: theme.surface }}
              >
                <Text style={{ color: theme.text, fontWeight: '800' }}>{statutOuverte ? 'OUVERTE' : 'FERMEE'}</Text>
              </Pressable>
            </View>

            <Pressable
              onPress={onCreate}
              disabled={creating || hasOpenCaisse || !canCreateCaisse}
              style={{
                marginTop: 14,
                backgroundColor: creating || hasOpenCaisse || !canCreateCaisse ? '#9ca3af' : '#16a34a',
                paddingVertical: 12,
                borderRadius: 12,
                alignItems: 'center',
              }}
            >
              {creating ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '900' }}>Sauvegarder</Text>}
            </Pressable>

            {!canCreateCaisse ? (
              <Text style={{ color: theme.muted, marginTop: 10, textAlign: 'center' }}>
                Permission requise pour créer une caisse.
              </Text>
            ) : null}
          </View>

          <View style={{ marginTop: 14, backgroundColor: theme.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: theme.isDark ? '#1f2937' : '#e5e7eb' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: theme.text, fontSize: 16, fontWeight: '900' }}>Caisses (boutique)</Text>
              {loadingCaisses ? <ActivityIndicator /> : null}
            </View>

            {caissesForBoutique.length === 0 && !loadingCaisses ? (
              <Text style={{ color: theme.muted, marginTop: 10, textAlign: 'center' }}>Aucune caisse trouvée</Text>
            ) : (
              <View>
                {caissesForBoutique.map((item) => {
                  const statut = String(item?.statut || '').toUpperCase();
                  const isOpen = statut === 'OUVERTE';
                  return (
                    <View key={String(item.id)} style={{ marginTop: 10, backgroundColor: theme.surface, borderRadius: 14, padding: 12 }}>
                      <Text style={{ color: theme.text, fontWeight: '900' }} numberOfLines={1}>
                        {item.reference || `Caisse #${item.id}`}
                      </Text>
                      <Text style={{ color: theme.muted, marginTop: 2 }}>
                        {formatDateHuman(item.dateCaisse)} • {isOpen ? 'OUVERTE' : 'FERMEE'}
                      </Text>

                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
                        <View>
                          <Text style={{ color: theme.muted, fontSize: 12 }}>Initial</Text>
                          <Text style={{ color: theme.text, fontWeight: '800' }}>{formatMoney(item.montantInitial)}</Text>
                        </View>
                        <View>
                          <Text style={{ color: theme.muted, fontSize: 12, textAlign: 'right' }}>Total</Text>
                          <Text style={{ color: theme.text, fontWeight: '800' }}>{formatMoney(item.montantTotal)}</Text>
                        </View>
                      </View>

                      <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                        {canManageCaisse ? (
                          <Pressable
                            onPress={() => toggleStatut(item)}
                            style={{ flex: 1, backgroundColor: theme.primary, paddingVertical: 10, borderRadius: 12, alignItems: 'center' }}
                          >
                            <Text style={{ color: '#fff', fontWeight: '900' }}>{isOpen ? 'Fermer' : 'Ouvrir'}</Text>
                          </Pressable>
                        ) : null}

                        {canViewMovements ? (
                          <Pressable
                            onPress={() => {
                              const ref = String(item?.reference || '').trim();
                              if (!ref) {
                                showInfo('Référence', 'Référence caisse introuvable.');
                                return;
                              }
                              setRefSearch(ref);
                              setTab('MOUVEMENTS');
                              fetchMovementsRef(ref);
                            }}
                            style={{ flex: 1, backgroundColor: theme.surface, paddingVertical: 10, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: theme.isDark ? '#374151' : '#d1d5db' }}
                          >
                            <Text style={{ color: theme.text, fontWeight: '900' }}>Mouvements</Text>
                          </Pressable>
                        ) : null}
                      </View>

                      {!canManageCaisse && !canViewMovements ? (
                        <Text style={{ color: theme.muted, marginTop: 10, textAlign: 'center' }}>
                          Permissions insuffisantes pour gérer ou consulter cette caisse.
                        </Text>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28 }} keyboardShouldPersistTaps="handled">
          {!canViewMovements ? (
            <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: theme.isDark ? '#1f2937' : '#e5e7eb' }}>
              <Text style={{ color: theme.text, fontSize: 16, fontWeight: '900' }}>Mouvements</Text>
              <Text style={{ color: theme.muted, marginTop: 8 }}>Vous n'avez pas la permission de consulter les mouvements.</Text>
            </View>
          ) : (
            <>
              <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: theme.isDark ? '#1f2937' : '#e5e7eb' }}>
                <Text style={{ color: theme.text, fontSize: 16, fontWeight: '900' }}>Recherche mouvements</Text>
                <Text style={{ color: theme.muted, marginTop: 10 }}>Caisse sélectionnée</Text>
                <Text style={{ color: theme.text, marginTop: 6, fontWeight: '900' }} numberOfLines={1}>
                  {refSearch || openCaisse?.reference || '—'}
                </Text>

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                  <Pressable
                    onPress={() => {
                      const ref = String((refSearch || openCaisse?.reference || '')).trim();
                      if (!ref) {
                        showInfo('Caisse', 'Sélectionnez une caisse.');
                        return;
                      }
                      setRefSearch(ref);
                      fetchMovementsRef(ref);
                    }}
                    style={{ flex: 1, backgroundColor: theme.primary, paddingVertical: 10, borderRadius: 12, alignItems: 'center' }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '900' }}>Charger</Text>
                  </Pressable>
                  <Pressable
                    onPress={fetchMovementsBoutique}
                    style={{ flex: 1, backgroundColor: theme.surface, paddingVertical: 10, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: theme.isDark ? '#374151' : '#d1d5db' }}
                  >
                    <Text style={{ color: theme.text, fontWeight: '900' }}>Boutique</Text>
                  </Pressable>
                </View>

                {canViewMovements && caissesForBoutique.length > 0 ? (
                  <View style={{ marginTop: 12 }}>
                    <Text style={{ color: theme.muted, marginBottom: 8 }}>Choisir une caisse</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {caissesForBoutique.slice(0, 8).map((c) => {
                        const ref = String(c?.reference || '').trim();
                        const selected = !!ref && ref === refSearch;
                        return (
                          <Pressable
                            key={String(c.id)}
                            onPress={() => {
                              if (!ref) {
                                showInfo('Référence', 'Référence caisse introuvable.');
                                return;
                              }
                              setRefSearch(ref);
                              fetchMovementsRef(ref);
                            }}
                            style={{ backgroundColor: selected ? theme.primary : theme.surface, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: theme.isDark ? '#374151' : '#d1d5db' }}
                          >
                            <Text style={{ color: selected ? '#fff' : theme.text, fontWeight: '800' }} numberOfLines={1}>
                              {ref || `#${c.id}`}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    {caissesForBoutique.length > 8 ? (
                      <Text style={{ color: theme.muted, marginTop: 8 }}>Ouvrez une caisse dans "Registre" pour la sélectionner.</Text>
                    ) : null}
                  </View>
                ) : null}

                <Pressable
                  onPress={() => {
                    setRefSearch('');
                    setMovements([]);
                  }}
                  style={{ marginTop: 10, paddingVertical: 10, borderRadius: 12, alignItems: 'center' }}
                >
                  <Text style={{ color: theme.muted, fontWeight: '800' }}>Réinitialiser</Text>
                </Pressable>
              </View>

              <View style={{ marginTop: 14, backgroundColor: theme.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: theme.isDark ? '#1f2937' : '#e5e7eb' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ color: theme.text, fontSize: 16, fontWeight: '900' }}>Mouvements</Text>
                  {loadingMovements ? <ActivityIndicator /> : null}
                </View>

                {!loadingMovements && movements.length === 0 ? (
                  <Text style={{ color: theme.muted, marginTop: 10, textAlign: 'center' }}>Aucun mouvement</Text>
                ) : (
                  movements
                    .slice()
                    .sort((a, b) => String(b?.createdAt || '').localeCompare(String(a?.createdAt || '')))
                    .map((m) => {
                      const label = m.typeLabel ?? m.type ?? '';
                      const badge = badgeColorForMovementType(label);
                      return (
                        <View key={String(m.id)} style={{ marginTop: 10, backgroundColor: theme.surface, borderRadius: 14, padding: 12 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={{ color: theme.muted }}>{formatDateHuman(m.createdAt)}</Text>
                            <View style={{ backgroundColor: badge.bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }}>
                              <Text style={{ color: badge.fg, fontWeight: '900', fontSize: 12 }}>{String(label || '').toUpperCase()}</Text>
                            </View>
                          </View>

                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
                            <View>
                              <Text style={{ color: theme.muted, fontSize: 12 }}>Montant</Text>
                              <Text style={{ color: theme.text, fontWeight: '900' }}>{formatMoney(m.montant)} {m.deviseSymbole || ''}</Text>
                            </View>
                            <View>
                              <Text style={{ color: theme.muted, fontSize: 12, textAlign: 'right' }}>Solde</Text>
                              <Text style={{ color: theme.text, fontWeight: '900' }}>{formatMoney(m.balanceAfter)} {m.deviseSymbole || ''}</Text>
                            </View>
                          </View>

                          {!!m.raison && <Text style={{ color: theme.muted, marginTop: 8 }}>Raison: {m.raison}</Text>}
                          {!!m.commandeReference && <Text style={{ color: theme.muted, marginTop: 4 }}>Commande: {m.commandeReference}</Text>}
                          {!!m.paiementReference && <Text style={{ color: theme.muted, marginTop: 4 }}>Paiement: {m.paiementReference}</Text>}
                          {!!m.userFullName && <Text style={{ color: theme.muted, marginTop: 4 }}>Utilisateur: {m.userFullName}</Text>}
                        </View>
                      );
                    })
                )}
              </View>
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
