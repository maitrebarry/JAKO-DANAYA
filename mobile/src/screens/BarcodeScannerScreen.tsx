import React, { useEffect, useState } from 'react';
import { View, Text, Button, Alert } from 'react-native';
// dynamic import for expo-barcode-scanner to avoid crash when not installed
let BarCodeScanner: any = null;
import { useTheme } from '../theme';
import { useAccess } from '../utils/access';
import { showError } from '../utils/notify';

export default function BarcodeScannerScreen({ navigation }: any) {
  const theme = useTheme();
  const access = useAccess();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);

  const BackHeader = require('../components/BackHeader').default;
  useEffect(() => {
    (async () => {
      try {
        if (!BarCodeScanner) BarCodeScanner = require('expo-barcode-scanner');
        const { status } = await BarCodeScanner.requestPermissionsAsync();
        setHasPermission(status === 'granted');
      } catch (e:any) {
        setHasPermission(false);
      }
    })();
  }, []);

  const handleBarCodeScanned = (ev: any) => {
    const { data } = ev;
    setScanned(true);
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
            params: { screen: 'ProductForm', params: { mode: 'create', initialCode: data } },
          }),
      });
    }
    actions.push({ text: 'OK', style: 'cancel' });
    if (!access.produits && !access.produitsCreate) {
      showError('Permission', "Vous n'avez pas accès aux produits.");
      return;
    }
    Alert.alert('Code scanné', String(data), actions);
  };

  if (hasPermission === null) return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <BackHeader title="Scanner" />
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><Text>Autorisation en cours...</Text></View>
    </View>
  );
  if (hasPermission === false) return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <BackHeader title="Scanner" />
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><Text>Pas d'accès à la caméra</Text></View>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <BackHeader title="Scanner" />
      <BarCodeScanner onBarCodeScanned={scanned ? undefined : handleBarCodeScanned} style={{ flex: 1 }} />
      {scanned && <Button title="Scanner de nouveau" onPress={() => setScanned(false)} color={theme.primary} />}
    </View>
  );
}
