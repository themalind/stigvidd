// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import BackButton from "@/components/back-button";
import ErrorView from "@/components/error-view";
import { HikeFact, HikeFactsCard, HikeInfo, HikeInfoCard } from "@/components/hike/hike-detail-sections";
import RoutePreviewMap from "@/components/map/route-preview-map";
import ShimmerBlock from "@/components/skeletons/shimmer-block";
import { SCREEN_PADDING, SURFACE_BORDER_RADIUS } from "@/constants/constants";
import CoordinateParser from "@/utils/coordinate-parser";
import FormattedTime from "@/utils/format-time-from-ms";
import { ReactNode, startTransition, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dimensions, Platform, ScrollView, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

const MAP_HEIGHT = Dimensions.get("screen").height * 0.3;

interface Props {
  title: string;
  headerAction?: ReactNode;
  idPrefix: string;
  hikeIdentifier: string;
  coordinates?: string;
  onOpenMap: () => void;
  hikeLength: number;
  duration: number;
  facts: HikeFact[];
  info: HikeInfo;
  media?: ReactNode;
  actions: ReactNode;
  children?: ReactNode;
}

export default function HikeDetailLayout({
  title,
  headerAction,
  idPrefix,
  hikeIdentifier,
  coordinates,
  onOpenMap,
  hikeLength,
  duration,
  facts,
  info,
  media,
  actions,
  children,
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [mapReady, setMapReady] = useState(false);

  // keep-comment: mounting MapLibre during the push animation makes it stutter, as on the trail screen
  useEffect(() => {
    startTransition(() => setMapReady(true));
  }, []);

  const path = useMemo(
    () => CoordinateParser({ data: coordinates ?? "", identifier: hikeIdentifier }),
    [coordinates, hikeIdentifier],
  );

  return (
    <View style={[s.screen, { backgroundColor: theme.colors.background }]}>
      <HikeDetailHeader title={title} action={headerAction} />
      <ScrollView contentContainerStyle={s.scrollContent}>
        {mapReady ? (
          <RoutePreviewMap idPrefix={idPrefix} path={path} onOpen={onOpenMap} style={s.map} />
        ) : (
          <ShimmerBlock style={s.map} />
        )}
        <HikeFactsCard
          facts={[
            { label: t("hike.length"), value: `${hikeLength} km` },
            { label: t("hike.time"), value: FormattedTime(duration) },
            ...facts,
          ]}
        />
        {media}
        <HikeInfoCard {...info} />
        <View testID="hike-actions" style={s.actions}>
          {actions}
        </View>
      </ScrollView>
      {children}
    </View>
  );
}

function HikeDetailHeader({ title, action }: { title?: string; action?: ReactNode }) {
  return (
    <View style={s.header}>
      <BackButton />
      <Text style={s.title} numberOfLines={1}>
        {title}
      </Text>
      {action}
    </View>
  );
}

export function HikeDetailFallback({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const theme = useTheme();

  return (
    <View style={[s.screen, { backgroundColor: theme.colors.background }]}>
      <HikeDetailHeader />
      <ErrorView error={error} onRetry={onRetry} />
    </View>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 44,
    paddingLeft: Platform.select({ ios: 0, default: SCREEN_PADDING }),
    paddingRight: SCREEN_PADDING,
  },
  title: {
    flex: 1,
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
  },
  // keep-comment: flexGrow plus the actions' marginTop auto pin the buttons to the bottom while content is short
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 4,
    paddingBottom: 20,
    gap: 15,
  },
  map: {
    height: MAP_HEIGHT,
    borderRadius: SURFACE_BORDER_RADIUS,
    overflow: "hidden",
  },
  actions: {
    marginTop: "auto",
    flexDirection: "row",
    gap: 16,
    paddingTop: 5,
  },
});
