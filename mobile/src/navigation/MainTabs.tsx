import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import DashboardScreen from '../screens/DashboardScreen';
import ProduitsStack from './ProduitsStack';
import AchatStack from './AchatStack';
import CommandeClientScreen from '../screens/CommandeClientScreen';
import UtilisationPertesScreen from '../screens/UtilisationPertesScreen';
import DepensesScreen from '../screens/DepensesScreen';

export type MainTabParamList = {
  Dashboard: undefined;
  Produits: undefined;
  Achat: undefined;
  CommandeClient: undefined;
  UtilisationPertes: undefined;
  Depenses: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

import TopBar from '../components/TopBar';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { useApp } from '../store/AppContext';
import { useAccess } from '../utils/access';

export default function MainTabs() {
  const theme = useTheme();
  const { profile } = useApp();
  const access = useAccess();
  const topBarKey = profile?.photoUrl || profile?.photo || profile?.avatar || 'no-avatar';

  const initialRouteName = access.dashboard
    ? 'Dashboard'
    : access.produits
      ? 'Produits'
      : access.achats
        ? 'Achat'
        : access.commandes
          ? 'CommandeClient'
          : access.utilisationPertes
            ? 'UtilisationPertes'
            : access.depenses
              ? 'Depenses'
              : 'Dashboard';

  const hideTab = (show: boolean) => (show ? undefined : () => null);

  return (
    <Tab.Navigator
      initialRouteName={initialRouteName as any}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.muted,
        tabBarStyle: { backgroundColor: theme.surface },
        tabBarIcon: ({ focused, color, size }) => {
          if (route.name === 'Dashboard') {
            const name = focused ? 'home' : 'home-outline';
            return <Ionicons name={name} size={size} color={color} />;
          }
          if (route.name === 'Produits') {
            const name = focused ? 'cube' : 'cube-outline';
            return <MaterialCommunityIcons name={name} size={size} color={color} />;
          }
          if (route.name === 'Achat') {
            return <MaterialCommunityIcons name="cart-arrow-down" size={size} color={color} />;
          }
          if (route.name === 'CommandeClient') {
            const name = focused ? 'clipboard-list' : 'clipboard-list-outline';
            return <MaterialCommunityIcons name={name} size={size} color={color} />;
          }
          if (route.name === 'UtilisationPertes') {
            return <MaterialCommunityIcons name={'clipboard-minus'} size={size} color={color} />;
          }
          if (route.name === 'Depenses') {
            return <MaterialCommunityIcons name={'cash-minus'} size={size} color={color} />;
          }
          return null;
        },
        tabBarShowLabel: true,
      })}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          headerShown: true,
          header: () => <TopBar key={topBarKey} showBack={false} />,
          tabBarButton: hideTab(access.dashboard),
        }}
      />
      <Tab.Screen
        name="Produits"
        component={ProduitsStack}
        options={{
          tabBarButton: hideTab(access.produits),
        }}
      />
      <Tab.Screen
        name="Achat"
        component={AchatStack}
        options={{
          title: 'Achat',
          tabBarButton: hideTab(access.achats),
        }}
      />
      <Tab.Screen
        name="CommandeClient"
        component={CommandeClientScreen}
        options={{
          title: 'Commande',
          headerShown: true,
          header: () => <TopBar key={topBarKey} showBack={false} />,
          tabBarButton: hideTab(access.commandes),
        }}
      />
      <Tab.Screen
        name="UtilisationPertes"
        component={UtilisationPertesScreen}
        options={{
          title: 'Utilisation',
          headerShown: true,
          header: () => <TopBar key={topBarKey} showBack={false} />,
          tabBarButton: hideTab(access.utilisationPertes),
        }}
      />
      <Tab.Screen
        name="Depenses"
        component={DepensesScreen}
        options={{
          title: 'Dépenses',
          headerShown: true,
          header: () => <TopBar key={topBarKey} showBack={false} />,
          tabBarButton: hideTab(access.depenses),
        }}
      />
    </Tab.Navigator>
  );
}
