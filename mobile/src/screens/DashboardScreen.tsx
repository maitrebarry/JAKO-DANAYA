
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Pressable, FlatList, Image, RefreshControl, Animated, Alert } from 'react-native';
import { useApp } from '../store/AppContext';
import { fetchCurrentUser } from '../services/auth';
import { API_BASE_URL } from '../utils/env';
import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { useAccess } from '../utils/access';
import { mergeAuthMeResponse } from '../utils/profile';
import { useFormatMoney } from '../utils/currency';

export default function DashboardScreen({ navigation }: any) {
  const { token, boutiqueId, profile, setProfile } = useApp();
  const theme = useTheme();
  const isDark = (theme as any).isDark;
  const access = useAccess();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [overview, setOverview] = useState<any>(null);
  const [dashPayload, setDashPayload] = useState<any>(null);
  const [cashTotal, setCashTotal] = useState<number | null>(null);
  const [stockValue, setStockValue] = useState<number | null>(null);
  const [recent, setRecent] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const load = async () => {
    if (!token) return;
    if (!access.dashboard) return;
    setError(null);
    try {
      if (!refreshing) setLoading(true);
      // fetch profile + overview + movements + cashier totals + stock value in parallel
      const profileP = fetchCurrentUser(token).catch((e:any)=>({}));

      const overviewP = fetch(`${API_BASE_URL}/api/dashboard/overview?shopId=${boutiqueId || ''}`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(r => r.ok ? r.json() : Promise.reject(new Error('Erreur overview'))).catch(()=>null);

      const movementsP = fetch(`${API_BASE_URL}/api/mouvements/search?page=1&size=5`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(r => r.ok ? r.json() : Promise.reject(new Error('Erreur mouvements'))).catch(()=>({ items: [] }));

      const cashierP = fetch(`${API_BASE_URL}/api/dashboard/cashier/totals?shopId=${boutiqueId || ''}`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(r => r.ok ? r.json() : Promise.reject(new Error('Erreur caisse'))).catch(()=>null);

      const stockP = fetch(`${API_BASE_URL}/api/rapports/valeur-stock?boutique=${boutiqueId || ''}`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(r => r.ok ? r.json() : Promise.reject(new Error('Erreur stock'))).catch(()=>null);

      const res = await Promise.all([profileP, overviewP, movementsP, cashierP, stockP]);
      const [p, ov, mv, ct, sv] = res as any[];

      // store profile in global context so TopBar and permission gating stay correct
      setProfile(mergeAuthMeResponse(p));
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

      // debug: log raw responses to console so we can compare mobile vs web
      try {
        console.log('DASHBOARD_RAW', { boutiqueId, overview: ov, movements: mv, cashier: ct, stock: sv });
      } catch (e) { /* ignore */ }

      // Also try the web-owned endpoint used by the web app (/dashboard/shops/:id/overview)
      try {
        // Always call the role-aware dashboard payload endpoint (without shopId for superadmin/global view, with shopId when provided)
        const dashUrl = boutiqueId != null ? `${API_BASE_URL}/api/dashboard?shopId=${boutiqueId}` : `${API_BASE_URL}/api/dashboard`;
        const dashRes = await fetch(dashUrl, { headers: { Authorization: `Bearer ${token}` } });
        const dashPayload = dashRes.ok ? await dashRes.json() : null;
        try { console.log('DASHBOARD_PAYLOAD', { dashUrl, dashPayload }); } catch (e) {}

        // store payload globally for role-specific rendering
        if (dashPayload) setDashPayload(dashPayload);

        if (dashPayload && dashPayload.widgets) {
          // Try resume_caisse (detailed payments) first for cash total
          const resume = dashPayload.widgets['resume_caisse'] || dashPayload.widgets['resumeCaisse'];
          if (resume && typeof resume === 'object') {
            const pc = Number(resume['paiements_complets'] || resume['paiementsComplets'] || 0);
            const pp = Number(resume['paiements_partiels'] || resume['paiementsPartiels'] || 0);
            const totalPayments = (Number.isFinite(pc) ? pc : 0) + (Number.isFinite(pp) ? pp : 0);
            if (!Number.isNaN(totalPayments)) setCashTotal(totalPayments);
          } else {
            // Fallback: widget may directly expose a numeric solde
            const soldeKeys = ['solde_caisse','caisse_total','balance_caisse','soldeCaisse'];
            for (const k of soldeKeys) {
              if (dashPayload.widgets[k] != null && !isNaN(Number(dashPayload.widgets[k]))) {
                setCashTotal(Number(dashPayload.widgets[k]));
                break;
              }
            }
          }

          // Use valeur_stock if present
          const vs = dashPayload.widgets['valeur_stock'];
          if (vs != null) {
            const vnum = Number(vs as any);
            if (Number.isFinite(vnum)) setStockValue(vnum);
          }

          // Ensure we pick salesToday from several possible widget names and always set overview.salesToday if available
          const salesKeys = ['ventes_jour','vente_jour','ventess_jour','salesToday','sales_today','chiffre_affaires_jour'];
          let salesTodayVal: any = null;
          for (const k of salesKeys) {
            if (dashPayload.widgets[k] != null) { salesTodayVal = dashPayload.widgets[k]; break; }
          }
          if (salesTodayVal != null && !isNaN(Number(salesTodayVal))) {
            setOverview((prev:any) => ({ ...(prev||{}), salesToday: Number(salesTodayVal) }));
          }

          // Map other common widgets into overview-like fields when appropriate
          const mapped: any = {};
          if (!ov && dashPayload.widgets['chiffre_affaires_total'] != null) mapped.salesTotal = dashPayload.widgets['chiffre_affaires_total'];
          if (dashPayload.widgets['evolution_ventes'] && dashPayload.widgets['evolution_ventes'].sales7d) mapped.sales7d = dashPayload.widgets['evolution_ventes'].sales7d;
          if (Object.keys(mapped).length > 0 && !ov) setOverview(mapped);

          try { console.log('DASHBOARD_MAPPED', { salesTodayVal, widgets: Object.keys(dashPayload.widgets) }); } catch (e) {}
        }

        // Backwards-compatible owner overview endpoint (older web code) if boutiqueId provided
        if (boutiqueId != null) {
          const ownerRes = await fetch(`${API_BASE_URL}/api/dashboard/shops/${boutiqueId}/overview`, { headers: { Authorization: `Bearer ${token}` } });
          const ownerOverview = ownerRes.ok ? await ownerRes.json() : null;
          try { console.log('DASHBOARD_OWNER_OVERVIEW', ownerOverview); } catch (e) {}
          if (!ov && ownerOverview) setOverview(ownerOverview as any);
        }
      } catch (e) { console.warn('dashboard payload fetch failed', e); }

      // animate cards in
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
    } catch (e: any) {
      setError(e?.message || 'Erreur chargement');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    if (!token) return;
    if (!access.dashboard) return;
    // initial animation start at 0
    fadeAnim.setValue(0);
    load();
    return () => { mounted = false; };
  }, [token, boutiqueId, access.dashboard]);

  const onRefresh = () => {
    if (!token) return;
    if (!access.dashboard) return;
    setRefreshing(true);
    load();
  }

  const fmt = (n: number | null | undefined) => n == null ? '—' : new Intl.NumberFormat('fr-FR').format(n);
  const fmtMoney = useFormatMoney();

  const annualTurnover = (() => {
    const bv = dashPayload?.widgets?.bilan_ventes || null;
    if (bv) {
      const annualTotal = Number((bv as any).annualTotal ?? (bv as any).annual_total ?? NaN);
      const annualCash = Number((bv as any).annualCash ?? (bv as any).annual_cash ?? 0);
      const annualCredit = Number((bv as any).annualCredit ?? (bv as any).annual_credit ?? 0);
      if (Number.isFinite(annualTotal)) return annualTotal;
      const cash = Number.isFinite(annualCash) ? annualCash : 0;
      const credit = Number.isFinite(annualCredit) ? annualCredit : 0;
      return cash + credit;
    }
    const fallback = Number(overview?.salesTotal ?? NaN);
    return Number.isFinite(fallback) ? fallback : null;
  })();

  const formatMovementDate = (d: any) => {
    if (!d) return '';
    let dt = new Date(d);
    if (isNaN(dt.getTime())) {
      // try numeric timestamp
      const asNum = Number(d);
      if (!isNaN(asNum)) dt = new Date(asNum);
    }
    if (isNaN(dt.getTime())) return '';
    return dt.toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
  };

  const hasRole = (r: string) => (profile?.roles || []).some((x: any) => (x.name || x).toString().toUpperCase() === r.toUpperCase());

  // Role-based activity filtering (synthetic view)
  const movementLabel = (m: any) => {
    if (!m) return '';
    const t = (m.sousType && m.sousType !== '') ? `${m.typeMouvement} · ${m.sousType}` : m.typeMouvement;
    const map: Record<string,string> = {
      VENTE: 'Vente', PAIEMENT: 'Paiement', RECEPTION: 'Réception', TRANSFERT: 'Transfert', CAISSE: 'Caisse', SORTIE: 'Sortie', ENTREE: 'Entrée', COMMANDE: 'Commande', AJUSTEMENT: 'Ajustement', UTILISATION: 'Utilisation'
    };
    return map[m.typeMouvement] || t;
  };

  const movementIcon = (m: any) => {
    const t = (m && m.typeMouvement) ? m.typeMouvement.toUpperCase() : '';
    if (t === 'VENTE' || t === 'SORTIE') return 'cart';
    if (t === 'PAIEMENT' || t === 'CAISSE') return 'cash';
    if (t === 'RECEPTION' || t === 'ENTREE') return 'truck-delivery';
    if (t === 'TRANSFERT') return 'transfer-right';
    if (t === 'UTILISATION' || t === 'AJUSTEMENT') return 'clipboard-list';
    return 'history';
  };

  // Global allowed recent movement types (simple, consistent with web)
  const RECENT_ALLOWED = ['VENTE','RECEPTION','TRANSFERT','AJUSTEMENT','UTILISATION','SORTIE','ENTREE','PAIEMENT','COMMANDE'];
  const filteredRecent = (() => {
    const list = Array.isArray(recent) ? recent : [];
    const filtered = list.filter((it:any) => RECENT_ALLOWED.includes((it.typeMouvement || '').toString().toUpperCase()));
    return filtered.slice(0, 5);
  })();

  if (!token) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Non authentifié</Text>
      </View>
    );
  }

  if (token && !access.dashboard) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background, padding: 16 }}>
        <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text }}>Dashboard</Text>
        <Text style={{ marginTop: 8, color: theme.muted, textAlign: 'center' }}>
          Vous n'avez pas la permission d'accéder au tableau de bord.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>


      <ScrollView contentContainerStyle={{ padding: 16, backgroundColor: theme.background }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.primary]} /> }>
        {loading && <ActivityIndicator style={{ marginTop: 12 }} color={theme.primary} />}
        {error ? <Text style={{ color: theme.danger }}>{error}</Text> : null}



        {/* KPI Cards */}
        <Animated.View style={{ gap: 12, opacity: fadeAnim }}>
          <View style={{ backgroundColor: theme.surface, padding: 14, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 3 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="bar-chart" size={28} color={theme.primary} />
              <View style={{ marginLeft: 10 }}>
                <Text style={{ color: theme.primary }}>Chiffre d'affaires annuel</Text>
                <Text style={{ fontSize: 20, fontWeight: '800', color: theme.text }}>{fmtMoney(annualTurnover)}</Text>
              </View>
            </View>
            {/* Mini sparkline for last 7d */}
            {overview?.sales7d && Array.isArray(overview.sales7d) ? (
              <View style={{ width: 120, height: 36, marginLeft: 12, flexDirection: 'row', alignItems: 'flex-end' }}>
                {overview.sales7d.slice(-7).map((v:any, idx:number) => {
                  const num = typeof v === 'number' ? v : (v === null || v === '' ? 0 : Number(v));
                  const arr = overview.sales7d.slice(-7).map((x:any) => Number(x) || 0);
                  const max = Math.max(...arr, 1);
                  const height = Math.max(3, Math.round((num / max) * 32));
                  return <View key={idx} style={{ flex: 1, marginHorizontal: 2, height, backgroundColor: '#0369a1', borderRadius: 2 }} />;
                })}
              </View>
            ) : null}
          </View>

          <View style={{ backgroundColor: isDark ? '#083129' : '#ecfdf5', padding: 14, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 3 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialIcons name="account-balance-wallet" size={28} color={isDark ? '#34d399' : '#059669'} />
              <View style={{ marginLeft: 10 }}>
                <Text style={{ color: isDark ? '#34d399' : '#059669' }}>Solde de la caisse journalière</Text>
                <Text style={{ fontSize: 20, fontWeight: '800', color: theme.text }}>{fmtMoney(cashTotal)}</Text>
              </View>
            </View>
          </View>

          <View style={{ backgroundColor: theme.surface, padding: 14, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 3 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialCommunityIcons name="sale" size={28} color={theme.primary} />
              <View style={{ marginLeft: 10 }}>
                <Text style={{ color: theme.primary }}>Ventes du jour</Text>
                <Text style={{ fontSize: 20, fontWeight: '800', color: theme.text }}>{fmtMoney(overview?.salesToday)}</Text>
                {/* show number of commandes when resume_caisse exists in dashboard payload */}
                {dashPayload && dashPayload.widgets && dashPayload.widgets['resume_caisse'] && (dashPayload.widgets['resume_caisse'].total_commandes != null || dashPayload.widgets['resume_caisse'].totalCommandes != null) ? (
                  <Text style={{ color: theme.muted, marginTop: 6, fontSize: 13 }}>{String(dashPayload.widgets['resume_caisse'].total_commandes ?? dashPayload.widgets['resume_caisse'].totalCommandes ?? 0)} ventes</Text>
                ) : null}
                <Text style={{ color: theme.muted, marginTop: 6, fontSize: 12 }}>Montant total des ventes enregistrées aujourd'hui</Text>
              </View>
            </View>
          </View>

          <View style={{ backgroundColor: theme.surface, padding: 14, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 3 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialCommunityIcons name="warehouse" size={28} color={theme.primary} />
              <View style={{ marginLeft: 10 }}>
                <Text style={{ color: theme.primary }}>Valeur du stock</Text>
                <Text style={{ fontSize: 20, fontWeight: '800', color: theme.text }}>{fmtMoney(stockValue)}</Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Action Buttons */}
        <View style={{ marginTop: 16 }}>
          <Text style={{ fontWeight: '700', marginBottom: 8, color: theme.text }}>Actions rapides</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' as any }}>
            {access.ventes ? (
              <Pressable onPress={() => navigation.navigate('VentesEspecesList')} style={{ backgroundColor: '#0ea5e9', padding: 14, borderRadius: 12, width: '48%', marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                <MaterialCommunityIcons name="format-list-bulleted" size={18} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '700', textAlign: 'center', marginLeft: 8 }}>Ventes espèces</Text>
              </Pressable>
            ) : null}

            {access.caisse ? (
              <Pressable onPress={() => navigation.navigate('Caisse')} style={{ backgroundColor: theme.primary, padding: 14, borderRadius: 12, width: '48%', marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                <MaterialIcons name="account-balance-wallet" size={18} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '700', textAlign: 'center', marginLeft: 8 }}>Caisse</Text>
              </Pressable>
            ) : null}

          </View>
        </View>

        {/* Recent Activity */}
        <View style={{ marginTop: 20 }}>
          <Text style={{ fontWeight: '700', marginBottom: 8, color: theme.text }}>Activité récente</Text>
          {filteredRecent.length === 0 ? (
            <Text style={{ color: theme.muted }}>Aucune activité récente</Text>
          ) : (
            <FlatList
              data={filteredRecent}
              keyExtractor={(it:any) => String(it.id)}
              renderItem={({ item }) => (
                <View style={{ backgroundColor: theme.card, padding: 12, borderRadius: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: 42, height: 42, backgroundColor: theme.surface, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                    <MaterialCommunityIcons name={movementIcon(item) as any} size={20} color={theme.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '600', color: theme.text }}>{movementLabel(item)}</Text>
                    <Text style={{ color: theme.muted, fontSize: 12 }}>{formatMovementDate(item.dateMouvement)}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    {item.montant ? <Text style={{ fontWeight: '800', color: theme.text }}>{fmtMoney(item.montant)}</Text> : null}
                    {item.produit ? <Text style={{ color: theme.muted, marginTop: 6 }}>{item.produit.nomProduit}</Text> : null}
                  </View>
                </View>
              )}
            />
          )}
        </View>

      </ScrollView>
    </View>
  );
}
