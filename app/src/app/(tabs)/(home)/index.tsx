import { getPopularTrails } from "@/api/trails";
import GetStartedCard from "@/components/home/get-started-card";
import HeroBanner from "@/components/home/hero-banner";
import LatestHikeCard from "@/components/home/latest-hike-card";
import LatestHikeSkeleton from "@/components/skeletons/latest-hike-skeleton";
import PagerCarouselSkeleton from "@/components/skeletons/pager-carousel-skeleton";
import PagerCarousel from "@/components/trail/pager-carousel";
import { SCREEN_PADDING, SURFACE_BORDER_RADIUS } from "@/constants/constants";
import { guardedNavigate } from "@/utils/navigation";
import { useLatestHike } from "@/hooks/hike/useLatestHike";
import { useUserLocation } from "@/hooks/useUserLocation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import React, { useRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTheme } from "react-native-paper";
import { useTranslation } from "react-i18next";

export default function HomeScreen() {
  const scrollViewRef = useRef<ScrollView>(null);
  const theme = useTheme();
  const { t } = useTranslation();
  // The Borås fallback isn't the user's position, so it must not reach the API — without
  // coordinates the section asks for popular trails outright and is titled accordingly.
  const { data: location, isPending: locationPending } = useUserLocation();
  const userLocation = location?.isFallback ? undefined : location;
  // Decides which personal card renders, and with it which slot is filled.
  const latest = useLatestHike();
  const query = useQuery({
    queryKey: ["trails", "popular", userLocation?.latitude, userLocation?.longitude],
    queryFn: () => getPopularTrails(userLocation?.latitude, userLocation?.longitude),
    // Waits for the position, so this fires once rather than again with coordinates.
    enabled: !locationPending,
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
      {(latest.kind === "signedOut" || latest.kind === "empty") && (
        <GetStartedCard signedIn={latest.kind === "empty"} />
      )}
      <View style={[s.section, { backgroundColor: theme.colors.background }]}>
        <View style={s.sectionHeader}>
          <Text style={[s.sectionTitle, { color: theme.colors.onBackground }]}>
            {userLocation ? t("home.popularNearYou") : t("home.popular")}
          </Text>
        </View>
        {query.data ? <PagerCarousel data={query.data} /> : <PagerCarouselSkeleton />}
      </View>

      {/* Held for the returning user, who is the one this slot is usually for: a first-time
          user resolves to "empty" and gets the get-started card above the carousel. */}
      {latest.kind === "loading" && <LatestHikeSkeleton />}
      {latest.kind === "hike" && <LatestHikeCard hike={latest.hike} />}

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
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 8,
    paddingHorizontal: SCREEN_PADDING,
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
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  cardSubtitle: {
    fontSize: 11,
  },
});
