import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, Image, SafeAreaView, KeyboardAvoidingView, Platform, TouchableOpacity, Switch } from 'react-native';
// dynamic import of expo-image-picker to avoid runtime crash when not installed
let ImagePicker: any = null;
import { useApp } from '../store/AppContext';
import { createProduit, fetchProduit, updateProduit, fetchConfigurationMarge } from '../services/produit';
import { useTheme } from '../theme';
import { showSuccess, showError, showInfo } from '../utils/notify';

export default function ProductFormScreen({ route, navigation }: any) {
  const { token, boutiqueId } = useApp();
  const theme = useTheme();
  const mode = route.params?.mode || 'create';
  const id = route.params?.id;
  const [margeLoading, setMargeLoading] = useState(false);

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
    } catch (e:any) {
      console.warn('FETCH_MARGE_FAILED', e);
      setMargeConfig(null);
    } finally {
      setMargeLoading(false);
    }
  };


  const BackHeader = require('../components/BackHeader').default;
  const [nom, setNom] = useState('');
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

  // Units and conditionnement
  const [unites, setUnites] = useState<any[]>([]);
  const [selectedUniteId, setSelectedUniteId] = useState<number | null>(null);
  const [nombreUnitesParConditionnement, setNombreUnitesParConditionnement] = useState<string>('1');
  const [showUnitsModal, setShowUnitsModal] = useState(false);
  const [createMissingUnitsImport, setCreateMissingUnitsImport] = useState(true);

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
    // load margin config on mount or when boutiqueId/token change
    loadMargeConfig();

    if (route.params?.initialCode && !nom) {
      setNom(String(route.params.initialCode || ''));
    }
    if (mode === 'edit' && id) {
      (async () => {
        try {
          const p = await fetchProduit(id, token as string);
          setNom(p.nomProduit || '');
          setPrixDetail(p.prixDetail ? String(p.prixDetail) : '');
          setPrixEnGros(p.prixEnGros ? String(p.prixEnGros) : '');
          setPrixAchat(p.prixAchat ? String(p.prixAchat) : '');
          setAlerteStock(p.alerteStock ? String(p.alerteStock) : '');
          setQuantite(p.quantiteInitialeConditionnements ? String(p.quantiteInitialeConditionnements) : '0');
          // unit and conditionnement
          setSelectedUniteId(p.unite ? p.unite.id : null);
          setNombreUnitesParConditionnement(p.nombreUnitesParConditionnement ? String(p.nombreUnitesParConditionnement) : '1');
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

  const pickImage = async () => {
    try {
      if (!ImagePicker) ImagePicker = require('expo-image-picker');
      // Use the new MediaType API when available to avoid deprecation warnings
      const mediaTypes = ImagePicker.MediaType?.Images || ImagePicker.MediaTypeOptions?.Images || ImagePicker.MediaType?.All || ImagePicker.MediaTypeOptions?.All;
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes, quality: 0.7, base64: false });
      if (!res.cancelled) setImage(res);
    } catch (e:any) {
      showError('Fonctionnalité non disponible', "Le module d'accès aux images n'est pas installé. Exécutez 'expo install expo-image-picker'");
    }
  };

  const computeSuggested = (prixAchatVal: number | null, cfg: any | null) => {
    if (!cfg || prixAchatVal == null) return { prixEnGros: null, prixDetail: null };
    const type = (cfg.typeMarge || 'FIXE').toUpperCase();
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
    const pa = prixAchat ? Number(prixAchat) : null;
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
    if (creating) return; // prevent double submit
    setCreating(true);
    try {
      // client-side validation
      const errs: Record<string,string> = {};
      if (!nom || !nom.trim()) errs.nom = 'Le nom est requis';
      const pd = prixDetail ? Number(prixDetail) : null;
      const peg = prixEnGros ? Number(prixEnGros) : null;
      const pa = prixAchat ? Number(prixAchat) : null;
      if (pd != null && (!Number.isFinite(pd) || pd <= 0)) errs.prixDetail = 'Prix détail invalide';
      if (peg != null && (!Number.isFinite(peg) || peg <= 0)) errs.prixEnGros = 'Prix en gros invalide';
      if (pa != null && (!Number.isFinite(pa) || pa < 0)) errs.prixAchat = 'Prix achat invalide';
      if (pa != null && peg != null && pa >= peg) errs.prixAchat = 'Prix achat doit être < prix en gros';
      if (peg != null && pd != null && peg >= pd) errs.prixEnGros = 'Prix en gros doit être < prix détail';

      setErrors(errs);
      if (Object.keys(errs).length > 0) { setCreating(false); return; }

      const fd = new FormData();
      fd.append('nomProduit', nom);
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
      fd.append('prixAchat', prixAchat);
      fd.append('alerteStock', alerteStock);
      fd.append('quantiteInitiale', quantite);

      // unit and conditionnement
      if (selectedUniteId != null) fd.append('uniteConditionnementId', String(selectedUniteId));
      if (nombreUnitesParConditionnement) fd.append('nombreUnitesParConditionnement', nombreUnitesParConditionnement);

      // Validate conditionnement numeric sanity before sending
      if (selectedUniteId != null) {
        const nb = Number(nombreUnitesParConditionnement || '0');
        if (!Number.isFinite(nb) || nb < 1) {
          showError('Erreur', 'Le nombre d\'unités par conditionnement doit être ≥ 1');
          setCreating(false); return;
        }
      }

      if (mode === 'create') {
        const saved = await createProduit(fd, token as string);
        console.log('PRODUCT_CREATE', { nom, prixDetail, computed: computeMargins, saved });
        // Success alert with actions
        const totalUnits = Number(quantite || '0') * Number(nombreUnitesParConditionnement || '1');
        showSuccess('Produit créé', `${saved.nomProduit} a été créé avec succès. Quantité initiale: ${quantite} ${selectedUniteId ? (unites.find(u=>u.id===selectedUniteId)?.libelle || '') + '(s)' : 'unités'} (= ${totalUnits} unités)`);
        navigation.navigate('ProductDetail', { id: saved.id });
      } else {
        const saved = await updateProduit(id, fd, token as string);
        console.log('PRODUCT_UPDATE', { id, nom, saved });
        showSuccess('Produit mis à jour', `${nom} a été mis à jour avec succès.`);
        navigation.goBack();
      }
    } catch (e:any) {
      showError('Erreur', e.message || 'Erreur enregistrement');
    } finally {
      setCreating(false);
    }
  };

  // Small helper to render labelled fields consistently ✅
  const Field = ({ label, children, help, error }: any) => (
    <View style={{ marginTop: 12 }}>
      <Text style={{ color: theme.text, fontWeight: '600', marginBottom: 6 }}>{label}</Text>
      {children}
      {help ? <Text style={{ color: theme.muted, marginTop: 6 }}>{help}</Text> : null}
      {error ? <Text style={{ color: theme.danger, marginTop: 6 }}>{error}</Text> : null}
    </View>
  );

  const inputStyle = { backgroundColor: theme.surface, padding: 12, borderRadius: 10, color: theme.text, borderWidth: 1, borderColor: theme.surface } as any;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
          <BackHeader title="Produit" />

          <Text style={{ color: theme.text, fontWeight: '800', fontSize: 18 }}>{mode === 'create' ? 'Créer un produit' : 'Modifier le produit'}</Text>

          <Field label="Nom" error={errors.nom}>
            <TextInput placeholder="Nom du produit" placeholderTextColor={theme.muted} value={nom} onChangeText={setNom} style={{ ...inputStyle, marginTop: 0 }} />
          </Field>

          <Field label="Prix d'achat" error={errors.prixAchat} help={computeMargins && margeConfig ? 'Le prix de vente sera calculé automatiquement si activé' : undefined}>
            <TextInput placeholder="Prix achat" keyboardType="numeric" placeholderTextColor={theme.muted} value={prixAchat} onChangeText={setPrixAchat} style={inputStyle} />
          </Field>

          <Field label="Prix en gros" error={errors.prixEnGros}>
            {computeMargins && margeConfig ? (
              <TextInput placeholder="Prix en gros (calculé)" keyboardType="numeric" placeholderTextColor={theme.muted} value={suggested.prixEnGros != null ? String(suggested.prixEnGros) : ''} editable={false} style={{ ...inputStyle, opacity: 0.85 }} />
            ) : (
              <TextInput placeholder="Prix en gros" keyboardType="numeric" placeholderTextColor={theme.muted} value={prixEnGros} onChangeText={(v)=>{ setPrixEnGros(v); setPrixEnGrosTouched(true); }} style={inputStyle} />
            )}
          </Field>

          <Field label="Prix détail" error={errors.prixDetail}>
            {computeMargins && margeConfig ? (
              <TextInput placeholder="Prix détail (calculé)" keyboardType="numeric" placeholderTextColor={theme.muted} value={suggested.prixDetail != null ? String(suggested.prixDetail) : ''} editable={false} style={{ ...inputStyle, opacity: 0.85 }} />
            ) : (
              <TextInput placeholder="Prix détail" keyboardType="numeric" placeholderTextColor={theme.muted} value={prixDetail} onChangeText={(v)=>{ setPrixDetail(v); setPrixDetailTouched(true); }} style={inputStyle} />
            )}
          </Field>

          <Field label="Unité de conditionnement (optionnel)">
            <Pressable onPress={() => setShowUnitsModal(s => !s)} style={{ padding: 12, backgroundColor: theme.surface, borderRadius: 10 }}>
              <Text style={{ color: theme.text }}>{selectedUniteId ? (unites.find(u=>u.id===selectedUniteId)?.libelle || String(selectedUniteId)) : 'Sélectionner une unité'}</Text>
            </Pressable>
            {showUnitsModal && (
              <View style={{ backgroundColor: theme.surface, marginTop: 8, borderRadius: 10, padding: 8, maxHeight: 240 }}>
                {unites.length === 0 ? <Text style={{ color: theme.muted }}>Aucune unité disponible</Text> : unites.map(u => (
                  <Pressable key={u.id} onPress={() => { setSelectedUniteId(u.id); setShowUnitsModal(false); }} style={{ padding: 10 }}>
                    <Text style={{ color: theme.text }}>{u.libelle}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            <TextInput placeholder="Nombre d'unités par conditionnement" keyboardType="numeric" placeholderTextColor={theme.muted} value={nombreUnitesParConditionnement} onChangeText={setNombreUnitesParConditionnement} style={{ ...inputStyle, marginTop: 8 }} />
          </Field>

          <Field label="Alerte stock">
            <TextInput placeholder="Alerte stock" keyboardType="numeric" placeholderTextColor={theme.muted} value={alerteStock} onChangeText={setAlerteStock} style={inputStyle} />
          </Field>

          <Field label={`Quantité initiale ${selectedUniteId ? `(${(unites.find(u=>u.id===selectedUniteId)?.libelle || '').toLowerCase()}s)` : ''}`}>
            <TextInput placeholder={selectedUniteId ? `Nombre de ${unites.find(u=>u.id===selectedUniteId)?.libelle?.toLowerCase() || 'conditionnements'}` : 'Quantité en unités de base'} keyboardType="numeric" placeholderTextColor={theme.muted} value={quantite} onChangeText={setQuantite} style={inputStyle} />
            {selectedUniteId ? (
              <Text style={{ color: theme.muted, marginTop: 6 }}>1 {unites.find(u=>u.id===selectedUniteId)?.libelle} = {Number(nombreUnitesParConditionnement || '1')} unités. Total: {Number(quantite || '0') * Number(nombreUnitesParConditionnement || '1')} unités.</Text>
            ) : null}
          </Field>

          <Field label="Image">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <TouchableOpacity onPress={pickImage} style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: theme.surface, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', borderWidth: 1, borderColor: theme.muted }}>
                {(imageType === 'file' && image?.uri) || (imageType === 'url' && imageUrl) ? (
                  <Image source={{ uri: imageType === 'file' ? image.uri : imageUrl }} style={{ width: 96, height: 96 }} />
                ) : (
                  <Text style={{ color: theme.muted, textAlign: 'center' }}>Ajouter{"\n"}photo</Text>
                )}
              </TouchableOpacity>

              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable onPress={() => setImageType('file')} style={{ paddingHorizontal: 12, paddingVertical: 8, backgroundColor: imageType === 'file' ? theme.primary : theme.surface, borderRadius: 8 }}>
                    <Text style={{ color: imageType === 'file' ? '#fff' : theme.text }}>Fichier</Text>
                  </Pressable>
                  <Pressable onPress={() => setImageType('url')} style={{ paddingHorizontal: 12, paddingVertical: 8, backgroundColor: imageType === 'url' ? theme.primary : theme.surface, borderRadius: 8 }}>
                    <Text style={{ color: imageType === 'url' ? '#fff' : theme.text }}>URL</Text>
                  </Pressable>
                </View>

                {imageType === 'file' && (
                  <TouchableOpacity onPress={pickImage} style={{ marginTop: 12 }}>
                    <Text style={{ color: theme.primary }}>Choisir une image depuis la galerie</Text>
                  </TouchableOpacity>
                )}

                {imageType === 'url' && (
                  <TextInput placeholder="https://..." value={imageUrl} onChangeText={setImageUrl} placeholderTextColor={theme.muted} style={{ ...inputStyle, marginTop: 12 }} />
                )}
              </View>
            </View>
          </Field>

          <View style={{ marginTop: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: theme.muted }}>Calculer prix à partir de la marge boutique</Text>
              <Switch value={computeMargins} onValueChange={(v:any)=>setComputeMargins(v)} trackColor={{ true: theme.primary, false: theme.surface }} thumbColor={computeMargins ? '#fff' : '#fff'} />
            </View>

            {margeLoading ? (
              <Text style={{ color: theme.muted, marginTop: 6 }}>Chargement configuration marges...</Text>
            ) : margeConfig == null ? (
              <View style={{ marginTop: 6 }}>
                <Text style={{ color: theme.danger }}>La configuration des marges n'est pas définie pour cette boutique.</Text>
                <Pressable onPress={loadMargeConfig} style={{ marginTop: 8, padding: 8, backgroundColor: theme.primary, borderRadius: 8 }}>
                  <Text style={{ color: '#fff' }}>Recharger la configuration</Text>
                </Pressable>
              </View>
            ) : (
              <View style={{ marginTop: 6 }}>
                <Text style={{ color: theme.muted }}>Type: {margeConfig.typeMarge}</Text>
                <View style={{ marginTop: 8, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <Pressable onPress={async () => {
                    try {
                      if (!boutiqueId) { showError('Erreur', 'Boutique introuvable'); return; }
                      const res = await require('../services/produit').recomputeMargeForBoutique(boutiqueId, token as string);
                      const jid = res?.jobId || res?.job || null;
                      setRecomputeJobId(jid);
                      setRecomputeStatus('RUNNING');
                      showInfo('Recalcul lancé', 'Job: ' + (jid || 'n/a'));
                      if (jid) {
                        if (recomputeTimer.current) clearInterval(recomputeTimer.current);
                        recomputeTimer.current = setInterval(async () => {
                          try {
                            const { fetchRecomputeJobStatus } = require('../services/produit');
                            const d = await fetchRecomputeJobStatus(jid, token as string);
                            setRecomputeStatus(d.status);
                            if (d.status === 'DONE' || d.status === 'FAILED') {
                              clearInterval(recomputeTimer.current);
                              recomputeTimer.current = null;
                              if (d.status === 'DONE') showSuccess('Recalcul terminé', `Produits mis à jour: ${d.updatedCount || 0}`);
                              else showError('Recalcul échoué', d.error || 'Erreur');
                              loadMargeConfig();
                            }
                          } catch (e) { /* ignore */ }
                        }, 2000);
                      }
                    } catch (e:any) { showError('Erreur', e.message || 'Impossible de lancer le recalcul'); }
                  }} style={{ padding: 8, backgroundColor: '#10b981', borderRadius: 8 }}>
                    <Text style={{ color: '#fff' }}>Recalculer maintenant</Text>
                  </Pressable>
                  {recomputeJobId ? <Text style={{ color: theme.muted }}>Job: {recomputeJobId} ({recomputeStatus})</Text> : null}
                </View>
              </View>
            )}
          </View>

        </ScrollView>

        {/* Sticky submit button to improve ergonomics */}
        <View style={{ position: 'absolute', left: 16, right: 16, bottom: Platform.OS === 'ios' ? 24 : 16 }}>
          <TouchableOpacity onPress={submit} disabled={creating} style={{ padding: 14, backgroundColor: creating ? '#94a3b8' : theme.primary, borderRadius: 12, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 6 }}>
            <Text style={{ color: '#fff', fontWeight: '800' }}>{creating ? (mode === 'create' ? 'Création...' : 'Enregistrement...') : (mode === 'create' ? 'Créer' : 'Enregistrer')}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
