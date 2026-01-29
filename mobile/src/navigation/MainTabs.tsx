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

export default function MainTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
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
