import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  SafeAreaView,
  Text,
  View,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { useTheme } from '../theme';
import { useApp } from '../store/AppContext';
import { useAccess } from '../utils/access';
import { showError, showInfo } from '../utils/notify';
import { downloadAndSharePdf } from '../services/pdf';
import { fetchVenteById, fetchVenteLignes, type LigneVenteDTO, type VenteDTO } from '../services/ventesEspeces';
import { useFormatMoney } from '../utils/currency';

function formatDateLong(d: any) {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d);
  return dt.toLocaleString('fr-FR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function productName(line: any) {
  return line?.produit?.nomProduit || line?.produit?.nom || (line?.produit?.id ? `Produit #${line.produit.id}` : 'Produit');
}

export default function VenteEspeceDetailScreen() {
  const theme = useTheme();
  const route = useRoute<any>();
  const { id } = route.params || {};

  const { token } = useApp();
  const access = useAccess();
  const fmtMoney = useFormatMoney();

  const [vente, setVente] = useState<VenteDTO | null>(null);
  const [lignes, setLignes] = useState<LigneVenteDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    if (!access.ventes) return;
    if (!id) return;

    try {
      setLoading(true);
      const [v, l] = await Promise.all([
        fetchVenteById(Number(id), token),
        fetchVenteLignes(Number(id), token),
      ]);
      setVente(v);
      setLignes(Array.isArray(l) ? l : []);
    } catch (e: any) {
      showError('Erreur', e?.message || 'Impossible de charger la vente');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, access.ventes, id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = () => {
    if (!token || !access.ventes) return;
    setRefreshing(true);
    load();
  };

  const headerBlocks = useMemo(() => {
    const v = vente || ({} as any);
    return [
      { label: 'Date', value: formatDateLong(v.dateVente) },
      { label: 'Client', value: v.nomClient || '—' },
      { label: 'Total', value: fmtMoney(v.montantTotal) },
      { label: 'Remise', value: fmtMoney(v.remise) },
      { label: 'Net à payer', value: fmtMoney(v.netAPayer) },
      { label: 'Montant reçu', value: fmtMoney(v.montantRecu) },
      { label: 'Monnaie', value: fmtMoney(v.monnaieRembourse) },
      { label: 'Réf. caisse', value: v.referenceCaisse || '—' },
    ];
  }, [vente]);

  const onPdf = async () => {
    if (!token) return;
    if (!id) return;

    try {
      setPdfLoading(true);
      showInfo('PDF', 'Génération / téléchargement du PDF...');
      await downloadAndSharePdf({
        apiPath: `ventes/${Number(id)}/pdf`,
        token,
        filename: `vente_${Number(id)}_${new Date().toISOString().slice(0, 10)}`,
      });
    } catch (e: any) {
      showError('PDF', e?.message || 'Impossible de générer le PDF');
    } finally {
      setPdfLoading(false);
    }
  };

  if (!token) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Non authentifié</Text>
      </View>
    );
  }

  if (!access.ventes) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background, padding: 16 }}>
        <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text }}>Détail vente</Text>
        <Text style={{ marginTop: 8, color: theme.muted, textAlign: 'center' }}>
          Vous n'avez pas la permission d'accéder à ce détail.
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ padding: 16, paddingBottom: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: '900' }}>
            Vente #{Number(id)}
          </Text>
          <Pressable
            onPress={onPdf}
            disabled={pdfLoading}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: theme.primary,
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderRadius: 12,
              opacity: pdfLoading ? 0.7 : 1,
            }}
          >
            {pdfLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <MaterialCommunityIcons name="file-pdf-box" size={18} color="#fff" />
            )}
            <Text style={{ color: '#fff', fontWeight: '800', marginLeft: 8 }}>PDF</Text>
          </Pressable>
        </View>

        <View style={{ marginTop: 12, gap: 10 }}>
          {headerBlocks.map((b) => (
            <View
              key={b.label}
              style={{
                backgroundColor: theme.surface,
                borderRadius: 12,
                padding: 12,
                borderWidth: 1,
                borderColor: theme.isDark ? '#1f2937' : '#e5e7eb',
              }}
            >
              <Text style={{ color: theme.muted, fontWeight: '700' }}>{b.label}</Text>
              <Text style={{ color: theme.text, fontWeight: '900', marginTop: 4 }} numberOfLines={2}>
                {b.value}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {loading ? <ActivityIndicator style={{ marginTop: 10 }} color={theme.primary} /> : null}

      <View style={{ paddingHorizontal: 16, marginTop: 4, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: theme.text, fontWeight: '900' }}>Lignes</Text>
        <Text style={{ color: theme.muted }}>{lignes.length}</Text>
      </View>

      <FlatList
        data={lignes}
        keyExtractor={(it) => String(it.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.primary]} />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        renderItem={({ item }) => {
          const qty = Number(item.quantite) || 0;
          const unitPrice = Number(item.newPrice);
          const lineTotal = Number.isFinite(unitPrice) ? unitPrice * qty : null;

          return (
            <View
              style={{
                backgroundColor: theme.card,
                borderRadius: 14,
                padding: 12,
                marginBottom: 10,
                borderWidth: 1,
                borderColor: theme.isDark ? '#1f2937' : '#e5e7eb',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    backgroundColor: theme.surface,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                  }}
                >
                  <Ionicons name="cube-outline" size={20} color={theme.primary} />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.text, fontWeight: '900' }} numberOfLines={1}>
                    {productName(item)}
                  </Text>
                  <Text style={{ color: theme.muted, marginTop: 2 }} numberOfLines={1}>
                    Qté: {qty} {item.priceMode ? `· ${String(item.priceMode)}` : ''}
                  </Text>
                  {Number.isFinite(unitPrice) ? (
                    <Text style={{ color: theme.muted, marginTop: 4 }}>
                      PU: {fmtMoney(unitPrice)}
                    </Text>
                  ) : null}
                </View>

                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: theme.text, fontWeight: '900' }}>{lineTotal != null ? fmtMoney(lineTotal) : '—'}</Text>
                </View>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={{ paddingHorizontal: 16, marginTop: 20 }}>
            <Text style={{ color: theme.muted, textAlign: 'center' }}>Aucune ligne.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
