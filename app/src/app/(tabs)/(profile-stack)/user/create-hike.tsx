// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { stigviddUserAtom } from "@/atoms/user-atoms";
import BackButton from "@/components/back-button";
import ErrorView from "@/components/error-view";
import LoadingIndicator from "@/components/loading-indicator";
import LocationDisclosureDialog from "@/components/trail/trail-creator/location-disclosure-dialog";
import RecordingInfoDialog from "@/components/trail/trail-creator/recording-info-dialog";
import TrailCreator from "@/components/trail/trail-creator/trail-creator";
import { USER_LOCATION_KEY } from "@/hooks/useUserLocation";
import { useQueryClient } from "@tanstack/react-query";
import * as Location from "expo-location";
import { router } from "expo-router";
import { useAtom } from "jotai";
import { useCallback, useEffect, useState } from "react";
import { BORDER_RADIUS, SCREEN_PADDING } from "@/constants/constants";
import { AppState, Linking, Platform, StyleSheet, View } from "react-native";
import { Button, Icon, IconButton, Text, useTheme } from "react-native-paper";
import { useTranslation } from "react-i18next";

// "checking" — reading the current status (never prompts)
// "disclosure" — showing why we need location, before the system prompt
// "granted" / "denied" — outcome
type PermissionPhase = "checking" | "disclosure" | "granted" | "denied";

export default function CreateHikeScreen() {
  const [{ isLoading, isError, error }] = useAtom(stigviddUserAtom);
  const theme = useTheme();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<PermissionPhase>("checking");
  // false once the OS stops offering the prompt ("never ask again" / iOS after a denial):
  // from then on the only way back is the system settings app.
  const [canAskAgain, setCanAskAgain] = useState(true);
  const [showInfo, setShowInfo] = useState(false);

  // getForegroundPermissionsAsync only *reads* the status — it never raises the system
  // dialog. That is what lets the disclosure come first: Play requires it ahead of the
  // prompt, and users who already granted must not be nagged on every visit.
  useEffect(() => {
    Location.getForegroundPermissionsAsync().then(({ granted }) => {
      setPhase(granted ? "granted" : "disclosure");
    });
  }, []);

  // The shared userLocation query can't notice a permission granted in-app — it refreshes
  // on a foreground return or a remount, and neither happens here. Without this the home
  // hero, popular trails, map camera and trail distances all keep using the Borås
  // fallback until the app is next backgrounded.
  const markGranted = useCallback(() => {
    setPhase("granted");
    queryClient.invalidateQueries({ queryKey: USER_LOCATION_KEY });
  }, [queryClient]);

  const handleContinue = async () => {
    const { granted, canAskAgain: mayRetry } = await Location.requestForegroundPermissionsAsync();
    setCanAskAgain(mayRetry);
    if (granted) markGranted();
    else setPhase("denied");
  };

  const handleOpenSettings = () => {
    Linking.openSettings().catch(() => undefined);
  };

  // Coming back from the settings app, the phase is stale if access was granted there —
  // nothing else would notice. Only while denied, so the listener isn't live during a
  // recording.
  //
  // getForegroundPermissionsAsync *reads* the status; it must never be swapped for
  // requestForegroundPermissionsAsync here. Requesting from AppState-driven code is what
  // caused the Android permission-dialog livelock.
  useEffect(() => {
    if (phase !== "denied") return;

    const subscription = AppState.addEventListener("change", (next) => {
      if (next !== "active") return;
      Location.getForegroundPermissionsAsync().then(({ granted, canAskAgain: mayRetry }) => {
        setCanAskAgain(mayRetry);
        if (granted) markGranted();
      });
    });

    return () => subscription.remove();
  }, [phase, markGranted]);

  if (isLoading || phase === "checking") {
    return <LoadingIndicator />;
  }

  if (phase === "disclosure") {
    return (
      <LocationDisclosureDialog
        visible
        onContinue={handleContinue}
        onDecline={() => (router.canGoBack() ? router.back() : setPhase("denied"))}
      />
    );
  }

  if (phase === "denied") {
    return (
      <View style={[s.screen, { backgroundColor: theme.colors.background }]}>
        <View style={s.header}>
          <BackButton />
        </View>
        <View style={s.deniedContent}>
          <View style={[s.deniedIcon, { backgroundColor: theme.colors.secondaryContainer }]}>
            <Icon source="map-marker-off-outline" size={40} color={theme.colors.onSecondaryContainer} />
          </View>
          <Text style={[s.deniedTitle, { color: theme.colors.onBackground }]}>
            {t("createHike.permissionDeniedTitle")}
          </Text>
          <Text variant="bodyMedium" style={[s.deniedBody, { color: theme.colors.onSurfaceVariant }]}>
            {t("createHike.locationRequired")}
          </Text>
          {canAskAgain ? (
            <Button mode="contained" style={s.deniedButton} onPress={handleContinue}>
              {t("createHike.permissionRetry")}
            </Button>
          ) : (
            <>
              <Text variant="bodySmall" style={[s.deniedBody, { color: theme.colors.onSurfaceVariant }]}>
                {t("createHike.permissionSettingsHint")}
              </Text>
              <Button mode="contained" style={s.deniedButton} onPress={handleOpenSettings}>
                {t("createHike.bgPermissionOpenSettings")}
              </Button>
            </>
          )}
        </View>
      </View>
    );
  }

  if (isError) {
    return <ErrorView error={error} />;
  }

  return (
    <View style={[s.screen, { backgroundColor: theme.colors.background }]}>
      <View style={s.header}>
        <BackButton />
        <Text style={s.title}>{t("createHike.title")}</Text>
        <IconButton
          icon="information-outline"
          size={20}
          iconColor={theme.colors.onBackground}
          style={s.infoButton}
          accessibilityLabel={t("createHike.infoTitle")}
          onPress={() => setShowInfo(true)}
        />
      </View>
      <View style={s.content}>
        <TrailCreator />
      </View>

      <RecordingInfoDialog visible={showInfo} onDismiss={() => setShowInfo(false)} />
    </View>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    paddingTop: 8,
    paddingBottom: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: Platform.select({ ios: 0, default: SCREEN_PADDING }),
    paddingBottom: 8,
    gap: 4,
  },
  title: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
  },
  infoButton: {
    margin: 0,
  },
  content: {
    flex: 1,
    paddingHorizontal: SCREEN_PADDING,
  },
  deniedContent: {
    flex: 1,
    paddingHorizontal: SCREEN_PADDING,
    paddingBottom: 60, // optically centered — the header pushes the block low otherwise
    gap: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  deniedIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  deniedTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 18,
    textAlign: "center",
  },
  deniedBody: {
    textAlign: "center",
    maxWidth: 320,
    lineHeight: 20,
  },
  deniedButton: {
    marginTop: 8,
    borderRadius: BORDER_RADIUS,
  },
});
