import React, { useEffect, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/LoginScreen';
import BoutiqueSelectScreen from '../screens/BoutiqueSelectScreen';
import MainTabs from './MainTabs';
import NotificationsScreen from '../screens/NotificationsScreen';
import { useApp } from '../store/AppContext';
import { View, ActivityIndicator, Alert } from 'react-native';
import TopBar from '../components/TopBar';
import { getRoleNames, isSuperAdmin } from '../utils/permissions';
import SubscriptionRenewScreen from '../screens/SubscriptionRenewScreen';
import SubscriptionScreen from '../screens/SubscriptionScreen';
import { approveAdminSubscriptionPayment, fetchAdminSubscriptionPayments, rejectAdminSubscriptionPayment } from '../services/admin';
import { ONBOARDING_SEEN_KEY } from '../screens/OnboardingScreen';
import { getItem } from '../utils/storage';

export type RootStackParamList = {
  Onboarding: undefined;
  Login: undefined;
  ForgotPassword: undefined;
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
  Fournisseurs: undefined;
  ReportsHome: undefined;
  Rapports: undefined;
  Documents: undefined;
  Mouvements: undefined;
  HistoriqueAchats: undefined;
  HistoriqueVentes: undefined;
  SubscriptionRenew: undefined;
  Subscription: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { token, boutiqueId, ready, profile, subscriptionStatus, subscriptionChecked } = useApp();
  const topBarKey = profile?.photoUrl || profile?.photo || profile?.avatar || 'no-avatar';
  const [lastPromptPaymentId, setLastPromptPaymentId] = useState<number | null>(null);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    let mounted = true;
    getItem(ONBOARDING_SEEN_KEY).then((v) => {
      if (!mounted) return;
      setShowOnboarding(v !== '1');
      setOnboardingChecked(true);
    });
    return () => { mounted = false; };
  }, []);

  const roles = getRoleNames(profile);
  const isSubscriptionManagedRole = !!token;
  const status = String(subscriptionStatus?.status || '').toUpperCase();
  const isAllowedStatus = status === 'ACTIVE' || status === 'TRIAL';
  const isSubscriptionBlocked = !!subscriptionStatus?.blocked || (subscriptionStatus?.configured && !isAllowedStatus);

  useEffect(() => {
    if (!token) return;
    if (!subscriptionChecked) return;
    if (!isSuperAdmin(profile)) return;

    let cancelled = false;
    const run = async () => {
      try {
        const rows = await fetchAdminSubscriptionPayments(token, 'PENDING');
        if (cancelled) return;
        const first = Array.isArray(rows) ? rows[0] : null;
        if (!first || !first.id) return;
        if (lastPromptPaymentId === first.id) return;

        setLastPromptPaymentId(first.id);
        Alert.alert(
          'Paiement abonnement en attente',
          `Boutique: ${first.boutique_nom || '—'}\nRéf: ${first.reference || '—'}\nMontant: ${first.montant || 0} ${first.devise || ''}`,
          [
            { text: 'Plus tard', style: 'cancel' },
            {
              text: 'Rejeter',
              style: 'destructive',
              onPress: async () => {
                try {
                  await rejectAdminSubscriptionPayment(token, first.id);
                } catch (e: any) {
                  Alert.alert('Erreur', e?.message || 'Rejet impossible');
                }
              },
            },
            {
              text: 'Valider',
              onPress: async () => {
                try {
                  await approveAdminSubscriptionPayment(token, first.id);
                } catch (e: any) {
                  Alert.alert('Erreur', e?.message || 'Validation impossible');
                }
              },
            },
          ]
        );
      } catch {
        // ignore
      }
    };

    run();
    return () => { cancelled = true; };
  }, [token, subscriptionChecked, profile?.id, lastPromptPaymentId]);

  if (!ready || !onboardingChecked) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (token && isSubscriptionManagedRole && !subscriptionChecked) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!token ? (
        <>
          {showOnboarding ? (
            <Stack.Screen name="Onboarding" component={require('../screens/OnboardingScreen').default} />
          ) : null}
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="ForgotPassword" component={require('../screens/ForgotPasswordScreen').default} />
        </>
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
          <Stack.Screen
            name="Fournisseurs"
            component={require('../screens/FournisseursScreen').default}
            options={{ headerShown: true, header: () => <TopBar key={topBarKey} showBack={true} /> }}
          />
          <Stack.Screen
            name="ReportsHome"
            component={require('../screens/ReportsHomeScreen').default}
            options={{ headerShown: true, header: () => <TopBar key={topBarKey} showBack={true} /> }}
          />
          <Stack.Screen
            name="Rapports"
            component={require('../screens/RapportsScreen').default}
            options={{ headerShown: true, header: () => <TopBar key={topBarKey} showBack={true} /> }}
          />
          <Stack.Screen
            name="Documents"
            component={require('../screens/DocumentsScreen').default}
            options={{ headerShown: true, header: () => <TopBar key={topBarKey} showBack={true} /> }}
          />
          <Stack.Screen
            name="Mouvements"
            component={require('../screens/MouvementsScreen').default}
            options={{ headerShown: true, header: () => <TopBar key={topBarKey} showBack={true} /> }}
          />
          <Stack.Screen
            name="HistoriqueAchats"
            component={require('../screens/HistoriqueAchatsScreen').default}
            options={{ headerShown: true, header: () => <TopBar key={topBarKey} showBack={true} /> }}
          />
          <Stack.Screen
            name="HistoriqueVentes"
            component={require('../screens/HistoriqueVentesScreen').default}
            options={{ headerShown: true, header: () => <TopBar key={topBarKey} showBack={true} /> }}
          />
          <Stack.Screen
            name="Subscription"
            component={SubscriptionScreen}
            options={{ headerShown: true, header: () => <TopBar key={topBarKey} showBack={true} /> }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}
