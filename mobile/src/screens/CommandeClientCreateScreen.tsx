import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
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
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme';
import { useApp } from '../store/AppContext';
import { useAccess } from '../utils/access';
import { showError, showSuccess } from '../utils/notify';
import { useCurrencySymbol } from '../utils/currency';
import { fetchStocks } from '../services/vente';
import {
  createCommandeClient,
  type CommandeClientLinePayload,
  type CreateCommandeClientPayload,
} from '../services/commandesClients';
import {
  createClientGrossiste,
  listClientsGrossistes,
  type ClientGrossisteDTO,
  type CreateClientGrossistePayload,
} from '../services/clientsGrossistes';

type StockItem = any;

type CartLine = {
  stockId: number;
  venteParConditionnement: boolean;
  quantite: string; // units
  quantiteConditionnement: string; // cartons
  idEmballage?: number; // which emballage (carton, sac...) was picked, when the product has 2+
  prixUnit: string; // digits-only string
  priceMode: 'DETAIL' | 'GROS';
};

function buildReference() {
  const now = new Date();
  return `CC-${now.toISOString().replace(/[:.]/g, '').slice(0, 15)}`;
}

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

function packMultiplier(stock: any, idEmballage?: number) {
  const embList = stock?.produit?.emballages;
  if (idEmballage != null && Array.isArray(embList)) {
    const chosen = embList.find((e: any) => e.id === idEmballage);
    if (chosen) return Number(chosen.nombreUnites) || 1;
  }
  const raw = stock?.produit?.nombreUnitesParConditionnement;
  const n = Number(raw);
  return Number.isFinite(n) && n > 1 ? n : 1;
}

function emballageList(stock: any): any[] {
  return Array.isArray(stock?.produit?.emballages) ? stock.produit.emballages : [];
}

function defaultEmballageId(stock: any): number | undefined {
  const def = emballageList(stock).find((e: any) => e.estParDefaut);
  return def ? def.id : undefined;
}

function emballageLabel(stock: any, idEmballage?: number) {
  const list = emballageList(stock);
  const chosen = idEmballage != null ? list.find((e: any) => e.id === idEmballage) : list.find((e: any) => e.estParDefaut);
  return String(chosen?.uniteLibelle || stock?.produit?.unite?.libelle || 'emballage');
}

function stockLabel(s: any) {
  const p = s?.produit || {};
  const base = p?.nomProduit || p?.nom || `Stock ${s?.id ?? ''}`;
  const place = s?.magasin?.nom ? ` / ${s.magasin.nom}` : '';
  return `${base}${place}`;
}

