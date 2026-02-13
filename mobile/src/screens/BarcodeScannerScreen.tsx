import React, { useEffect, useState } from 'react';
import { View, Text, Button, Alert, Pressable, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useTheme } from '../theme';
import { useAccess } from '../utils/access';
import { showError } from '../utils/notify';
import { lookupBarcodeName } from '../services/barcodeLookup';

export default function BarcodeScannerScreen({ navigation }: any) {
  const theme = useTheme();
  const access = useAccess();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);

  const BackHeader = require('../components/BackHeader').default;
  useEffect(() => {
    requestPermission();
  }, [requestPermission]);

  const handleBarCodeScanned = async (ev: BarcodeScanningResult) => {
    const { data } = ev;
    setScanned(true);

    let resolvedName: string | null = null;
    try {
      setLookupLoading(true);
      const r = await lookupBarcodeName(String(data));
      resolvedName = r?.name ?? null;
    } catch {
      resolvedName = null;
    } finally {
      setLookupLoading(false);
    }

    const actions: any[] = [];
    if (access.produits) {
      actions.push({ text: 'Rechercher', onPress: () => navigation.navigate('Produits', { q: data }) });
    }
    if (access.produitsCreate) {
      actions.push({
        text: 'Créer',
        onPress: () =>
          navigation.navigate('Main', {
            screen: 'Produits',
            params: { screen: 'ProductForm', params: { mode: 'create', initialCode: data, initialNomProduit: resolvedName } },
          }),
      });
    }
    actions.push({ text: 'OK', style: 'cancel' });
    if (!access.produits && !access.produitsCreate) {
      showError('Permission', "Vous n'avez pas accès aux produits.");
      return;
    }
    const msg = resolvedName ? `${String(data)}\nNom: ${resolvedName}` : String(data);
    Alert.alert('Code scanné', msg, actions);
  };

  if (!permission) return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <BackHeader title="Scanner" />
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><Text>Autorisation en cours...</Text></View>
    </View>
  );
  if (!permission.granted) return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <BackHeader title="Scanner" />
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 }}>
        <Text style={{ color: theme.text, fontWeight: '800', fontSize: 16 }}>Pas d'accès à la caméra</Text>
        <Text style={{ color: theme.muted, marginTop: 8, textAlign: 'center' }}>
          Autorisez l'accès à la caméra pour scanner un code-barres.
        </Text>
        <Pressable onPress={() => requestPermission()} style={{ marginTop: 16, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: theme.primary, borderRadius: 8 }}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>Autoriser</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <BackHeader title="Scanner" />
      <CameraView
        style={{ flex: 1 }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      />
      {lookupLoading ? (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 12, backgroundColor: 'rgba(0,0,0,0.35)' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <ActivityIndicator color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '700' }}>Recherche du produit…</Text>
          </View>
        </View>
      ) : null}
      {scanned && !lookupLoading && <Button title="Scanner de nouveau" onPress={() => setScanned(false)} color={theme.primary} />}
    </View>
  );
}
