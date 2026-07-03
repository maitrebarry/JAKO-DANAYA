import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, Switch, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { useApp } from '../store/AppContext';
import { fetchHistoriqueBoutique, type HistoriqueItemDTO } from '../services/achat';
import { cancelPaiement, cancelReception } from '../services/historique';
import { downloadAndSharePdf } from '../services/pdf';
import { hasPermission, isSuperAdmin } from '../utils/permissions';
import { showError, showSuccess } from '../utils/notify';
import { useFormatMoney } from '../utils/currency';

type FilterType = 'ALL' | 'RECEPTION' | 'PAIEMENT';

export default function HistoriqueAchatsScreen() {
  const theme = useTheme();
  const { token, boutiqueId, profile } = useApp();
  const fmtMoney = useFormatMoney();
  const borderColor = (theme as any).isDark ? '#1f2937' : '#e5e7eb';

  const canAnnulerPaiement = isSuperAdmin(profile) || hasPermission(profile, ['PAIEMENT_ANNULATION', 'PAIEMENT_SUPPRESSION']);
  const canAnnulerReception = isSuperAdmin(profile) || hasPermission(profile, ['RECEPTION_ANNULATION', 'RECEPTION_SUPPRESSION']);

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<HistoriqueItemDTO[]>([]);
  const [filterType, setFilterType] = useState<FilterType>('ALL');
  const [search, setSearch] = useState('');
  const [viewingAnnulations, setViewingAnnulations] = useState(false);

  const load = useCallback(async () => {
    if (!token || !boutiqueId) return;
    setLoading(true);
    try {
      const list = await fetchHistoriqueBoutique(boutiqueId, token, { annulations: viewingAnnulations });
      setItems(list);
    } catch (e: any) {
      showError('Erreur', e?.message || 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }, [token, boutiqueId, viewingAnnulations]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    let list = items;
    if (filterType !== 'ALL') list = list.filter((i) => i.type === filterType);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((i) => {
        const s = `${i.reference || ''} ${i.referenceCommande || ''} ${i.fournisseur || ''}`.toLowerCase();
        return s.includes(q);
      });
    }
    return list;
  }, [items, filterType, search]);

  const printReceptionPdf = async (id: number) => {
    if (!token) return;
    try {
      await downloadAndSharePdf({ apiPath: `receptions/${id}/pdf`, token, filename: `reception-${id}.pdf` });
    } catch (e: any) {
      showError('Erreur', e?.message || "Impossible d'ouvrir le PDF");
    }
  };

  const printPaiementPdf = async (id: number) => {
    if (!token) return;
    try {
      await downloadAndSharePdf({ apiPath: `paiements/${id}/pdf`, token, filename: `paiement-${id}.pdf` });
    } catch (e: any) {
      showError('Erreur', e?.message || "Impossible d'ouvrir le PDF");
    }
  };

  const annulerItem = (item: HistoriqueItemDTO) => {
    const isPaiement = item.type === 'PAIEMENT';
    if (isPaiement && !canAnnulerPaiement) {
      showError('Accès refusé', 'Permission manquante');
      return;
    }
    if (!isPaiement && !canAnnulerReception) {
      showError('Accès refusé', 'Permission manquante');
      return;
    }
    Alert.alert('Annuler', `Annuler ${isPaiement ? 'ce paiement' : 'cette réception'} ?`, [
      { text: 'Retour', style: 'cancel' },
      {
        text: 'Annuler',
        style: 'destructive',
        onPress: async () => {
          if (!token) return;
          try {
            if (isPaiement) await cancelPaiement(item.id, 'Annulation via historique', token);
            else await cancelReception(item.id, 'Annulation via historique', token);
            showSuccess('Succès', 'Annulé');
            await load();
          } catch (e: any) {
            showError('Erreur', e?.message || 'Annulation impossible');
          }
        },
      },
    ]);
  };

  if (!token || !boutiqueId) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.background }}>
        <Text style={{ color: theme.text }}>Connectez-vous pour continuer.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ padding: 16, paddingBottom: 8 }}>
        <Text style={{ color: theme.text, fontSize: 20, fontWeight: '900', marginBottom: 10 }}>Historique achats</Text>

        <View style={{ flexDirection: 'row', gap: 8 as any, marginBottom: 10 }}>
          {(['ALL', 'RECEPTION', 'PAIEMENT'] as FilterType[]).map((t) => (
            <Pressable
              key={t}
              onPress={() => setFilterType(t)}
              style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: filterType === t ? theme.primary : theme.surface, borderWidth: 1, borderColor }}
            >
              <Text style={{ color: theme.text }}>{t === 'ALL' ? 'Tout' : t === 'RECEPTION' ? 'Réceptions' : 'Paiements'}</Text>
            </Pressable>
          ))}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.card, borderRadius: 12, paddingHorizontal: 10, borderWidth: 1, borderColor, marginBottom: 10 }}>
          <Ionicons name="search" size={18} color={theme.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Rechercher (référence, fournisseur)"
            placeholderTextColor={theme.muted}
            style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 10, color: theme.text }}
          />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: theme.muted, fontWeight: '900' }}>Afficher annulations</Text>
          <Switch value={viewingAnnulations} onValueChange={setViewingAnnulations} />
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 20 }} color={theme.primary} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item, idx) => `${item.type}-${item.id}-${idx}`}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
          ListEmptyComponent={<Text style={{ color: theme.muted, textAlign: 'center', marginTop: 20 }}>Aucun élément.</Text>}
          renderItem={({ item }) => {
            const isPaiement = item.type === 'PAIEMENT';
            return (
              <View style={{ backgroundColor: theme.card, borderRadius: 14, padding: 12, borderWidth: 1, borderColor, marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ backgroundColor: isPaiement ? '#10b98122' : '#ef444422', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: isPaiement ? '#10b981' : '#ef4444' }}>
                    <Text style={{ color: theme.text, fontWeight: '900' }}>{item.type}</Text>
                  </View>
                  <Text style={{ color: theme.muted }}>{item.date || '—'}</Text>
                </View>
                <Text style={{ color: theme.text, fontWeight: '900', marginTop: 8 }}>{item.reference || '—'}</Text>
                {item.referenceCommande ? <Text style={{ color: theme.muted, marginTop: 2 }}>Commande: {item.referenceCommande}</Text> : null}
                <Text style={{ color: theme.muted, marginTop: 2 }}>{item.fournisseur || '—'}</Text>
                {item.montant != null ? <Text style={{ color: theme.text, fontWeight: '900', marginTop: 4 }}>{fmtMoney(item.montant)}</Text> : null}

                <View style={{ flexDirection: 'row', gap: 10 as any, marginTop: 12 }}>
                  <Pressable
                    onPress={() => (isPaiement ? printPaiementPdf(item.id) : printReceptionPdf(item.id))}
                    style={{ flex: 1, backgroundColor: theme.surface, borderWidth: 1, borderColor, paddingVertical: 10, borderRadius: 12, alignItems: 'center' }}
                  >
                    <Text style={{ color: theme.text, fontWeight: '900' }}>PDF</Text>
                  </Pressable>
                  {!viewingAnnulations ? (
                    <Pressable
                      onPress={() => annulerItem(item)}
                      style={{ flex: 1, backgroundColor: theme.danger, paddingVertical: 10, borderRadius: 12, alignItems: 'center' }}
                    >
                      <Text style={{ color: '#fff', fontWeight: '900' }}>Annuler</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}
