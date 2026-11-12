// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { BORDER_RADIUS } from "@/constants/constants";
import { FACILITY_ICONS } from "@/constants/facility-icons";
import { AreaFeature } from "@/utils/area/area-list";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { Icon, Text, useTheme } from "react-native-paper";

interface Props {
  features: AreaFeature[];
  // keep-comment: icons alone where the card is narrow, icon and word in the list
  compact?: boolean;
  testID?: string;
}

export default function AreaFeatureTags({ features, compact = false, testID }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();

  if (features.length === 0) return null;

  return (
    <View testID={testID} style={s.row}>
      {features.map((feature) => (
        <View
          key={feature}
          accessible
          accessibilityLabel={t(`area.feature.${feature}`)}
          style={[s.tag, { backgroundColor: theme.colors.secondaryContainer }]}
        >
          <Icon source={FACILITY_ICONS[feature]} size={14} color={theme.colors.onSecondaryContainer} />
          {!compact && (
            <Text style={[s.label, { color: theme.colors.onSecondaryContainer }]}>{t(`area.feature.${feature}`)}</Text>
          )}
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
  },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS,
  },
  label: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
});
