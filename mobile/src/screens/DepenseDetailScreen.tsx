import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { useApp } from '../store/AppContext';
import { useAccess } from '../utils/access';
import { cancelDepense, deleteDepense, getDepense, rejectDepense } from '../services/depenses';
import { downloadAndSharePdf } from '../services/pdf';
import { showError, showSuccess } from '../utils/notify';

import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'DepenseDetail'>;

function badgeColor(status: string) {
  const st = String(status || '').toUpperCase();
  if (st === 'VALIDEE') return '#16a34a';
  if (st === 'REJETEE') return '#dc2626';
  if (st === 'ANNULEE') return '#6b7280';
  return '#f59e0b';
}

export default function DepenseDetailScreen({ route, navigation }: Props) {
  const theme = useTheme();
  const { token } = useApp();
  const access = useAccess();

  const id = route.params?.id;

  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState<any>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const d = await getDepense(id, token);
      setItem(d);
    } catch (e: any) {
      showError('Erreur', e?.message || 'Impossible de charger la dépense');
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const status = useMemo(() => String(item?.status || ''), [item]);
  const isPending = useMemo(() => String(status).toUpperCase() === 'EN_ATTENTE', [status]);
  const isValidated = useMemo(() => String(status).toUpperCase() === 'VALIDEE', [status]);

  const canEditOrDelete = access.depensesCreate && isPending;
  const canValidate = access.depensesValidation && isPending;
  const canReject = access.depensesValidation && isPending;
  const canCancel = access.depensesAnnulation && isValidated;

  if (!token) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
        <Text style={{ color: theme.text }}>Non authentifié</Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.background }} contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: theme.text, fontSize: 18, fontWeight: '900' }}>
          {item?.reference || `Dépense #${id}`}
        </Text>
        <View style={{ backgroundColor: badgeColor(status), paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }}>
          <Text style={{ color: '#fff', fontWeight: '900', fontSize: 12 }}>{String(status || '—').toUpperCase()}</Text>
        </View>
      </View>

      {loading ? (
        <View style={{ marginTop: 16 }}>
          <ActivityIndicator />
        </View>
      ) : (
        <>
          {!!item?.libelle && <Text style={{ marginTop: 10, color: theme.muted }}>{item.libelle}</Text>}

          <View style={{ marginTop: 12, backgroundColor: theme.card, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: theme.isDark ? '#1f2937' : '#e5e7eb' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: theme.muted }}>Montant</Text>
              <Text style={{ color: theme.text, fontWeight: '900' }}>{item?.montant ?? '—'} {item?.deviseSymbole || ''}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
              <Text style={{ color: theme.muted }}>Caisse</Text>
              <Text style={{ color: theme.text, fontWeight: '900' }}>{item?.referenceCaisse || '—'}</Text>
            </View>
            {!!item?.note && (
              <>
                <Text style={{ color: theme.muted, marginTop: 10 }}>Note</Text>
                <Text style={{ color: theme.text, marginTop: 4 }}>{String(item.note)}</Text>
              </>
            )}
          </View>

          <View style={{ marginTop: 12, flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
            <Pressable
              onPress={async () => {
                try {
                  await downloadAndSharePdf({
                    apiPath: `depenses/${id}/pdf`,
                    token,
                    filename: `depense_${item?.reference || id}.pdf`,
                  });
                } catch (e: any) {
                  showError('Erreur', e?.message || 'PDF impossible');
                }
              }}
              style={{ backgroundColor: theme.primary, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}
            >
              <MaterialCommunityIcons name="file-pdf-box" size={18} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '900' }}>PDF</Text>
            </Pressable>

            {canValidate ? (
              <Pressable
                onPress={() => navigation.navigate('DepenseValidate', { id })}
                style={{ backgroundColor: '#16a34a', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}
              >
                <MaterialCommunityIcons name="check-circle" size={18} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '900' }}>Valider</Text>
              </Pressable>
            ) : null}

            {canReject ? (
              <Pressable
                onPress={() => {
                  Alert.alert('Rejeter', 'Rejeter cette dépense ?', [
                    { text: 'Annuler', style: 'cancel' },
                    {
                      text: 'Rejeter',
                      style: 'destructive',
                      onPress: async () => {
                        try {
                          await rejectDepense(id, token);
                          showSuccess('Succès', 'Dépense rejetée');
                          load();
                        } catch (e: any) {
                          showError('Erreur', e?.message || 'Rejet échoué');
                        }
                      },
                    },
                  ]);
                }}
                style={{ backgroundColor: '#dc2626', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}
              >
                <MaterialCommunityIcons name="close-circle" size={18} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '900' }}>Rejeter</Text>
              </Pressable>
            ) : null}

            {canCancel ? (
              <Pressable
                onPress={() => {
                  Alert.alert('Annuler', 'Annuler cette dépense validée ? (cela recrédite la caisse)', [
                    { text: 'Retour', style: 'cancel' },
                    {
                      text: 'Annuler',
                      style: 'destructive',
                      onPress: async () => {
                        try {
                          await cancelDepense(id, { reason: 'Annulation dépense' }, token);
                          showSuccess('Succès', 'Dépense annulée');
                          load();
                        } catch (e: any) {
                          showError('Erreur', e?.message || 'Annulation échouée');
                        }
                      },
                    },
                  ]);
                }}
                style={{ backgroundColor: '#6b7280', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}
              >
                <MaterialCommunityIcons name="backup-restore" size={18} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '900' }}>Annuler</Text>
              </Pressable>
            ) : null}

            {canEditOrDelete ? (
              <Pressable
                onPress={() => navigation.navigate('DepenseForm', { mode: 'edit', id })}
                style={{ backgroundColor: theme.isDark ? '#374151' : '#111827', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}
              >
                <MaterialCommunityIcons name="pencil" size={18} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '900' }}>Modifier</Text>
              </Pressable>
            ) : null}

            {canEditOrDelete ? (
              <Pressable
                onPress={() => {
                  Alert.alert('Supprimer', 'Supprimer cette dépense ? (uniquement EN_ATTENTE)', [
                    { text: 'Annuler', style: 'cancel' },
                    {
                      text: 'Supprimer',
                      style: 'destructive',
                      onPress: async () => {
                        try {
                          await deleteDepense(id, token);
                          showSuccess('Succès', 'Dépense supprimée');
                          navigation.goBack();
                        } catch (e: any) {
                          showError('Erreur', e?.message || 'Suppression échouée');
                        }
                      },
                    },
                  ]);
                }}
                style={{ backgroundColor: '#7f1d1d', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}
              >
                <MaterialCommunityIcons name="trash-can" size={18} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '900' }}>Supprimer</Text>
              </Pressable>
            ) : null}
          </View>
        </>
      )}
    </ScrollView>
  );
}
