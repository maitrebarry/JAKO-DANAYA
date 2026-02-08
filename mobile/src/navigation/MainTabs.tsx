import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import DashboardScreen from '../screens/DashboardScreen';
import ProduitsStack from './ProduitsStack';
import AchatStack from './AchatStack';
import CommandeClientScreen from '../screens/CommandeClientScreen';
import StockInventaireScreen from '../screens/StockInventaireScreen';
import CaisseScreen from '../screens/CaisseScreen';
import ProfilScreen from '../screens/ProfilScreen';

export type MainTabParamList = {
  Dashboard: undefined;
  Produits: undefined;
  Achat: undefined;
  CommandeClient: undefined;
  StockInventaire: undefined;
  Caisse: undefined;
  Profil: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

import TopBar from '../components/TopBar';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { useApp } from '../store/AppContext';

export default function MainTabs() {
  const theme = useTheme();
  const { profile } = useApp();
  const topBarKey = profile?.photoUrl || profile?.photo || profile?.avatar || 'no-avatar';
  return (
    <Tab.Navigator
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
          if (route.name === 'StockInventaire') {
            const name = focused ? 'warehouse' : 'warehouse';
            return <MaterialCommunityIcons name={name} size={size} color={color} />;
          }
          if (route.name === 'Caisse') {
            const name = focused ? 'cash' : 'cash';
            return <MaterialCommunityIcons name={name} size={size} color={color} />;
          }
          if (route.name === 'Profil') {
            const name = focused ? 'person' : 'person-outline';
            return <Ionicons name={name} size={size} color={color} />;
          }
          return null;
        },
        tabBarShowLabel: true,
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ headerShown: true, header: () => <TopBar key={topBarKey} showBack={false} /> }} />
        <Tab.Screen name="Produits" component={ProduitsStack} />
      <Tab.Screen name="Achat" component={AchatStack} options={{ title: 'Achat' }} />
      <Tab.Screen name="CommandeClient" component={CommandeClientScreen} options={{ title: 'Commande', headerShown: true, header: () => <TopBar key={topBarKey} showBack={false} /> }} />
      <Tab.Screen name="StockInventaire" component={StockInventaireScreen} options={{ title: 'Stock', headerShown: true, header: () => <TopBar key={topBarKey} showBack={false} /> }} />
      <Tab.Screen name="Caisse" component={CaisseScreen} options={{ headerShown: true, header: () => <TopBar key={topBarKey} showBack={false} /> }} />
      <Tab.Screen name="Profil" component={ProfilScreen} options={{ headerShown: true, header: () => <TopBar key={topBarKey} showBack={false} /> }} />
    </Tab.Navigator>
  );
}
