
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Pressable, FlatList, Image } from 'react-native';
import { useApp } from '../store/AppContext';
import { fetchCurrentUser } from '../services/auth';

export default function DashboardScreen({ navigation }: any) {
  const { token, boutiqueId } = useApp();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [overview, setOverview] = useState<any>(null);
  const [cashTotal, setCashTotal] = useState<number | null>(null);
  const [stockValue, setStockValue] = useState<number | null>(null);
  const [recent, setRecent] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!token) return;
      setLoading(true);
      setError(null);
      try {
        // fetch profile + overview + movements + cashier totals + stock value in parallel
        const profileP = fetchCurrentUser(token).catch((e:any)=>({}));

        const overviewP = fetch(`${process.env.API_BASE_URL || 'http://localhost:8080'}/api/dashboard/overview?shopId=${boutiqueId || ''}`, {
          headers: { Authorization: `Bearer ${token}` }
        }).then(r => r.ok ? r.json() : Promise.reject(new Error('Erreur overview'))).catch(()=>null);

        const movementsP = fetch(`${process.env.API_BASE_URL || 'http://localhost:8080'}/api/mouvements/search?page=1&size=5`, {
          headers: { Authorization: `Bearer ${token}` }
        }).then(r => r.ok ? r.json() : Promise.reject(new Error('Erreur mouvements'))).catch(()=>({ items: [] }));

        const cashierP = fetch(`${process.env.API_BASE_URL || 'http://localhost:8080'}/api/dashboard/cashier/totals?shopId=${boutiqueId || ''}`, {
          headers: { Authorization: `Bearer ${token}` }
        }).then(r => r.ok ? r.json() : Promise.reject(new Error('Erreur caisse'))).catch(()=>null);

        const stockP = fetch(`${process.env.API_BASE_URL || 'http://localhost:8080'}/api/rapports/valeur-stock?boutique=${boutiqueId || ''}`, {
          headers: { Authorization: `Bearer ${token}` }
        }).then(r => r.ok ? r.json() : Promise.reject(new Error('Erreur stock'))).catch(()=>null);

        const res = await Promise.all([profileP, overviewP, movementsP, cashierP, stockP]);
        const [p, ov, mv, ct, sv] = res as any[];
        if (!mounted) return;
        setProfile(p?.user || p);
        setOverview(ov);
        setRecent(mv?.items || mv || []);

        // Cash totals: ensure we handle unknown safely and produce a number
        if (ct && typeof ct === 'object') {
          const cashTotals = ct as Record<string, any>;
          const sum = Object.values(cashTotals).reduce((acc: number, v: any) => acc + (Number(v) || 0), 0);
          setCashTotal(sum);
        } else {
          setCashTotal(null);
        }

        // Stock value: coerce to number when present, otherwise null
        if (sv && typeof sv === 'object' && 'valeurTotale' in sv) {
          const raw = (sv as any).valeurTotale;
          const v = Number(raw);
          setStockValue(Number.isFinite(v) ? v : null);
        } else {
          setStockValue(null);
        }
      } catch (e: any) {
        setError(e?.message || 'Erreur chargement');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [token, boutiqueId]);

  const fmt = (n: number | null | undefined) => n == null ? '—' : new Intl.NumberFormat('fr-FR').format(n);
  const fmtMoney = (n: number | null | undefined) => n == null ? '—' : new Intl.NumberFormat('fr-FR').format(n) + ' FCFA';

  const hasRole = (r: string) => (profile?.roles || []).some((x: any) => (x.name || x).toString().toUpperCase() === r.toUpperCase());

  if (!token) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Non authentifié</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: '#eee' }}>
        <View>
          <Text style={{ fontWeight: '700', fontSize: 18 }}>JÀGO DÁNAYA</Text>
          <Text style={{ color: '#666' }}>{profile?.boutique?.nom || 'Boutique'}</Text>
        </View>
        <Pressable onPress={() => navigation.navigate('Profil')} style={{ alignItems: 'center' }}>
          <Image source={require('../assets/logo.png')} style={{ width: 40, height: 40, borderRadius: 20 }} />
          {profile?.roles && profile.roles.length > 0 ? (
            <Text style={{ fontSize: 11, marginTop: 4, color: '#444' }}>{(profile.roles[0].name || profile.roles[0]).replace(/_/g,' ')}</Text>
          ) : null}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {loading && <ActivityIndicator style={{ marginTop: 12 }} />}
        {error ? <Text style={{ color: '#c0392b' }}>{error}</Text> : null}

        {/* KPI Cards */}
        <View style={{ gap: 12 }}>
          <View style={{ backgroundColor: '#fff', padding: 12, borderRadius: 8, shadowColor: '#000', shadowOpacity: 0.05, elevation: 2 }}>
            <Text style={{ color: '#666', marginBottom: 6 }}>Chiffre d'affaires du jour</Text>
            <Text style={{ fontSize: 20, fontWeight: '700' }}>{fmtMoney(overview?.salesToday)}</Text>
          </View>

          <View style={{ backgroundColor: '#fff', padding: 12, borderRadius: 8, shadowColor: '#000', shadowOpacity: 0.05, elevation: 2 }}>
            <Text style={{ color: '#666', marginBottom: 6 }}>Solde de la caisse</Text>
            <Text style={{ fontSize: 20, fontWeight: '700' }}>{fmtMoney(cashTotal)}</Text>
          </View>

          <View style={{ backgroundColor: '#fff', padding: 12, borderRadius: 8, shadowColor: '#000', shadowOpacity: 0.05, elevation: 2 }}>
            <Text style={{ color: '#666', marginBottom: 6 }}>Nombre de ventes du jour</Text>
            <Text style={{ fontSize: 20, fontWeight: '700' }}>{fmt((() => {
              // Prefer explicit salesToday if present, otherwise fallback to last element of sales7d
              if (overview == null) return null;
              if (typeof overview.salesToday === 'number') return overview.salesToday;
              if (Array.isArray(overview.sales7d) && overview.sales7d.length > 0) {
                const last = overview.sales7d[overview.sales7d.length - 1];
                return (typeof last === 'number') ? last : (typeof last === 'string' && last !== '' ? Number(last) : null);
              }
              return null;
            })())}</Text>
            <Text style={{ color: '#999', marginTop: 6, fontSize: 12 }}>Basé sur les ventes journalières</Text>
          </View>

          <View style={{ backgroundColor: '#fff', padding: 12, borderRadius: 8, shadowColor: '#000', shadowOpacity: 0.05, elevation: 2 }}>
            <Text style={{ color: '#666', marginBottom: 6 }}>Valeur du stock</Text>
            <Text style={{ fontSize: 20, fontWeight: '700' }}>{fmtMoney(stockValue)}</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={{ marginTop: 16 }}>
          <Text style={{ fontWeight: '700', marginBottom: 8 }}>Actions rapides</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' as any }}>
            <Pressable onPress={() => navigation.navigate('VenteEspece')} style={{ backgroundColor: '#22c55e', padding: 14, borderRadius: 8, width: '48%', marginBottom: 8 }}>
              <Text style={{ color: '#fff', fontWeight: '700', textAlign: 'center' }}>Vente en espèces</Text>
            </Pressable>

            <Pressable onPress={() => navigation.navigate('Caisse')} style={{ backgroundColor: '#0ea5e9', padding: 14, borderRadius: 8, width: '48%', marginBottom: 8 }}>
              <Text style={{ color: '#fff', fontWeight: '700', textAlign: 'center' }}>Caisse</Text>
            </Pressable>

            <Pressable onPress={() => navigation.navigate('StockInventaire')} style={{ backgroundColor: '#f59e0b', padding: 14, borderRadius: 8, width: '48%', marginBottom: 8 }}>
              <Text style={{ color: '#fff', fontWeight: '700', textAlign: 'center' }}>Stock</Text>
            </Pressable>

            {/* Inventory - show only for managers/magasinier */}
            { (hasRole('MAGASINIER') || hasRole('GERANT') || hasRole('PROPRIETAIRE')) && (
              <Pressable onPress={() => navigation.navigate('StockInventaire')} style={{ backgroundColor: '#7c3aed', padding: 14, borderRadius: 8, width: '48%', marginBottom: 8 }}>
                <Text style={{ color: '#fff', fontWeight: '700', textAlign: 'center' }}>Inventaire</Text>
              </Pressable>
            )}

            {/* Transfer - only for magasinier / gerant */}
            { (hasRole('MAGASINIER') || hasRole('GERANT')) && (
              <Pressable onPress={() => navigation.navigate('Produits')} style={{ backgroundColor: '#ef4444', padding: 14, borderRadius: 8, width: '48%', marginBottom: 8 }}>
                <Text style={{ color: '#fff', fontWeight: '700', textAlign: 'center' }}>Transfert</Text>
              </Pressable>
            )}

          </View>
        </View>

        {/* Recent Activity */}
        <View style={{ marginTop: 20 }}>
          <Text style={{ fontWeight: '700', marginBottom: 8 }}>Activité récente</Text>
          {recent.length === 0 ? (
            <Text style={{ color: '#666' }}>Aucune activité récente</Text>
          ) : (
            <FlatList
              data={recent}
              keyExtractor={(it:any) => String(it.id)}
              renderItem={({ item }) => (
                <View style={{ backgroundColor: '#fff', padding: 12, borderRadius: 8, marginBottom: 8 }}>
                  <Text style={{ fontWeight: '600' }}>{item.typeMouvement} {item.sousType ? `· ${item.sousType}` : ''}</Text>
                  <Text style={{ color: '#666', fontSize: 12 }}>{item.dateMouvement}</Text>
                  {item.montant ? <Text style={{ marginTop: 6, fontWeight: '700' }}>{fmtMoney(item.montant)}</Text> : null}
                  {item.produit ? <Text style={{ color: '#444', marginTop: 6 }}>{item.produit.nomProduit}</Text> : null}
                </View>
              )}
            />
          )}
        </View>

      </ScrollView>
    </View>
  );
}
