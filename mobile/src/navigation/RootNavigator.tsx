import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/LoginScreen';
import BoutiqueSelectScreen from '../screens/BoutiqueSelectScreen';
import MainTabs from './MainTabs';
import NotificationsScreen from '../screens/NotificationsScreen';
import { useApp } from '../store/AppContext';
import { View, ActivityIndicator } from 'react-native';
import TopBar from '../components/TopBar';
import { getRoleNames } from '../utils/permissions';
import SubscriptionRenewScreen from '../screens/SubscriptionRenewScreen';

export type RootStackParamList = {
  Login: undefined;
  BoutiqueSelect: undefined;
  Main: undefined;
  Notifications: undefined;
  Profil: { openAvatarPicker?: boolean } | undefined;
  Caisse: undefined;
  VenteEspece: undefined;
  VentesEspecesList: undefined;
  VenteEspeceDetail: { id: number };
  CommandeClientDetail: { id: number };
  CommandeClientPaiement: { id: number; reference?: string; total?: number; paie?: number };
  CommandeClientLivraison: { id: number };
  CommandeClientCreate: undefined;
  DepenseDetail: { id: number };
  DepenseForm: { mode: 'create' | 'edit'; id?: number };
  DepenseValidate: { id: number };
  UtilisationPertesForm: { mode: 'create' | 'edit'; mouvementId?: number };
  ProductDetail: { id: number };
  ProductForm: { mode: 'create'|'edit'; id?: number; initialCode?: string } | undefined;
  BarcodeScanner: undefined;
  Documentation: undefined;
  ConfigurationHome: undefined;
  ConfigurationUsers: undefined;
  ConfigurationBoutique: undefined;
  ConfigurationMagasins: undefined;
  ConfigurationUnites: undefined;
  ConfigurationPermissions: undefined;
  ConfigurationAssignPermissions: undefined;
  ConfigurationMarges: undefined;
  SubscriptionRenew: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { token, boutiqueId, ready, profile, subscriptionStatus } = useApp();
  const topBarKey = profile?.photoUrl || profile?.photo || profile?.avatar || 'no-avatar';

  const roles = getRoleNames(profile);
  const isSubscriptionManagedRole =
    roles.includes('PROPRIETAIRE') ||
    roles.includes('OWNER') ||
    roles.includes('GERANT') ||
    roles.includes('GERANT_BOUTIQUE') ||
    roles.includes('MANAGER');
  const isSubscriptionBlocked = isSubscriptionManagedRole && !!subscriptionStatus?.blocked;

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
      ) : isSubscriptionBlocked ? (
        <Stack.Screen name="SubscriptionRenew" component={SubscriptionRenewScreen} />
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
          <Stack.Screen
            name="VentesEspecesList"
            component={require('../screens/VentesEspecesListScreen').default}
            options={{ headerShown: true, header: () => <TopBar key={topBarKey} showBack={true} /> }}
          />
          <Stack.Screen
            name="VenteEspeceDetail"
            component={require('../screens/VenteEspeceDetailScreen').default}
            options={{ headerShown: true, header: () => <TopBar key={topBarKey} showBack={true} /> }}
          />
          <Stack.Screen
            name="Notifications"
            component={NotificationsScreen}
            options={{ headerShown: true, header: () => <TopBar key={topBarKey} showBack={true} /> }}
          />
          <Stack.Screen
            name="Profil"
            component={require('../screens/ProfilScreen').default}
            options={{ headerShown: true, header: () => <TopBar key={topBarKey} showBack={true} /> }}
          />
          <Stack.Screen
            name="Caisse"
            component={require('../screens/CaisseScreen').default}
            options={{ headerShown: true, header: () => <TopBar key={topBarKey} showBack={true} /> }}
          />
          <Stack.Screen
            name="CommandeClientDetail"
            component={require('../screens/CommandeClientDetailScreen').default}
            options={{ headerShown: true, header: () => <TopBar key={topBarKey} showBack={true} /> }}
          />
          <Stack.Screen
            name="CommandeClientCreate"
            component={require('../screens/CommandeClientCreateScreen').default}
            options={{ headerShown: true, header: () => <TopBar key={topBarKey} showBack={true} /> }}
          />
          <Stack.Screen
            name="CommandeClientPaiement"
            component={require('../screens/CommandeClientPaiementScreen').default}
            options={{ headerShown: true, header: () => <TopBar key={topBarKey} showBack={true} /> }}
          />
          <Stack.Screen
            name="CommandeClientLivraison"
            component={require('../screens/CommandeClientLivraisonScreen').default}
            options={{ headerShown: true, header: () => <TopBar key={topBarKey} showBack={true} /> }}
          />
          <Stack.Screen
            name="DepenseDetail"
            component={require('../screens/DepenseDetailScreen').default}
            options={{ headerShown: true, header: () => <TopBar key={topBarKey} showBack={true} /> }}
          />
          <Stack.Screen
            name="DepenseForm"
            component={require('../screens/DepenseFormScreen').default}
            options={{ headerShown: true, header: () => <TopBar key={topBarKey} showBack={true} /> }}
          />
          <Stack.Screen
            name="DepenseValidate"
            component={require('../screens/DepenseValidationScreen').default}
            options={{ headerShown: true, header: () => <TopBar key={topBarKey} showBack={true} /> }}
          />
          <Stack.Screen
            name="UtilisationPertesForm"
            component={require('../screens/UtilisationPertesFormScreen').default}
            options={{ headerShown: true, header: () => <TopBar key={topBarKey} showBack={true} /> }}
          />
          <Stack.Screen name="ProductDetail" component={require('../screens/ProductDetailScreen').default} />
          <Stack.Screen name="ProductForm" component={require('../screens/ProductFormScreen').default} options={{ presentation: 'modal' }} />
          <Stack.Screen name="BarcodeScanner" component={require('../screens/BarcodeScannerScreen').default} />

          <Stack.Screen
            name="Documentation"
            component={require('../screens/DocumentationScreen').default}
            options={{ headerShown: true, header: () => <TopBar key={topBarKey} showBack={true} /> }}
          />
          <Stack.Screen
            name="ConfigurationHome"
            component={require('../screens/ConfigurationHomeScreen').default}
            options={{ headerShown: true, header: () => <TopBar key={topBarKey} showBack={true} /> }}
          />
          <Stack.Screen
            name="ConfigurationUsers"
            component={require('../screens/ConfigurationUsersScreen').default}
            options={{ headerShown: true, header: () => <TopBar key={topBarKey} showBack={true} /> }}
          />
          <Stack.Screen
            name="ConfigurationBoutique"
            component={require('../screens/ConfigurationBoutiqueScreen').default}
            options={{ headerShown: true, header: () => <TopBar key={topBarKey} showBack={true} /> }}
          />
          <Stack.Screen
            name="ConfigurationMagasins"
            component={require('../screens/ConfigurationMagasinsScreen').default}
            options={{ headerShown: true, header: () => <TopBar key={topBarKey} showBack={true} /> }}
          />
          <Stack.Screen
            name="ConfigurationUnites"
            component={require('../screens/ConfigurationUnitesScreen').default}
            options={{ headerShown: true, header: () => <TopBar key={topBarKey} showBack={true} /> }}
          />
          <Stack.Screen
            name="ConfigurationPermissions"
            component={require('../screens/ConfigurationPermissionsScreen').default}
            options={{ headerShown: true, header: () => <TopBar key={topBarKey} showBack={true} /> }}
          />
          <Stack.Screen
            name="ConfigurationAssignPermissions"
            component={require('../screens/ConfigurationAssignPermissionsScreen').default}
            options={{ headerShown: true, header: () => <TopBar key={topBarKey} showBack={true} /> }}
          />
          <Stack.Screen
            name="ConfigurationMarges"
            component={require('../screens/ConfigurationMargesScreen').default}
            options={{ headerShown: true, header: () => <TopBar key={topBarKey} showBack={true} /> }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}
