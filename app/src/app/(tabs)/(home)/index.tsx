import { getPopularTrails } from "@/api/trails";
import { locationResolvedAtom, userLocationAtom } from "@/atoms/location-atoms";
import HeroBanner from "@/components/home/hero-banner";
import MockNews from "@/components/mockNews";
import PagerCarouselSkeleton from "@/components/skeletons/pager-carousel-skeleton";
import PagerCarousel from "@/components/trail/pager-carousel";
import { SURFACE_BORDER_RADIUS } from "@/constants/constants";
import { guardedNavigate } from "@/utils/navigation";
import Ionicons from "@expo/vector-icons/Ionicons";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { useAtomValue } from "jotai";
import React, { useRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTheme } from "react-native-paper";
import { useTranslation } from "react-i18next";

export default function HomeScreen() {
  const scrollViewRef = useRef<ScrollView>(null);
  const theme = useTheme();
  const { t } = useTranslation();
  const userLocation = useAtomValue(userLocationAtom);
  const locationResolved = useAtomValue(locationResolvedAtom);
  const query = useQuery({
    queryKey: ["trails", "popular", userLocation?.latitude, userLocation?.longitude],
    queryFn: () => getPopularTrails(userLocation?.latitude, userLocation?.longitude),
    enabled: locationResolved,
    placeholderData: keepPreviousData,
  });

  // Scroll to top when screen is focused or bottomtab is pressed.
  useFocusEffect(
    React.useCallback(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
    }, []),
  );

  return (
    <ScrollView ref={scrollViewRef} contentContainerStyle={[s.container, { backgroundColor: theme.colors.background }]}>
      <HeroBanner lat={userLocation?.latitude} lon={userLocation?.longitude} />
      <View style={[s.section, { backgroundColor: theme.colors.background }]}>
        <View style={s.sectionHeader}>
          <Text style={[s.sectionTitle, { color: theme.colors.onBackground }]}>{t("home.popularNearYou")}</Text>
        </View>
        {query.data ? <PagerCarousel data={query.data} /> : <PagerCarouselSkeleton />}
      </View>

      <View style={s.cardRow}>
        <Pressable
          style={[s.guideCard, s.halfCard]}
          onPress={() => guardedNavigate(() => router.navigate("/(tabs)/(settings)/guide"))}
        >
          <Image source={require("../../../assets/images/guide_cover.jpg")} style={s.cardImage} contentFit="cover" />
          <View style={[s.cardText, { backgroundColor: theme.colors.surface }]}>
            <Text style={[s.cardTitle, { color: theme.colors.onSurface }]}>{t("home.guide")}</Text>
            <Text style={[s.cardSubtitle, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>
              {t("home.guideSubtitle")}
            </Text>
          </View>
        </Pressable>

        <Pressable
          style={[s.areasCard, s.halfCard]}
          onPress={() => guardedNavigate(() => router.navigate("/(tabs)/(home)/area/area-list-screen"))}
        >
          <View style={s.collage}>
            <View style={s.collageRow}>
              <Image
                source={require("../../../assets/images/area_cover1.jpg")}
                style={s.collageImage}
                contentFit="cover"
              />
              <Image
                source={require("../../../assets/images/area_cover2.jpg")}
                style={s.collageImage}
                contentFit="cover"
              />
            </View>
            <View style={s.collageRow}>
              <Image
                source={require("../../../assets/images/area_cover3.jpg")}
                style={s.collageImage}
                contentFit="cover"
              />
              <Image
                source={require("../../../assets/images/area_cover4.jpg")}
                style={s.collageImage}
                contentFit="cover"
              />
            </View>
          </View>
          <View style={[s.cardText, { backgroundColor: theme.colors.surface }]}>
            <Text style={[s.cardTitle, { color: theme.colors.onSurface }]}>{t("home.explore")}</Text>
            <Text style={[s.cardSubtitle, { color: theme.colors.onSurfaceVariant }]}>{t("home.exploreSubtitle")}</Text>
          </View>
        </Pressable>
      </View>

      <View style={[s.section, s.newsSection, { backgroundColor: theme.colors.surface }]}>
        <View style={s.sectionHeader}>
          <Ionicons name="newspaper-outline" size={20} color={theme.colors.onSurface} />
          <Text style={[s.sectionTitle, { color: theme.colors.onSurface }]}>{t("home.news")}</Text>
        </View>
        <MockNews />
      </View>
    </ScrollView>
  );
}
const s = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingBottom: 30,
    gap: 12,
  },
  section: {
    padding: 12,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  sectionTitle: {
    fontWeight: "700",
    fontSize: 15,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 8,
    paddingHorizontal: 12,
  },
  halfCard: {
    flex: 1,
    borderRadius: SURFACE_BORDER_RADIUS,
    overflow: "hidden",
  },
  cardImage: {
    width: "100%",
    height: 110,
  },
  cardText: {
    padding: 8,
    gap: 2,
  },
  newsSection: {
    marginHorizontal: 12,
    borderRadius: SURFACE_BORDER_RADIUS,
  },
  guideCard: {},
  areasCard: {},
  collage: {
    height: 110,
    gap: 2,
  },
  collageRow: {
    flex: 1,
    flexDirection: "row",
    gap: 2,
  },
  collageImage: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  cardSubtitle: {
    fontSize: 11,
  },
});
