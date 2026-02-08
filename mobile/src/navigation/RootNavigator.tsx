import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/LoginScreen';
import BoutiqueSelectScreen from '../screens/BoutiqueSelectScreen';
import MainTabs from './MainTabs';
import NotificationsScreen from '../screens/NotificationsScreen';
import { useApp } from '../store/AppContext';
import { View, ActivityIndicator } from 'react-native';
import TopBar from '../components/TopBar';

export type RootStackParamList = {
  Login: undefined;
  BoutiqueSelect: undefined;
  Main: undefined;
  Notifications: undefined;
  VenteEspece: undefined;
  ProductDetail: { id: number };
  ProductForm: { mode: 'create'|'edit'; id?: number; initialCode?: string } | undefined;
  BarcodeScanner: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { token, boutiqueId, ready } = useApp();
  const { profile } = useApp();
  const topBarKey = profile?.photoUrl || profile?.photo || profile?.avatar || 'no-avatar';

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!token ? (
        <Stack.Screen name="Login" component={LoginScreen} />
      ) : !boutiqueId ? (
        <Stack.Screen name="BoutiqueSelect" component={BoutiqueSelectScreen} />
      ) : (
        <>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen
            name="VenteEspece"
            component={require('../screens/VenteEspeceScreen').default}
            options={{ headerShown: true, header: () => <TopBar key={topBarKey} showBack={true} /> }}
          />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
          <Stack.Screen name="ProductDetail" component={require('../screens/ProductDetailScreen').default} />
          <Stack.Screen name="ProductForm" component={require('../screens/ProductFormScreen').default} options={{ presentation: 'modal' }} />
          <Stack.Screen name="BarcodeScanner" component={require('../screens/BarcodeScannerScreen').default} />
        </>
      )}
    </Stack.Navigator>
  );
}
