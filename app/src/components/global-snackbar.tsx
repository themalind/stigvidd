// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

// components/GlobalSnackbar.tsx
import { MaterialIcons } from "@expo/vector-icons";
import { useAtom, useSetAtom } from "jotai";
import { StyleSheet, View } from "react-native";
import { Snackbar, Text, useTheme } from "react-native-paper";
import { hideSnackbarAtom, snackbarAtom } from "../atoms/snackbar-atoms";

// Not a Portal: portals stack in mount order, so it would be drawn under every modal opened after
// startup. The root layout mounts it after PaperProvider's portal host instead.
export function GlobalSnackbar() {
  const theme = useTheme();
  const [snackbar] = useAtom(snackbarAtom);
  const hideSnackbar = useSetAtom(hideSnackbarAtom);

  return (
    <Snackbar
      visible={snackbar.visible}
      onDismiss={hideSnackbar}
      duration={3000}
      wrapperStyle={{ bottom: 50 }}
      style={{
        backgroundColor: theme.colors.secondary,
      }}
    >
      <View style={s.contentContainer}>
        {snackbar.icon && <MaterialIcons name={snackbar.icon as any} size={20} color={theme.colors.onSecondary} />}
        <Text testID="snackbar-message" style={[s.message, { color: theme.colors.onSecondary }]}>
          {snackbar.message}
        </Text>
      </View>
    </Snackbar>
  );
}
const s = StyleSheet.create({
  contentContainer: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  message: {
    flexShrink: 1,
  },
});
