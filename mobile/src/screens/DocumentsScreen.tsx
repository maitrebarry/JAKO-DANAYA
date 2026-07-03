import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { useApp } from '../store/AppContext';
import { useAccess } from '../utils/access';
import { fetchDocuments, apiPathFromDocumentUrl, type DocumentReference } from '../services/documents';
import { downloadAndShareFile } from '../services/pdf';
import { listMagasins, type MagasinDTO } from '../services/magasins';
import { listBoutiques, type BoutiqueDTO } from '../services/boutiques';
import { isSuperAdmin } from '../utils/permissions';
import { showError } from '../utils/notify';

const PAGE_SIZE = 20;
const TYPES = ['', 'VENTE', 'RECEPTION', 'INVENTAIRE', 'CAISSE'];

export default function DocumentsScreen() {
  const theme = useTheme();
  const { token, profile, currentBoutique } = useApp();
  const access = useAccess();
  const borderColor = (theme as any).isDark ? '#1f2937' : '#e5e7eb';
  const superAdmin = isSuperAdmin(profile);

  const [items, setItems] = useState<DocumentReference[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [typeFilter, setTypeFilter] = useState('');
  const [refFilter, setRefFilter] = useState('');
  const [magasinId, setMagasinId] = useState<number | null>(null);
  const [boutiqueId, setBoutiqueId] = useState<number | null>(null);
  const [magasins, setMagasins] = useState<MagasinDTO[]>([]);
  const [boutiques, setBoutiques] = useState<BoutiqueDTO[]>([]);

  useEffect(() => {
    if (!token) return;
    listMagasins(token).then(setMagasins).catch(() => {});
    if (superAdmin) listBoutiques(token).then(setBoutiques).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, superAdmin]);

  const load = useCallback(
    async (p: number, append: boolean) => {
      if (!token || !access.documentsView) {
        setLoading(false);
        return;
      }
      if (append) setLoadingMore(true);
      else setLoading(true);
      try {
        const res = await fetchDocuments(
          { page: p, size: PAGE_SIZE, type: typeFilter || undefined, ref: refFilter.trim() || undefined, boutique: boutiqueId, magasin: magasinId },
          token
        );
        setItems((prev) => (append ? [...prev, ...res.content] : res.content));
        setTotal(res.totalElements);
        setPage(res.number);
      } catch (e: any) {
        showError('Erreur', e?.message || 'Chargement impossible');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [token, access.documentsView, typeFilter, refFilter, boutiqueId, magasinId]
  );

  useEffect(() => {
    load(0, false);
  }, [load]);

  const openPdf = async (doc: DocumentReference) => {
    if (!token || !doc.previewUrl) return;
    try {
      await downloadAndShareFile({ apiPath: apiPathFromDocumentUrl(doc.previewUrl), token, filename: `${doc.sourceType}-${doc.sourceId}.pdf`, mimeType: 'application/pdf' });
    } catch (e: any) {
      showError('Erreur', e?.message || "Impossible d'ouvrir le PDF");
    }
  };

  const downloadCsv = async (doc: DocumentReference) => {
    if (!token) return;
    try {
      await downloadAndShareFile({ apiPath: `documents/${doc.sourceType.toLowerCase()}/${doc.sourceId}/download?format=csv`, token, filename: `${doc.sourceType}-${doc.sourceId}.csv`, mimeType: 'text/csv' });
    } catch (e: any) {
      showError('Erreur', e?.message || 'Téléchargement CSV impossible');
    }
  };

  const hasMore = items.length < total;

  if (!token) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.background }}>
        <Text style={{ color: theme.text }}>Connectez-vous pour continuer.</Text>
      </View>
    );
  }

  if (!access.documentsView) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: theme.background }}>
        <Text style={{ color: theme.text, textAlign: 'center' }}>Vous n'avez pas la permission d'accéder à cet écran.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ padding: 16, paddingBottom: 8 }}>
        <Text style={{ color: theme.text, fontSize: 20, fontWeight: '900', marginBottom: 10 }}>Documents</Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.card, borderRadius: 12, paddingHorizontal: 10, borderWidth: 1, borderColor, marginBottom: 10 }}>
          <Ionicons name="search" size={18} color={theme.muted} />
          <TextInput
            value={refFilter}
            onChangeText={setRefFilter}
            onSubmitEditing={() => load(0, false)}
            placeholder="Rechercher (référence)"
            placeholderTextColor={theme.muted}
            style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 10, color: theme.text }}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
          {TYPES.map((t) => (
            <Pressable key={t || 'ALL'} onPress={() => setTypeFilter(t)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: typeFilter === t ? theme.primary : theme.surface, borderWidth: 1, borderColor, marginRight: 8 }}>
              <Text style={{ color: theme.text }}>{t || 'Tous types'}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
          <Pressable onPress={() => setMagasinId(null)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: magasinId == null ? theme.primary : theme.surface, borderWidth: 1, borderColor, marginRight: 8 }}>
            <Text style={{ color: theme.text }}>Tous magasins</Text>
          </Pressable>
          {magasins.map((m) => (
            <Pressable key={m.id} onPress={() => setMagasinId(m.id)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: magasinId === m.id ? theme.primary : theme.surface, borderWidth: 1, borderColor, marginRight: 8 }}>
              <Text style={{ color: theme.text }}>{m.nom || m.nomMagasin || `#${m.id}`}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {superAdmin ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
            <Pressable onPress={() => setBoutiqueId(null)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: boutiqueId == null ? theme.primary : theme.surface, borderWidth: 1, borderColor, marginRight: 8 }}>
              <Text style={{ color: theme.text }}>Toutes boutiques</Text>
            </Pressable>
            {boutiques.map((b) => (
              <Pressable key={b.id} onPress={() => setBoutiqueId(b.id)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: boutiqueId === b.id ? theme.primary : theme.surface, borderWidth: 1, borderColor, marginRight: 8 }}>
                <Text style={{ color: theme.text }}>{b.nom || `#${b.id}`}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <Text style={{ color: theme.muted }}>Boutique: {currentBoutique?.nom || '—'}</Text>
        )}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 10 }} color={theme.primary} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(d, idx) => `${d.sourceType}-${d.sourceId}-${idx}`}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (hasMore && !loadingMore) load(page + 1, true);
          }}
          ListEmptyComponent={<Text style={{ color: theme.muted, textAlign: 'center', marginTop: 10 }}>Aucun document.</Text>}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={{ marginVertical: 12 }} color={theme.primary} /> : null}
          renderItem={({ item }) => (
            <View style={{ backgroundColor: theme.card, borderRadius: 14, padding: 12, borderWidth: 1, borderColor, marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: theme.text, fontWeight: '900' }}>{item.sourceType}</Text>
                <Text style={{ color: theme.muted }}>{item.date || '—'}</Text>
              </View>
              <Text style={{ color: theme.muted, marginTop: 4 }}>{item.reference || `#${item.sourceId}`}</Text>

              <View style={{ flexDirection: 'row', gap: 10 as any, marginTop: 12 }}>
                <Pressable onPress={() => openPdf(item)} style={{ flex: 1, backgroundColor: theme.surface, borderWidth: 1, borderColor, paddingVertical: 10, borderRadius: 12, alignItems: 'center' }}>
                  <Text style={{ color: theme.text, fontWeight: '900' }}>Voir / PDF</Text>
                </Pressable>
                {access.documentsDownload && item.sourceType === 'VENTE' ? (
                  <Pressable onPress={() => downloadCsv(item)} style={{ flex: 1, backgroundColor: theme.surface, borderWidth: 1, borderColor, paddingVertical: 10, borderRadius: 12, alignItems: 'center' }}>
                    <Text style={{ color: theme.text, fontWeight: '900' }}>CSV</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}
