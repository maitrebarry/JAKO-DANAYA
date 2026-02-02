import React, { useEffect, useState } from 'react';
import { View, Text, Button, Alert } from 'react-native';
// dynamic import for expo-barcode-scanner to avoid crash when not installed
let BarCodeScanner: any = null;
import { useTheme } from '../theme';

export default function BarcodeScannerScreen({ navigation }: any) {
  const theme = useTheme();
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
    Alert.alert('Code scanné', String(data), [{ text: 'Rechercher', onPress: () => navigation.navigate('Produits', { q: data }) }, { text: 'Créer', onPress: () => navigation.navigate('ProductForm', { mode: 'create', initialCode: data }) }, { text: 'OK', style: 'cancel' }]);
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
