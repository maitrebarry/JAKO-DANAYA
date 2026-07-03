import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { useApp } from '../store/AppContext';
import { useAccess } from '../utils/access';
import { showError, showSuccess } from '../utils/notify';
import { useFormatMoney } from '../utils/currency';
import { listMagasins, listStocksForMagasin, listBoutiqueStocks, type MagasinDTO } from '../services/magasins';
import { transferBetweenLocations } from '../services/stockTransfer';

type TransferStock = {
  produitId: number;
  nomProduit: string;
  quantiteDisponible: number;
  multiplicateur: number;
  uniteCondLibelle?: string;
  prixAchat?: number;
  prixDetail?: number;
  prixGros?: number;
};

function normalizeStock(s: any): TransferStock | null {
  const produitId = s?.produitId ?? s?.produit?.id;
  if (produitId == null) return null;
  return {
    produitId: Number(produitId),
    nomProduit: s?.nomProduit ?? s?.produit?.nomProduit ?? s?.produit?.nom ?? `Produit #${produitId}`,
    quantiteDisponible: Number(s?.quantiteDisponible ?? 0),
    multiplicateur: Number(s?.produit?.nombreUnitesParConditionnement ?? 1) || 1,
    uniteCondLibelle: s?.produit?.unite?.libelle ?? s?.unite ?? undefined,
    prixAchat: s?.prixAchat ?? s?.produit?.prixAchat,
    prixDetail: s?.prixDetail ?? s?.produit?.prixDetail,
    prixGros: s?.prixGros ?? s?.prixEnGros ?? s?.produit?.prixEnGros,
  };
}

