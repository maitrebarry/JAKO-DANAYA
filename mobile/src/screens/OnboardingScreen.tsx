import React, { useState } from 'react';
import { View, Text, Pressable, FlatList, Image, ImageSourcePropType, useWindowDimensions, StatusBar, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { setItem } from '../utils/storage';

const ONBOARDING_SEEN_KEY = 'jd_onboarding_seen';

type Slide = {
  key: string;
  image: ImageSourcePropType;
  title: string;
  description: string;
};

const SLIDES: Slide[] = [
  {
    key: 'produits',
    image: require('../assets/onboarding/onboarding-produits.jpg'),
    title: 'Produits & Stock',
    description: "Gérez vos produits, vos prix et suivez votre stock en temps réel, boutique par boutique.",
  },
  {
    key: 'ventes',
    image: require('../assets/onboarding/onboarding-ventes.jpg'),
    title: 'Ventes & Caisse',
    description: "Enregistrez vos ventes en espèces ou sur commande, et suivez votre caisse au quotidien.",
  },
  {
    key: 'rapports',
    image: require('../assets/onboarding/onboarding-rapports.jpg'),
    title: 'Rapports & Historique',
    description: "Consultez vos rapports de ventes, de stock et l'historique complet de votre activité.",
  },
  {
    key: 'boutiques',
    image: require('../assets/onboarding/onboarding-boutiques.jpg'),
    title: 'Multi-boutiques',
    description: "Gérez plusieurs boutiques et magasins depuis une seule et même application.",
  },
];

export default function OnboardingScreen() {
  const navigation = useNavigation<any>();
  const { width, height } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(0);

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
        data={SLIDES}
        keyExtractor={(s) => s.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        renderItem={({ item }) => (
          <View style={{ width, height }}>
            <View style={{ width, height: imageHeight }}>
              <Image source={item.image} style={{ width, height: imageHeight }} resizeMode="cover" />
              <LinearGradient
                colors={['transparent', 'rgba(20,22,26,0.9)', '#14161a']}
                style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 90 }}
              />
            </View>

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
