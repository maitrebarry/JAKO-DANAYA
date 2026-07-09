import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { useAccess } from '../utils/access';
import { useResponsiveLayout } from '../utils/responsive';

export default function ReportsHomeScreen() {
  const navigation = useNavigation<any>();
  const theme = useTheme();
  const access = useAccess();
  const responsive = useResponsiveLayout();
  const borderColor = (theme as any).isDark ? '#1f2937' : '#e5e7eb';

  const item = (opts: { title: string; subtitle?: string; icon: any; route: string }) => (
    <Pressable
      key={opts.route}
      onPress={() => navigation.navigate(opts.route)}
      style={{
        backgroundColor: theme.card,
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor }}>
        <Ionicons name={opts.icon} size={20} color={theme.text} />
      </View>
      <View style={{ marginLeft: 12, flex: 1 }}>
        <Text style={{ color: theme.text, fontWeight: '900' }}>{opts.title}</Text>
        {opts.subtitle ? <Text style={{ color: theme.muted, marginTop: 2 }} numberOfLines={2}>{opts.subtitle}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.muted} />
    </Pressable>
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={{
        width: '100%',
        maxWidth: responsive.contentMaxWidth,
        alignSelf: 'center',
        paddingHorizontal: responsive.horizontalPadding,
        paddingVertical: 16,
        paddingBottom: 36,
      }}
    >
      <Text style={{ color: theme.text, fontSize: 22, fontWeight: '900', marginBottom: 10 }}>Rapports & Historique</Text>

      {access.rapportsView ? item({ title: 'Rapports', subtitle: 'Ventes, stock, valeur stock, top produits', icon: 'bar-chart-outline', route: 'Rapports' }) : null}
      {access.documentsView ? item({ title: 'Documents', subtitle: 'Réceptions, ventes, inventaires, caisse', icon: 'document-text-outline', route: 'Documents' }) : null}
      {item({ title: 'Mouvements', subtitle: 'Journal des mouvements de stock', icon: 'swap-vertical-outline', route: 'Mouvements' })}
      {item({ title: 'Historique achats', subtitle: 'Réceptions et paiements fournisseurs', icon: 'cart-outline', route: 'HistoriqueAchats' })}
      {item({ title: 'Historique ventes', subtitle: 'Livraisons et paiements clients', icon: 'receipt-outline', route: 'HistoriqueVentes' })}

      {!access.rapportsView && !access.documentsView ? (
        <View style={{ backgroundColor: theme.surface, borderRadius: 16, padding: 12, borderWidth: 1, borderColor, marginTop: 4 }}>
          <Text style={{ color: theme.muted, lineHeight: 20 }}>
            Certaines sections (Rapports, Documents) nécessitent des permissions supplémentaires.
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}
