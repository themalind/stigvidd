// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { BORDER_RADIUS } from "@/constants/constants";
import { CityArea } from "@/data/types";
import { areaFeatures } from "@/utils/area/area-list";
import { areaDistance, areaSummary } from "@/utils/area/area-summary";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "react-native-paper";
import AreaFeatureTags from "./area-feature-tags";
import AreaImage from "./area-image";

const THUMBNAIL = 84;

interface Props {
  area: CityArea;
  onPress: (identifier: string) => void;
}

export default function AreaRow({ area, onPress }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const distance = areaDistance(area);

  return (
    <Pressable
      testID={`area-row-${area.identifier}`}
      onPress={() => onPress(area.identifier)}
      accessibilityRole="button"
      style={({ pressed }) => [
        s.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.outlineVariant,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <View style={s.thumbnail}>
        <AreaImage area={area} style={s.thumbnail} />
      </View>
      <View style={s.body}>
        <View style={s.titleRow}>
          <Text style={[s.name, { color: theme.colors.onSurface }]} numberOfLines={1}>
            {area.name}
          </Text>
          {distance && (
            <Text
              testID={`area-row-distance-${area.identifier}`}
              style={[s.distance, { color: theme.colors.onSurfaceVariant }]}
            >
              {distance}
            </Text>
          )}
        </View>
        <Text style={[s.meta, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>
          {areaSummary(area, t)}
        </Text>
        <AreaFeatureTags features={areaFeatures(area)} />
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: {
    flexDirection: "row",
    borderRadius: BORDER_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    minHeight: THUMBNAIL,
  },
  thumbnail: {
    width: THUMBNAIL,
    height: "100%",
    minHeight: THUMBNAIL,
  },
  body: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 4,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  name: {
    flex: 1,
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  distance: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
  },
  meta: {
    fontSize: 12,
  },
});
