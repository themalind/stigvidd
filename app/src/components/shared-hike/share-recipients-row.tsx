// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import AvatarStack from "@/components/friends/avatar-stack";
import { BORDER_RADIUS } from "@/constants/constants";
import { ShareRecipient } from "@/data/types";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";
import { Icon, Text, useTheme } from "react-native-paper";

interface Props {
  recipients: readonly ShareRecipient[];
  onPress: () => void;
}

export default function ShareRecipientsRow({ recipients, onPress }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <Pressable
      testID="share-recipients-row"
      accessibilityRole="button"
      accessibilityLabel={t("hike.sharedWithCount", { count: recipients.length })}
      onPress={onPress}
      style={({ pressed }) => [
        s.row,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant },
        pressed && s.pressed,
      ]}
    >
      <AvatarStack people={recipients} />
      <View style={s.text}>
        <Text variant="bodyMedium" style={s.count}>
          {t("hike.sharedWithCount", { count: recipients.length })}
        </Text>
      </View>
      <Text variant="bodyMedium" style={{ color: theme.colors.primary }}>
        {t("hike.seeShares")}
      </Text>
      <Icon source="chevron-right" size={20} color={theme.colors.primary} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS,
  },
  text: {
    flex: 1,
  },
  count: {
    fontFamily: "Inter_600SemiBold",
  },
  pressed: {
    opacity: 0.7,
  },
});
