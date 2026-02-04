import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import RootNavigator from './src/navigation/RootNavigator';
import { AppProvider } from './src/store/AppContext';
import FlashMessage from 'react-native-flash-message';

export default function App() {
  return (
    <AppProvider>
      <NavigationContainer>
        <RootNavigator />
        <FlashMessage position="top" />
      </NavigationContainer>
    </AppProvider>
  );
}
