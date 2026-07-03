import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useTheme } from '../theme';
import { useApp } from '../store/AppContext';
import { useAccess } from '../utils/access';
import { fetchRapport, buildRapportExportQuery, type RapportType } from '../services/rapports';
import { listBoutiques, type BoutiqueDTO } from '../services/boutiques';
import { downloadAndShareFile } from '../services/pdf';
import { isSuperAdmin } from '../utils/permissions';
import { showError, showSuccess } from '../utils/notify';
import { useFormatMoney } from '../utils/currency';

function firstOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

const TYPE_LABELS: Record<RapportType, string> = {
  ventes: 'Ventes',
  stock: 'Stock',
  'valeur-stock': 'Valeur stock',
  'top-produits': 'Top produits',
};

type Row = Record<string, any>;

export default function RapportsScreen() {
  const theme = useTheme();
  const { token, profile, currentBoutique } = useApp();
  const access = useAccess();
  const fmtMoney = useFormatMoney();
  const borderColor = (theme as any).isDark ? '#1f2937' : '#e5e7eb';
  const superAdmin = isSuperAdmin(profile);

  const [reportType, setReportType] = useState<RapportType>('ventes');
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());
  const [limit, setLimit] = useState('10');
  const [boutiqueId, setBoutiqueId] = useState<number | null>(null);
  const [boutiques, setBoutiques] = useState<BoutiqueDTO[]>([]);

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [aggregates, setAggregates] = useState<{ totalCount: number; totalAmount?: number; valeur?: number }>({ totalCount: 0 });

  useEffect(() => {
    if (!token || !superAdmin) return;
    listBoutiques(token).then(setBoutiques).catch(() => {});
  }, [token, superAdmin]);

  const generate = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = { boutique: boutiqueId, from, to, limit: Number(limit) || 10 };
      const data = await fetchRapport(reportType, params, token);
      if (reportType === 'ventes') {
        const list: Row[] = (Array.isArray(data) ? data : []).map((d: any) => ({ date: d.date, ventes: d.nombreVentes, montant: d.montantTotal }));
        setRows(list);
        setAggregates({ totalCount: list.length, totalAmount: list.reduce((s, r) => s + Number(r.montant || 0), 0) });
      } else if (reportType === 'stock') {
        const list: Row[] = (Array.isArray(data) ? data : []).map((d: any) => ({ produit: d.produitName, qte: d.quantiteDisponible, magasin: d.magasinName }));
        setRows(list);
        setAggregates({ totalCount: list.length });
      } else if (reportType === 'valeur-stock') {
        const details = Array.isArray(data?.details) ? data.details : [];
        const list: Row[] = details.map((d: any) => {
          const unitPrice = d.costAverage ?? d.lastPurchasePrice ?? 0;
          const qte = d.quantiteDisponible ?? 0;
          return { produit: d.produitName, qte, unitPrice, valeur: unitPrice * qte };
        });
        setRows(list);
        setAggregates({ totalCount: list.length, valeur: data?.valeurTotale });
      } else {
        const list: Row[] = (Array.isArray(data) ? data : []).map((d: any) => ({ produit: d.produitName, ventes: d.quantiteVendue, montant: d.montantTotal }));
        setRows(list);
        setAggregates({ totalCount: list.length });
      }
    } catch (e: any) {
      showError('Erreur', e?.message || 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }, [token, reportType, boutiqueId, from, to, limit]);

  useEffect(() => {
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportType]);

  const exportFile = async (format: 'csv' | 'pdf') => {
    if (!token) return;
    try {
      const qs = buildRapportExportQuery({ boutique: boutiqueId, from, to, limit: Number(limit) || 10 });
      await downloadAndShareFile({
        apiPath: `rapports/${reportType}?${qs}&format=${format}`,
        token,
        filename: `rapport-${reportType}.${format}`,
        mimeType: format === 'csv' ? 'text/csv' : 'application/pdf',
      });
      showSuccess('Succès', 'Export généré');
    } catch (e: any) {
      showError('Erreur', e?.message || 'Export impossible');
    }
  };

  const columns = useMemo(() => {
    if (reportType === 'ventes') return ['date', 'ventes', 'montant'];
    if (reportType === 'stock') return ['produit', 'qte', 'magasin'];
    if (reportType === 'valeur-stock') return ['produit', 'qte', 'unitPrice', 'valeur'];
    return ['produit', 'ventes', 'montant'];
  }, [reportType]);

  if (!access.rapportsView) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: theme.background }}>
        <Text style={{ color: theme.text, textAlign: 'center' }}>Vous n'avez pas la permission d'accéder à cet écran.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.background }} contentContainerStyle={{ padding: 16 }}>
      <Text style={{ color: theme.text, fontSize: 20, fontWeight: '900', marginBottom: 10 }}>Rapports</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
        {(Object.keys(TYPE_LABELS) as RapportType[]).map((t) => (
          <Pressable key={t} onPress={() => setReportType(t)} style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: reportType === t ? theme.primary : theme.surface, borderWidth: 1, borderColor, marginRight: 8 }}>
            <Text style={{ color: theme.text, fontWeight: '900' }}>{TYPE_LABELS[t]}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor, marginBottom: 12 }}>
        {(reportType === 'ventes' || reportType === 'top-produits') ? (
          <View style={{ flexDirection: 'row', gap: 10 as any, marginBottom: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.muted, marginBottom: 6 }}>Du</Text>
              <TextInput value={from} onChangeText={setFrom} placeholder="AAAA-MM-JJ" placeholderTextColor={theme.muted} style={{ backgroundColor: theme.surface, borderRadius: 10, padding: 10, color: theme.text, borderWidth: 1, borderColor }} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.muted, marginBottom: 6 }}>Au</Text>
              <TextInput value={to} onChangeText={setTo} placeholder="AAAA-MM-JJ" placeholderTextColor={theme.muted} style={{ backgroundColor: theme.surface, borderRadius: 10, padding: 10, color: theme.text, borderWidth: 1, borderColor }} />
            </View>
          </View>
        ) : null}

        {reportType === 'top-produits' ? (
          <View style={{ marginBottom: 10 }}>
            <Text style={{ color: theme.muted, marginBottom: 6 }}>Limite</Text>
            <TextInput value={limit} onChangeText={(v) => setLimit(v.replace(/[^0-9]/g, ''))} keyboardType="numeric" placeholderTextColor={theme.muted} style={{ backgroundColor: theme.surface, borderRadius: 10, padding: 10, color: theme.text, borderWidth: 1, borderColor }} />
          </View>
        ) : null}

        {superAdmin ? (
          <>
            <Text style={{ color: theme.muted, marginBottom: 6 }}>Boutique</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
              <Pressable onPress={() => setBoutiqueId(null)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: boutiqueId == null ? theme.primary : theme.surface, borderWidth: 1, borderColor, marginRight: 8 }}>
                <Text style={{ color: theme.text }}>Toutes</Text>
              </Pressable>
              {boutiques.map((b) => (
                <Pressable key={b.id} onPress={() => setBoutiqueId(b.id)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: boutiqueId === b.id ? theme.primary : theme.surface, borderWidth: 1, borderColor, marginRight: 8 }}>
                  <Text style={{ color: theme.text }}>{b.nom || `#${b.id}`}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        ) : (
          <Text style={{ color: theme.muted, marginBottom: 10 }}>Boutique: {currentBoutique?.nom || '—'}</Text>
        )}

        <View style={{ flexDirection: 'row', gap: 10 as any }}>
          <Pressable onPress={generate} style={{ flex: 1, backgroundColor: theme.primary, paddingVertical: 10, borderRadius: 12, alignItems: 'center' }}>
            <Text style={{ color: theme.text, fontWeight: '900' }}>Générer</Text>
          </Pressable>
          <Pressable onPress={() => exportFile('csv')} style={{ flex: 1, backgroundColor: theme.surface, borderWidth: 1, borderColor, paddingVertical: 10, borderRadius: 12, alignItems: 'center' }}>
            <Text style={{ color: theme.text, fontWeight: '900' }}>CSV</Text>
          </Pressable>
          <Pressable onPress={() => exportFile('pdf')} style={{ flex: 1, backgroundColor: theme.surface, borderWidth: 1, borderColor, paddingVertical: 10, borderRadius: 12, alignItems: 'center' }}>
            <Text style={{ color: theme.text, fontWeight: '900' }}>PDF</Text>
          </Pressable>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={theme.primary} />
      ) : (
        <>
          <View style={{ backgroundColor: theme.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor, marginBottom: 10 }}>
            <Text style={{ color: theme.text, fontWeight: '900' }}>
              {aggregates.totalCount} ligne(s)
              {aggregates.totalAmount != null ? ` • Total: ${fmtMoney(aggregates.totalAmount)}` : ''}
              {aggregates.valeur != null ? ` • Valeur totale: ${fmtMoney(aggregates.valeur)}` : ''}
            </Text>
          </View>

          {rows.length === 0 ? (
            <Text style={{ color: theme.muted, textAlign: 'center' }}>Aucune donnée.</Text>
          ) : (
            rows.map((r, idx) => (
              <View key={idx} style={{ backgroundColor: theme.card, borderRadius: 12, padding: 12, borderWidth: 1, borderColor, marginBottom: 8 }}>
                {columns.map((c) => (
                  <Text key={c} style={{ color: theme.text, marginTop: 2 }}>
                    <Text style={{ color: theme.muted }}>{c}: </Text>
                    {c === 'montant' || c === 'valeur' || c === 'unitPrice' ? fmtMoney(r[c]) : String(r[c] ?? '—')}
                  </Text>
                ))}
              </View>
            ))
          )}
        </>
      )}
    </ScrollView>
  );
}
