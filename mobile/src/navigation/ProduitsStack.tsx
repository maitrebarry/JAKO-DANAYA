import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ProduitsScreen from '../screens/ProduitsScreen';
import ProductFormScreen from '../screens/ProductFormScreen';
import TopBar from '../components/TopBar';
import { useApp } from '../store/AppContext';

const Stack = createNativeStackNavigator();

export default function ProduitsStack() {
  const { profile } = useApp();
  const topBarKey = profile?.photoUrl || profile?.photo || profile?.avatar || 'no-avatar';
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Produits" component={ProduitsScreen} options={{ headerShown: true, header: () => <TopBar key={topBarKey} showBack={false} /> }} />
      <Stack.Screen name="ProductForm" component={ProductFormScreen} options={{ headerShown: true, header: () => <TopBar key={topBarKey} showBack={true} /> }} />
    </Stack.Navigator>
  );
}