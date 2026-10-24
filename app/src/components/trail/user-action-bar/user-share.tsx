// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { SHARE_LINK_BASE_URL } from "@/constants/constants";
import { Trail } from "@/data/types";
import { logger } from "@/services/logger";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useTranslation } from "react-i18next";
import { Pressable, Share, StyleSheet, Text, View } from "react-native";
import { useTheme } from "react-native-paper";

interface Props {
  trail: Pick<Trail, "identifier" | "name">;
}

export function trailShareUrl(identifier: string) {
  return `${SHARE_LINK_BASE_URL}/trail/${encodeURIComponent(identifier)}`;
}

export default function UserShare({ trail }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();

  const share = () => {
    const message = t("userActions.shareMessage", { name: trail.name, url: trailShareUrl(trail.identifier) });
    Share.share({ message }).catch((error) => logger.warn("Sharing a trail failed", { errorMessage: String(error) }));
  };

  return (
    <View style={s.container}>
      <Pressable onPress={share} style={({ pressed }) => [s.touchable, pressed && { opacity: 0.7 }]}>
        <MaterialIcons name="share" size={30} color={theme.colors.onSurface} />
        <Text style={[s.text, { color: theme.colors.onSurface }]}>{t("userActions.share")}</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flexDirection: "column",
  },
  touchable: {
    justifyContent: "center",
    alignItems: "center",
  },
  text: {
    fontSize: 12,
  },
});
