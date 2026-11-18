// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import BackButton from "@/components/layout/back-button";
import LoadingIndicator from "@/components/status/loading-indicator";
import LocationDisclosureDialog from "@/components/hike/recorder/location-disclosure-dialog";
import RecordingInfoDialog from "@/components/hike/recorder/recording-info-dialog";
import HikeRecorder from "@/components/hike/recorder/hike-recorder";
import { USER_LOCATION_KEY } from "@/hooks/location/useUserLocation";
import { hasHikeInProgress } from "@/services/location-task";
import { logger } from "@/services/logger";
import { useQueryClient } from "@tanstack/react-query";
import * as Location from "expo-location";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { BORDER_RADIUS, SCREEN_PADDING } from "@/constants/constants";
import { AppState, Linking, Platform, StyleSheet, View } from "react-native";
import { Button, Icon, IconButton, Text, useTheme } from "react-native-paper";
import { useTranslation } from "react-i18next";

type PermissionPhase = "checking" | "disclosure" | "granted" | "denied";

async function readPermissionPhase(): Promise<PermissionPhase> {
  const { granted } = await Location.getForegroundPermissionsAsync();
  if (!granted) return "disclosure";
  // Play requires the disclosure before the background prompt the recording raises on Android. keep-comment: store policy
  if (Platform.OS !== "android") return "granted";
  if (await hasHikeInProgress()) return "granted";
  const background = await Location.getBackgroundPermissionsAsync();
  return background.granted ? "granted" : "disclosure";
}

export default function CreateHikeScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<PermissionPhase>("checking");
  // keep-comment: false once the OS stops prompting; then only the settings app can grant it
  const [canAskAgain, setCanAskAgain] = useState(true);
  const [showInfo, setShowInfo] = useState(false);

  // keep-comment: only reads, never prompts, so Play's disclosure can come first
  useEffect(() => {
    readPermissionPhase()
      .then(setPhase)
      .catch((error: unknown) => {
        logger.warn("Reading location permission failed", { errorMessage: String(error) });
        setPhase("disclosure");
      });
  }, []);

  // keep-comment: the shared location query misses an in-app grant and would keep the Borås fallback app-wide
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

  // keep-comment: notices a grant made in the settings app; only while denied, so it is off during a recording
  // keep-comment: never request here: requesting from AppState code livelocks the Android permission dialog
  useEffect(() => {
    if (phase !== "denied") return;

    const subscription = AppState.addEventListener("change", (next) => {
      if (next !== "active") return;
      Location.getForegroundPermissionsAsync()
        .then(({ granted, canAskAgain: mayRetry }) => {
          setCanAskAgain(mayRetry);
          if (granted) markGranted();
        })
        .catch((error: unknown) => logger.warn("Reading location permission failed", { errorMessage: String(error) }));
    });

    return () => subscription.remove();
  }, [phase, markGranted]);

  if (phase === "checking") {
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
      <View testID="create-hike-denied" style={[s.screen, { backgroundColor: theme.colors.background }]}>
        <View style={s.header}>
          <BackButton />
        </View>
        <View style={s.deniedContent}>
          <View
            testID="create-hike-denied-icon"
            style={[s.deniedIcon, { backgroundColor: theme.colors.secondaryContainer }]}
          >
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

  return (
    <View testID="create-hike-screen" style={[s.screen, { backgroundColor: theme.colors.background }]}>
      <View testID="create-hike-header" style={s.header}>
        <BackButton />
        <Text style={s.title}>{t("createHike.title")}</Text>
        <IconButton
          testID="create-hike-info"
          icon="information-outline"
          size={20}
          iconColor={theme.colors.onBackground}
          style={s.infoButton}
          accessibilityLabel={t("createHike.infoTitle")}
          onPress={() => setShowInfo(true)}
        />
      </View>
      <View testID="create-hike-content" style={s.content}>
        <HikeRecorder />
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
