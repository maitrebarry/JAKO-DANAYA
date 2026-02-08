import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
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
import { showError, showSuccess } from '../utils/notify';
import { useAccess } from '../utils/access';
import {
  createCommandeFournisseur,
  createFournisseur,
  fetchBoutiqueStocksForAchat,
  fetchFournisseurs,
  type CreateFournisseurPayload,
  type CreateCommandeFournisseurPayload,
  type Fournisseur,
} from '../services/achat';

type StockItem = any;

type CartLine = {
  stockId: number;
  produit: any;
  designation: string;
  achatParConditionnement: boolean;
  quantite: string; // units
  quantiteConditionnement: string; // cartons
  prixUnit: string; // digits string
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

function packMultiplier(stock: any) {
  const raw = stock?.produit?.nombreUnitesParConditionnement;
  const n = Number(raw);
  return Number.isFinite(n) && n > 1 ? n : 1;
}

function productNameFromStock(s: any) {
  return s?.produit?.nomProduit || s?.produit?.nom || s?.nomProduit || `Stock ${s?.id ?? ''}`;
}

function buildReference() {
  const now = new Date();
  return `CF-${now.toISOString().replace(/[:.]/g, '').slice(0, 15)}`;
}

function formatDateCommandeForApi(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function fournisseurLabel(f: Fournisseur | null) {
  if (!f) return '';
  const nom = [f.nom, f.prenom].filter(Boolean).join(' ').trim();
  if (nom) return nom;
  return `Fournisseur #${f.id}`;
}

const CreateFournisseurModal = React.memo(function CreateFournisseurModal({
  visible,
  onClose,
  onSubmit,
  theme,
  submitting,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateFournisseurPayload) => void;
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
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700' }}>Nouveau fournisseur</Text>
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
              const payload: CreateFournisseurPayload = {
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

const FournisseurPickerModal = React.memo(function FournisseurPickerModal({
  visible,
  onClose,
  fournisseurs,
  onPick,
  theme,
}: {
  visible: boolean;
  onClose: () => void;
  fournisseurs: Fournisseur[];
  onPick: (f: Fournisseur) => void;
  theme: ReturnType<typeof useTheme>;
}) {
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!visible) setQ('');
  }, [visible]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const base = Array.isArray(fournisseurs) ? fournisseurs : [];
    if (!query) return base.slice(0, 60);
    return base
      .filter((f) => fournisseurLabel(f).toLowerCase().includes(query) || String(f.id).includes(query))
      .slice(0, 60);
  }, [q, fournisseurs]);

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
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700' }}>Choisir un fournisseur</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={22} color={theme.text} />
          </Pressable>
        </View>

        <View style={{ padding: 16 }}>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Rechercher..."
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
          keyExtractor={(item) => String(item.id)}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          renderItem={({ item }) => {
            const title = fournisseurLabel(item);
            const subtitle = [item.contact, item.ville].filter(Boolean).join(' • ');
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
                <Text style={{ color: theme.text, fontWeight: '800' }} numberOfLines={1}>
                  {title}
                </Text>
                {!!subtitle && (
                  <Text style={{ color: theme.muted, marginTop: 2 }} numberOfLines={1}>
                    {subtitle}
                  </Text>
                )}
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={{ paddingHorizontal: 16 }}>
              <Text style={{ color: theme.muted }}>Aucun fournisseur.</Text>
            </View>
          }
        />
      </SafeAreaView>
    </Modal>
  );
});

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
                    <Text style={{ color: theme.text, fontWeight: '800' }} numberOfLines={1}>
                      {name}
                    </Text>
                    <Text style={{ color: theme.muted, marginTop: 2 }} numberOfLines={1}>
                      Stock actuel: {available} U{mult > 1 ? ` • ${mult} U/carton` : ''}
                    </Text>
                  </View>
                  <View
                    style={{
                      backgroundColor: theme.primary,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 12,
                    }}
                  >
                    <Text style={{ color: 'white', fontWeight: '800' }}>Ajouter</Text>
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

export default function AchatScreen() {
  const theme = useTheme();
  const { token } = useApp();
  const access = useAccess();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [stocks, setStocks] = useState<StockItem[]>([]);

  const [reference, setReference] = useState(buildReference());
  const [selectedFournisseur, setSelectedFournisseur] = useState<Fournisseur | null>(null);

  const [showFournisseurPicker, setShowFournisseurPicker] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [showCreateFournisseur, setShowCreateFournisseur] = useState(false);
  const [creatingFournisseur, setCreatingFournisseur] = useState(false);

  const [cart, setCart] = useState<CartLine[]>([]);

  const stockById = useMemo(() => {
    const map = new Map<number, any>();
    (stocks || []).forEach((s: any) => {
      if (s && s.id != null) map.set(Number(s.id), s);
    });
    return map;
  }, [stocks]);

  const total = useMemo(() => {
    return cart.reduce((sum, line) => {
      const stock = stockById.get(line.stockId);
      const mult = packMultiplier(stock || { produit: line.produit });

      let qtyUnits = parseIntFromDigits(line.quantite);
      if (line.achatParConditionnement) {
        const cartons = parseIntFromDigits(line.quantiteConditionnement);
        qtyUnits = cartons * mult;
      }

      const prixUnit = parseIntFromDigits(line.prixUnit);
      return sum + qtyUnits * prixUnit;
    }, 0);
  }, [cart, stockById]);

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    if (!access.achatsCreate) {
      setFournisseurs([]);
      setStocks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [fs, st] = await Promise.all([
        fetchFournisseurs(token),
        fetchBoutiqueStocksForAchat(token),
      ]);
      setFournisseurs(fs);
      setStocks(st);
    } catch (e: any) {
      showError('Erreur', e?.message || 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }, [token, access.achatsCreate]);

  useEffect(() => {
    load();
  }, [load]);

  const addToCart = useCallback((s: any) => {
    const stockId = Number(s?.id);
    if (!Number.isFinite(stockId)) return;
    setCart((prev) => {
      if (prev.some((l) => l.stockId === stockId)) return prev;
      const produit = s?.produit || {};
      const prixAchat = Number(produit?.prixAchat);
      const defaultPrix = Number.isFinite(prixAchat) && prixAchat > 0 ? String(Math.trunc(prixAchat)) : '';
      return [
        {
          stockId,
          produit,
          designation: productNameFromStock(s),
          achatParConditionnement: false,
          quantite: '1',
          quantiteConditionnement: '',
          prixUnit: defaultPrix,
        },
        ...prev,
      ];
    });
    setShowProductPicker(false);
  }, []);

  const removeLine = useCallback((stockId: number) => {
    setCart((prev) => prev.filter((l) => l.stockId !== stockId));
  }, []);

  const toggleConditionnement = useCallback((stockId: number, enabled: boolean) => {
    setCart((prev) =>
      prev.map((l) =>
        l.stockId === stockId
          ? {
              ...l,
              achatParConditionnement: enabled,
              quantiteConditionnement: enabled ? (l.quantiteConditionnement || '1') : '',
              quantite: enabled ? '' : (l.quantite || '1'),
            }
          : l
      )
    );
  }, []);

  const changeQty = useCallback((stockId: number, v: string) => {
    setCart((prev) => prev.map((l) => (l.stockId === stockId ? { ...l, quantite: digitsOnly(v) } : l)));
  }, []);

  const changeQtyCond = useCallback((stockId: number, v: string) => {
    setCart((prev) => prev.map((l) => (l.stockId === stockId ? { ...l, quantiteConditionnement: digitsOnly(v) } : l)));
  }, []);

  const changePrixUnit = useCallback((stockId: number, v: string) => {
    setCart((prev) => prev.map((l) => (l.stockId === stockId ? { ...l, prixUnit: digitsOnly(v) } : l)));
  }, []);

  const submit = useCallback(async () => {
    if (!token) {
      showError('Connexion', 'Vous devez être connecté.');
      return;
    }
    if (!access.achatsCreate) {
      showError('Permission', "Vous n'avez pas la permission de créer une commande fournisseur.");
      return;
    }
    if (!selectedFournisseur) {
      showError('Fournisseur', 'Sélectionnez un fournisseur.');
      return;
    }
    if (!cart.length) {
      showError('Produits', 'Ajoutez au moins un produit.');
      return;
    }
    if (total <= 0) {
      showError('Total', 'Le total doit être supérieur à 0.');
      return;
    }

    const produitsSelectionnes: CreateCommandeFournisseurPayload['produitsSelectionnes'] = [];
    for (const line of cart) {
      const stock = stockById.get(line.stockId);
      const mult = packMultiplier(stock || { produit: line.produit });

      const prix = parseIntFromDigits(line.prixUnit);
      if (prix <= 0) {
        showError('Prix', `Prix invalide pour ${line.designation}`);
        return;
      }

      if (line.achatParConditionnement) {
        const cartons = parseIntFromDigits(line.quantiteConditionnement);
        if (cartons <= 0) {
          showError('Quantité', `Quantité carton invalide pour ${line.designation}`);
          return;
        }
        produitsSelectionnes.push({
          id_stock: line.stockId,
          quantite: cartons * mult,
          quantiteConditionnement: cartons,
          prix,
        });
      } else {
        const qty = parseIntFromDigits(line.quantite);
        if (qty <= 0) {
          showError('Quantité', `Quantité invalide pour ${line.designation}`);
          return;
        }
        produitsSelectionnes.push({ id_stock: line.stockId, quantite: qty, prix });
      }
    }

    const payload: CreateCommandeFournisseurPayload = {
      reference: reference || buildReference(),
      dateCommande: formatDateCommandeForApi(new Date()),
      fournisseur: { id: selectedFournisseur.id },
      produitsSelectionnes,
      total: Math.trunc(total),
    };

    setSubmitting(true);
    try {
      await createCommandeFournisseur(payload, token);
      showSuccess('Commande créée', payload.reference);
      setCart([]);
      setSelectedFournisseur(null);
      setReference(buildReference());
    } catch (e: any) {
      showError('Erreur', e?.message || 'Création impossible');
    } finally {
      setSubmitting(false);
    }
  }, [token, access.achatsCreate, selectedFournisseur, cart, total, stockById, reference]);

  if (!token) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background, padding: 16 }}>
        <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text }}>Achat</Text>
        <Text style={{ marginTop: 8, color: theme.muted, textAlign: 'center' }}>Connectez-vous pour gérer les achats.</Text>
      </View>
    );
  }

  if (token && !access.achatsCreate) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background, padding: 16 }}>
        <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text }}>Achat</Text>
        <Text style={{ marginTop: 8, color: theme.muted, textAlign: 'center' }}>
          Vous n'avez pas la permission de créer une commande fournisseur.
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <FournisseurPickerModal
        visible={showFournisseurPicker}
        onClose={() => setShowFournisseurPicker(false)}
        fournisseurs={fournisseurs}
        onPick={(f) => {
          setSelectedFournisseur(f);
          setShowFournisseurPicker(false);
        }}
        theme={theme}
      />
      <ProductPickerModal
        visible={showProductPicker}
        onClose={() => setShowProductPicker(false)}
        stocks={stocks}
        onPick={addToCart}
        theme={theme}
      />
      <CreateFournisseurModal
        visible={showCreateFournisseur}
        onClose={() => {
          if (!creatingFournisseur) setShowCreateFournisseur(false);
        }}
        submitting={creatingFournisseur}
        theme={theme}
        onSubmit={async (payload) => {
          if (!token) return;
          setCreatingFournisseur(true);
          try {
            const created = await createFournisseur(payload, token);
            setFournisseurs((prev) => {
              const next = [created, ...(prev || [])];
              // de-dup by id
              const seen = new Set<number>();
              return next.filter((f) => {
                if (!f?.id) return false;
                if (seen.has(f.id)) return false;
                seen.add(f.id);
                return true;
              });
            });
            setSelectedFournisseur(created);
            setShowCreateFournisseur(false);
            showSuccess('Fournisseur créé', fournisseurLabel(created));
          } catch (e: any) {
            showError('Erreur', e?.message || 'Création fournisseur impossible');
          } finally {
            setCreatingFournisseur(false);
          }
        }}
      />

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator />
          <Text style={{ color: theme.muted, marginTop: 8 }}>Chargement...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28 }} keyboardShouldPersistTaps="handled">
          <View
            style={{
              backgroundColor: theme.card,
              borderRadius: 16,
              padding: 14,
              borderWidth: 1,
              borderColor: theme.isDark ? '#1f2937' : '#e5e7eb',
            }}
          >
            <Text style={{ color: theme.text, fontSize: 18, fontWeight: '900' }}>Nouvelle commande fournisseur</Text>

            <Text style={{ color: theme.muted, marginTop: 10, marginBottom: 6 }}>Référence</Text>
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

            <Text style={{ color: theme.muted, marginTop: 12, marginBottom: 6 }}>Fournisseur</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable
                onPress={() => setShowFournisseurPicker(true)}
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
                <Text style={{ color: selectedFournisseur ? theme.text : theme.muted, fontWeight: '700' }} numberOfLines={1}>
                  {selectedFournisseur ? fournisseurLabel(selectedFournisseur) : 'Choisir un fournisseur'}
                </Text>
                <Ionicons name="chevron-down" size={18} color={theme.muted} />
              </Pressable>
              <Pressable
                onPress={() => setShowCreateFournisseur(true)}
                style={{
                  backgroundColor: theme.primary,
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="person-add" size={18} color="white" />
              </Pressable>
            </View>
          </View>

          <View style={{ marginTop: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <Text style={{ color: theme.text, fontSize: 16, fontWeight: '900' }}>Produits</Text>
              <Pressable
                onPress={() => setShowProductPicker(true)}
                style={{ backgroundColor: theme.primary, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12 }}
              >
                <Text style={{ color: 'white', fontWeight: '900' }}>+ Ajouter</Text>
              </Pressable>
            </View>

            {cart.length === 0 ? (
              <View
                style={{
                  backgroundColor: theme.card,
                  borderRadius: 14,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: theme.isDark ? '#1f2937' : '#e5e7eb',
                }}
              >
                <Text style={{ color: theme.muted }}>Aucun produit ajouté.</Text>
              </View>
            ) : (
              cart.map((line) => {
                const stock = stockById.get(line.stockId);
                const mult = packMultiplier(stock || { produit: line.produit });
                return (
                  <View
                    key={String(line.stockId)}
                    style={{
                      backgroundColor: theme.card,
                      borderRadius: 14,
                      padding: 12,
                      marginBottom: 10,
                      borderWidth: 1,
                      borderColor: theme.isDark ? '#1f2937' : '#e5e7eb',
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <View style={{ flex: 1, paddingRight: 10 }}>
                        <Text style={{ color: theme.text, fontWeight: '900' }} numberOfLines={2}>
                          {line.designation}
                        </Text>
                        <Text style={{ color: theme.muted, marginTop: 2 }} numberOfLines={1}>
                          Stock actuel: {Number(stock?.quantiteDisponible) || 0} U{mult > 1 ? ` • ${mult} U/carton` : ''}
                        </Text>
                      </View>
                      <Pressable onPress={() => removeLine(line.stockId)} hitSlop={12}>
                        <Ionicons name="trash-outline" size={20} color={theme.danger} />
                      </Pressable>
                    </View>

                    {mult > 1 && (
                      <Pressable
                        onPress={() => toggleConditionnement(line.stockId, !line.achatParConditionnement)}
                        style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}
                      >
                        <View
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: 6,
                            backgroundColor: line.achatParConditionnement ? theme.primary : theme.surface,
                            borderWidth: 1,
                            borderColor: theme.isDark ? '#1f2937' : '#e5e7eb',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginRight: 8,
                          }}
                        >
                          {line.achatParConditionnement && <Ionicons name="checkmark" size={16} color="white" />}
                        </View>
                        <Text style={{ color: theme.text, fontWeight: '800' }}>Saisir par conditionnement</Text>
                      </Pressable>
                    )}

                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: theme.muted, marginBottom: 6 }}>Quantité</Text>
                        <TextInput
                          value={line.achatParConditionnement ? line.quantiteConditionnement : line.quantite}
                          onChangeText={(v) =>
                            line.achatParConditionnement
                              ? changeQtyCond(line.stockId, v)
                              : changeQty(line.stockId, v)
                          }
                          placeholder={line.achatParConditionnement ? 'Cartons' : 'Unités'}
                          placeholderTextColor={theme.muted}
                          keyboardType="numeric"
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
                        <Text style={{ color: theme.muted, marginBottom: 6 }}>Prix unité (achat)</Text>
                        <TextInput
                          value={formatThousandsFromDigits(line.prixUnit)}
                          onChangeText={(v) => changePrixUnit(line.stockId, v)}
                          placeholder="0"
                          placeholderTextColor={theme.muted}
                          keyboardType="numeric"
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
                  </View>
                );
              })
            )}
          </View>

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
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: theme.text, fontSize: 16, fontWeight: '900' }}>Total</Text>
              <Text style={{ color: theme.text, fontSize: 18, fontWeight: '900' }}>{formatThousandsFromDigits(String(total))}</Text>
            </View>

            <Pressable
              onPress={submit}
              disabled={submitting}
              style={{
                marginTop: 12,
                backgroundColor: submitting ? theme.muted : theme.primary,
                paddingVertical: 12,
                borderRadius: 14,
                alignItems: 'center',
              }}
            >
              {submitting ? (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <ActivityIndicator color="white" />
                  <Text style={{ color: 'white', fontWeight: '900', marginLeft: 10 }}>Envoi...</Text>
                </View>
              ) : (
                <Text style={{ color: 'white', fontWeight: '900' }}>Créer la commande</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
