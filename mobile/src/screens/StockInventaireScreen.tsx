import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../theme';
import { useAccess } from '../utils/access';

export default function StockInventaireScreen() {
  const theme = useTheme();
  const access = useAccess();

  if (!access.stock) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background, padding: 16 }}>
        <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text }}>Stock / Inventaire</Text>
        <Text style={{ marginTop: 8, color: theme.muted, textAlign: 'center' }}>
          Vous n'avez pas la permission d'accéder à cet écran.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
      <Text style={{ fontSize: 20, fontWeight: '600', color: theme.text }}>Stock / Inventaire</Text>
      <Text style={{ color: theme.muted }}>Placeholder</Text>
    </View>
  );
}
