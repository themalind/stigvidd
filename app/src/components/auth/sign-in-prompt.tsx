// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { loginReturnPathAtom, userAtom } from "@/atoms/auth-atoms";
import { BORDER_RADIUS } from "@/constants/constants";
import { MaterialIcons } from "@expo/vector-icons";
import { router, usePathname } from "expo-router";
import { useStore } from "jotai";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { Button, Text, useTheme } from "react-native-paper";

type Props = {
  message: string;
};

export default function SignInPrompt({ message }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const pathname = usePathname();
  const store = useStore();

  // Leaving the prompt while still signed out drops the return, so a later login stays on the profile. keep-comment: why the user check
  useEffect(() => {
    return () => {
      if (!store.get(userAtom) && store.get(loginReturnPathAtom) === pathname) {
        store.set(loginReturnPathAtom, null);
      }
    };
  }, [store, pathname]);

  const goToLogin = () => {
    store.set(loginReturnPathAtom, pathname);
    router.navigate("/(tabs)/(profile-stack)/login");
  };

  return (
    <View testID="sign-in-prompt" style={[s.container, { backgroundColor: theme.colors.background }]}>
      <MaterialIcons name="lock-outline" size={48} color={theme.colors.onSurfaceVariant} />
      <Text style={[s.message, { color: theme.colors.onBackground }]}>{message}</Text>
      <Button
        testID="sign-in-prompt-login"
        mode="contained"
        onPress={goToLogin}
        style={{ borderRadius: BORDER_RADIUS }}
      >
        {t("auth.goToLogin")}
      </Button>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 16,
  },
  message: {
    fontSize: 15,
    textAlign: "center",
  },
});
