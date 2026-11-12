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

export const AREA_TILE_WIDTH = 220;

interface Props {
  area: CityArea;
  onPress: (identifier: string) => void;
  testID: string;
}

export default function AreaTile({ area, onPress, testID }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const distance = areaDistance(area);

  return (
    <Pressable
      testID={testID}
      style={[s.card, { backgroundColor: theme.colors.background }]}
      onPress={() => onPress(area.identifier)}
      accessibilityRole="button"
    >
      <View>
        <AreaImage area={area} style={s.image} />
        {distance && (
          <View style={[s.badge, { backgroundColor: theme.colors.surface }]}>
            <Text style={[s.badgeText, { color: theme.colors.onSurface }]}>{distance}</Text>
          </View>
        )}
      </View>
      <View style={s.text}>
        <Text style={[s.name, { color: theme.colors.onSurface }]} numberOfLines={1}>
          {area.name}
        </Text>
        <Text style={[s.meta, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>
          {areaSummary(area, t)}
        </Text>
        <AreaFeatureTags features={areaFeatures(area)} compact />
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: {
    width: AREA_TILE_WIDTH,
    borderRadius: BORDER_RADIUS,
    overflow: "hidden",
  },
  image: {
    width: AREA_TILE_WIDTH,
    height: 110,
  },
  badge: {
    position: "absolute",
    top: 8,
    right: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS,
  },
  badgeText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
  },
  text: {
    padding: 8,
    gap: 4,
  },
  name: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  meta: {
    fontSize: 12,
  },
});
