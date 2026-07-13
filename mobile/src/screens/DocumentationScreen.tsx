import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useTheme } from '../theme';
import { FRONTEND_BASE_URL } from '../utils/env';
import { DOCUMENTATION_HTML } from '../docs/documentationHtml';
import { showError, showSuccess } from '../utils/notify';

export default function DocumentationScreen() {
  const theme = useTheme();
  const docUrl = `${FRONTEND_BASE_URL}/documentation`;
  const borderColor = (theme as any).isDark ? '#1f2937' : '#e5e7eb';

  const openWebDoc = async () => {
    try {
      await WebBrowser.openBrowserAsync(docUrl);
    } catch {
      // ignore
    }
  };

  const downloadPdf = async () => {
    try {
      const canShare = await Sharing.isAvailableAsync().catch(() => false);
      const { uri } = await Print.printToFileAsync({ html: DOCUMENTATION_HTML, base64: false });
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Documentation (PDF)' });
      } else {
        await WebBrowser.openBrowserAsync(docUrl);
      }
      showSuccess('Succès', 'PDF généré');
    } catch (e: any) {
      showError('Erreur', e?.message || 'Impossible de générer le PDF');
    }
  };

  const downloadWord = async () => {
    try {
      const canShare = await Sharing.isAvailableAsync().catch(() => false);
      const fsAny = FileSystem as any;
      const baseDir: string | null | undefined = fsAny?.cacheDirectory ?? fsAny?.documentDirectory;
      if (!baseDir) {
        await WebBrowser.openBrowserAsync(docUrl);
        return;
      }
      const path = `${baseDir.endsWith('/') ? baseDir : `${baseDir}/`}Documentation-JAGO-DANAYA.doc`;
      await FileSystem.writeAsStringAsync(path, DOCUMENTATION_HTML, { encoding: 'utf8' as any });
      if (canShare) {
        await Sharing.shareAsync(path, { mimeType: 'application/msword', dialogTitle: 'Documentation (Word)' });
      } else {
        await WebBrowser.openBrowserAsync(docUrl);
      }
      showSuccess('Succès', 'Document Word généré');
    } catch (e: any) {
      showError('Erreur', e?.message || 'Impossible de générer le document Word');
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.background }} contentContainerStyle={{ padding: 16 }}>
      <Text style={{ color: theme.text, fontSize: 22, fontWeight: '900', marginBottom: 10 }}>Guide d'utilisation</Text>

      <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor }}>
        <Text style={{ color: theme.text, fontWeight: '900', marginBottom: 8 }}>Le guide de JÀGO DÁNAYA</Text>
        <Text style={{ color: theme.muted, lineHeight: 20 }}>
          Ce résumé te dit quoi faire, étape par étape. Pour voir le guide complet avec des images de l'application, ouvre la documentation web ci‑dessous.
        </Text>

        <View style={{ flexDirection: 'row', gap: 10 as any, marginTop: 12 }}>
          <Pressable
            onPress={downloadPdf}
            style={{ flex: 1, backgroundColor: theme.surface, borderWidth: 1, borderColor, paddingVertical: 12, borderRadius: 12, alignItems: 'center' }}
          >
            <Text style={{ color: theme.text, fontWeight: '900' }}>Télécharger (PDF)</Text>
          </Pressable>
          <Pressable
            onPress={downloadWord}
            style={{ flex: 1, backgroundColor: theme.surface, borderWidth: 1, borderColor, paddingVertical: 12, borderRadius: 12, alignItems: 'center' }}
          >
            <Text style={{ color: theme.text, fontWeight: '900' }}>Télécharger (Word)</Text>
          </Pressable>
        </View>

        <Pressable
          onPress={openWebDoc}
          style={{ marginTop: 12, backgroundColor: theme.primary, paddingVertical: 12, borderRadius: 12, alignItems: 'center' }}
        >
          <Text style={{ color: theme.text, fontWeight: '900' }}>Ouvrir la documentation web</Text>
        </Pressable>
      </View>

      <View style={{ height: 12 }} />

      <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor }}>
        <Text style={{ color: theme.text, fontWeight: '900', marginBottom: 6 }}>1. Se connecter</Text>
        <Text style={{ color: theme.muted, lineHeight: 20 }}>Tape ton email et ton mot de passe, puis appuie sur « Connexion ».</Text>

        <Text style={{ color: theme.text, fontWeight: '900', marginTop: 12, marginBottom: 6 }}>2. Configuration de départ</Text>
        <Text style={{ color: theme.muted, lineHeight: 20 }}>
          - Unités : ajoute au moins une unité (carton, sac, paquet).{"\n"}
          - Marges : règle-les une fois, les prix de vente se calculent tout seuls ensuite.
        </Text>

        <Text style={{ color: theme.text, fontWeight: '900', marginTop: 12, marginBottom: 6 }}>3. Produits et stock</Text>
        <Text style={{ color: theme.muted, lineHeight: 20 }}>
          Ajoute tes produits, fais l'inventaire, puis enregistre tes achats et tes ventes.
        </Text>
      </View>
    </ScrollView>
  );
}