function defaultUnitPrice(stock: any, mode: 'DETAIL' | 'GROS') {
  const p = stock?.produit || {};
  const raw = mode === 'DETAIL' ? (p.prixDetail ?? p.prixAchat) : (p.prixEnGros ?? p.prixAchat);
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function clientLabel(c: ClientGrossisteDTO | null) {
  if (!c) return '—';
  const name = [c.prenom, c.nom].filter(Boolean).join(' ').trim();
  return name || c.nomClient || `Client #${c.id}`;
}

const StockPickerModal = React.memo(function StockPickerModal({
  visible,
  onClose,
  stocks,
  onPick,
  isInCart,
  theme,
}: {
  visible: boolean;
  onClose: () => void;
  stocks: StockItem[];
  onPick: (s: StockItem) => void;
  isInCart?: (stockId: number) => boolean;
  theme: ReturnType<typeof useTheme>;
}) {
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!visible) setQ('');
  }, [visible]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const base = Array.isArray(stocks) ? stocks : [];
    if (!query) return base.slice(0, 60);
    return base.filter((s) => stockLabel(s).toLowerCase().includes(query)).slice(0, 60);
  }, [stocks, q]);

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
            const id = Number(item?.id);
            const already = id && isInCart ? isInCart(id) : false;
            const available = Number(item?.quantiteDisponible) || 0;
            return (
              <View
                style={{
                  backgroundColor: theme.card,
                  borderRadius: 14,
                  padding: 12,
                  marginBottom: 10,
                  borderWidth: 1,
                  borderColor: theme.isDark ? '#1f2937' : '#e5e7eb',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.text, fontWeight: '800' }} numberOfLines={1}>
                    {stockLabel(item)}
                  </Text>
                  <Text style={{ color: theme.muted, marginTop: 2 }} numberOfLines={1}>
                    Stock actuel: {available}
                  </Text>
                </View>

                <Pressable
                  disabled={already}
                  onPress={() => onPick(item)}
                  style={{
                    backgroundColor: already ? theme.surface : theme.primary,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    borderRadius: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  {already ? (
                    <Ionicons name="checkmark" size={18} color={theme.text} />
                  ) : (
                    <Ionicons name="add" size={18} color="white" />
                  )}
                  <Text style={{ color: already ? theme.text : 'white', fontWeight: '900' }}>
                    {already ? 'Ajouté' : 'Ajouter'}
                  </Text>
                </Pressable>
              </View>
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

const ClientPickerModal = React.memo(function ClientPickerModal({
  visible,
  onClose,
  clients,
  onPick,
  canCreate,
  onCreate,
  theme,
}: {
  visible: boolean;
  onClose: () => void;
  clients: ClientGrossisteDTO[];
  onPick: (c: ClientGrossisteDTO) => void;
  canCreate?: boolean;
  onCreate?: () => void;
  theme: ReturnType<typeof useTheme>;
}) {
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!visible) setQ('');
  }, [visible]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const base = Array.isArray(clients) ? clients : [];
    if (!query) return base.slice(0, 80);
    return base
      .filter((c) => clientLabel(c).toLowerCase().includes(query))
      .slice(0, 80);
  }, [clients, q]);

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
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700' }}>Choisir un client</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={22} color={theme.text} />
          </Pressable>
        </View>

        <View style={{ padding: 16 }}>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Rechercher un client..."
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
          renderItem={({ item }) => (
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
              <Text style={{ color: theme.text, fontWeight: '800' }} numberOfLines={1}>
                {clientLabel(item)}
              </Text>
              {!!item.contact && (
                <Text style={{ color: theme.muted, marginTop: 2 }} numberOfLines={1}>
                  {String(item.contact)}
                </Text>
              )}
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={{ paddingHorizontal: 16 }}>
              <Text style={{ color: theme.muted }}>Aucun client trouvé.</Text>
            </View>
          }
          ListFooterComponent={
            canCreate ? (
              <View style={{ paddingTop: 6, paddingBottom: 24 }}>
                <Pressable
                  onPress={onCreate}
                  style={{
                    backgroundColor: theme.primary,
                    borderRadius: 14,
                    paddingVertical: 12,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: 'white', fontWeight: '900' }}>+ Nouveau client</Text>
                </Pressable>
              </View>
            ) : null
          }
        />
      </SafeAreaView>
    </Modal>
  );
});

