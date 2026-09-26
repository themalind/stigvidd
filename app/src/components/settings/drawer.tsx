// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { showErrorAtom } from "@/atoms/snackbar-atoms";
import { useThemeChoice } from "@/hooks/useThemeChoice";
import { MaterialIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useSetAtom } from "jotai";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Dimensions, Modal, Pressable, StyleSheet, View } from "react-native";
import { useAuth } from "@/components/auth/auth-provider";
import { Divider, Drawer, Text, useTheme } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { logger } from "../../services/logger";

interface Props {
  visible: boolean;
  onDismiss: () => void;
}

const width = Dimensions.get("screen").width;

export default function SettingsDrawer({ visible, onDismiss }: Props) {
  const { isAuthenticated, logout } = useAuth();
  const { choice } = useThemeChoice();
  const theme = useTheme();
  const { t } = useTranslation();
  const setError = useSetAtom(showErrorAtom);
  const [active, setActive] = React.useState("");
  const insets = useSafeAreaInsets();

  function handleTheme() {
    setActive("theme");
    onDismiss();
    router.replace("/(tabs)/(settings)/theme");
  }

  function handleAbout() {
    setActive("about");
    onDismiss();
    router.replace("/(tabs)/(settings)/about");
  }

  async function handleSignOut() {
    setActive("logout");
    try {
      await logout();
    } catch (e) {
      logger.error("Sign-out failed", { error: String(e) });
      setError(t("auth.couldNotLogout"));
    }
    onDismiss();
    // No navigation needed: logout() flips userAtom → the (profile-stack) guard
    // swaps the protected screens for the login screen in place.
  }

  function handleLogin() {
    setActive("login");
    onDismiss();
    // Send login into the profile stack so the auth guard lands on the profile
    // page once signed in. The (settings) stack has no post-login destination.
    router.replace("/(tabs)/(profile-stack)/login");
  }

  function handleGuide() {
    setActive("guide");
    onDismiss();
    router.replace("/(tabs)/(settings)/guide");
  }

  function handlePrivacy() {
    setActive("privacy");
    onDismiss();
    router.replace("/(tabs)/(settings)/privacy");
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable testID="drawer-backdrop" style={s.backdrop} onPress={onDismiss}>
        <BlurView intensity={80} tint={theme.dark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
      </Pressable>
      <View
        testID="drawer-panel"
        style={[
          s.panel,
          {
            backgroundColor: theme.colors.surface,
            borderLeftColor: theme.colors.outlineVariant,
            borderLeftWidth: 1,
            paddingTop: insets.top + 10,
          },
        ]}
      >
        <View style={s.stigviddContainer}>
          <Image style={s.image} contentFit="contain" source={require("../../assets/images/mammaapp.png")} />
          <Text style={[s.text, { color: theme.colors.onSurfaceVariant }]}>Stigvidd</Text>
          <Pressable testID="drawer-close" hitSlop={12} onPress={onDismiss} style={s.closeButton}>
            <MaterialIcons name="close" size={24} color={theme.colors.onSurfaceVariant} />
          </Pressable>
        </View>
        <View testID="drawer-items" style={s.drawerItemContainer}>
          <Divider bold style={{ marginHorizontal: 16 }} />
          <Drawer.Section showDivider={false} style={s.drawerSection}>
            <Drawer.Item
              label={t("settings.theme")}
              icon="theme-light-dark"
              active={active === "theme"}
              theme={{ roundness: 1 }}
              right={() => (
                <Text
                  testID="drawer-theme-name"
                  style={{
                    color: active === "theme" ? theme.colors.onSecondaryContainer : theme.colors.onSurfaceVariant,
                  }}
                >
                  {t(choice === "auto" ? "themes.system" : `themes.${choice}`)}
                </Text>
              )}
              onPress={handleTheme}
            />
            <Drawer.Item
              label={t("settings.guide")}
              icon="pine-tree"
              active={active === "guide"}
              theme={{ roundness: 1 }}
              onPress={handleGuide}
            />
            <Drawer.Item
              label={t("settings.privacy")}
              icon="shield-account"
              active={active === "privacy"}
              theme={{ roundness: 1 }}
              onPress={handlePrivacy}
            />
            <Drawer.Item
              label={t("settings.about")}
              icon="cellphone-information"
              active={active === "about"}
              theme={{ roundness: 1 }}
              onPress={handleAbout}
            />
            {isAuthenticated ? (
              <Drawer.Item
                label={t("auth.logout")}
                icon="logout"
                active={active === "logout"}
                theme={{ roundness: 1 }}
                onPress={handleSignOut}
              />
            ) : (
              <Drawer.Item
                label={t("auth.login")}
                icon="login"
                active={active === "login"}
                theme={{ roundness: 1 }}
                onPress={handleLogin}
              />
            )}
          </Drawer.Section>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  panel: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    width: width * 0.7,
    paddingTop: 0,
    elevation: 8,
  },
  stigviddContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingLeft: 16,
    paddingRight: 12,
  },
  closeButton: {
    marginLeft: "auto",
  },
  text: {
    fontSize: 20,
    fontWeight: 700,
  },
  image: {
    height: 60,
    width: 60,
    alignSelf: "center",
  },
  drawerItemContainer: {
    marginTop: "auto",
    paddingBottom: 45,
  },
  drawerSection: {
    marginTop: 8,
  },
});
