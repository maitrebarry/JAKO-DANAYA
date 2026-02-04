import React, { useEffect, useState } from 'react';
import { View, Text, Image, ActivityIndicator, ScrollView, Pressable, Modal, TouchableOpacity } from 'react-native';
import { useApp } from '../store/AppContext';
import { showError, showSuccess } from '../utils/notify';
import { fetchProduit, deleteProduit } from '../services/produit';
import { useTheme } from '../theme';
import { resolveMediaUrl } from '../utils/urls';

export default function ProductDetailScreen({ route, navigation }: any) {
  const { token } = useApp();
  const theme = useTheme();
  const id = route.params?.id;
  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<any>(null);

  // header back
  const BackHeader = require('../components/BackHeader').default;

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const p = await fetchProduit(id, token as string);
        setProduct(p);
      } catch (e:any) {
        showError('Erreur', e.message || 'Impossible de charger le produit');
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const onDelete = () => setShowDeleteModal(true);

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await deleteProduit(id, token as string);
      setShowDeleteModal(false);
      setSuccessMsg('Produit supprimé avec succès');      showSuccess('Succès', 'Produit supprimé avec succès');      // show success briefly then go back
      setTimeout(() => {
        setSuccessMsg(null);
        navigation.goBack();
      }, 1400);
    } catch (e:any) {
      setShowDeleteModal(false);
      showError('Erreur', e.message || 'Suppression impossible');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <BackHeader title="Produit" />
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator color={theme.primary} /></View>
    </View>
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.background }}>
      <BackHeader title={product?.nomProduit || 'Produit'} />

      {/* Success banner */}
      {successMsg ? (
        <View style={{ backgroundColor: '#10b981', padding: 10, margin: 12, borderRadius: 8 }}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>{successMsg}</Text>
        </View>
      ) : null}

      <View style={{ padding: 16 }}>
        {product?.productImage ? (() => { const imgUrl = resolveMediaUrl(product.productImage); console.debug('Product detail image URL:', imgUrl); return <Image source={{ uri: imgUrl }} style={{ width: '100%', height: 220, borderRadius: 8, marginBottom: 12 }} /> })() : null}
        <Text style={{ color: theme.text, fontSize: 20, fontWeight: '800' }}>{product?.nomProduit}</Text>
      <Text style={{ color: theme.muted, marginTop: 6 }}>{product?.caracteristique}</Text>

      <View style={{ marginTop: 14 }}>
        <Text style={{ color: theme.muted }}>Prix détail</Text>
        <Text style={{ color: theme.text, fontWeight: '700' }}>{product?.prixDetail ?? '—'} FCFA</Text>
      </View>

      <View style={{ marginTop: 12 }}>
        <Text style={{ color: theme.muted }}>Unité de conditionnement</Text>
        <Text style={{ color: theme.text, fontWeight: '700' }}>{product?.unite?.libelle ? `${product.unite.libelle} (${product.nombreUnitesParConditionnement ?? 1} unités)` : 'Unité de base'}</Text>

        <Text style={{ color: theme.muted, marginTop: 8 }}>Quantité initiale</Text>
        <Text style={{ color: theme.text, fontWeight: '700' }}>
          {product?.quantiteInitialeConditionnements ?? '—'} {product?.unite?.libelle ? `${product.unite.libelle.toLowerCase()}(s)` : ''}
          {product?.unite?.libelle ? ` (= ${ (Number(product.quantiteInitialeConditionnements || 0) * Number(product.nombreUnitesParConditionnement || 1)) } unités)` : ` (= ${product?.quantiteInitialeConditionnements ?? '—'} unités)`}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', marginTop: 18, gap: 8 }}>
        <Pressable onPress={() => navigation.navigate('ProductForm', { mode: 'edit', id })} style={{ padding: 12, backgroundColor: theme.primary, borderRadius: 8 }}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>Modifier</Text>
        </Pressable>
        <Pressable onPress={onDelete} style={{ padding: 12, backgroundColor: '#ef4444', borderRadius: 8 }}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>Supprimer</Text>
        </Pressable>
      </View>

      {/* Delete confirmation modal (sweet-like) */}
      <Modal visible={showDeleteModal} transparent animationType="fade" onRequestClose={() => setShowDeleteModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ width: '86%', backgroundColor: theme.surface, padding: 16, borderRadius: 10 }}>
            <Text style={{ fontWeight: '800', color: theme.text, fontSize: 18 }}>Confirmer la suppression</Text>
            <Text style={{ color: theme.muted, marginTop: 8 }}>Voulez-vous vraiment supprimer ce produit ? Cette action est irréversible.</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <TouchableOpacity onPress={() => setShowDeleteModal(false)} style={{ paddingVertical: 10, paddingHorizontal: 12, borderRadius: 6 }}>
                <Text style={{ color: theme.text }}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={confirmDelete} disabled={deleting} style={{ paddingVertical: 10, paddingHorizontal: 12, borderRadius: 6, backgroundColor: '#ef4444' }}>
                <Text style={{ color: '#fff' }}>{deleting ? 'Suppression...' : 'Supprimer'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      </View>
    </ScrollView>
  );
}