const CreateClientGrossisteModal = React.memo(function CreateClientGrossisteModal({
  visible,
  onClose,
  onSubmit,
  theme,
  submitting,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateClientGrossistePayload) => void;
  theme: ReturnType<typeof useTheme>;
  submitting: boolean;
}) {
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [contact, setContact] = useState('');
  const [ville, setVille] = useState('');

  useEffect(() => {
    if (!visible) {
      setNom('');
      setPrenom('');
      setContact('');
      setVille('');
    }
  }, [visible]);

  const canSubmit = useMemo(() => {
    const hasName = !!(nom.trim() || prenom.trim());
    return hasName;
  }, [nom, prenom]);

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
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700' }}>Nouveau client</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={22} color={theme.text} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28 }} keyboardShouldPersistTaps="handled">
          <Text style={{ color: theme.muted, marginBottom: 6 }}>Nom</Text>
          <TextInput
            value={nom}
            onChangeText={setNom}
            placeholder="Nom"
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

          <Text style={{ color: theme.muted, marginTop: 12, marginBottom: 6 }}>Prénom</Text>
          <TextInput
            value={prenom}
            onChangeText={setPrenom}
            placeholder="Prénom"
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

          <Text style={{ color: theme.muted, marginTop: 12, marginBottom: 6 }}>Contact (téléphone)</Text>
          <TextInput
            value={contact}
            onChangeText={setContact}
            placeholder="Ex: +221..."
            placeholderTextColor={theme.muted}
            keyboardType="phone-pad"
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

          <Text style={{ color: theme.muted, marginTop: 12, marginBottom: 6 }}>Ville</Text>
          <TextInput
            value={ville}
            onChangeText={setVille}
            placeholder="Ville"
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

          <Pressable
            disabled={!canSubmit || submitting}
            onPress={() => {
              const payload: CreateClientGrossistePayload = {
                nom: nom.trim() || undefined,
                prenom: prenom.trim() || undefined,
                contact: contact.trim() || undefined,
                ville: ville.trim() || undefined,
              };
              onSubmit(payload);
            }}
            style={{
              marginTop: 16,
              backgroundColor: !canSubmit || submitting ? theme.muted : theme.primary,
              paddingVertical: 12,
              borderRadius: 14,
              alignItems: 'center',
            }}
          >
            {submitting ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <ActivityIndicator color="white" />
                <Text style={{ color: 'white', fontWeight: '900', marginLeft: 10 }}>Création...</Text>
              </View>
            ) : (
              <Text style={{ color: 'white', fontWeight: '900' }}>Créer et sélectionner</Text>
            )}
          </Pressable>

          <Text style={{ color: theme.muted, marginTop: 10 }}>
            Astuce: renseigne au moins un nom ou prénom.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
});

