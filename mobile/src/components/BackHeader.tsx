import React from 'react';
import { SafeAreaView, View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme';

export default function BackHeader({ title }: { title?: string }) {
  const navigation = useNavigation<any>();
  const theme = useTheme();
  return (
    <SafeAreaView style={{ backgroundColor: theme.background }}>
      <View style={{ padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={{ top: 10, left: 10, right: 10, bottom: 10 }} accessibilityRole="button" accessibilityLabel="Retour">
          <Ionicons name="arrow-back" size={24} color={theme.primary} />
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: '700', color: theme.text }}>{title || ''}</Text>
      </View>
    </SafeAreaView>
  );
}