export default function StockTransferScreen() {
  const theme = useTheme();
  const { token, currentBoutique } = useApp();
  const access = useAccess();
  const fmtMoney = useFormatMoney();
  const borderColor = (theme as any).isDark ? '#1f2937' : '#e5e7eb';

  const [magasins, setMagasins] = useState<MagasinDTO[]>([]);
  const [sourceType, setSourceType] = useState<'BOUTIQUE' | 'MAGASIN'>('BOUTIQUE');
  const [sourceMagasinId, setSourceMagasinId] = useState<number | null>(null);
  const [destType, setDestType] = useState<'BOUTIQUE' | 'MAGASIN'>('MAGASIN');
  const [destMagasinId, setDestMagasinId] = useState<number | null>(null);

  const [loadingStocks, setLoadingStocks] = useState(false);
  const [stocks, setStocks] = useState<TransferStock[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [isCond, setIsCond] = useState<Record<number, boolean>>({});
  const [condQuantities, setCondQuantities] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) return;
    listMagasins(token)
      .then((list) => {
        setMagasins(list);
        if (list.length > 0 && sourceMagasinId == null) setSourceMagasinId(list[0].id);
      })
      .catch((e: any) => showError('Erreur', e?.message || 'Chargement magasins impossible'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const loadStocks = useCallback(async () => {
    if (!token) return;
    if (sourceType === 'MAGASIN' && !sourceMagasinId) {
      setStocks([]);
      return;
    }
    setLoadingStocks(true);
    try {
      const raw = sourceType === 'MAGASIN' ? await listStocksForMagasin(sourceMagasinId as number, token) : await listBoutiqueStocks(token);
      const normalized = raw.map(normalizeStock).filter(Boolean) as TransferStock[];
      setStocks(normalized);
    } catch (e: any) {
      showError('Erreur', e?.message || 'Chargement stock impossible');
    } finally {
      setLoadingStocks(false);
    }
  }, [token, sourceType, sourceMagasinId]);

  useEffect(() => {
    loadStocks();
    setSelected({});
    setQuantities({});
    setCondQuantities({});
  }, [loadStocks]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return stocks;
    return stocks.filter((s) => s.nomProduit.toLowerCase().includes(q));
  }, [stocks, search]);

  const destMagasinsOptions = useMemo(() => magasins.filter((m) => !(sourceType === 'MAGASIN' && m.id === sourceMagasinId)), [magasins, sourceType, sourceMagasinId]);

  const effectiveQty = (s: TransferStock): number => {
    if (isCond[s.produitId]) {
      const cq = Number(condQuantities[s.produitId] || 0);
      return cq * s.multiplicateur;
    }
    return Number(quantities[s.produitId] || 0);
  };

  const selectedItems = useMemo(() => stocks.filter((s) => selected[s.produitId]), [stocks, selected]);

  const totals = useMemo(() => {
    let achat = 0;
    let detail = 0;
    let gros = 0;
    selectedItems.forEach((s) => {
      const qty = effectiveQty(s);
      achat += qty * (s.prixAchat || 0);
      detail += qty * (s.prixDetail || 0);
      gros += qty * (s.prixGros || 0);
    });
    return { achat, detail, gros };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItems, quantities, condQuantities, isCond]);

  const toggleSelected = (id: number) => setSelected((prev) => ({ ...prev, [id]: !prev[id] }));

  const buildItems = (): { produitId: number; quantite?: number; quantiteConditionnement?: number }[] => {
    return selectedItems.map((s) => {
      if (isCond[s.produitId]) {
        return { produitId: s.produitId, quantiteConditionnement: Number(condQuantities[s.produitId] || 0) };
      }
      return { produitId: s.produitId, quantite: Number(quantities[s.produitId] || 0) };
    });
  };

  const validate = (): string | null => {
    if (sourceType === 'MAGASIN' && !sourceMagasinId) return 'Magasin source requis';
    if (selectedItems.length === 0) return 'Sélectionnez au moins un produit';
    if (destType === 'MAGASIN' && !destMagasinId) return 'Magasin destination requis';
    for (const s of selectedItems) {
      const qty = effectiveQty(s);
      if (!qty || qty <= 0) return `Quantité invalide pour ${s.nomProduit}`;
      if (qty > s.quantiteDisponible) return `Quantité insuffisante pour ${s.nomProduit} (disponible: ${s.quantiteDisponible})`;
    }
    return null;
  };

  const doTransfer = async () => {
    if (!token) return;
    const err = validate();
    if (err) {
      showError('Erreur', err);
      return;
    }
    setSubmitting(true);
    try {
      await transferBetweenLocations(
        {
          sourceType,
          sourceId: sourceType === 'BOUTIQUE' ? Number(currentBoutique?.id) : Number(sourceMagasinId),
          destType,
          destId: destType === 'BOUTIQUE' ? Number(currentBoutique?.id) : Number(destMagasinId),
          items: buildItems(),
        },
        token
      );
      showSuccess('Succès', 'Transfert effectué');
      setSelected({});
      setQuantities({});
      setCondQuantities({});
      await loadStocks();
    } catch (e: any) {
      showError('Erreur', e?.message || 'Transfert impossible');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmTransfer = () => {
    const err = validate();
    if (err) {
      showError('Erreur', err);
      return;
    }
    Alert.alert('Confirmer', `Transférer ${selectedItems.length} produit(s) ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Transférer', onPress: doTransfer },
    ]);
  };

  const exportCsv = async () => {
    if (selectedItems.length === 0) {
      showError('Erreur', 'Sélectionnez au moins un produit');
      return;
    }
    const lines = ['Produit;QuantitéSaisie;QuantitéEffective;PrixAchat;MontantAchat;PrixDetail;MontantDetail;PrixGros;MontantGros'];
    let totalAchat = 0;
    let totalDetail = 0;
    let totalGros = 0;
    selectedItems.forEach((s) => {
      const saisie = isCond[s.produitId] ? Number(condQuantities[s.produitId] || 0) : Number(quantities[s.produitId] || 0);
      const eff = effectiveQty(s);
      const mAchat = eff * (s.prixAchat || 0);
      const mDetail = eff * (s.prixDetail || 0);
      const mGros = eff * (s.prixGros || 0);
      totalAchat += mAchat;
      totalDetail += mDetail;
      totalGros += mGros;
      lines.push(`${s.nomProduit};${saisie};${eff};${(s.prixAchat || 0).toFixed(2)};${mAchat.toFixed(2)};${(s.prixDetail || 0).toFixed(2)};${mDetail.toFixed(2)};${(s.prixGros || 0).toFixed(2)};${mGros.toFixed(2)}`);
    });
    lines.push(`TOTALS;;;;${totalAchat.toFixed(2)};;${totalDetail.toFixed(2)};;${totalGros.toFixed(2)}`);
    const csv = lines.join('\n');

    try {
      const baseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
      const ts = new Date().toISOString().replace(/[:T]/g, '_').slice(0, 19);
      const fileUri = `${baseDir}transfert_export_${ts}.csv`;
      await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: 'utf8' as any });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: 'Exporter CSV' });
      }
    } catch (e: any) {
      showError('Erreur', e?.message || "Export CSV impossible");
    }
  };

  if (!access.stockTransfer) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: theme.background }}>
        <Text style={{ color: theme.text, textAlign: 'center' }}>Vous n'avez pas la permission d'accéder à cet écran.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 0 }}>
        <Text style={{ color: theme.text, fontSize: 20, fontWeight: '900', marginBottom: 10 }}>Transfert de stock</Text>

        <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor, marginBottom: 12 }}>
          <Text style={{ color: theme.muted, fontWeight: '900', marginBottom: 8 }}>Source</Text>
          <View style={{ flexDirection: 'row', gap: 10 as any }}>
            <Pressable onPress={() => setSourceType('BOUTIQUE')} style={{ flex: 1, backgroundColor: sourceType === 'BOUTIQUE' ? theme.primary : theme.surface, borderWidth: 1, borderColor, paddingVertical: 10, borderRadius: 12, alignItems: 'center' }}>
              <Text style={{ color: theme.text, fontWeight: '900' }}>Boutique</Text>
            </Pressable>
            <Pressable onPress={() => setSourceType('MAGASIN')} style={{ flex: 1, backgroundColor: sourceType === 'MAGASIN' ? theme.primary : theme.surface, borderWidth: 1, borderColor, paddingVertical: 10, borderRadius: 12, alignItems: 'center' }}>
              <Text style={{ color: theme.text, fontWeight: '900' }}>Magasin</Text>
            </Pressable>
          </View>
          {sourceType === 'MAGASIN' ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
              {magasins.map((m) => (
                <Pressable
                  key={m.id}
                  onPress={() => setSourceMagasinId(m.id)}
                  style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: sourceMagasinId === m.id ? theme.primary : theme.surface, borderWidth: 1, borderColor, marginRight: 8 }}
                >
                  <Text style={{ color: theme.text }}>{m.nom || m.nomMagasin || `Magasin #${m.id}`}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.card, borderRadius: 12, paddingHorizontal: 10, borderWidth: 1, borderColor, marginBottom: 12 }}>
          <Ionicons name="search" size={18} color={theme.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Rechercher produit"
            placeholderTextColor={theme.muted}
            style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 10, color: theme.text }}
          />
        </View>
      </ScrollView>

      {loadingStocks ? (
        <ActivityIndicator style={{ marginTop: 20 }} color={theme.primary} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(s) => String(s.produitId)}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 220 }}
          ListEmptyComponent={<Text style={{ color: theme.muted, textAlign: 'center', marginTop: 20 }}>Aucun produit en stock.</Text>}
          renderItem={({ item }) => {
            const checked = !!selected[item.produitId];
            const cond = !!isCond[item.produitId];
            return (
              <View style={{ backgroundColor: theme.card, borderRadius: 14, padding: 12, borderWidth: 1, borderColor, marginBottom: 10 }}>
                <Pressable onPress={() => toggleSelected(item.produitId)} style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={20} color={checked ? theme.primary : theme.muted} />
                  <View style={{ marginLeft: 10, flex: 1 }}>
                    <Text style={{ color: theme.text, fontWeight: '900' }}>{item.nomProduit}</Text>
                    <Text style={{ color: theme.muted, marginTop: 2 }}>Disponible: {item.quantiteDisponible}{item.uniteCondLibelle ? ` • ${item.uniteCondLibelle}` : ''}</Text>
                  </View>
                </Pressable>

                {checked ? (
                  <View style={{ marginTop: 10 }}>
                    <View style={{ flexDirection: 'row', gap: 10 as any, marginBottom: 8 }}>
                      <Pressable onPress={() => setIsCond((p) => ({ ...p, [item.produitId]: false }))} style={{ flex: 1, backgroundColor: !cond ? theme.primary : theme.surface, borderWidth: 1, borderColor, paddingVertical: 8, borderRadius: 10, alignItems: 'center' }}>
                        <Text style={{ color: theme.text }}>Unités</Text>
                      </Pressable>
                      <Pressable onPress={() => setIsCond((p) => ({ ...p, [item.produitId]: true }))} style={{ flex: 1, backgroundColor: cond ? theme.primary : theme.surface, borderWidth: 1, borderColor, paddingVertical: 8, borderRadius: 10, alignItems: 'center' }}>
                        <Text style={{ color: theme.text }}>Par cond.</Text>
                      </Pressable>
                    </View>
                    {cond ? (
                      <TextInput
                        value={condQuantities[item.produitId] || ''}
                        onChangeText={(v) => setCondQuantities((p) => ({ ...p, [item.produitId]: v.replace(/[^0-9]/g, '') }))}
                        keyboardType="numeric"
                        placeholder="Qté conditionnements"
                        placeholderTextColor={theme.muted}
                        style={{ backgroundColor: theme.surface, borderRadius: 10, padding: 10, color: theme.text, borderWidth: 1, borderColor }}
                      />
                    ) : (
                      <TextInput
                        value={quantities[item.produitId] || ''}
                        onChangeText={(v) => setQuantities((p) => ({ ...p, [item.produitId]: v.replace(/[^0-9]/g, '') }))}
                        keyboardType="numeric"
                        placeholder={`Quantité (max ${item.quantiteDisponible})`}
                        placeholderTextColor={theme.muted}
                        style={{ backgroundColor: theme.surface, borderRadius: 10, padding: 10, color: theme.text, borderWidth: 1, borderColor }}
                      />
                    )}
                  </View>
                ) : null}
              </View>
            );
          }}
        />
      )}

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: theme.card, borderTopWidth: 1, borderTopColor: borderColor, padding: 14 }}>
        <Text style={{ color: theme.muted, marginBottom: 8 }}>
          {selectedItems.length} sélectionné(s) • Achat: {fmtMoney(totals.achat)} • Détail: {fmtMoney(totals.detail)}
        </Text>

        <Text style={{ color: theme.muted, fontWeight: '900', marginBottom: 6 }}>Destination</Text>
        <View style={{ flexDirection: 'row', gap: 10 as any, marginBottom: 8 }}>
          <Pressable onPress={() => setDestType('BOUTIQUE')} style={{ flex: 1, backgroundColor: destType === 'BOUTIQUE' ? theme.primary : theme.surface, borderWidth: 1, borderColor, paddingVertical: 8, borderRadius: 10, alignItems: 'center' }}>
            <Text style={{ color: theme.text }}>Boutique</Text>
          </Pressable>
          <Pressable onPress={() => setDestType('MAGASIN')} style={{ flex: 1, backgroundColor: destType === 'MAGASIN' ? theme.primary : theme.surface, borderWidth: 1, borderColor, paddingVertical: 8, borderRadius: 10, alignItems: 'center' }}>
            <Text style={{ color: theme.text }}>Magasin</Text>
          </Pressable>
        </View>
        {destType === 'MAGASIN' ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
            {destMagasinsOptions.map((m) => (
              <Pressable
                key={m.id}
                onPress={() => setDestMagasinId(m.id)}
                style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: destMagasinId === m.id ? theme.primary : theme.surface, borderWidth: 1, borderColor, marginRight: 8 }}
              >
                <Text style={{ color: theme.text }}>{m.nom || m.nomMagasin || `Magasin #${m.id}`}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        <View style={{ flexDirection: 'row', gap: 10 as any }}>
          <Pressable onPress={exportCsv} style={{ flex: 1, backgroundColor: theme.surface, borderWidth: 1, borderColor, paddingVertical: 12, borderRadius: 12, alignItems: 'center' }}>
            <Text style={{ color: theme.text, fontWeight: '900' }}>Export CSV</Text>
          </Pressable>
          <Pressable onPress={confirmTransfer} disabled={submitting} style={{ flex: 1, backgroundColor: submitting ? theme.muted : theme.primary, paddingVertical: 12, borderRadius: 12, alignItems: 'center' }}>
            <Text style={{ color: theme.text, fontWeight: '900' }}>{submitting ? 'En cours…' : 'Transférer'}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
