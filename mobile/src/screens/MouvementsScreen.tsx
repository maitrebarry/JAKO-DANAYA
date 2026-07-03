import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useTheme } from '../theme';
import { useApp } from '../store/AppContext';
import { useAccess } from '../utils/access';
import { searchMouvements, buildMouvementsExportQuery, type MouvementDTO } from '../services/mouvements';
import { listBoutiques, type BoutiqueDTO } from '../services/boutiques';
import { listUsers, type UserDTO } from '../services/admin';
import { listMagasins, type MagasinDTO } from '../services/magasins';
import { downloadAndShareFile } from '../services/pdf';
import { showError, showSuccess } from '../utils/notify';
import { useFormatMoney } from '../utils/currency';

const PAGE_SIZE = 25;

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 19);
}

export default function MouvementsScreen() {
  const theme = useTheme();
  const { token, currentBoutique } = useApp();
  const access = useAccess();
  const fmtMoney = useFormatMoney();
  const borderColor = (theme as any).isDark ? '#1f2937' : '#e5e7eb';
  const isAuditor = access.mouvementsAudit;

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<MouvementDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const [type, setType] = useState('');
  const [sousType, setSousType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [magasinId, setMagasinId] = useState<number | null>(null);
  const [boutiqueId, setBoutiqueId] = useState<number | null>(null);
  const [userId, setUserId] = useState<number | null>(null);

  const [magasins, setMagasins] = useState<MagasinDTO[]>([]);
  const [boutiques, setBoutiques] = useState<BoutiqueDTO[]>([]);
  const [users, setUsers] = useState<UserDTO[]>([]);

  useEffect(() => {
    if (!token) return;
    listMagasins(token).then(setMagasins).catch(() => {});
    if (isAuditor) {
      listBoutiques(token).then(setBoutiques).catch(() => {});
      listUsers(token).then(setUsers).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, isAuditor]);

  const fetchResults = useCallback(
    async (p: number) => {
      if (!token) return;
      setLoading(true);
      try {
        const res = await searchMouvements(
          {
            type: type.trim() || undefined,
            sousType: sousType.trim() || undefined,
            boutiqueId: isAuditor ? boutiqueId : undefined,
            magasinId: magasinId || undefined,
            userId: isAuditor ? userId : undefined,
            from: from || undefined,
            to: to || undefined,
            page: p,
            size: PAGE_SIZE,
          },
          token
        );
        setItems(res.items);
        setTotal(res.total);
        setPage(p);
      } catch (e: any) {
        showError('Erreur', e?.message || 'Chargement impossible');
      } finally {
        setLoading(false);
      }
    },
    [token, type, sousType, boutiqueId, magasinId, userId, from, to, isAuditor]
  );

  useEffect(() => {
    fetchResults(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const applyPreset = (preset: 'jour' | 'semaine' | 'mois' | 'annee') => {
    const days = preset === 'jour' ? 1 : preset === 'semaine' ? 7 : preset === 'mois' ? 30 : 365;
    setFrom(isoDaysAgo(days));
    setTo(new Date().toISOString().slice(0, 19));
    setTimeout(() => fetchResults(1), 0);
  };

  const clearDates = () => {
    setFrom('');
    setTo('');
  };

  const exportCsv = async () => {
    if (!token) return;
    try {
      const qs = buildMouvementsExportQuery({
        type: type.trim() || undefined,
        sousType: sousType.trim() || undefined,
        boutiqueId: isAuditor ? boutiqueId : undefined,
        magasinId: magasinId || undefined,
        userId: isAuditor ? userId : undefined,
        from: from || undefined,
        to: to || undefined,
      });
      await downloadAndShareFile({ apiPath: `mouvements/export?${qs}`, token, filename: `mouvements_export.csv`, mimeType: 'text/csv' });
      showSuccess('Succès', 'Export généré');
    } catch (e: any) {
      showError('Erreur', e?.message || 'Export impossible');
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const boutiqueLabel = useMemo(() => {
    if (!isAuditor) return currentBoutique?.nom || 'Ma boutique';
    return boutiques.find((b) => b.id === boutiqueId)?.nom || 'Toutes';
  }, [isAuditor, boutiques, boutiqueId, currentBoutique]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 8 }}>
        <Text style={{ color: theme.text, fontSize: 20, fontWeight: '900', marginBottom: 10 }}>Mouvements</Text>

        <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor, marginBottom: 12 }}>
          <Text style={{ color: theme.muted, fontWeight: '900', marginBottom: 8 }}>Période rapide</Text>
          <View style={{ flexDirection: 'row', gap: 8 as any, flexWrap: 'wrap' }}>
            <Pressable onPress={() => applyPreset('jour')} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: theme.surface, borderWidth: 1, borderColor }}>
              <Text style={{ color: theme.text }}>Jour</Text>
            </Pressable>
            <Pressable onPress={() => applyPreset('semaine')} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: theme.surface, borderWidth: 1, borderColor }}>
              <Text style={{ color: theme.text }}>Semaine</Text>
            </Pressable>
            <Pressable onPress={() => applyPreset('mois')} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: theme.surface, borderWidth: 1, borderColor }}>
              <Text style={{ color: theme.text }}>Mois</Text>
            </Pressable>
            <Pressable onPress={() => applyPreset('annee')} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: theme.surface, borderWidth: 1, borderColor }}>
              <Text style={{ color: theme.text }}>Année</Text>
            </Pressable>
            {from || to ? (
              <Pressable onPress={clearDates} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: theme.surface, borderWidth: 1, borderColor }}>
                <Text style={{ color: theme.danger }}>Effacer</Text>
              </Pressable>
            ) : null}
          </View>

          <Text style={{ color: theme.muted, fontWeight: '900', marginTop: 12, marginBottom: 6 }}>Type</Text>
          <TextInput value={type} onChangeText={setType} placeholder="Ex. VENTE, CAISSE" placeholderTextColor={theme.muted} style={{ backgroundColor: theme.surface, borderRadius: 10, padding: 10, color: theme.text, borderWidth: 1, borderColor }} />

          <Text style={{ color: theme.muted, fontWeight: '900', marginTop: 12, marginBottom: 6 }}>Sous-type</Text>
          <TextInput value={sousType} onChangeText={setSousType} placeholder="Ex. ESPECE, OUVERTURE" placeholderTextColor={theme.muted} style={{ backgroundColor: theme.surface, borderRadius: 10, padding: 10, color: theme.text, borderWidth: 1, borderColor }} />

          <Text style={{ color: theme.muted, fontWeight: '900', marginTop: 12, marginBottom: 6 }}>Magasin</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Pressable onPress={() => setMagasinId(null)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: magasinId == null ? theme.primary : theme.surface, borderWidth: 1, borderColor, marginRight: 8 }}>
              <Text style={{ color: theme.text }}>Tous</Text>
            </Pressable>
            {magasins.map((m) => (
              <Pressable key={m.id} onPress={() => setMagasinId(m.id)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: magasinId === m.id ? theme.primary : theme.surface, borderWidth: 1, borderColor, marginRight: 8 }}>
                <Text style={{ color: theme.text }}>{m.nom || m.nomMagasin || `#${m.id}`}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {isAuditor ? (
            <>
              <Text style={{ color: theme.muted, fontWeight: '900', marginTop: 12, marginBottom: 6 }}>Boutique</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <Pressable onPress={() => setBoutiqueId(null)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: boutiqueId == null ? theme.primary : theme.surface, borderWidth: 1, borderColor, marginRight: 8 }}>
                  <Text style={{ color: theme.text }}>Toutes</Text>
                </Pressable>
                {boutiques.map((b) => (
                  <Pressable key={b.id} onPress={() => setBoutiqueId(b.id)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: boutiqueId === b.id ? theme.primary : theme.surface, borderWidth: 1, borderColor, marginRight: 8 }}>
                    <Text style={{ color: theme.text }}>{b.nom || `#${b.id}`}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              <Text style={{ color: theme.muted, fontWeight: '900', marginTop: 12, marginBottom: 6 }}>Utilisateur</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <Pressable onPress={() => setUserId(null)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: userId == null ? theme.primary : theme.surface, borderWidth: 1, borderColor, marginRight: 8 }}>
                  <Text style={{ color: theme.text }}>Tous</Text>
                </Pressable>
                {users.map((u) => (
                  <Pressable key={u.id} onPress={() => setUserId(u.id)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: userId === u.id ? theme.primary : theme.surface, borderWidth: 1, borderColor, marginRight: 8 }}>
                    <Text style={{ color: theme.text }}>{`${u.prenom || ''} ${u.nom || ''}`.trim() || u.email}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          ) : (
            <Text style={{ color: theme.muted, marginTop: 10 }}>Boutique: {boutiqueLabel}</Text>
          )}

          <View style={{ flexDirection: 'row', gap: 10 as any, marginTop: 14 }}>
            <Pressable onPress={() => fetchResults(1)} style={{ flex: 1, backgroundColor: theme.primary, paddingVertical: 10, borderRadius: 12, alignItems: 'center' }}>
              <Text style={{ color: theme.text, fontWeight: '900' }}>Rechercher</Text>
            </Pressable>
            <Pressable onPress={exportCsv} style={{ flex: 1, backgroundColor: theme.surface, borderWidth: 1, borderColor, paddingVertical: 10, borderRadius: 12, alignItems: 'center' }}>
              <Text style={{ color: theme.text, fontWeight: '900' }}>Export CSV</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 10 }} color={theme.primary} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(m) => String(m.id)}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
          ListEmptyComponent={<Text style={{ color: theme.muted, textAlign: 'center', marginTop: 10 }}>Aucun mouvement.</Text>}
          renderItem={({ item }) => (
            <View style={{ backgroundColor: theme.card, borderRadius: 14, padding: 12, borderWidth: 1, borderColor, marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: theme.text, fontWeight: '900' }}>{item.typeMouvement}{item.sousType ? ` / ${item.sousType}` : ''}</Text>
                <Text style={{ color: theme.muted }}>{item.dateMouvement}</Text>
              </View>
              {item.produit?.nomProduit ? <Text style={{ color: theme.muted, marginTop: 4 }}>{item.produit.nomProduit}{item.quantite != null ? ` • Qté: ${item.quantite}` : ''}</Text> : null}
              {item.magasin?.nom ? <Text style={{ color: theme.muted, marginTop: 2 }}>Magasin: {item.magasin.nom}</Text> : null}
              {item.utilisateur ? <Text style={{ color: theme.muted, marginTop: 2 }}>Par: {`${item.utilisateur.prenom || ''} ${item.utilisateur.nom || ''}`.trim() || item.utilisateur.email}</Text> : null}
              {item.description ? <Text style={{ color: theme.muted, marginTop: 2 }}>{item.description}</Text> : null}
              {item.montant != null ? <Text style={{ color: theme.text, fontWeight: '900', marginTop: 4 }}>{fmtMoney(item.montant)}</Text> : null}
            </View>
          )}
          ListFooterComponent={
            total > 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 }}>
                <Pressable disabled={page <= 1} onPress={() => fetchResults(page - 1)} style={{ opacity: page <= 1 ? 0.4 : 1, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: theme.surface, borderWidth: 1, borderColor }}>
                  <Text style={{ color: theme.text }}>Préc.</Text>
                </Pressable>
                <Text style={{ color: theme.muted }}>Page {page} / {totalPages} • {total} résultat(s)</Text>
                <Pressable disabled={page >= totalPages} onPress={() => fetchResults(page + 1)} style={{ opacity: page >= totalPages ? 0.4 : 1, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: theme.surface, borderWidth: 1, borderColor }}>
                  <Text style={{ color: theme.text }}>Suiv.</Text>
                </Pressable>
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}