export default function CommandeClientCreateScreen() {
  const theme = useTheme();
  const access = useAccess();
  const navigation = useNavigation<any>();
  const { token } = useApp();
  const currencySymbol = useCurrencySymbol();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [clients, setClients] = useState<ClientGrossisteDTO[]>([]);

  const [priceMode, setPriceMode] = useState<'DETAIL' | 'GROS'>('DETAIL');
  const [selectedClient, setSelectedClient] = useState<ClientGrossisteDTO | null>(null);

  const [stockPickerOpen, setStockPickerOpen] = useState(false);
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [clientCreateOpen, setClientCreateOpen] = useState(false);
  const [creatingClient, setCreatingClient] = useState(false);

  const [reference, setReference] = useState(buildReference());

  const [productQuery, setProductQuery] = useState('');

  const [lines, setLines] = useState<CartLine[]>([]);

  const stockById = useMemo(() => {
    const m = new Map<number, any>();
    (stocks || []).forEach((s: any) => {
      const id = Number(s?.id);
      if (id) m.set(id, s);
    });
    return m;
  }, [stocks]);

  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [st, cl] = await Promise.all([fetchStocks(token), listClientsGrossistes(token)]);
      setStocks(Array.isArray(st) ? st : []);
      setClients(Array.isArray(cl) ? cl : []);
    } catch (e: any) {
      showError('Erreur', e?.message || 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    reload();
  }, [reload]);

  // When global price mode changes, update unit prices for lines based on their products (same behavior as Vente en espèces).
  useEffect(() => {
    setLines((prev) =>
      (prev || []).map((l) => {
        const stock = stockById.get(l.stockId);
        if (!stock) return { ...l, priceMode };
        const p = defaultUnitPrice(stock, priceMode);
        return {
          ...l,
          prixUnit: String(Math.max(0, Number(p || 0)) || 0),
          priceMode,
        };
      })
    );
  }, [priceMode, stockById]);

  const total = useMemo(() => {
    return (lines || []).reduce((sum, l) => {
      const stock = stockById.get(l.stockId);
      const mult = packMultiplier(stock, l.idEmballage);
      const qUnits = parseIntFromDigits(l.quantite);
      const qCond = parseIntFromDigits(l.quantiteConditionnement);
      const realQ = l.venteParConditionnement ? Math.max(0, qCond) * mult : Math.max(0, qUnits);
      const price = parseIntFromDigits(l.prixUnit);
      return sum + realQ * Math.max(0, price);
    }, 0);
  }, [lines, stockById]);

  const addStockToCart = useCallback(
    (stock: any) => {
      const id = Number(stock?.id);
      if (!id) return;
      setLines((prev) => {
        const exists = (prev || []).some((l) => l.stockId === id);
        if (exists) return prev;
        const price = defaultUnitPrice(stock, priceMode);
        return [
          ...(prev || []),
          {
            stockId: id,
            venteParConditionnement: false,
            quantite: '1',
            quantiteConditionnement: '1',
            idEmballage: defaultEmballageId(stock),
            prixUnit: String(Math.max(0, Number(price || 0)) || 0),
            priceMode,
          },
        ];
      });
    },
    [priceMode]
  );

  const cartStockIds = useMemo(() => {
    const s = new Set<number>();
    (lines || []).forEach((l) => {
      if (l?.stockId) s.add(Number(l.stockId));
    });
    return s;
  }, [lines]);

  const filteredStocks = useMemo(() => {
    const query = productQuery.trim().toLowerCase();
    const base = Array.isArray(stocks) ? stocks : [];
    const list = query ? base.filter((s) => stockLabel(s).toLowerCase().includes(query)) : base;
    return list.slice(0, 40);
  }, [stocks, productQuery]);

  const removeLine = useCallback((stockId: number) => {
    setLines((prev) => (prev || []).filter((l) => l.stockId !== stockId));
  }, []);

  const updateLine = useCallback(
    (
      stockId: number,
      patch: Partial<Pick<CartLine, 'quantite' | 'quantiteConditionnement' | 'prixUnit' | 'venteParConditionnement' | 'priceMode' | 'idEmballage'>>
    ) => {
      setLines((prev) => (prev || []).map((l) => (l.stockId === stockId ? { ...l, ...patch } : l)));
    },
    []
  );

  const canSubmit = useMemo(() => {
    if (!token) return false;
    if (!access.ventesCreate) return false;
    if (!reference.trim()) return false;
    if (!selectedClient) return false;
    if (!lines.length) return false;
    if (total <= 0) return false;
    // require qty > 0 and price >= 0
    for (const l of lines) {
      const stock = stockById.get(l.stockId);
      const mult = packMultiplier(stock, l.idEmballage);
      const qUnits = parseIntFromDigits(l.quantite);
      const qCond = parseIntFromDigits(l.quantiteConditionnement);
      const realQ = l.venteParConditionnement ? qCond * mult : qUnits;
      if (!realQ || realQ <= 0) return false;
      if (parseIntFromDigits(l.prixUnit) < 0) return false;
      if (l.venteParConditionnement && emballageList(stock).length > 1 && l.idEmballage == null) return false;
    }
    return !submitting;
  }, [token, access.ventesCreate, reference, selectedClient, lines, total, submitting, stockById]);

  const onSubmit = useCallback(async () => {
    if (!token) {
      showError('Connexion requise', 'Veuillez vous reconnecter.');
      return;
    }
    if (!access.ventesCreate) {
      showError('Permission', "Vous n'avez pas la permission de créer une commande client (VENTE_CREER).");
      return;
    }

    if (!reference.trim()) {
      showError('Vérification', 'La référence est obligatoire.');
      return;
    }

    if (!selectedClient) {
      showError('Vérification', 'Veuillez sélectionner un client.');
      return;
    }

    if (!lines.length) {
      showError('Vérification', 'Ajoutez au moins un produit.');
      return;
    }

    const produitsSelectionnes: CommandeClientLinePayload[] = lines.map((l) => {
      const stock = stockById.get(l.stockId);
      const mult = packMultiplier(stock, l.idEmballage);
      const qUnits = parseIntFromDigits(l.quantite);
      const qCond = parseIntFromDigits(l.quantiteConditionnement);
      const realQ = l.venteParConditionnement ? qCond * mult : qUnits;
      return {
        id_stock: l.stockId,
        quantite: realQ,
        venteParConditionnement: !!l.venteParConditionnement,
        quantiteConditionnement: l.venteParConditionnement ? qCond : null,
        id_emballage: l.venteParConditionnement ? l.idEmballage : undefined,
        prix: parseIntFromDigits(l.prixUnit),
        priceMode: l.priceMode,
      };
    });

    const payload: CreateCommandeClientPayload = {
      reference: reference.trim(),
      dateVente: new Date().toISOString(),
      client: { id: selectedClient.id },
      produitsSelectionnes,
      total,
    };

    setSubmitting(true);
    try {
      const saved = await createCommandeClient(payload, token);
      showSuccess('Commande créée', saved?.reference || payload.reference);
      navigation.goBack();
    } catch (e: any) {
      showError('Erreur', e?.message || 'Création impossible');
    } finally {
      setSubmitting(false);
    }
  }, [token, access.ventesCreate, reference, lines, selectedClient, total, navigation]);

  if (!token) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
        <Text style={{ color: theme.text }}>Non authentifié</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <StockPickerModal
        visible={stockPickerOpen}
        stocks={stocks}
        onClose={() => setStockPickerOpen(false)}
        onPick={(s) => {
          addStockToCart(s);
          setStockPickerOpen(false);
        }}
        isInCart={(stockId) => cartStockIds.has(stockId)}
        theme={theme}
      />

      <ClientPickerModal
        visible={clientPickerOpen}
        clients={clients}
        onClose={() => setClientPickerOpen(false)}
        onPick={(c) => {
          setSelectedClient(c);
          setClientPickerOpen(false);
        }}
        canCreate={!!access.clientsCreate}
        onCreate={() => {
          setClientPickerOpen(false);
          setClientCreateOpen(true);
        }}
        theme={theme}
      />

      <CreateClientGrossisteModal
        visible={clientCreateOpen}
        onClose={() => {
          if (!creatingClient) setClientCreateOpen(false);
        }}
        submitting={creatingClient}
        onSubmit={async (payload) => {
          if (!token) return;
          setCreatingClient(true);
          try {
            const created = await createClientGrossiste(payload, token);
            // refresh list and select
            const cl = await listClientsGrossistes(token);
            setClients(Array.isArray(cl) ? cl : []);
            const found = (Array.isArray(cl) ? cl : []).find((x) => Number(x?.id) === Number(created?.id)) || created;
            setSelectedClient(found as any);
            setClientCreateOpen(false);
            showSuccess('Succès', 'Client créé');
          } catch (e: any) {
            showError('Erreur', e?.message || 'Création client échouée');
          } finally {
            setCreatingClient(false);
          }
        }}
        theme={theme}
      />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: theme.text, fontSize: 20, fontWeight: '900' }}>Nouvelle commande client</Text>
          <Pressable
            onPress={reload}
            style={{ paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, backgroundColor: theme.surface }}
          >
            <Ionicons name="refresh" size={18} color={theme.text} />
          </Pressable>
        </View>

        {loading ? (
          <View style={{ marginTop: 20, alignItems: 'center' }}>
            <ActivityIndicator />
            <Text style={{ color: theme.muted, marginTop: 8 }}>Chargement...</Text>
          </View>
        ) : null}

        <View
          style={{
            marginTop: 14,
            backgroundColor: theme.card,
            borderRadius: 16,
            padding: 14,
            borderWidth: 1,
            borderColor: theme.isDark ? '#1f2937' : '#e5e7eb',
          }}
        >
          <Text style={{ color: theme.muted, marginBottom: 6 }}>Référence</Text>
          <TextInput
            value={reference}
            onChangeText={setReference}
            placeholder="Référence"
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

          <Text style={{ color: theme.muted, marginTop: 12, marginBottom: 6 }}>Client</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable
              onPress={() => setClientPickerOpen(true)}
              style={{
                flex: 1,
                backgroundColor: theme.surface,
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 12,
                borderWidth: 1,
                borderColor: theme.isDark ? '#1f2937' : '#e5e7eb',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Text style={{ color: theme.text, fontWeight: '800' }} numberOfLines={1}>
                {clientLabel(selectedClient)}
              </Text>
              <Ionicons name="chevron-down" size={18} color={theme.muted} />
            </Pressable>

            {access.clientsCreate ? (
              <Pressable
                onPress={() => setClientCreateOpen(true)}
                style={{
                  width: 48,
                  backgroundColor: theme.primary,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="person-add" size={20} color="#fff" />
              </Pressable>
            ) : null}
          </View>

          {!access.clientsCreate ? (
            <Text style={{ color: theme.muted, marginTop: 8 }}>
              Pour ajouter un client: permission requise CLIENT_CREER.
            </Text>
          ) : null}

          <Text style={{ color: theme.muted, marginTop: 12, marginBottom: 6 }}>Mode de prix</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable
              onPress={() => setPriceMode('DETAIL')}
              style={{
                flex: 1,
                backgroundColor: priceMode === 'DETAIL' ? theme.primary : theme.surface,
                paddingVertical: 10,
                borderRadius: 12,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: priceMode === 'DETAIL' ? 'white' : theme.text, fontWeight: '800' }}>DÉTAIL</Text>
            </Pressable>
            <Pressable
              onPress={() => setPriceMode('GROS')}
              style={{
                flex: 1,
                backgroundColor: priceMode === 'GROS' ? theme.primary : theme.surface,
                paddingVertical: 10,
                borderRadius: 12,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: priceMode === 'GROS' ? 'white' : theme.text, fontWeight: '800' }}>GROS</Text>
            </Pressable>
          </View>
        </View>

        <View style={{ marginTop: 14 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Text style={{ color: theme.text, fontSize: 16, fontWeight: '900' }}>Produits</Text>
            <Pressable
              onPress={() => setStockPickerOpen(true)}
              style={{ backgroundColor: theme.primary, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12 }}
            >
              <Text style={{ color: 'white', fontWeight: '900' }}>Rechercher</Text>
            </Pressable>
          </View>

          <TextInput
            value={productQuery}
            onChangeText={setProductQuery}
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
          />

          <View style={{ marginTop: 10 }}>
            {filteredStocks.length === 0 ? (
              <View
                style={{
                  backgroundColor: theme.card,
                  borderRadius: 14,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: theme.isDark ? '#1f2937' : '#e5e7eb',
                }}
              >
                <Text style={{ color: theme.muted }}>Aucun produit trouvé.</Text>
              </View>
            ) : (
              filteredStocks.map((s: any) => {
                const id = Number(s?.id);
                const available = Number(s?.quantiteDisponible) || 0;
                const mult = packMultiplier(s);
                const already = id ? cartStockIds.has(id) : false;
                return (
                  <View
                    key={String(id || Math.random())}
                    style={{
                      backgroundColor: theme.card,
                      borderRadius: 14,
                      padding: 12,
                      marginBottom: 10,
                      borderWidth: 1,
                      borderColor: theme.isDark ? '#1f2937' : '#e5e7eb',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.text, fontWeight: '900' }} numberOfLines={1}>
                        {stockLabel(s)}
                      </Text>
                      <Text style={{ color: theme.muted, marginTop: 2 }} numberOfLines={1}>
                        Stock dispo: {available} U{mult > 1 ? ` • ${mult} U/emballage` : ''}
                      </Text>
                    </View>

                    <Pressable
                      disabled={already}
                      onPress={() => addStockToCart(s)}
                      style={{
                        backgroundColor: already ? theme.surface : theme.primary,
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        borderRadius: 12,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      {already ? (
                        <Ionicons name="checkmark" size={18} color={theme.text} />
                      ) : (
                        <Ionicons name="add" size={18} color="white" />
                      )}
                      <Text style={{ color: already ? theme.text : 'white', fontWeight: '900' }}>
                        {already ? 'Ajouté' : 'Ajouter'}
                      </Text>
                    </Pressable>
                  </View>
                );
              })
            )}
          </View>
        </View>

        <View style={{ marginTop: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={{ color: theme.text, fontSize: 16, fontWeight: '900' }}>Panier</Text>
            <Pressable
              onPress={() => setLines([])}
              style={{ backgroundColor: theme.surface, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12 }}
            >
              <Text style={{ color: theme.text, fontWeight: '800' }}>Vider</Text>
            </Pressable>
          </View>
          {lines.length === 0 ? (
            <View style={{ backgroundColor: theme.surface, padding: 16, borderRadius: 14 }}>
              <Text style={{ color: theme.muted }}>Aucun produit. Ajoutez depuis la liste “Produits”.</Text>
            </View>
          ) : (
            lines.map((l) => {
              const stock = stockById.get(l.stockId);
              const mult = packMultiplier(stock, l.idEmballage);
              const embList = emballageList(stock);
              const available = stock?.quantiteDisponible != null ? Number(stock.quantiteDisponible) : null;
              const qUnits = parseIntFromDigits(l.quantite);
              const qCond = parseIntFromDigits(l.quantiteConditionnement);
              const realQ = l.venteParConditionnement ? qCond * mult : qUnits;
              const price = parseIntFromDigits(l.prixUnit);
              const montant = Math.max(0, realQ) * Math.max(0, price);
              const selectedEmbLabel = emballageLabel(stock, l.idEmballage);
              const selectedEmbLabelPlural = qCond > 1 && !selectedEmbLabel.toLowerCase().endsWith('s') ? `${selectedEmbLabel}s` : selectedEmbLabel;
              const lineBorder = theme.isDark ? '#1f2937' : '#dbeafe';
              const mutedBorder = theme.isDark ? '#1f2937' : '#e5e7eb';
              const inputBackground = theme.isDark ? '#0f1724' : '#f8fbff';
              const softPrimary = theme.isDark ? '#0b3b57' : '#d9f3ff';
              return (
                <View
                  key={String(l.stockId)}
                  style={{
                    backgroundColor: theme.card,
                    padding: 14,
                    borderRadius: 18,
                    marginBottom: 12,
                    borderWidth: 1,
                    borderColor: lineBorder,
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
                        {stockLabel(stock)}
                      </Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                        <View style={{ backgroundColor: softPrimary, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
                          <Text style={{ color: theme.isDark ? '#bae6fd' : '#0369a1', fontWeight: '800', fontSize: 12 }}>
                            {available != null ? `Stock: ${available} U` : `Stock ID: ${String(l.stockId)}`}
                          </Text>
                        </View>
                        {mult > 1 ? (
                          <View style={{ backgroundColor: theme.isDark ? '#172033' : '#f1f5f9', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
                            <Text style={{ color: theme.text, fontWeight: '800', fontSize: 12 }}>1 {selectedEmbLabel} = {mult} U</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                    <Pressable
                      onPress={() => removeLine(l.stockId)}
                      hitSlop={10}
                      style={{ width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.isDark ? '#2a1620' : '#fff1f2' }}
                    >
                      <Ionicons name="trash-outline" size={18} color={theme.danger} />
                    </Pressable>
                  </View>

                  {mult > 1 ? (
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                      <Pressable
                        onPress={() => updateLine(l.stockId, { venteParConditionnement: false })}
                        style={{
                          flex: 1,
                          minHeight: 48,
                          backgroundColor: !l.venteParConditionnement ? theme.primary : inputBackground,
                          borderRadius: 14,
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderWidth: 1,
                          borderColor: !l.venteParConditionnement ? theme.primary : mutedBorder,
                        }}
                      >
                        <Text style={{ color: !l.venteParConditionnement ? '#fff' : theme.text, fontWeight: '900' }}>Unités</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => updateLine(l.stockId, { venteParConditionnement: true, idEmballage: l.idEmballage ?? defaultEmballageId(stock) })}
                        style={{
                          flex: 1,
                          minHeight: 48,
                          backgroundColor: l.venteParConditionnement ? theme.primary : inputBackground,
                          borderRadius: 14,
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderWidth: 1,
                          borderColor: l.venteParConditionnement ? theme.primary : mutedBorder,
                        }}
                      >
                        <Text style={{ color: l.venteParConditionnement ? '#fff' : theme.text, fontWeight: '900' }}>{selectedEmbLabel}</Text>
                      </Pressable>
                    </View>
                  ) : null}

                  {l.venteParConditionnement && embList.length > 1 && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                      {embList.map((e: any) => {
                        const selected = l.idEmballage === e.id;
                        return (
                          <Pressable
                            key={e.id}
                            onPress={() => updateLine(l.stockId, { idEmballage: e.id })}
                            style={{
                              paddingHorizontal: 12,
                              paddingVertical: 8,
                              borderRadius: 12,
                              backgroundColor: selected ? theme.primary : theme.surface,
                              borderWidth: 1,
                              borderColor: selected ? theme.primary : mutedBorder,
                            }}
                          >
                            <Text style={{ color: selected ? '#fff' : theme.text, fontWeight: '700' }}>
                              {e.uniteLibelle} ({e.nombreUnites}u)
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}

                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.muted, marginBottom: 6 }}>
                        {l.venteParConditionnement ? `Quantité (${selectedEmbLabel})` : 'Quantité (unités)'}
                      </Text>
                      <TextInput
                        value={l.venteParConditionnement ? l.quantiteConditionnement : l.quantite}
                        onChangeText={(t) =>
                          updateLine(l.stockId, {
                            ...(l.venteParConditionnement
                              ? { quantiteConditionnement: digitsOnly(t) }
                              : { quantite: digitsOnly(t) }),
                          })
                        }
                        keyboardType="numeric"
                        placeholder="0"
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
                      {l.venteParConditionnement ? (
                        <Text style={{ color: theme.muted, marginTop: 6 }}>
                          {qCond || 0} {selectedEmbLabelPlural} ≈ {realQ || 0} unité(s)
                        </Text>
                      ) : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.muted, marginBottom: 6 }}>Prix</Text>
                      <TextInput
                        value={formatThousandsFromDigits(l.prixUnit)}
                        onChangeText={(t) => updateLine(l.stockId, { prixUnit: digitsOnly(t) })}
                        keyboardType="numeric"
                        placeholder="0"
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
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
                    <Text style={{ color: theme.muted }}>Montant ligne</Text>
                    <Text style={{ color: theme.text, fontWeight: '900' }}>{formatThousandsFromDigits(String(montant))} {currencySymbol}</Text>
                  </View>
                </View>
              );
            })
          )}
        </View>

        <View
          style={{
            marginTop: 10,
            backgroundColor: theme.card,
            borderRadius: 16,
            padding: 14,
            borderWidth: 1,
            borderColor: theme.isDark ? '#1f2937' : '#e5e7eb',
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: theme.muted, fontWeight: '800' }}>Total</Text>
            <Text style={{ color: theme.text, fontWeight: '900' }}>{formatThousandsFromDigits(String(total))} {currencySymbol}</Text>
          </View>

          <Pressable
            onPress={onSubmit}
            disabled={!canSubmit}
            style={{
              marginTop: 12,
              backgroundColor: canSubmit ? theme.primary : theme.surface,
              paddingVertical: 12,
              borderRadius: 14,
              alignItems: 'center',
              opacity: submitting ? 0.7 : 1,
            }}
          >
            <Text style={{ color: canSubmit ? 'white' : theme.muted, fontWeight: '900' }}>
              {submitting ? 'Création...' : 'Créer la commande'}
            </Text>
          </Pressable>

          {!access.ventesCreate ? (
            <Text style={{ color: theme.muted, marginTop: 10, textAlign: 'center' }}>
              Permission requise: VENTE_CREER
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
