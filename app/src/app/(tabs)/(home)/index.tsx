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
import NearbyAreas from "@/components/home/nearby-areas";
import PopularContributions from "@/components/home/popular-contributions";
import InlineError from "@/components/status/inline-error";
import SectionPanel, { PANEL_BLEED, PANEL_PADDING } from "@/components/layout/section-panel";
import LatestHikeSkeleton from "@/components/skeletons/latest-hike-skeleton";
import PagerCarouselSkeleton from "@/components/skeletons/pager-carousel-skeleton";
import PagerCarousel from "@/components/trail/pager-carousel";
import { POPULAR_TRAILS_STALE_TIME } from "@/constants/cache";
import { SCREEN_PADDING } from "@/constants/constants";
import { useLatestHike } from "@/hooks/hike/useLatestHike";
import { useIsOnline } from "@/hooks/useIsOnline";
import { useApproximatePosition } from "@/hooks/location/useApproximatePosition";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import React, { useRef } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useTheme } from "react-native-paper";
import { useTranslation } from "react-i18next";

export default function HomeScreen() {
  const scrollViewRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const theme = useTheme();
  const { t } = useTranslation();
  // keep-comment: without a real position the section asks for popular trails
  const { latitude, longitude, hasPosition, isPending: locationPending } = useApproximatePosition();
  const latest = useLatestHike();
  const isOnline = useIsOnline();
  const query = useQuery({
    queryKey: ["trails", "popular", latitude, longitude],
    queryFn: () => getPopularTrails(latitude, longitude),
    // keep-comment: waits for the position, so this fires once rather than again with coordinates
    enabled: !locationPending,
    placeholderData: keepPreviousData,
    staleTime: POPULAR_TRAILS_STALE_TIME,
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
      <HeroBanner lat={latitude} lon={longitude} />
      {(latest.kind === "signedOut" || latest.kind === "empty") && (
        <GetStartedCard signedIn={latest.kind === "empty"} />
      )}
      {/* Offline with nothing cached there is nothing to show; the offline banner says why. keep-comment: hidden coupling to the banner */}
      {(query.data || isOnline) && (
        <SectionPanel testID="home-popular" title={hasPosition ? t("home.popularNearYou") : t("home.popular")}>
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

      <NearbyAreas />

      {/* Held for the returning user, who is the one this slot is usually for: a first-time
          user resolves to "empty" and gets the get-started card above the carousel. */}
      {latest.kind === "loading" && <LatestHikeSkeleton />}
      {latest.kind === "error" && (
        <SectionPanel testID="home-latest-error" title={t("home.latestHike")}>
          <InlineError message={t("home.latestHikeError")} onRetry={latest.retry} />
        </SectionPanel>
      )}
      {latest.kind === "hike" && <LatestHikeCard hike={latest.hike} />}

      <PopularContributions latitude={latitude} longitude={longitude} enabled={!locationPending} />

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
});
