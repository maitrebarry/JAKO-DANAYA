import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
import { createVenteEspece, fetchBoutiqueStocks, PriceMode } from '../services/venteEspece';
import { showError, showInfo, showSuccess } from '../utils/notify';
import { useAccess } from '../utils/access';
import { useNavigation } from '@react-navigation/native';

type StockItem = any;

type CartLine = {
  stockId: number;
  produit: any;
  designation: string;
  venteParConditionnement: boolean;
  quantite: string; // unités vendues
  quantiteConditionnement: string; // nombre de cartons/conditionnements
  idEmballage?: number; // which emballage (carton, sac...) was picked, when the product has 2+
  prixUnit: number;
  prixRevendeur?: number | null; // prix affiché sur le reçu (option revendeur) ; n'affecte pas le prix réel
  priceMode: PriceMode;
};

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

function formatStock(units: number, mult: number) {
  const u = Number(units) || 0;
  if (!mult || mult <= 1) return `${u} U`;
  const full = Math.floor(u / mult);
  const rem = u % mult;
  if (full <= 0) return `${u} U`;
  if (rem === 0) return `${u} U (${full} emballage${full > 1 ? 's' : ''})`;
  return `${u} U (${full} emballage${full > 1 ? 's' : ''} + ${rem} U)`;
}

function productNameFromStock(s: any) {
  return s?.produit?.nomProduit || s?.produit?.nom || `Stock ${s?.id ?? ''}`;
}

function packMultiplier(s: any, idEmballage?: number) {
  const embList = s?.produit?.emballages;
  if (idEmballage != null && Array.isArray(embList)) {
    const chosen = embList.find((e: any) => e.id === idEmballage);
    if (chosen) return Number(chosen.nombreUnites) || 1;
  }
  const raw = s?.produit?.nombreUnitesParConditionnement;
  const n = Number(raw);
  return Number.isFinite(n) && n > 1 ? n : 1;
}

function emballageList(s: any): any[] {
  return Array.isArray(s?.produit?.emballages) ? s.produit.emballages : [];
}

function defaultEmballageId(s: any): number | undefined {
  const list = emballageList(s);
  const def = list.find((e: any) => e.estParDefaut);
  return def ? def.id : undefined;
}

function emballageLabel(s: any, idEmballage?: number) {
  const list = emballageList(s);
  const chosen = idEmballage != null ? list.find((e: any) => e.id === idEmballage) : list.find((e: any) => e.estParDefaut);
  return String(chosen?.uniteLibelle || s?.produit?.unite?.libelle || 'emballage');
}

