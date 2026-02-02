import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import DashboardScreen from '../screens/DashboardScreen';
import ProduitsScreen from '../screens/ProduitsScreen';
import VenteEspeceScreen from '../screens/VenteEspeceScreen';
import CommandeClientScreen from '../screens/CommandeClientScreen';
import StockInventaireScreen from '../screens/StockInventaireScreen';
import CaisseScreen from '../screens/CaisseScreen';
import ProfilScreen from '../screens/ProfilScreen';

export type MainTabParamList = {
  Dashboard: undefined;
  Produits: undefined;
  VenteEspece: undefined;
  CommandeClient: undefined;
  StockInventaire: undefined;
  Caisse: undefined;
  Profil: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

import TopBar from '../components/TopBar';
import { Ionicons } from '@expo/vector-icons';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../theme';

export default function MainTabs() {
  const theme = useTheme();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        header: () => <TopBar />,
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
          if (route.name === 'VenteEspece') {
            return <MaterialIcons name="attach-money" size={size} color={color} />;
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
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Produits" component={ProduitsScreen} />
      <Tab.Screen name="VenteEspece" component={VenteEspeceScreen} options={{ title: 'Vente' }} />
      <Tab.Screen name="CommandeClient" component={CommandeClientScreen} options={{ title: 'Commande' }} />
      <Tab.Screen name="StockInventaire" component={StockInventaireScreen} options={{ title: 'Stock' }} />
      <Tab.Screen name="Caisse" component={CaisseScreen} />
      <Tab.Screen name="Profil" component={ProfilScreen} />
    </Tab.Navigator>
  );
}
