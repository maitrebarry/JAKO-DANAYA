import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, Image, SafeAreaView, KeyboardAvoidingView, Platform, TouchableOpacity, Switch } from 'react-native';
// dynamic import of expo-image-picker to avoid runtime crash when not installed
let ImagePicker: any = null;
import { useApp } from '../store/AppContext';
import { createProduit, fetchProduit, updateProduit, fetchConfigurationMarge, createEmballage, updateEmballage, deleteEmballage } from '../services/produit';
import { useTheme } from '../theme';
import { showSuccess, showError, showInfo } from '../utils/notify';
import { useAccess } from '../utils/access';

const Field = React.memo(function Field({ label, children, help, error, theme }: any) {
  return (
    <View style={{ marginTop: 12 }}>
      <Text style={{ color: theme.text, fontWeight: '600', marginBottom: 6 }}>{label}</Text>
      {children}
      {help ? <Text style={{ color: theme.muted, marginTop: 6 }}>{help}</Text> : null}
      {error ? <Text style={{ color: theme.danger, marginTop: 6 }}>{error}</Text> : null}
    </View>
  );
});

type EmballageRow = {
  tempId: string;
  id?: number;
  uniteId: string;
  nombreUnites: string;
  estParDefaut: boolean;
};

function newEmballageRow(isDefault: boolean): EmballageRow {
  return {
    tempId: `new-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    uniteId: '',
    nombreUnites: '',
    estParDefaut: isDefault,
  };
}

export default function ProductFormScreen({ route, navigation }: any) {
  const { token, boutiqueId } = useApp();
  const theme = useTheme();
  const access = useAccess();
  const nomInputRef = React.useRef<TextInput>(null);
  const moneyDigits = (v: string) => String(v || '').replace(/[^0-9]/g, '');
  const formatThousands = (digits: string) => {
    const d = String(digits || '').replace(/^0+(?=\d)/, '');
    if (!d) return '';
    return d.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  };
  const parseMoneyInt = (v: string) => {
    const d = moneyDigits(v);
    if (!d) return null;
    const n = Number(d);
    return Number.isFinite(n) ? n : null;
  };
  const mode = route.params?.mode || 'create';
  const id = route.params?.id;

  const canEditThis = mode === 'create' ? access.produitsCreate : access.produitsEdit;
  const [margeLoading, setMargeLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(0); // 0: Produit, 1: Emballages, 2: Prix & CMP

  const loadMargeConfig = async () => {
    if (!boutiqueId || !token) {
      console.log('MARGE SKIP - missing boutiqueId or token', boutiqueId, !!token);
      return;
    }
    try {
      setMargeLoading(true);
      console.log('FETCH_MARGE_CONFIG', { boutiqueId });
      const cfg = await fetchConfigurationMarge(boutiqueId, token as string);
      console.log('FETCH_MARGE_RESULT', cfg);
      setMargeConfig(cfg);
      // If configuration is MANUEL, disable automatic margin computation by default
      try {
        const t = (cfg && cfg.typeMarge) ? String(cfg.typeMarge).toUpperCase() : null;
        if (t === 'MANUEL') setComputeMargins(false);
      } catch (e) { /* ignore parsing errors */ }
    } catch (e:any) {
      console.warn('FETCH_MARGE_FAILED', e);
      setMargeConfig(null);
    } finally {
      setMargeLoading(false);
    }
  };


  const BackHeader = require('../components/BackHeader').default;
  const [nom, setNom] = useState('');
  const [description, setDescription] = useState(''); // caracteristique
  const [categorie, setCategorie] = useState(''); // not used yet
  const [prixDetail, setPrixDetail] = useState('');
  const [prixEnGros, setPrixEnGros] = useState('');
  const [prixAchat, setPrixAchat] = useState('');
  const [alerteStock, setAlerteStock] = useState('');
  const [quantite, setQuantite] = useState('0');
  const [image, setImage] = useState<any>(null);
  const [imageType, setImageType] = useState<'file'|'url'>('file');
  const [imageUrl, setImageUrl] = useState('');
  const [errors, setErrors] = useState<Record<string,string>>({});
  const [margeConfig, setMargeConfig] = useState<any | null>(null);
  const [computeMargins, setComputeMargins] = useState(true);
  const [suggested, setSuggested] = useState<{ prixEnGros?: number | null, prixDetail?: number | null }>({});
  const [prixEnGrosTouched, setPrixEnGrosTouched] = useState(false);
  const [prixDetailTouched, setPrixDetailTouched] = useState(false);
  const [recomputeJobId, setRecomputeJobId] = useState<string | null>(null);
  const [recomputeStatus, setRecomputeStatus] = useState<string | null>(null);
  const recomputeTimer = React.useRef<any>(null);

  // Units and emballages
  const [unites, setUnites] = useState<any[]>([]);
  const [selectedUniteId, setSelectedUniteId] = useState<number | null>(null);
  const [nombreUnitesParConditionnement, setNombreUnitesParConditionnement] = useState<string>('1');
  const [emballageRows, setEmballageRows] = useState<EmballageRow[]>([]);
  const [originalEmballageIds, setOriginalEmballageIds] = useState<number[]>([]);

  const fetchUnits = async () => {
    try {
      if (!token) return;
      const { fetchUnites } = require('../services/produit');
      const d = await fetchUnites(token as string);
      setUnites(d || []);
    } catch (e:any) {
      console.warn('FETCH_UNITS_FAILED', e.message || e);
      // keep empty units list
      setUnites([]);
    }
  };
  useEffect(() => { fetchUnits(); }, [token]);

  useEffect(() => {
    const def = emballageRows.find((r) => r.estParDefaut) || emballageRows[0];
    if (def) {
      setSelectedUniteId(def.uniteId ? Number(def.uniteId) : null);
      setNombreUnitesParConditionnement(def.nombreUnites || '1');
    } else {
      setSelectedUniteId(null);
      setNombreUnitesParConditionnement('1');
    }
  }, [emballageRows]);

  useEffect(() => {
    // load margin config on mount or when boutiqueId/token change
    loadMargeConfig();

    // If we come from the barcode scanner with a resolved product name (external lookup), prefill it.
    if (mode === 'create' && route.params?.initialNomProduit && !nom) {
      setNom(String(route.params.initialNomProduit || ''));
    }
    if (mode === 'edit' && id) {
      (async () => {
        try {
          const p = await fetchProduit(id, token as string);
          setNom(p.nomProduit || '');
          setDescription(p.caracteristique || '');
          setPrixDetail(p.prixDetail ? String(p.prixDetail) : '');
          setPrixEnGros(p.prixEnGros ? String(p.prixEnGros) : '');
          setPrixAchat(p.prixAchat ? String(p.prixAchat) : '');
          setAlerteStock(p.alerteStock ? String(p.alerteStock) : '');
          setQuantite(p.quantiteInitialeConditionnements ? String(p.quantiteInitialeConditionnements) : '0');
          const existingEmballages: EmballageRow[] = Array.isArray(p.emballages) && p.emballages.length > 0
            ? p.emballages.map((e: any) => ({
                tempId: `existing-${e.id}`,
                id: e.id,
                uniteId: String(e.uniteId ?? e.unite?.id ?? ''),
                nombreUnites: e.nombreUnites != null ? String(e.nombreUnites) : '',
                estParDefaut: !!e.estParDefaut,
              }))
            : (p.unite ? [{
                tempId: 'legacy-default',
                uniteId: String(p.unite.id),
                nombreUnites: p.nombreUnitesParConditionnement ? String(p.nombreUnitesParConditionnement) : '1',
                estParDefaut: true,
              }] : []);
          setEmballageRows(existingEmballages);
          setOriginalEmballageIds(existingEmballages.map((e) => e.id).filter((emballageId): emballageId is number => emballageId != null));
          // image handling: if productImage looks like a URL, use URL mode; otherwise keep file mode
          if (p.productImage) {
            const isUrl = typeof p.productImage === 'string' && p.productImage.includes('://');
            if (isUrl) {
              setImageType('url');
              setImageUrl(p.productImage);
              setImage(null);
            } else {
              setImageType('file');
              setImage({ uri: p.productImage });
            }
          }
        } catch (e:any) { showError('Erreur', e.message || 'Erreur'); navigation.goBack(); }
      })();
    }
  }, [mode, id, boutiqueId, token]);

  useEffect(() => {
    console.log('ProductFormScreen MOUNT');
    return () => {
      console.log('ProductFormScreen UNMOUNT');
    };
  }, []);

  const pickImage = async () => {
    try {
      if (!ImagePicker) ImagePicker = require('expo-image-picker');
      // Request camera permissions
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        showError('Permission refusée', 'L\'accès à la caméra est requis pour prendre une photo.');
        return;
      }
      // Use the new MediaType API when available to avoid deprecation warnings
      const mediaTypes = ImagePicker.MediaType?.Images || ImagePicker.MediaTypeOptions?.Images || ImagePicker.MediaType?.All || ImagePicker.MediaTypeOptions?.All;
      const res = await ImagePicker.launchCameraAsync({ mediaTypes, quality: 0.7, base64: false });
      if (!res.cancelled) setImage(res);
    } catch (e:any) {
      showError('Fonctionnalité non disponible', "Le module d'accès à la caméra n'est pas installé. Exécutez 'expo install expo-image-picker'");
    }
  };

  const computeSuggested = (prixAchatVal: number | null, cfg: any | null) => {
    if (!cfg || prixAchatVal == null) return { prixEnGros: null, prixDetail: null };
    const type = (cfg.typeMarge || 'FIXE').toUpperCase();
    if (type === 'MANUEL') return { prixEnGros: null, prixDetail: null };
    let gros = 0, detail = 0;
    if (type === 'FIXE') {
      gros = prixAchatVal + (Number(cfg.valeurGros || 0) || 0);
      detail = prixAchatVal + (Number(cfg.valeurDetail || 0) || 0);
    } else {
      const vgPct = Number(cfg.valeurGros || 0) || 0;
      const vdPct = Number(cfg.valeurDetail || 0) || 0;
      gros = Math.round(prixAchatVal * (1 + vgPct / 100));
      detail = Math.round(prixAchatVal * (1 + vdPct / 100));
      // apply minima if set
      const minG = Number(cfg.margeMinimaleGros || 0) || 0;
      const minD = Number(cfg.margeMinimaleDetail || 0) || 0;
      if ((gros - prixAchatVal) < minG) gros = prixAchatVal + minG;
      if ((detail - prixAchatVal) < minD) detail = prixAchatVal + minD;
    }
    return { prixEnGros: gros, prixDetail: detail };
  };

  useEffect(() => {
    const pa = parseMoneyInt(prixAchat);
    if (computeMargins) {
      const sug = computeSuggested(pa, margeConfig);
      setSuggested(sug);
      // Mirror web: when creating, always set computed prix; when editing, only override if user didn't manually change fields
      if (mode !== 'edit') {
        if (sug.prixEnGros != null) setPrixEnGros(String(sug.prixEnGros));
        if (sug.prixDetail != null) setPrixDetail(String(sug.prixDetail));
      } else {
        if (!prixEnGrosTouched && sug.prixEnGros != null) setPrixEnGros(String(sug.prixEnGros));
        if (!prixDetailTouched && sug.prixDetail != null) setPrixDetail(String(sug.prixDetail));
      }
    } else {
      setSuggested({});
    }
  }, [prixAchat, margeConfig, computeMargins, mode, prixEnGrosTouched, prixDetailTouched]);

  const [creating, setCreating] = useState(false);

  const submit = async () => {
    if (!canEditThis) {
      showError('Permission', mode === 'create' ? "Vous n'avez pas la permission d'ajouter un produit." : "Vous n'avez pas la permission de modifier un produit.");
      return;
    }
    if (creating) return; // prevent double submit
    setCreating(true);
    try {
      // client-side validation
      const errs: Record<string,string> = {};
      if (!nom || !nom.trim()) errs.nom = 'Le nom est requis';
      const pd = prixDetail ? Number(prixDetail) : null;
      const peg = prixEnGros ? Number(prixEnGros) : null;
      const pa = parseMoneyInt(prixAchat);
      if (pd != null && (!Number.isFinite(pd) || pd <= 0)) errs.prixDetail = 'Prix détail invalide';
      if (peg != null && (!Number.isFinite(peg) || peg <= 0)) errs.prixEnGros = 'Prix en gros invalide';
      if (pa != null && (!Number.isFinite(pa) || pa < 0)) errs.prixAchat = 'Prix achat invalide';
      if (pa != null && peg != null && pa >= peg) errs.prixAchat = 'Prix achat doit être < prix en gros';
      if (peg != null && pd != null && peg >= pd) errs.prixEnGros = 'Prix en gros doit être < prix détail';

      setErrors(errs);
      if (Object.keys(errs).length > 0) { setCreating(false); return; }

      const fd = new FormData();
      fd.append('nomProduit', nom);
      fd.append('caracteristique', description);
      // send image URL if chosen, otherwise send a file (imageFile) or empty productImage
      if (imageType === 'url' && imageUrl) {
        fd.append('productImage', imageUrl);
      } else {
        fd.append('productImage', '');
        if (image && image.uri) {
          const parts = image.uri.split('/');
          const name = parts[parts.length - 1];
          // In Expo, fetch the blob and append
          const resp = await fetch(image.uri);
          const blob = await resp.blob();
          fd.append('imageFile', blob as any, name);
        }
      }

      // Always include prixEnGros/prixDetail keys (backend expects these params). Use empty string when margins are calculated server-side.
      if (computeMargins) {
        fd.append('prixEnGros', '');
        fd.append('prixDetail', '');
      } else {
        fd.append('prixEnGros', prixEnGros);
        fd.append('prixDetail', prixDetail);
      }
      fd.append('prixAchat', moneyDigits(prixAchat));
      fd.append('alerteStock', alerteStock);
      fd.append('quantiteInitiale', quantite);

      const cleanedEmballages = emballageRows.filter((r) => r.uniteId || r.nombreUnites);
      if (cleanedEmballages.some((r) => !r.uniteId || !r.nombreUnites || Number(r.nombreUnites) < 1)) {
        showError('Erreur', "Veuillez compléter chaque emballage (unité + nombre d'unités) ou le retirer.");
        setCreating(false); return;
      }
      const uniteIdsUsed = cleanedEmballages.map((r) => r.uniteId);
      if (new Set(uniteIdsUsed).size !== uniteIdsUsed.length) {
        showError('Erreur', 'Chaque emballage doit utiliser une unité différente.');
        setCreating(false); return;
      }
      const defaultEmballage = cleanedEmballages.find((r) => r.estParDefaut) || cleanedEmballages[0];
      if (defaultEmballage) {
        fd.append('uniteConditionnementId', defaultEmballage.uniteId);
        fd.append('nombreUnitesParConditionnement', defaultEmballage.nombreUnites);
      }

      if (mode === 'create') {
        const saved = await createProduit(fd, token as string);
        console.log('PRODUCT_CREATE', { nom, prixDetail, computed: computeMargins, saved });
        const ordered = [...cleanedEmballages].sort((a, b) => Number(b.estParDefaut) - Number(a.estParDefaut));
        for (const row of ordered) {
          await createEmballage(saved.id, {
            uniteId: Number(row.uniteId),
            nombreUnites: Number(row.nombreUnites),
            estParDefaut: row.estParDefaut,
          }, token as string);
        }
        // Success alert with actions
        const totalUnits = Number(quantite || '0') * Number(defaultEmballage?.nombreUnites || '1');
        const unitName = defaultEmballage ? (unites.find(u=>String(u.id)===defaultEmballage.uniteId)?.libelle || '') : '';
        showSuccess('Produit créé', `${saved.nomProduit} a été créé avec succès. Quantité initiale: ${quantite} ${unitName ? unitName + '(s)' : 'unités'} (= ${totalUnits} unités)`);
        navigation.navigate('ProductDetail', { id: saved.id });
      } else {
        const saved = await updateProduit(id, fd, token as string);
        console.log('PRODUCT_UPDATE', { id, nom, saved });
        const deletedIds = originalEmballageIds.filter((emballageId) => !cleanedEmballages.some((r) => r.id === emballageId));
        for (const emballageId of deletedIds) {
          await deleteEmballage(id, emballageId, token as string);
        }
        const ordered = [...cleanedEmballages].sort((a, b) => Number(b.estParDefaut) - Number(a.estParDefaut));
        for (const row of ordered) {
          const payload = {
            uniteId: Number(row.uniteId),
            nombreUnites: Number(row.nombreUnites),
            estParDefaut: row.estParDefaut,
          };
          if (row.id != null) {
            await updateEmballage(id, row.id, payload, token as string);
          } else {
            await createEmballage(id, payload, token as string);
          }
        }
        showSuccess('Produit mis à jour', `${nom} a été mis à jour avec succès.`);
        navigation.goBack();
      }
    } catch (e:any) {
      showError('Erreur', e.message || 'Erreur enregistrement');
    } finally {
      setCreating(false);
    }
  };

  const inputStyle = { backgroundColor: theme.surface, padding: 12, borderRadius: 10, color: theme.text, borderWidth: 1, borderColor: theme.surface } as any;
  const mobileBorder = theme.isDark ? '#1f2937' : '#dbeafe';
  const mutedBorder = theme.isDark ? '#1f2937' : '#e5e7eb';
  const inputBackground = theme.isDark ? '#0f1724' : '#f8fbff';
  const softPrimary = theme.isDark ? '#0b3b57' : '#d9f3ff';
  const selectedUnit = selectedUniteId ? unites.find((u) => u.id === selectedUniteId) : null;
  const packUnits = Number(nombreUnitesParConditionnement || '1') || 1;
  const initialPacks = Number(quantite || '0') || 0;
  const initialUnits = selectedUniteId ? initialPacks * packUnits : initialPacks;

  if (!canEditThis) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center', padding: 16 }}>
        <Text style={{ color: theme.text, fontSize: 18, fontWeight: '800' }}>{mode === 'create' ? 'Nouveau produit' : 'Modifier le produit'}</Text>
        <Text style={{ color: theme.muted, marginTop: 8, textAlign: 'center' }}>
          Permission requise.
        </Text>
        <Pressable onPress={() => navigation.goBack()} style={{ marginTop: 14, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: theme.surface }}>
          <Text style={{ color: theme.text, fontWeight: '800' }}>Retour</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <Text style={{ color: theme.text, fontWeight: '800', fontSize: 18, paddingHorizontal: 16, paddingTop: 16 }}>{mode === 'create' ? 'Nouveau produit' : 'Modifier le produit'}</Text>

      {/* Amélioration de la barre de navigation par onglets */}
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          {[
            { id: 0, number: '1', label: 'Produit' },
            { id: 1, number: '2', label: 'Emballages' },
            { id: 2, number: '3', label: 'Prix & Stock' }
          ].map((tab) => (
            <TouchableOpacity
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              style={{
                flex: 1,
                alignItems: 'center',
                paddingVertical: 12,
                borderBottomWidth: 3,
                borderBottomColor: activeTab === tab.id ? theme.primary : 'transparent',
              }}
            >
              <View style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: activeTab === tab.id ? theme.primary : theme.surface,
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 6
              }}>
                <Text style={{
                  color: activeTab === tab.id ? '#fff' : theme.muted,
                  fontWeight: 'bold',
                  fontSize: 14
                }}>
                  {tab.number}
                </Text>
              </View>
              <Text style={{
                color: activeTab === tab.id ? theme.primary : theme.muted,
                fontWeight: activeTab === tab.id ? '700' : '500',
                fontSize: 12,
                textAlign: 'center'
              }}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        
        {/* Ligne décorative sous les tabs */}
        <View style={{
          height: 1,
          backgroundColor: `${theme.muted}20`,
          marginTop: 8,
          marginHorizontal: 8
        }} />
      </View>

      <ScrollView 
        contentContainerStyle={{ padding: 16, paddingBottom: 140 }} 
        showsVerticalScrollIndicator={false} 
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="interactive"
      >
        {activeTab === 0 && (
            <View>

              <Field theme={theme} label="Nom du produit" error={errors.nom}>
                <TextInput 
                  ref={nomInputRef}
                  placeholder="Nom du produit" 
                  placeholderTextColor={theme.muted} 
                  value={nom} 
                  onChangeText={(v) => {
                    setNom(v);
                    // Safety net: if something triggers an unexpected blur, keep focus.
                    requestAnimationFrame(() => nomInputRef.current?.focus());
                  }} 
                  style={{ 
                    ...inputStyle, 
                    marginTop: 0,
                    borderColor: errors.nom ? theme.danger : theme.surface,
                    borderWidth: errors.nom ? 1 : 0
                  }} 
                  autoCapitalize="words" 
                  autoCorrect={false} 
                  onFocus={() => console.log('Nom INPUT focus')}
                  onBlur={() => console.log('Nom INPUT blur')}
                />
              </Field>

              <Field theme={theme} label="Image">
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <TouchableOpacity onPress={pickImage} style={{ width: 96, height: 96, borderRadius: 12, backgroundColor: theme.surface, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', borderWidth: 2, borderColor: theme.primary + '40', borderStyle: 'dashed' }}>
                    {(imageType === 'file' && image?.uri) || (imageType === 'url' && imageUrl) ? (
                      <Image source={{ uri: imageType === 'file' ? image.uri : imageUrl }} style={{ width: 96, height: 96 }} resizeMode="cover" />
                    ) : (
                      <View style={{ alignItems: 'center' }}>
                        <Text style={{ fontSize: 32, color: theme.primary }}>📷</Text>
                        <Text style={{ color: theme.muted, textAlign: 'center', fontSize: 12, marginTop: 4 }}>Ajouter{"\n"}photo</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity 
                        onPress={() => setImageType('file')} 
                        style={{ 
                          paddingHorizontal: 12, 
                          paddingVertical: 8, 
                          backgroundColor: imageType === 'file' ? theme.primary : theme.surface,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: imageType === 'file' ? theme.primary : theme.muted + '40'
                        }}
                      >
                        <Text style={{ color: imageType === 'file' ? '#fff' : theme.text, fontWeight: '500' }}>Fichier</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        onPress={() => setImageType('url')} 
                        style={{ 
                          paddingHorizontal: 12, 
                          paddingVertical: 8, 
                          backgroundColor: imageType === 'url' ? theme.primary : theme.surface,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: imageType === 'url' ? theme.primary : theme.muted + '40'
                        }}
                      >
                        <Text style={{ color: imageType === 'url' ? '#fff' : theme.text, fontWeight: '500' }}>URL</Text>
                      </TouchableOpacity>
                    </View>

                    {imageType === 'file' && (
                      <TouchableOpacity onPress={pickImage} style={{ marginTop: 12, padding: 8, backgroundColor: theme.surface, borderRadius: 8, alignItems: 'center' }}>
                        <Text style={{ color: theme.primary, fontWeight: '600' }}>Choisir une image</Text>
                        <Text style={{ color: theme.muted, fontSize: 11, marginTop: 2 }}>Depuis la galerie</Text>
                      </TouchableOpacity>
                    )}

                    {imageType === 'url' && (
                      <TextInput 
                        placeholder="https://exemple.com/image.jpg" 
                        value={imageUrl} 
                        onChangeText={setImageUrl} 
                        placeholderTextColor={theme.muted} 
                        style={{ ...inputStyle, marginTop: 12 }} 
                        autoCapitalize="none" 
                        autoCorrect={false} 
                      />
                    )}
                  </View>
                </View>
              </Field>

              <Field theme={theme} label="Description (optionnelle)">
                <TextInput 
                  placeholder="Description du produit, caractéristiques..." 
                  placeholderTextColor={theme.muted} 
                  value={description} 
                  onChangeText={setDescription} 
                  multiline 
                  numberOfLines={4} 
                  style={{ 
                    ...inputStyle, 
                    marginTop: 0, 
                    height: 100, 
                    textAlignVertical: 'top',
                    paddingTop: 12
                  }} 
                  autoCapitalize="sentences" 
                  autoCorrect={true} 
                  returnKeyType="default" 
                />
              </Field>
              
              {/* Bouton pour passer à l'étape suivante */}
              <TouchableOpacity 
                onPress={() => setActiveTab(1)}
                style={{
                  marginTop: 24,
                  padding: 14,
                  backgroundColor: theme.primary,
                  borderRadius: 12,
                  alignItems: 'center'
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '800' }}>Suivant: Emballages</Text>
              </TouchableOpacity>
            </View>
          )}

          {activeTab === 1 && (
            <View>
              <View
                style={{
                  backgroundColor: theme.card,
                  borderRadius: 18,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: mobileBorder,
                  shadowColor: '#0f172a',
                  shadowOpacity: theme.isDark ? 0 : 0.08,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 4 },
                  elevation: 2,
                }}
              >
                <Text style={{ color: theme.text, fontSize: 17, fontWeight: '900' }}>Emballages</Text>
                <Text style={{ color: theme.muted, marginTop: 4 }}>
                  Le même produit peut se vendre de plusieurs façons (carton, sac, casier...).
                </Text>

              <Field theme={theme} label="Ça se vend aussi comment ? (ex: carton, sac, casier)">
                {emballageRows.length === 0 ? (
                  <View style={{ backgroundColor: inputBackground, borderRadius: 14, borderWidth: 1, borderColor: mutedBorder, padding: 14 }}>
                    <Text style={{ color: theme.muted, fontWeight: '800' }}>Non, juste à l'unité.</Text>
                  </View>
                ) : null}

                {emballageRows.map((row, idx) => {
                  const rowUnit = unites.find((u) => String(u.id) === row.uniteId);
                  return (
                    <View key={row.tempId} style={{ backgroundColor: inputBackground, borderRadius: 16, borderWidth: 1, borderColor: mutedBorder, padding: 12, marginBottom: 10 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <Text style={{ color: theme.text, fontWeight: '900' }}>Emballage {idx + 1}</Text>
                        <TouchableOpacity
                          onPress={() => setEmballageRows((rows) => {
                            const next = rows.filter((_, i) => i !== idx);
                            if (next.length > 0 && !next.some((r) => r.estParDefaut)) next[0] = { ...next[0], estParDefaut: true };
                            return next;
                          })}
                          style={{ width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.isDark ? '#2a1620' : '#fff1f2' }}
                        >
                          <Text style={{ color: theme.danger, fontWeight: '900', fontSize: 18 }}>×</Text>
                        </TouchableOpacity>
                      </View>

                      <Text style={{ color: theme.muted, fontWeight: '800', marginBottom: 6 }}>Unité</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          {unites.length === 0 ? (
                            <Text style={{ color: theme.muted, paddingVertical: 8 }}>Aucune unité disponible</Text>
                          ) : unites.map((u) => {
                            const selected = row.uniteId === String(u.id);
                            return (
                              <TouchableOpacity
                                key={u.id}
                                onPress={() => {
                                  const lib = String(u.libelle || '').toLowerCase();
                                  setEmballageRows((rows) => rows.map((r, i) => {
                                    if (i !== idx) return r;
                                    return {
                                      ...r,
                                      uniteId: String(u.id),
                                      nombreUnites: r.nombreUnites || (lib.includes('carton') ? '12' : ''),
                                    };
                                  }));
                                }}
                                style={{
                                  paddingHorizontal: 12,
                                  paddingVertical: 9,
                                  borderRadius: 999,
                                  borderWidth: 1,
                                  borderColor: selected ? theme.primary : mutedBorder,
                                  backgroundColor: selected ? theme.primary : theme.surface,
                                }}
                              >
                                <Text style={{ color: selected ? '#fff' : theme.text, fontWeight: '800' }}>{u.libelle}</Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </ScrollView>

                      <View style={{ marginTop: 10 }}>
                        <Text style={{ color: theme.muted, fontWeight: '800', marginBottom: 6 }}>Nombre d'unités</Text>
                        <TextInput
                          placeholder="Ex: 12 unités"
                          keyboardType="numeric"
                          placeholderTextColor={theme.muted}
                          value={row.nombreUnites}
                          onChangeText={(value) => setEmballageRows((rows) => rows.map((r, i) => i === idx ? { ...r, nombreUnites: value.replace(/[^0-9]/g, '') } : r))}
                          style={{
                            ...inputStyle,
                            marginTop: 0,
                            minHeight: 52,
                            borderRadius: 14,
                            backgroundColor: theme.surface,
                            borderColor: mutedBorder,
                            fontWeight: '800',
                          }}
                          autoCorrect={false}
                        />
                      </View>

                      <TouchableOpacity
                        onPress={() => setEmballageRows((rows) => rows.map((r, i) => ({ ...r, estParDefaut: i === idx })))}
                        style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center' }}
                      >
                        <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: row.estParDefaut ? theme.primary : theme.muted, backgroundColor: row.estParDefaut ? theme.primary : 'transparent', alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
                          {row.estParDefaut ? <Text style={{ color: '#fff', fontWeight: '900', fontSize: 12 }}>✓</Text> : null}
                        </View>
                        <Text style={{ color: theme.text, fontWeight: '900' }}>Par défaut</Text>
                      </TouchableOpacity>

                      {rowUnit && row.nombreUnites ? (
                        <View style={{ marginTop: 10, padding: 10, backgroundColor: softPrimary, borderRadius: 12, borderWidth: 1, borderColor: mobileBorder }}>
                          <Text style={{ color: theme.text, fontWeight: '900' }}>1 {rowUnit.libelle} = {row.nombreUnites} unités</Text>
                        </View>
                      ) : null}
                    </View>
                  );
                })}

                <TouchableOpacity
                  onPress={() => setEmballageRows((rows) => [...rows, newEmballageRow(rows.length === 0)])}
                  style={{ marginTop: 2, minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: theme.primary, backgroundColor: theme.isDark ? '#0b3b57' : '#eef9ff', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text style={{ color: theme.primary, fontWeight: '900' }}>+ Ajouter un emballage</Text>
                </TouchableOpacity>
              </Field>
              </View>
              
              {/* Boutons de navigation */}
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
                <TouchableOpacity 
                  onPress={() => setActiveTab(0)}
                  style={{
                    flex: 1,
                    padding: 14,
                    backgroundColor: theme.surface,
                    borderRadius: 12,
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: theme.muted + '30'
                  }}
                >
                  <Text style={{ color: theme.text, fontWeight: '600' }}>Précédent</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  onPress={() => setActiveTab(2)}
                  style={{
                    flex: 1,
                    padding: 14,
                    backgroundColor: theme.primary,
                    borderRadius: 12,
                    alignItems: 'center'
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: '800' }}>Suivant: Prix & Stock</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {activeTab === 2 && (
            <View>

              <Field theme={theme} label="Prix d'achat" error={errors.prixAchat} help={computeMargins && margeConfig ? 'Le prix de vente sera calculé automatiquement si activé' : undefined}>
                <TextInput 
                  placeholder="10 000" 
                  keyboardType="numeric" 
                  placeholderTextColor={theme.muted} 
                  value={prixAchat} 
                  onChangeText={(v) => setPrixAchat(formatThousands(moneyDigits(v)))} 
                  style={{
                    ...inputStyle,
                    borderColor: errors.prixAchat ? theme.danger : theme.surface,
                    borderWidth: errors.prixAchat ? 1 : 0
                  }} 
                  autoCorrect={false} 
                />
              </Field>

              <Field theme={theme} label="Prix en gros" error={errors.prixEnGros}>
                {computeMargins && margeConfig ? (
                  <View style={{ position: 'relative' }}>
                    <TextInput 
                      placeholder="Prix en gros (calculé)" 
                      keyboardType="decimal-pad" 
                      placeholderTextColor={theme.muted} 
                      value={suggested.prixEnGros != null ? String(suggested.prixEnGros) : ''} 
                      editable={false} 
                      style={{ 
                        ...inputStyle, 
                        backgroundColor: theme.surface + '80',
                        paddingRight: 40
                      }} 
                    />
                    <View style={{
                      position: 'absolute',
                      right: 12,
                      top: 12,
                      backgroundColor: theme.primary + '20',
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 6
                    }}>
                      <Text style={{ color: theme.primary, fontSize: 12, fontWeight: '600' }}>AUTO</Text>
                    </View>
                  </View>
                ) : (
                  <TextInput 
                    placeholder="0.00" 
                    keyboardType="decimal-pad" 
                    placeholderTextColor={theme.muted} 
                    value={prixEnGros} 
                    onChangeText={(v)=>{ 
                      setPrixEnGros(v); 
                      setPrixEnGrosTouched(true); 
                    }} 
                    style={{
                      ...inputStyle,
                      borderColor: errors.prixEnGros ? theme.danger : theme.surface,
                      borderWidth: errors.prixEnGros ? 1 : 0
                    }} 
                    autoCorrect={false} 
                  />
                )}
              </Field>

              <Field theme={theme} label="Prix détail" error={errors.prixDetail}>
                {computeMargins && margeConfig ? (
                  <View style={{ position: 'relative' }}>
                    <TextInput 
                      placeholder="Prix détail (calculé)" 
                      keyboardType="decimal-pad" 
                      placeholderTextColor={theme.muted} 
                      value={suggested.prixDetail != null ? String(suggested.prixDetail) : ''} 
                      editable={false} 
                      style={{ 
                        ...inputStyle, 
                        backgroundColor: theme.surface + '80',
                        paddingRight: 40
                      }} 
                    />
                    <View style={{
                      position: 'absolute',
                      right: 12,
                      top: 12,
                      backgroundColor: theme.primary + '20',
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 6
                    }}>
                      <Text style={{ color: theme.primary, fontSize: 12, fontWeight: '600' }}>AUTO</Text>
                    </View>
                  </View>
                ) : (
                  <TextInput 
                    placeholder="0.00" 
                    keyboardType="decimal-pad" 
                    placeholderTextColor={theme.muted} 
                    value={prixDetail} 
                    onChangeText={(v)=>{ 
                      setPrixDetail(v); 
                      setPrixDetailTouched(true); 
                    }} 
                    style={{
                      ...inputStyle,
                      borderColor: errors.prixDetail ? theme.danger : theme.surface,
                      borderWidth: errors.prixDetail ? 1 : 0
                    }} 
                    autoCorrect={false} 
                  />
                )}
              </Field>

              <Field theme={theme} label="Alerte stock (optionnel)">
                <TextInput 
                  placeholder="Seuil d'alerte en unités" 
                  keyboardType="numeric" 
                  placeholderTextColor={theme.muted} 
                  value={alerteStock} 
                  onChangeText={setAlerteStock} 
                  style={inputStyle} 
                  autoCorrect={false} 
                />
              </Field>

              <Field theme={theme} label={`Quantité initiale ${selectedUniteId ? `(${unites.find(u=>u.id===selectedUniteId)?.libelle?.toLowerCase()}s)` : ''}`}>
                <TextInput 
                  placeholder={selectedUniteId ? 
                    `Nombre de ${unites.find(u=>u.id===selectedUniteId)?.libelle?.toLowerCase()}s` : 
                    'Quantité en unités de base'
                  } 
                  keyboardType="numeric" 
                  placeholderTextColor={theme.muted} 
                  value={quantite} 
                  onChangeText={setQuantite} 
                  style={{
                    ...inputStyle,
                    minHeight: 52,
                    borderRadius: 14,
                    backgroundColor: inputBackground,
                    borderColor: mutedBorder,
                    fontWeight: '800',
                  }} 
                  autoCorrect={false} 
                />
                {selectedUniteId && (
                  <View style={{ 
                    marginTop: 8, 
                    padding: 12, 
                    backgroundColor: theme.isDark ? '#063423' : '#dcfce7', 
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: theme.isDark ? '#14532d' : '#bbf7d0',
                  }}>
                    <Text style={{ color: theme.text, fontWeight: '900' }}>
                      Total: {initialPacks} {selectedUnit?.libelle} × {packUnits} =
                      <Text style={{ color: '#10b981', fontWeight: '900' }}> {initialUnits} unités</Text>
                    </Text>
                  </View>
                )}
              </Field>

              <View style={{ marginTop: 20, padding: 16, backgroundColor: theme.surface, borderRadius: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16 }}>Calcul automatique des prix</Text>
                    <Text style={{ color: theme.muted, marginTop: 4 }}>Utiliser la marge configurée de la boutique</Text>
                  </View>
                  <Switch 
                    value={computeMargins} 
                    onValueChange={setComputeMargins} 
                    trackColor={{ true: theme.primary, false: '#ccc' }} 
                    thumbColor={computeMargins ? '#fff' : '#fff'} 
                    ios_backgroundColor="#ccc"
                  />
                </View>

                {margeLoading ? (
                  <View style={{ marginTop: 12, padding: 12, backgroundColor: theme.surface + '80', borderRadius: 8, alignItems: 'center' }}>
                    <Text style={{ color: theme.muted }}>Chargement configuration marges...</Text>
                  </View>
                ) : margeConfig == null ? (
                  <View style={{ marginTop: 12, padding: 12, backgroundColor: theme.danger + '20', borderRadius: 8 }}>
                    <Text style={{ color: theme.danger, fontWeight: '600' }}>Configuration des marges non définie</Text>
                    <Text style={{ color: theme.muted, marginTop: 4 }}>Veuillez configurer les marges dans les paramètres de la boutique</Text>
                    <TouchableOpacity onPress={loadMargeConfig} style={{ marginTop: 12, padding: 10, backgroundColor: theme.primary, borderRadius: 8, alignItems: 'center' }}>
                      <Text style={{ color: '#fff', fontWeight: '600' }}>Recharger la configuration</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={{ marginTop: 12 }}>
                    <View style={{ 
                      padding: 12, 
                      backgroundColor: '#10b98120', 
                      borderRadius: 8,
                      borderLeftWidth: 3,
                      borderLeftColor: '#10b981'
                    }}>
                      <Text style={{ color: theme.text, fontWeight: '600' }}>
                        Configuration active: <Text style={{ color: '#10b981' }}>{margeConfig.typeMarge}</Text>
                      </Text>
                      <Text style={{ color: theme.muted, marginTop: 4 }}>
                        {margeConfig.typeMarge === 'FIXE' ? 
                          `Marge fixe: ${margeConfig.valeurGros || 0} (gros) / ${margeConfig.valeurDetail || 0} (détail)` :
                          `Marge %: ${margeConfig.valeurGros || 0}% (gros) / ${margeConfig.valeurDetail || 0}% (détail)`
                        }
                      </Text>
                    </View>
                    
                    {recomputeStatus && (
                      <View style={{ 
                        marginTop: 12, 
                        padding: 12, 
                        backgroundColor: recomputeStatus === 'RUNNING' ? '#f59e0b20' : 
                                      recomputeStatus === 'DONE' ? '#10b98120' : 
                                      theme.danger + '20', 
                        borderRadius: 8,
                        borderLeftWidth: 3,
                        borderLeftColor: recomputeStatus === 'RUNNING' ? '#f59e0b' : 
                                       recomputeStatus === 'DONE' ? '#10b981' : 
                                       theme.danger
                      }}>
                        <Text style={{ 
                          color: recomputeStatus === 'RUNNING' ? '#f59e0b' : 
                                recomputeStatus === 'DONE' ? '#10b981' : 
                                theme.danger,
                          fontWeight: '600'
                        }}>
                          {recomputeStatus === 'RUNNING' ? '⏳ Recalcul en cours...' :
                           recomputeStatus === 'DONE' ? '✅ Recalcul terminé' :
                           '❌ Recalcul échoué'}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
              
              {/* Boutons de navigation */}
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
                <TouchableOpacity 
                  onPress={() => setActiveTab(1)}
                  style={{
                    flex: 1,
                    padding: 14,
                    backgroundColor: theme.surface,
                    borderRadius: 12,
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: theme.muted + '30'
                  }}
                >
                  <Text style={{ color: theme.text, fontWeight: '600' }}>Précédent</Text>
                </TouchableOpacity>
              </View>
            </View>
        )}
      </ScrollView>

      {/* Sticky submit button only on TAB 3 */}
      {activeTab === 2 && (
        <View style={{ 
          position: 'absolute', 
          left: 16, 
          right: 16, 
          bottom: Platform.OS === 'ios' ? 24 : 16,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
          elevation: 8
        }}>
          <TouchableOpacity 
            onPress={submit} 
            disabled={creating} 
            style={{ 
              padding: 16, 
              backgroundColor: creating ? '#94a3b8' : theme.primary, 
              borderRadius: 12, 
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 8
            }}
          >
            {creating ? (
              <>
                <Text style={{ color: '#fff', fontSize: 16 }}>⏳</Text>
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>Enregistrement...</Text>
              </>
            ) : (
              <>
                <Text style={{ color: '#fff', fontSize: 20 }}>✓</Text>
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>
                  {mode === 'create' ? 'Créer le produit' : 'Mettre à jour le produit'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  )};
