// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { getPopularTrails } from "@/api/trails";
import AdventureCard from "@/components/home/adventure-card";
import GetStartedCard from "@/components/home/get-started-card";
import HeroBanner from "@/components/home/hero-banner";
import LatestHikeCard from "@/components/home/latest-hike-card";
import PopularContributions from "@/components/home/popular-contributions";
import ImageLinkCard from "@/components/image-link-card";
import InlineError from "@/components/inline-error";
import SectionPanel, { PANEL_BLEED, PANEL_PADDING } from "@/components/section-panel";
import LatestHikeSkeleton from "@/components/skeletons/latest-hike-skeleton";
import PagerCarouselSkeleton from "@/components/skeletons/pager-carousel-skeleton";
import PagerCarousel from "@/components/trail/pager-carousel";
import { SCREEN_PADDING } from "@/constants/constants";
import { guardedNavigate } from "@/utils/navigation";
import { useLatestHike } from "@/hooks/hike/useLatestHike";
import { useIsOnline } from "@/hooks/useIsOnline";
import { useUserLocation } from "@/hooks/useUserLocation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { router, useFocusEffect } from "expo-router";
import React, { useRef } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useTheme } from "react-native-paper";
import { useTranslation } from "react-i18next";

const AREA_COVERS = [
  require("../../../assets/images/area_cover1.jpg"),
  require("../../../assets/images/area_cover2.jpg"),
  require("../../../assets/images/area_cover3.jpg"),
  require("../../../assets/images/area_cover4.jpg"),
];

export default function HomeScreen() {
  const scrollViewRef = useRef<ScrollView>(null);
  const theme = useTheme();
  const { t } = useTranslation();
  // keep-comment: the Borås fallback is not the user's position, so it never reaches the API; without coordinates the section asks for popular trails
  const { data: location, isPending: locationPending } = useUserLocation();
  const userLocation = location?.isFallback ? undefined : location;
  const latest = useLatestHike();
  const isOnline = useIsOnline();
  const query = useQuery({
    queryKey: ["trails", "popular", userLocation?.latitude, userLocation?.longitude],
    queryFn: () => getPopularTrails(userLocation?.latitude, userLocation?.longitude),
    // keep-comment: waits for the position, so this fires once rather than again with coordinates
    enabled: !locationPending,
    placeholderData: keepPreviousData,
  });

  useFocusEffect(
    React.useCallback(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
    }, []),
  );

  return (
    <ScrollView
      testID="home-scroll"
      ref={scrollViewRef}
      contentContainerStyle={[s.container, { backgroundColor: theme.colors.background }]}
    >
      <HeroBanner lat={userLocation?.latitude} lon={userLocation?.longitude} />
      {(latest.kind === "signedOut" || latest.kind === "empty") && (
        <GetStartedCard signedIn={latest.kind === "empty"} />
      )}
      {/* Offline with nothing cached there is nothing to show; the offline banner says why. keep-comment: hidden coupling to the banner */}
      {(query.data || isOnline) && (
        <SectionPanel testID="home-popular" title={userLocation ? t("home.popularNearYou") : t("home.popular")}>
          {query.data ? (
            <View style={PANEL_BLEED}>
              <PagerCarousel
                data={query.data}
                containerPadding={SCREEN_PADDING * 2}
                imageRadius={0}
                textInset={PANEL_PADDING}
              />
            </View>
          ) : query.isError ? (
            <InlineError
              testID="home-popular-error"
              message={t("home.popularError")}
              onRetry={() => void query.refetch()}
            />
          ) : (
            <PagerCarouselSkeleton />
          )}
        </SectionPanel>
      )}

      <ImageLinkCard
        testID="home-areas-card"
        style={s.wideCard}
        images={AREA_COVERS}
        title={t("home.explore")}
        subtitle={t("home.exploreSubtitle")}
        onPress={() => guardedNavigate(() => router.navigate("/(tabs)/(home)/area/area-list-screen"))}
      />

      <PopularContributions />

      {/* Held for the returning user, who is the one this slot is usually for: a first-time
          user resolves to "empty" and gets the get-started card above the carousel. */}
      {latest.kind === "loading" && <LatestHikeSkeleton />}
      {latest.kind === "error" && (
        <SectionPanel testID="home-latest-error" title={t("home.latestHike")}>
          <InlineError message={t("home.latestHikeError")} onRetry={latest.retry} />
        </SectionPanel>
      )}
      {latest.kind === "hike" && <LatestHikeCard hike={latest.hike} />}

      <AdventureCard />
    </ScrollView>
  );
}
const s = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingBottom: 30,
    gap: 16,
  },
  wideCard: {
    marginHorizontal: SCREEN_PADDING,
  },
});
