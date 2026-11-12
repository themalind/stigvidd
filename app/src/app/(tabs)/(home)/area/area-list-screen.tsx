// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import AreaFilterBar from "@/components/area/area-filter-bar";
import AreaRow from "@/components/area/area-row";
import BackButton from "@/components/layout/back-button";
import ErrorView from "@/components/status/error-view";
import LoadingIndicator from "@/components/status/loading-indicator";
import { SCREEN_PADDING } from "@/constants/constants";
import { useAreas } from "@/hooks/area/useAreas";
import { DEFAULT_AREA_FILTERS, areaMunicipalities, groupAreas } from "@/utils/area/area-list";
import { guardedNavigate } from "@/utils/navigation";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, SectionList, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

export default function AreaListScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { data: areas, isPending, isError, error, refetch, hasPosition } = useAreas();
  const [filters, setFilters] = useState(DEFAULT_AREA_FILTERS);
  const otherMunicipality = t("area.otherMunicipality");
  const sections = useMemo(
    () =>
      groupAreas(areas ?? [], filters, otherMunicipality).map((group) => ({
        key: group.title ?? "all",
        title: group.title,
        data: group.areas,
      })),
    [areas, filters, otherMunicipality],
  );
  const municipalities = useMemo(() => areaMunicipalities(areas ?? []), [areas]);

  if (isPending) {
    return <LoadingIndicator />;
  }

  // keep-comment: a failed refetch keeps the cached data, so the error screen is only for having nothing to show
  if (isError && !areas) {
    return <ErrorView error={error} onRetry={refetch} />;
  }

  const openArea = (identifier: string) =>
    guardedNavigate(() => router.navigate({ pathname: "/(tabs)/(home)/area/[identifier]", params: { identifier } }));

  return (
    <SectionList
      testID="area-list"
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={s.content}
      sections={sections}
      keyExtractor={(area) => area.identifier}
      stickySectionHeadersEnabled={false}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={s.header}>
          <View style={s.titleRow}>
            <BackButton />
            <Text style={[s.title, { color: theme.colors.onBackground }]}>{t("area.listTitle")}</Text>
          </View>
          <AreaFilterBar
            filters={filters}
            municipalities={municipalities}
            hasPosition={hasPosition}
            onChange={setFilters}
          />
        </View>
      }
      renderSectionHeader={({ section }) =>
        section.title ? (
          <Text style={[s.group, { color: theme.colors.onSurfaceVariant }]}>
            {section.title} · {section.data.length}
          </Text>
        ) : null
      }
      renderItem={({ item }) => <AreaRow area={item} onPress={openArea} />}
      ItemSeparatorComponent={() => <View style={s.separator} />}
      ListEmptyComponent={
        <Text testID="area-list-empty" style={[s.empty, { color: theme.colors.onSurfaceVariant }]}>
          {t("area.noMatches")}
        </Text>
      }
    />
  );
}

const s = StyleSheet.create({
  content: {
    paddingTop: 8,
    paddingBottom: 24,
    paddingHorizontal: SCREEN_PADDING,
  },
  header: {
    gap: 12,
    paddingBottom: 12,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginLeft: Platform.select({ ios: -SCREEN_PADDING, default: 0 }),
  },
  title: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 22,
  },
  group: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingTop: 12,
    paddingBottom: 6,
  },
  separator: {
    height: 8,
  },
  empty: {
    textAlign: "center",
    paddingVertical: 24,
    fontSize: 14,
  },
});
