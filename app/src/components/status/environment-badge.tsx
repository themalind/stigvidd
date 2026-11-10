// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { BORDER_RADIUS } from "@/constants/constants";
import { logger } from "@/services/logger";
import type { AppEnvironment } from "@/utils/app-environment";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  environment: AppEnvironment;
};

const LABELS: Partial<Record<AppEnvironment, string>> = {
  staging: "STAGING",
  mixed: "BLANDAD MILJÖ",
};

export default function EnvironmentBadge({ environment }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (environment === "mixed") {
      logger.error("App environment mismatch", {
        apiUrl: process.env.EXPO_PUBLIC_API_URL,
        realm: process.env.EXPO_PUBLIC_OIDC_REALM,
      });
    }
  }, [environment]);

  const label = LABELS[environment];
  if (!label) return null;

  const background = environment === "mixed" ? theme.colors.error : theme.colors.tertiary;
  const foreground = environment === "mixed" ? theme.colors.onError : theme.colors.onTertiary;

  return (
    <View testID="environment-badge" pointerEvents="none" style={[s.wrapper, { top: insets.top }]}>
      <Text
        accessibilityLabel={`Miljö: ${label}`}
        style={[s.label, { backgroundColor: background, color: foreground }]}
      >
        {label}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  label: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: BORDER_RADIUS,
    overflow: "hidden",
    opacity: 0.9,
  },
});
