import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { useApp } from '../store/AppContext';
import { hasPermission, isSuperAdmin, getRoleNames } from '../utils/permissions';

export default function ConfigurationHomeScreen() {
  const navigation = useNavigation<any>();
  const theme = useTheme();
  const { profile } = useApp();
  const borderColor = (theme as any).isDark ? '#1f2937' : '#e5e7eb';

  const roles = getRoleNames(profile);
  const canView = hasPermission(profile, 'CONFIGURATION_VOIR') || isSuperAdmin(profile) || roles.includes('PROPRIETAIRE') || roles.includes('ADMINISTRATEUR');

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
    <ScrollView style={{ flex: 1, backgroundColor: theme.background }} contentContainerStyle={{ padding: 16 }}>
      <Text style={{ color: theme.text, fontSize: 22, fontWeight: '900', marginBottom: 10 }}>Configuration</Text>

      {!canView ? (
        <View style={{ backgroundColor: theme.surface, borderRadius: 16, padding: 12, borderWidth: 1, borderColor, marginBottom: 12 }}>
          <Text style={{ color: theme.text, fontWeight: '900' }}>Accès limité</Text>
          <Text style={{ color: theme.muted, marginTop: 6, lineHeight: 20 }}>
            Vous n’avez pas la permission CONFIGURATION_VOIR. Certaines sections peuvent être vides ou refuser les modifications.
          </Text>
        </View>
      ) : null}

      {item({ title: 'Liste utilisateurs', subtitle: 'Créer / modifier / activer-désactiver', icon: 'people-outline', route: 'ConfigurationUsers' })}
      {item({ title: 'Boutique', subtitle: 'Informations et paramètres boutique', icon: 'storefront-outline', route: 'ConfigurationBoutique' })}
      {item({ title: 'Magasins', subtitle: 'Gestion des magasins (inventaire)', icon: 'business-outline', route: 'ConfigurationMagasins' })}
      {item({ title: 'Unité', subtitle: 'Unités (libellé, symbole, code)', icon: 'pricetag-outline', route: 'ConfigurationUnites' })}
      {isSuperAdmin(profile) ? item({ title: 'Permissions', subtitle: 'Liste / création / modification', icon: 'key-outline', route: 'ConfigurationPermissions' }) : null}
      {item({ title: 'Assigner des permissions', subtitle: 'Attribuer des permissions à un utilisateur', icon: 'shield-checkmark-outline', route: 'ConfigurationAssignPermissions' })}
      {item({ title: 'Marges (configuration)', subtitle: 'Type de marge + recalcul automatique', icon: 'calculator-outline', route: 'ConfigurationMarges' })}
    </ScrollView>
  );
}