function defaultUnitPrice(prod: any, mode: PriceMode) {
  const p = prod || {};
  const raw = mode === 'DETAIL' ? (p.prixDetail ?? p.prixAchat) : (p.prixEnGros ?? p.prixAchat);
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function buildReference() {
  const now = new Date();
  return `ES-${now.toISOString().replace(/[:.]/g, '').slice(0, 15)}`;
}

const ProductPickerModal = React.memo(function ProductPickerModal({
  visible,
  onClose,
  stocks,
  onPick,
  theme,
}: {
  visible: boolean;
  onClose: () => void;
  stocks: StockItem[];
  onPick: (s: StockItem) => void;
  theme: ReturnType<typeof useTheme>;
}) {
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!visible) setQ('');
  }, [visible]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const base = Array.isArray(stocks) ? stocks : [];
    if (!query) return base.slice(0, 40);
    return base
      .filter((s) => productNameFromStock(s).toLowerCase().includes(query))
      .slice(0, 40);
  }, [q, stocks]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <View
          style={{
            paddingHorizontal: 16,
            paddingVertical: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottomWidth: 1,
            borderBottomColor: theme.isDark ? '#1f2937' : '#e5e7eb',
          }}
        >
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700' }}>Ajouter un produit</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={22} color={theme.text} />
          </Pressable>
        </View>

        <View style={{ padding: 16 }}>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Rechercher un produit..."
            placeholderTextColor={theme.muted}
            style={{
              backgroundColor: theme.surface,
              color: theme.text,
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderWidth: 1,
              borderColor: theme.isDark ? '#1f2937' : '#e5e7eb',
            }}
            autoFocus
          />
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item?.id ?? Math.random())}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          renderItem={({ item }) => {
            const name = productNameFromStock(item);
            const mult = packMultiplier(item);
            const available = Number(item?.quantiteDisponible) || 0;
            const stockLabel = formatStock(available, mult);
            return (
              <Pressable
                onPress={() => onPick(item)}
                style={{
                  backgroundColor: theme.card,
                  borderRadius: 14,
                  padding: 12,
                  marginBottom: 10,
                  borderWidth: 1,
                  borderColor: theme.isDark ? '#1f2937' : '#e5e7eb',
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={{ color: theme.text, fontWeight: '700' }} numberOfLines={1}>
                      {name}
                    </Text>
                    <Text style={{ color: theme.muted, marginTop: 2 }} numberOfLines={1}>
                      Stock: {stockLabel}
                    </Text>
                  </View>
                  <View style={{
                    backgroundColor: theme.primary,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 12,
                  }}>
                    <Text style={{ color: 'white', fontWeight: '700' }}>Ajouter</Text>
                  </View>
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={{ paddingHorizontal: 16 }}>
              <Text style={{ color: theme.muted }}>Aucun produit trouvé.</Text>
            </View>
          }
        />
      </SafeAreaView>
    </Modal>
  );
});

const CartLineItem = React.memo(function CartLineItem({
  line,
  stock,
  theme,
  onRemove,
  onToggleConditionnement,
  onChangeQuantite,
  onChangeQuantiteConditionnement,
  onChangeEmballage,
  optionRevendeur,
  onChangePrixRevendeur,
}: {
  line: CartLine;
  stock: StockItem | undefined;
  theme: ReturnType<typeof useTheme>;
  onRemove: (stockId: number) => void;
  onToggleConditionnement: (stockId: number, enabled: boolean) => void;
  onChangeQuantite: (stockId: number, v: string) => void;
  onChangeQuantiteConditionnement: (stockId: number, v: string) => void;
  onChangeEmballage: (stockId: number, idEmballage: number) => void;
  optionRevendeur?: boolean;
  onChangePrixRevendeur?: (stockId: number, v: string) => void;
}) {
  const name = line.designation;
  const stockOrProduit = stock || { produit: line.produit };
  const mult = packMultiplier(stockOrProduit, line.idEmballage);
  const embList = emballageList(stockOrProduit);
  const available = Number(stock?.quantiteDisponible) || 0;
  const stockLabel = formatStock(available, mult);

  const packsOpen = parseIntFromDigits(line.quantiteConditionnement);
  const unitsSold = line.venteParConditionnement ? Math.max(0, packsOpen * mult) : parseIntFromDigits(line.quantite);
  const unitLabel = emballageLabel(stockOrProduit, line.idEmballage);
  const unitLabelPlural = packsOpen > 1 && !unitLabel.toLowerCase().endsWith('s') ? `${unitLabel}s` : unitLabel;
  const lineTotal = unitsSold * (Number(line.prixUnit) || 0);
  const borderColor = theme.isDark ? '#1f2937' : '#dbeafe';
  const mutedBorder = theme.isDark ? '#1f2937' : '#e5e7eb';
  const softPrimary = theme.isDark ? '#0b3b57' : '#d9f3ff';
  const inputBackground = theme.isDark ? '#0f1724' : '#f8fbff';

  return (
    <View
      style={{
        backgroundColor: theme.card,
        borderRadius: 18,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor,
        shadowColor: '#0f172a',
        shadowOpacity: theme.isDark ? 0 : 0.08,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={{ color: theme.text, fontWeight: '900', fontSize: 16 }} numberOfLines={2}>
            {name}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            <View style={{ backgroundColor: softPrimary, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
              <Text style={{ color: theme.isDark ? '#bae6fd' : '#0369a1', fontWeight: '800', fontSize: 12 }}>Stock: {stockLabel}</Text>
            </View>
            <View style={{ backgroundColor: theme.isDark ? '#172033' : '#f1f5f9', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
              <Text style={{ color: theme.text, fontWeight: '800', fontSize: 12 }}>Prix: {formatThousandsFromDigits(String(line.prixUnit))}</Text>
            </View>
          </View>
          {optionRevendeur && (
            <View style={{ marginTop: 10 }}>
              <Text style={{ color: theme.muted, fontWeight: '700', fontSize: 12, marginBottom: 4 }}>Prix revendeur (reçu)</Text>
              <TextInput
                keyboardType="numeric"
                value={line.prixRevendeur != null ? String(line.prixRevendeur) : ''}
                onChangeText={(t) => onChangePrixRevendeur && onChangePrixRevendeur(line.stockId, digitsOnly(t))}
                placeholder="Optionnel — affiché sur le reçu"
                placeholderTextColor={theme.muted}
                style={{ borderWidth: 1, borderColor: mutedBorder, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, color: theme.text, backgroundColor: inputBackground }}
              />
            </View>
          )}
        </View>
        <Pressable
          onPress={() => onRemove(line.stockId)}
          hitSlop={12}
          style={{
            width: 42,
            height: 42,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.isDark ? '#2a1620' : '#fff1f2',
          }}
        >
          <Ionicons name="trash-outline" size={20} color={theme.danger} />
        </Pressable>
      </View>

      {mult > 1 && (
        <View style={{ marginTop: 14 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              onPress={() => onToggleConditionnement(line.stockId, false)}
              style={{
                flex: 1,
                minHeight: 48,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: !line.venteParConditionnement ? theme.primary : inputBackground,
                borderWidth: 1,
                borderColor: !line.venteParConditionnement ? theme.primary : mutedBorder,
              }}
            >
              <Text style={{ color: !line.venteParConditionnement ? '#fff' : theme.text, fontWeight: '900' }}>Unités</Text>
            </Pressable>
            <Pressable
              onPress={() => onToggleConditionnement(line.stockId, true)}
              style={{
                flex: 1,
                minHeight: 48,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: line.venteParConditionnement ? theme.primary : inputBackground,
                borderWidth: 1,
                borderColor: line.venteParConditionnement ? theme.primary : mutedBorder,
              }}
            >
              <Text style={{ color: line.venteParConditionnement ? '#fff' : theme.text, fontWeight: '900' }}>{unitLabel}</Text>
            </Pressable>
          </View>
          <Text style={{ color: theme.muted, marginTop: 8, fontSize: 12 }}>1 {unitLabel} = {mult} unité(s)</Text>
        </View>
      )}

      {line.venteParConditionnement && embList.length > 1 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
          {embList.map((e: any) => {
            const selected = line.idEmballage === e.id;
            return (
              <Pressable
                key={e.id}
                onPress={() => onChangeEmballage(line.stockId, e.id)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 12,
                  backgroundColor: selected ? theme.primary : theme.surface,
                  borderWidth: 1,
                  borderColor: selected ? theme.primary : mutedBorder,
                }}
              >
                <Text style={{ color: selected ? 'white' : theme.text, fontWeight: '700' }}>
                  {e.uniteLibelle} ({e.nombreUnites}u)
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
        {line.venteParConditionnement ? (
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.muted, marginBottom: 6, fontWeight: '700' }}>Quantité ({unitLabel})</Text>
            <TextInput
              value={line.quantiteConditionnement}
              onChangeText={(t) => onChangeQuantiteConditionnement(line.stockId, digitsOnly(t))}
              keyboardType="number-pad"
              placeholder="1"
              placeholderTextColor={theme.muted}
              style={{
                backgroundColor: inputBackground,
                color: theme.text,
                borderRadius: 14,
                paddingHorizontal: 12,
                paddingVertical: Platform.OS === 'android' ? 8 : 10,
                minHeight: 50,
                borderWidth: 1,
                borderColor: mutedBorder,
                fontWeight: '800',
              }}
            />
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.muted, marginBottom: 6, fontWeight: '700' }}>Quantité (unités)</Text>
            <TextInput
              value={line.quantite}
              onChangeText={(t) => onChangeQuantite(line.stockId, digitsOnly(t))}
              keyboardType="number-pad"
              placeholder="1"
              placeholderTextColor={theme.muted}
              style={{
                backgroundColor: inputBackground,
                color: theme.text,
                borderRadius: 14,
                paddingHorizontal: 12,
                paddingVertical: Platform.OS === 'android' ? 8 : 10,
                minHeight: 50,
                borderWidth: 1,
                borderColor: mutedBorder,
                fontWeight: '800',
              }}
            />
          </View>
        )}
      </View>

      {line.venteParConditionnement ? (
        <View style={{ marginTop: 10, backgroundColor: theme.isDark ? '#101827' : '#eef9ff', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 }}>
          <Text style={{ color: theme.muted, fontSize: 12 }}>
            {packsOpen || 0} {unitLabelPlural} ≈ {unitsSold} unité(s)
          </Text>
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: mutedBorder }}>
        <Text style={{ color: theme.muted, fontWeight: '800' }}>Montant</Text>
        <Text style={{ color: theme.text, fontWeight: '900', fontSize: 18 }}>{formatThousandsFromDigits(String(lineTotal))}</Text>
      </View>
    </View>
  );
});

export default function VenteEspeceScreen() {
  const theme = useTheme();
  const { token, currentBoutique } = useApp();
  // Option revendeur : permet de saisir un prix revendeur (reçu) par ligne, sans toucher au prix réel.
  const optionRevendeur = !!currentBoutique?.optionRevendeur;
  const access = useAccess();
  const navigation = useNavigation<any>();

  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [loadingStocks, setLoadingStocks] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);

  const [priceModeDefault, setPriceModeDefault] = useState<PriceMode>('DETAIL');
  const [nomClient, setNomClient] = useState('Clients divers');
  const [lines, setLines] = useState<CartLine[]>([]);

  const [remiseText, setRemiseText] = useState('');
  const [montantRecuText, setMontantRecuText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reloadStocks = useCallback(async () => {
    if (!token) return;
    if (!access.ventesCreate) {
      setStocks([]);
      setLoadingStocks(false);
      return;
    }
    setLoadingStocks(true);
    try {
      const boutiqueOnly = await fetchBoutiqueStocks(token);
      setStocks(boutiqueOnly);
    } catch (e: any) {
      showError('Erreur', e?.message || 'Erreur chargement stocks');
    } finally {
      setLoadingStocks(false);
    }
  }, [token, access.ventesCreate]);

  useEffect(() => {
    reloadStocks();
  }, [reloadStocks]);

  // When global price mode changes, update unit prices for lines based on their products.
  useEffect(() => {
    setLines((prev) =>
      prev.map((l) => ({
        ...l,
        prixUnit: defaultUnitPrice(l.produit, priceModeDefault),
        priceMode: priceModeDefault,
      }))
    );
  }, [priceModeDefault]);

  const stockById = useMemo(() => {
    const m = new Map<number, StockItem>();
    (stocks || []).forEach((s: any) => {
      if (s && s.id != null) m.set(Number(s.id), s);
    });
    return m;
  }, [stocks]);

  const addStockToCart = useCallback(
    (s: StockItem) => {
      const id = Number(s?.id);
      if (!id) return;
      setLines((prev) => {
        if (prev.some((l) => l.stockId === id)) {
          showInfo('Panier', 'Ce produit est déjà dans le panier.');
          return prev;
        }
        const prod = s?.produit || {};
        const newLine: CartLine = {
          stockId: id,
          produit: prod,
          designation: productNameFromStock(s),
          venteParConditionnement: false,
          quantite: '1',
          quantiteConditionnement: '1',
          idEmballage: defaultEmballageId(s),
          prixUnit: defaultUnitPrice(prod, priceModeDefault),
          priceMode: priceModeDefault,
        };
        return [...prev, newLine];
      });
    },
    [priceModeDefault]
  );

  const removeLine = useCallback((stockId: number) => {
    setLines((prev) => prev.filter((l) => l.stockId !== stockId));
  }, []);

  const changePrixRevendeur = useCallback((stockId: number, v: string) => {
    setLines((prev) => prev.map((l) => (l.stockId === stockId ? { ...l, prixRevendeur: v === '' ? null : (parseIntFromDigits(v) || 0) } : l)));
  }, []);

  const toggleConditionnement = useCallback((stockId: number, enabled: boolean) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.stockId !== stockId) return l;
        const stock = stockById.get(stockId) || { produit: l.produit };
        const idEmballage = enabled ? (l.idEmballage ?? defaultEmballageId(stock)) : l.idEmballage;
        const packs = enabled ? parseIntFromDigits(l.quantiteConditionnement || '1') || 1 : 0;
        const mult = packMultiplier(stock, idEmballage);
        return {
          ...l,
          venteParConditionnement: enabled,
          idEmballage,
          quantiteConditionnement: enabled ? String(packs) : l.quantiteConditionnement,
          quantite: enabled ? String(packs * mult) : (l.quantite || '1'),
        };
      })
    );
  }, [stockById]);

  const changeQuantite = useCallback((stockId: number, v: string) => {
    setLines((prev) => prev.map((l) => (l.stockId === stockId ? { ...l, quantite: v } : l)));
  }, []);

  const changeQuantiteConditionnement = useCallback((stockId: number, v: string) => {
    setLines((prev) => prev.map((l) => {
      if (l.stockId !== stockId) return l;
      const stock = stockById.get(stockId) || { produit: l.produit };
      const packs = parseIntFromDigits(v);
      const mult = packMultiplier(stock, l.idEmballage);
      return { ...l, quantiteConditionnement: v, quantite: l.venteParConditionnement ? String(packs * mult) : l.quantite };
    }));
  }, [stockById]);

  const changeEmballage = useCallback((stockId: number, idEmballage: number) => {
    setLines((prev) => prev.map((l) => {
      if (l.stockId !== stockId) return l;
      const stock = stockById.get(stockId) || { produit: l.produit };
      const packs = parseIntFromDigits(l.quantiteConditionnement);
      const mult = packMultiplier(stock, idEmballage);
      return { ...l, idEmballage, quantite: l.venteParConditionnement ? String(packs * mult) : l.quantite };
    }));
  }, [stockById]);

  const { subtotal, totalNet, remise, montantRecu, monnaie, submissionErrors, canSubmit } = useMemo(() => {
    const errors: string[] = [];

    const remiseVal = parseIntFromDigits(remiseText);
    const montantRecuVal = parseIntFromDigits(montantRecuText);

    let subtotalVal = 0;

    const validLines = lines.filter((l) => l.stockId);
    if (validLines.length === 0) errors.push('Ajoutez au moins un produit.');

    validLines.forEach((l) => {
      const stock = stockById.get(l.stockId);
      if (!stock) {
        errors.push(`Stock introuvable pour ${l.designation}.`);
        return;
      }
      const mult = packMultiplier(stock, l.idEmballage);
      const available = Number(stock?.quantiteDisponible) || 0;

      let units = parseIntFromDigits(l.quantite);
      if (l.venteParConditionnement) {
        const packs = parseIntFromDigits(l.quantiteConditionnement);
        if (packs < 1) errors.push(`Quantité d'emballages invalide pour ${l.designation}.`);
        units = packs * mult;
        if (units < 1) errors.push(`Quantité invalide pour ${l.designation}.`);
        if (emballageList(stock).length > 1 && l.idEmballage == null) {
          errors.push(`Veuillez préciser l'emballage vendu pour ${l.designation}.`);
        }
      } else {
        if (units < 1) errors.push(`Quantité invalide pour ${l.designation}.`);
      }

      if (units > available) errors.push(`Stock insuffisant pour ${l.designation} (disponible: ${available}, demandé: ${units}).`);

      const prix = Number(l.prixUnit) || 0;
      subtotalVal += units * prix;
    });

    const net = subtotalVal - (remiseVal || 0);
    if (net <= 0) errors.push('Le total doit être supérieur à 0.');

    if (!montantRecuText || montantRecuVal <= 0) errors.push('Le montant reçu doit être renseigné.');
    if (montantRecuVal < net) errors.push('Le montant reçu est insuffisant.');

    const change = Math.max(montantRecuVal - net, 0);

    return {
      subtotal: subtotalVal,
      totalNet: net,
      remise: remiseVal,
      montantRecu: montantRecuVal,
      monnaie: change,
      submissionErrors: errors,
      canSubmit: errors.length === 0 && !submitting,
    };
  }, [lines, remiseText, montantRecuText, stockById, submitting]);

  const onSubmit = useCallback(async () => {
    if (!token) {
      showError('Connexion requise', 'Veuillez vous reconnecter.');
      return;
    }
    if (!access.ventesCreate) {
      showError('Permission', "Vous n'avez pas la permission d'enregistrer une vente.");
      return;
    }
    if (!canSubmit) {
      showError('Vérification', submissionErrors[0] || 'Vérifiez les champs.');
      return;
    }

    setSubmitting(true);
    try {
      const now = new Date();
      const payload = {
        reference: buildReference(),
        dateVente: now.toISOString(),
        nomClient: nomClient?.trim() ? nomClient.trim() : 'Clients divers',
        // IMPORTANT: web sends total already net of remise; keep same to stay compatible with existing behavior
        total: totalNet,
        montantRecu,
        monnaieRembourse: monnaie,
        remise,
        produitsSelectionnes: lines.map((l) => {
          const packs = l.venteParConditionnement ? parseIntFromDigits(l.quantiteConditionnement) : 0;
          const mult = packMultiplier(stockById.get(l.stockId) || { produit: l.produit }, l.idEmballage);
          const units = l.venteParConditionnement ? packs * mult : parseIntFromDigits(l.quantite);
          return {
            id_stock: l.stockId,
            quantite: units,
            venteParConditionnement: l.venteParConditionnement,
            quantiteConditionnement: l.venteParConditionnement ? packs : null,
            id_emballage: l.venteParConditionnement ? l.idEmballage : undefined,
            prix: Number(l.prixUnit) || 0,
            prixRevendeur: (optionRevendeur && l.prixRevendeur != null) ? l.prixRevendeur : undefined,
            priceMode: l.priceMode,
          };
        }),
      };

      await createVenteEspece(payload as any, token);
      showSuccess('Vente enregistrée', String(payload.reference || '').trim());
      setLines([]);
      setRemiseText('');
      setMontantRecuText('');
      setNomClient('Clients divers');
      await reloadStocks();
    } catch (e: any) {
      showError('Erreur', e?.message || 'Erreur lors de la création de la vente');
    } finally {
      setSubmitting(false);
    }
  }, [token, access.ventesCreate, canSubmit, submissionErrors, nomClient, totalNet, montantRecu, monnaie, remise, lines, stockById, reloadStocks]);

  if (!token) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background, padding: 16 }}>
        <Text style={{ color: theme.text, fontWeight: '900' }}>Authentification requise</Text>
      </View>
    );
  }

  if (token && !access.ventesCreate) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background, padding: 16 }}>
        <Text style={{ color: theme.text, fontWeight: '900' }}>Permission requise</Text>
        <Text style={{ marginTop: 8, color: theme.muted, textAlign: 'center' }}>
          Vous n'avez pas la permission d'enregistrer une vente.
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
      <ProductPickerModal
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        stocks={stocks}
        onPick={(s) => {
          addStockToCart(s);
          setPickerVisible(false);
        }}
        theme={theme}
      />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: theme.text, fontSize: 22, fontWeight: '900' }}>Vente en espèces</Text>
            <Pressable
              onPress={reloadStocks}
              style={{ paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, backgroundColor: theme.surface }}
            >
              <Ionicons name="refresh" size={18} color={theme.text} />
            </Pressable>
          </View>

          <View style={{ marginTop: 14, backgroundColor: theme.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: theme.isDark ? '#1f2937' : '#e5e7eb' }}>
            <Text style={{ color: theme.muted, marginBottom: 6 }}>Mode de prix</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable
                onPress={() => setPriceModeDefault('DETAIL')}
                style={{
                  flex: 1,
                  backgroundColor: priceModeDefault === 'DETAIL' ? theme.primary : theme.surface,
                  paddingVertical: 10,
                  borderRadius: 12,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: priceModeDefault === 'DETAIL' ? 'white' : theme.text, fontWeight: '800' }}>DÉTAIL</Text>
              </Pressable>
              <Pressable
                onPress={() => setPriceModeDefault('GROS')}
                style={{
                  flex: 1,
                  backgroundColor: priceModeDefault === 'GROS' ? theme.primary : theme.surface,
                  paddingVertical: 10,
                  borderRadius: 12,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: priceModeDefault === 'GROS' ? 'white' : theme.text, fontWeight: '800' }}>GROS</Text>
              </Pressable>
            </View>

            <Text style={{ color: theme.muted, marginTop: 12, marginBottom: 6 }}>Client</Text>
            <TextInput
              value={nomClient}
              onChangeText={setNomClient}
              placeholder="Clients divers"
              placeholderTextColor={theme.muted}
              style={{
                backgroundColor: theme.surface,
                color: theme.text,
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderWidth: 1,
                borderColor: theme.isDark ? '#1f2937' : '#e5e7eb',
              }}
            />
          </View>

          <View style={{ marginTop: 14, flexDirection: 'row', gap: 10 }}>
            <Pressable
              onPress={() => setPickerVisible(true)}
              style={{ flex: 1, backgroundColor: theme.primary, paddingVertical: 12, borderRadius: 14, alignItems: 'center' }}
            >
              <Text style={{ color: 'white', fontWeight: '900' }}>Ajouter produit</Text>
            </Pressable>
            <Pressable
              onPress={() => setLines([])}
              style={{ paddingHorizontal: 14, backgroundColor: theme.surface, paddingVertical: 12, borderRadius: 14, alignItems: 'center' }}
            >
              <Text style={{ color: theme.text, fontWeight: '800' }}>Vider</Text>
            </Pressable>
          </View>

          <View style={{ marginTop: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ color: theme.text, fontSize: 16, fontWeight: '900' }}>Panier</Text>
              {loadingStocks ? <ActivityIndicator /> : null}
            </View>

            {lines.length === 0 ? (
              <View style={{ backgroundColor: theme.surface, padding: 16, borderRadius: 14 }}>
                <Text style={{ color: theme.muted }}>Aucun produit dans le panier. Appuyez sur “Ajouter produit”.</Text>
              </View>
            ) : (
              lines.map((l) => (
                <CartLineItem
                  key={String(l.stockId)}
                  line={l}
                  stock={stockById.get(l.stockId)}
                  theme={theme}
                  onRemove={removeLine}
                  onToggleConditionnement={toggleConditionnement}
                  onChangeQuantite={changeQuantite}
                  onChangeQuantiteConditionnement={changeQuantiteConditionnement}
                  onChangeEmballage={changeEmballage}
                  optionRevendeur={optionRevendeur}
                  onChangePrixRevendeur={changePrixRevendeur}
                />
              ))
            )}
          </View>

          <View style={{ marginTop: 16, backgroundColor: theme.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: theme.isDark ? '#1f2937' : '#e5e7eb' }}>
            <Text style={{ color: theme.text, fontSize: 16, fontWeight: '900', marginBottom: 10 }}>Paiement</Text>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.muted, marginBottom: 6 }}>Remise</Text>
                <TextInput
                  value={remiseText}
                  onChangeText={(t) => setRemiseText(formatThousandsFromDigits(t))}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={theme.muted}
                  style={{
                    backgroundColor: theme.surface,
                    color: theme.text,
                    borderRadius: 12,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    borderWidth: 1,
                    borderColor: theme.isDark ? '#1f2937' : '#e5e7eb',
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.muted, marginBottom: 6 }}>Montant reçu</Text>
                <TextInput
                  value={montantRecuText}
                  onChangeText={(t) => setMontantRecuText(formatThousandsFromDigits(t))}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={theme.muted}
                  style={{
                    backgroundColor: theme.surface,
                    color: theme.text,
                    borderRadius: 12,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    borderWidth: 1,
                    borderColor: theme.isDark ? '#1f2937' : '#e5e7eb',
                  }}
                />
              </View>
            </View>

            <View style={{ marginTop: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ color: theme.muted }}>Sous-total</Text>
                <Text style={{ color: theme.text, fontWeight: '800' }}>{formatThousandsFromDigits(String(subtotal))}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ color: theme.muted }}>Total à payer</Text>
                <Text style={{ color: theme.text, fontWeight: '900' }}>{formatThousandsFromDigits(String(totalNet))}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: theme.muted }}>Monnaie à rendre</Text>
                <Text style={{ color: theme.text, fontWeight: '900' }}>{formatThousandsFromDigits(String(monnaie))}</Text>
              </View>
            </View>

            {submissionErrors.length > 0 ? (
              <View style={{ marginTop: 12, backgroundColor: theme.isDark ? '#3f1d1d' : '#fee2e2', padding: 12, borderRadius: 12 }}>
                {submissionErrors.slice(0, 4).map((e, idx) => (
                  <Text key={idx} style={{ color: theme.isDark ? '#fecaca' : '#991b1b' }}>
                    • {e}
                  </Text>
                ))}
                {submissionErrors.length > 4 ? (
                  <Text style={{ color: theme.isDark ? '#fecaca' : '#991b1b', marginTop: 6 }}>
                    +{submissionErrors.length - 4} autre(s)
                  </Text>
                ) : null}
              </View>
            ) : null}

            <Pressable
              onPress={onSubmit}
              disabled={!canSubmit}
              style={{
                marginTop: 14,
                backgroundColor: canSubmit ? theme.primary : theme.muted,
                paddingVertical: 14,
                borderRadius: 14,
                alignItems: 'center',
                opacity: submitting ? 0.8 : 1,
              }}
            >
              {submitting ? <ActivityIndicator color="white" /> : <Text style={{ color: 'white', fontWeight: '900' }}>Enregistrer la vente</Text>}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
