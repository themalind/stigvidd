// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { SURFACE_BORDER_RADIUS } from "@/constants/constants";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { Button, useTheme } from "react-native-paper";

type Props = {
  message: string;
  onRetry: () => void;
  testID?: string;
};

export default function InlineError({ message, onRetry, testID }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <View testID={testID} style={[s.card, { backgroundColor: theme.colors.background }]}>
      <Text style={[s.message, { color: theme.colors.onSurfaceVariant }]}>{message}</Text>
      <Button mode="text" onPress={onRetry}>
        {t("common.retry")}
      </Button>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    borderRadius: SURFACE_BORDER_RADIUS,
    padding: 16,
    alignItems: "center",
    gap: 4,
  },
  message: {
    fontSize: 14,
    textAlign: "center",
  },
});
