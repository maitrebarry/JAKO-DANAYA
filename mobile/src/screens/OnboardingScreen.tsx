import React, { useRef, useState } from 'react';
import { View, Text, Pressable, FlatList, useWindowDimensions, StatusBar, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { setItem } from '../utils/storage';

const ONBOARDING_SEEN_KEY = 'jd_onboarding_seen';

type Slide = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  gradient: [string, string];
  title: string;
  description: string;
};

const SLIDES: Slide[] = [
  {
    key: 'produits',
    icon: 'cube-outline',
    gradient: ['#38bdf8', '#0369a1'],
    title: 'Produits & Stock',
    description: "Gérez vos produits, vos prix et suivez votre stock en temps réel, boutique par boutique.",
  },
  {
    key: 'ventes',
    icon: 'cart-outline',
    gradient: ['#4ade80', '#15803d'],
    title: 'Ventes & Caisse',
    description: "Enregistrez vos ventes en espèces ou sur commande, et suivez votre caisse au quotidien.",
  },
  {
    key: 'rapports',
    icon: 'bar-chart-outline',
    gradient: ['#fbbf24', '#b45309'],
    title: 'Rapports & Historique',
    description: "Consultez vos rapports de ventes, de stock et l'historique complet de votre activité.",
  },
  {
    key: 'boutiques',
    icon: 'business-outline',
    gradient: ['#818cf8', '#3730a3'],
    title: 'Multi-boutiques',
    description: "Gérez plusieurs boutiques et magasins depuis une seule et même application.",
  },
];

export default function OnboardingScreen() {
  const navigation = useNavigation<any>();
  const { width, height } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<FlatList>(null);

  const goToLogin = () => {
    setItem(ONBOARDING_SEEN_KEY, '1');
    navigation.navigate('Login');
  };

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / width);
    setActiveIndex(idx);
  };

  const imageHeight = Math.round(height * 0.6);

  return (
    <View style={{ flex: 1, backgroundColor: '#14161a' }}>
      <StatusBar barStyle="light-content" />
      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(s) => s.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        renderItem={({ item }) => (
          <View style={{ width, height }}>
            <LinearGradient
              colors={item.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ width, height: imageHeight, alignItems: 'center', justifyContent: 'center' }}
            >
              <View
                style={{
                  width: 160,
                  height: 160,
                  borderRadius: 80,
                  backgroundColor: 'rgba(255,255,255,0.18)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name={item.icon} size={84} color="#fff" />
              </View>
            </LinearGradient>

            <View
              style={{
                flex: 1,
                backgroundColor: '#14161a',
                marginTop: -28,
                borderTopLeftRadius: 32,
                borderTopRightRadius: 32,
                paddingHorizontal: 24,
                paddingTop: 32,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 24, fontWeight: '800' }}>{item.title}</Text>
              <Text style={{ color: '#9ca3af', fontSize: 15, lineHeight: 22, marginTop: 12 }}>{item.description}</Text>

              <View style={{ flex: 1 }} />

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 36 }}>
                <View style={{ flexDirection: 'row', gap: 8 as any }}>
                  {SLIDES.map((s, i) => (
                    <View
                      key={s.key}
                      style={{
                        width: i === activeIndex ? 22 : 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: i === activeIndex ? '#0ea5e9' : '#3f3f46',
                      }}
                    />
                  ))}
                </View>

                <Pressable
                  onPress={goToLogin}
                  style={{ backgroundColor: '#0ea5e9', paddingVertical: 14, paddingHorizontal: 28, borderRadius: 999 }}
                >
                  <Text style={{ color: '#fff', fontWeight: '800' }}>Connexion</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      />
    </View>
  );
}

export { ONBOARDING_SEEN_KEY };
