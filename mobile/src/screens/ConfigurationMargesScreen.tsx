import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useTheme } from '../theme';
import { useApp } from '../store/AppContext';
import { hasPermission, isSuperAdmin } from '../utils/permissions';
import {
  ConfigurationMargeDTO,
  createConfigMarge,
  deleteConfigMarge,
  getConfigMargeByBoutique,
  getRecomputeJob,
  startRecomputeJob,
  updateConfigMarge,
} from '../services/configurationMarges';
import { showError, showSuccess } from '../utils/notify';

export default function ConfigurationMargesScreen() {
  const theme = useTheme();
  const { token, boutiqueId, profile } = useApp();
  const borderColor = (theme as any).isDark ? '#1f2937' : '#e5e7eb';

  const canRead = isSuperAdmin(profile) || hasPermission(profile, 'CONFIG_MARGE_LECTURE') || hasPermission(profile, 'CONFIG_MARGE_ECRITURE');
  const canWrite = isSuperAdmin(profile) || hasPermission(profile, 'CONFIG_MARGE_ECRITURE');
  const canDelete = isSuperAdmin(profile) || hasPermission(profile, 'CONFIG_MARGE_SUPPRESSION');

  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<ConfigurationMargeDTO | null>(null);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [typeMarge, setTypeMarge] = useState<'FIXE' | 'POURCENTAGE'>('FIXE');
  const [valeurDetail, setValeurDetail] = useState('');
  const [valeurGros, setValeurGros] = useState('');
  const [margeMinDetail, setMargeMinDetail] = useState('');
  const [margeMinGros, setMargeMinGros] = useState('');

  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [jobUpdatedCount, setJobUpdatedCount] = useState<number | null>(null);
  const timerRef = useRef<any>(null);

  const bid = boutiqueId || profile?.boutique?.id;

  const setFormFromConfig = (cfg: ConfigurationMargeDTO | null) => {
    setTypeMarge(((cfg?.typeMarge as any) || 'FIXE') === 'POURCENTAGE' ? 'POURCENTAGE' : 'FIXE');
    setValeurDetail(cfg?.valeurDetail != null ? String(cfg.valeurDetail) : '');
    setValeurGros(cfg?.valeurGros != null ? String(cfg.valeurGros) : '');
    setMargeMinDetail(cfg?.margeMinimaleDetail != null ? String(cfg.margeMinimaleDetail) : '');
    setMargeMinGros(cfg?.margeMinimaleGros != null ? String(cfg.margeMinimaleGros) : '');
  };

  const load = async () => {
    if (!token || !bid) return;
    setLoading(true);
    setMessage(null);
    try {
      const cfg = await getConfigMargeByBoutique(bid, token);
      setConfig(cfg);
      setFormFromConfig(cfg);
    } catch (e: any) {
      setMessage(e.message || 'Chargement impossible');
      setConfig(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, bid]);

  const startPolling = (jid: string) => {
    if (!token) return;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(async () => {
      try {
        const j = await getRecomputeJob(jid, token);
        const st = String(j?.status || '').toUpperCase();
        setJobStatus(st || null);
        setJobUpdatedCount(typeof j?.updatedCount === 'number' ? j.updatedCount : null);
        if (st === 'DONE' || st === 'FAILED') {
          clearInterval(timerRef.current);
          timerRef.current = null;
          if (st === 'DONE') {
            setMessage(`Recalcul terminé : ${j?.updatedCount ?? 0} produits mis à jour`);
          } else {
            setMessage(`Erreur pendant le recalcul : ${j?.error || 'inconnue'}`);
          }
          setTimeout(() => {
            setJobId(null);
            setJobStatus(null);
            setJobUpdatedCount(null);
          }, 3500);
        }
      } catch {
        // ignore temporary
      }
    }, 2000);
  };

  const save = async () => {
    if (!token || !bid) return;
    if (!canWrite) {
      showError('Accès refusé', 'Permission CONFIG_MARGE_ECRITURE requise');
      return;
    }
    try {
      const payload: any = {
        typeMarge,
        valeurDetail: parseFloat(String(valeurDetail || 0)) || 0,
        valeurGros: parseFloat(String(valeurGros || 0)) || 0,
        margeMinimaleDetail: parseFloat(String(margeMinDetail || 0)) || 0,
        margeMinimaleGros: parseFloat(String(margeMinGros || 0)) || 0,
        boutique: { id: bid },
      };
      const saved = config?.id
        ? await updateConfigMarge(config.id, payload, token)
        : await createConfigMarge(payload, token);
      setConfig(saved);
      setFormFromConfig(saved);
      setEditing(false);
      showSuccess('Succès', config?.id ? 'Configuration mise à jour' : 'Configuration créée');
    } catch (e: any) {
      showError('Erreur', e.message || 'Sauvegarde impossible');
    }
  };

  const remove = async () => {
    if (!token || !config?.id) return;
    if (!canDelete) {
      showError('Accès refusé', 'Permission CONFIG_MARGE_SUPPRESSION requise');
      return;
    }
    try {
      await deleteConfigMarge(config.id, token);
      setConfig(null);
      setFormFromConfig(null);
      setEditing(false);
      showSuccess('Succès', 'Configuration supprimée');
    } catch (e: any) {
      showError('Erreur', e.message || 'Suppression impossible');
    }
  };

  const recompute = async () => {
    if (!token || !bid) return;
    if (!canWrite) {
      showError('Accès refusé', 'Permission CONFIG_MARGE_ECRITURE requise');
      return;
    }
    try {
      setMessage('Recalcul des marges lancé...');
      const jid = await startRecomputeJob(bid, token);
      setJobId(jid);
      setJobStatus('RUNNING');
      setJobUpdatedCount(null);
      startPolling(jid);
    } catch (e: any) {
      showError('Erreur', e.message || 'Impossible de lancer le recalcul');
    }
  };

  const inputStyle = useMemo(
    () => ({ backgroundColor: theme.surface, borderRadius: 12, padding: 10, color: theme.text, borderWidth: 1, borderColor }),
    [theme.surface, theme.text, borderColor]
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.background }} contentContainerStyle={{ padding: 16 }}>
      <Text style={{ color: theme.text, fontSize: 20, fontWeight: '900', marginBottom: 10 }}>Configuration des marges</Text>

      {!canRead ? (
        <View style={{ backgroundColor: theme.surface, borderRadius: 16, padding: 12, borderWidth: 1, borderColor }}>
          <Text style={{ color: theme.text, fontWeight: '900' }}>Accès refusé</Text>
          <Text style={{ color: theme.muted, marginTop: 6 }}>Permission CONFIG_MARGE_LECTURE requise.</Text>
        </View>
      ) : null}

      {message ? (
        <View style={{ backgroundColor: theme.surface, borderRadius: 16, padding: 12, borderWidth: 1, borderColor, marginBottom: 12 }}>
          <Text style={{ color: theme.text }}>{message}</Text>
        </View>
      ) : null}

      <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor, marginBottom: 12 }}>
        <Text style={{ color: theme.text, fontWeight: '900', marginBottom: 6 }}>Rappel</Text>
        <Text style={{ color: theme.muted, lineHeight: 20 }}>
          - Type marge: FIXE (montant) ou POURCENTAGE (%).{"\n"}
          - Après modification, lancez un recalcul pour appliquer aux produits.
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator />
      ) : (
        <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: theme.text, fontWeight: '900' }}>{config ? 'Configuration existante' : 'Aucune configuration'}</Text>
            {canWrite ? (
              <Pressable onPress={() => setEditing((v) => !v)} style={{ backgroundColor: theme.surface, borderWidth: 1, borderColor, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 12 }}>
                <Text style={{ color: theme.text, fontWeight: '900' }}>{editing ? 'Annuler' : 'Modifier'}</Text>
              </Pressable>
            ) : null}
          </View>

          <Text style={{ color: theme.muted, marginTop: 12, marginBottom: 6 }}>Type marge</Text>
          {editing ? (
            <View style={{ flexDirection: 'row', gap: 10 as any }}>
              <Pressable onPress={() => setTypeMarge('FIXE')} style={{ flex: 1, backgroundColor: typeMarge === 'FIXE' ? theme.primary : theme.surface, borderWidth: 1, borderColor, paddingVertical: 10, borderRadius: 12, alignItems: 'center' }}>
                <Text style={{ color: theme.text, fontWeight: '900' }}>FIXE</Text>
              </Pressable>
              <Pressable onPress={() => setTypeMarge('POURCENTAGE')} style={{ flex: 1, backgroundColor: typeMarge === 'POURCENTAGE' ? theme.primary : theme.surface, borderWidth: 1, borderColor, paddingVertical: 10, borderRadius: 12, alignItems: 'center' }}>
                <Text style={{ color: theme.text, fontWeight: '900' }}>POURCENTAGE</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={{ color: theme.text, fontWeight: '900' }}>{typeMarge}</Text>
          )}

          <Text style={{ color: theme.muted, marginTop: 12, marginBottom: 6 }}>Valeur détail</Text>
          {editing ? <TextInput keyboardType="numeric" value={valeurDetail} onChangeText={setValeurDetail} style={inputStyle as any} /> : <Text style={{ color: theme.text }}>{valeurDetail || '0'}</Text>}

          <Text style={{ color: theme.muted, marginTop: 12, marginBottom: 6 }}>Valeur gros</Text>
          {editing ? <TextInput keyboardType="numeric" value={valeurGros} onChangeText={setValeurGros} style={inputStyle as any} /> : <Text style={{ color: theme.text }}>{valeurGros || '0'}</Text>}

          <Text style={{ color: theme.muted, marginTop: 12, marginBottom: 6 }}>Marge minimale détail (fixe)</Text>
          {editing ? <TextInput keyboardType="numeric" value={margeMinDetail} onChangeText={setMargeMinDetail} style={inputStyle as any} /> : <Text style={{ color: theme.text }}>{margeMinDetail || '0'}</Text>}

          <Text style={{ color: theme.muted, marginTop: 12, marginBottom: 6 }}>Marge minimale gros (fixe)</Text>
          {editing ? <TextInput keyboardType="numeric" value={margeMinGros} onChangeText={setMargeMinGros} style={inputStyle as any} /> : <Text style={{ color: theme.text }}>{margeMinGros || '0'}</Text>}

          {jobStatus === 'RUNNING' ? (
            <View style={{ marginTop: 12, backgroundColor: theme.surface, borderRadius: 14, padding: 10, borderWidth: 1, borderColor }}>
              <Text style={{ color: theme.text, fontWeight: '900' }}>Recalcul en cours…</Text>
              <Text style={{ color: theme.muted, marginTop: 4 }}>Job: {jobId}</Text>
            </View>
          ) : null}
          {jobStatus === 'DONE' ? (
            <View style={{ marginTop: 12, backgroundColor: theme.surface, borderRadius: 14, padding: 10, borderWidth: 1, borderColor }}>
              <Text style={{ color: theme.text, fontWeight: '900' }}>Recalcul terminé</Text>
              <Text style={{ color: theme.muted, marginTop: 4 }}>{jobUpdatedCount ?? 0} produits mis à jour</Text>
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', gap: 10 as any, marginTop: 14 }}>
            {editing ? (
              <Pressable onPress={save} style={{ flex: 1, backgroundColor: theme.primary, paddingVertical: 12, borderRadius: 12, alignItems: 'center' }}>
                <Text style={{ color: theme.text, fontWeight: '900' }}>{config ? 'Enregistrer' : 'Créer'}</Text>
              </Pressable>
            ) : (
              <Pressable onPress={recompute} style={{ flex: 1, backgroundColor: theme.primary, paddingVertical: 12, borderRadius: 12, alignItems: 'center' }}>
                <Text style={{ color: theme.text, fontWeight: '900' }}>Recalculer maintenant</Text>
              </Pressable>
            )}
            {config?.id && canDelete ? (
              <Pressable onPress={remove} style={{ backgroundColor: theme.danger, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12, alignItems: 'center' }}>
                <Text style={{ color: theme.text, fontWeight: '900' }}>Supprimer</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      )}
    </ScrollView>
  );
}
