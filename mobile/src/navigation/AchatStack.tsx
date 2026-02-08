import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import TopBar from '../components/TopBar';
import { useApp } from '../store/AppContext';
import AchatListScreen from '../screens/AchatListScreen';
import AchatScreen from '../screens/AchatScreen';
import AchatDetailScreen from '../screens/AchatDetailScreen';
import AchatPaiementScreen from '../screens/AchatPaiementScreen';
import AchatReceptionScreen from '../screens/AchatReceptionScreen';

import type { AchatStackParamList } from './achatTypes';

const Stack = createNativeStackNavigator<AchatStackParamList>();

export default function AchatStack() {
  const { profile } = useApp();
  const topBarKey = profile?.photoUrl || profile?.photo || profile?.avatar || 'no-avatar';

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="AchatList"
        component={AchatListScreen}
        options={{ headerShown: true, header: () => <TopBar key={topBarKey} showBack={false} /> }}
      />
      <Stack.Screen
        name="AchatCreate"
        component={AchatScreen}
        options={{ headerShown: true, header: () => <TopBar key={topBarKey} showBack={true} /> }}
      />
      <Stack.Screen
        name="AchatDetail"
        component={AchatDetailScreen}
        options={{ headerShown: true, header: () => <TopBar key={topBarKey} showBack={true} /> }}
      />
      <Stack.Screen
        name="AchatPaiement"
        component={AchatPaiementScreen}
        options={{ headerShown: true, header: () => <TopBar key={topBarKey} showBack={true} /> }}
      />
      <Stack.Screen
        name="AchatReception"
        component={AchatReceptionScreen}
        options={{ headerShown: true, header: () => <TopBar key={topBarKey} showBack={true} /> }}
      />
    </Stack.Navigator>
  );
}
