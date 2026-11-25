// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { pruneTrailCardCache } from "@/hooks/trail/useTrailCard";
import { initMapTiler } from "@/components/map/map-style";
import { initMapCache } from "@/utils/map/map-cache";
import { loadUserTheme, userThemeAtom } from "@/atoms/user-theme-atom";
import { basemapAtom, loadBasemap } from "@/atoms/basemap-atom";
import { BannedWriteDialog } from "@/components/auth/banned-write-dialog";
import { SessionRecovery } from "@/components/auth/session-recovery";
import { createQueryClient } from "@/api/core/query-client";
import { DialogHost } from "@/components/dialog/dialog-host";
import EnvironmentBadge from "@/components/status/environment-badge";
import { APP_ENVIRONMENT } from "@/utils/app-environment";
import { GlobalSnackbar } from "@/components/status/global-snackbar";
import { ConsentDialog } from "@/components/settings/consent-dialog";
import { useAppState } from "@/hooks/useAppState";
import { useOpenActiveRecording } from "@/hooks/hike/useOpenActiveRecording";
import { useUserTheme } from "@/hooks/theme/useUserTheme";
import { loadStoredLanguage } from "@/i18n";
import "@/services/location-task";
import { track } from "@/services/analytics";
import { initOnlineStatus } from "@/services/online-status";
import { initTelemetry } from "@/services/telemetry";
import { logger } from "@/services/logger";
import {
  claimNotificationResponse,
  invalidateForPush,
  isPushType,
  NOTIFICATION_HANDLERS,
  notificationHandlerFor,
  registerForPushNotificationsAsync,
  releaseNotificationResponse,
} from "@/services/notifications";
import { openPushRoute } from "@/services/open-push-route";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
import { ThemeProvider } from "expo-router/react-navigation";
import { Stack, useNavigationContainerRef, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSetAtom } from "jotai";
import { queryClientAtom } from "jotai-tanstack-query";
import { Inter_600SemiBold, useFonts } from "@expo-google-fonts/inter";
import { useEffect, useMemo, useRef, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { PaperProvider, ThemeProvider as PaperThemeProvider } from "react-native-paper";
import "react-native-reanimated";
import { useAuth, useInitAuth } from "@/components/auth/auth-provider";

// keep-comment: module scope, since RootLayout renders null at first and an effect would miss startup crashes
initTelemetry();

function NotificationHandler() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const lastResponse = Notifications.useLastNotificationResponse();
  const handledNotificationId = useRef<string | null>(null);
  const signedInUserId = useRef<string | undefined>(undefined);
  const pathname = usePathname();
  const currentPath = useRef(pathname);
  const navigation = useNavigationContainerRef();

  useEffect(() => {
    signedInUserId.current = user?.id;
  }, [user]);

  useEffect(() => {
    currentPath.current = pathname;
  }, [pathname]);

  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data;
      const handler = notificationHandlerFor(data);
      if (handler && data) invalidateForPush(queryClient, handler, data);
    });
    return () => subscription.remove();
  }, [queryClient]);

  useEffect(() => {
    if (!lastResponse || !user) return;
    const notifId = lastResponse.notification.request.identifier;
    if (notifId === handledNotificationId.current) return;
    handledNotificationId.current = notifId;
    const data = lastResponse.notification.request.content.data;
    const type = data?.type;
    if (!type) return;
    const userId = user.id;
    void claimNotificationResponse(notifId)
      .then(async (isNew) => {
        if (!isNew) return;
        if (signedInUserId.current !== userId) {
          if (handledNotificationId.current === notifId) handledNotificationId.current = null;
          return releaseNotificationResponse(notifId);
        }
        if (isPushType(type)) {
          const handler = NOTIFICATION_HANDLERS[type];
          track("push.opened", { type, routed: true });
          invalidateForPush(queryClient, handler, data);
          await openPushRoute(handler, data, {
            currentPath: () => currentPath.current,
            rootState: () => navigation.getRootState(),
          });
        } else {
          track("push.opened", { type: "unknown", routed: false });
          logger.warn("Unknown notification type", { type: String(type) });
        }
        Notifications.clearLastNotificationResponse();
      })
      .catch((error: unknown) => {
        logger.error("Notification navigation failed", { type, errorMessage: String(error) });
        return releaseNotificationResponse(notifId);
      });
  }, [lastResponse, user, queryClient, navigation]);

  return null;
}

function ActiveRecordingHandler() {
  const { user } = useAuth();
  useOpenActiveRecording(!!user);
  return null;
}

// keep-comment: last resort above the providers; the tab stacks catch first and keep the tab bar
export { default as ErrorBoundary } from "@/components/status/root-error-boundary";

export default function RootLayout() {
  const setUserTheme = useSetAtom(userThemeAtom);
  const theme = useUserTheme();
  // keep-comment: iOS reads it from the root Stack's screen, not StatusBar, see docs/notes/ios-27-sdk-ignores-app-level-status-bar-style.md
  const statusBarStyle = theme.dark ? "light" : "dark";

  // keep-comment: outside the render gate below, which waits on it
  useInitAuth();
  const { user, isLoading } = useAuth();

  // keep-comment: one client for the app's life; user-scoped keys keep users apart, not a new client
  const queryClient = useMemo(() => createQueryClient(), []);

  const setQueryClient = useSetAtom(queryClientAtom);
  useEffect(() => {
    setQueryClient(queryClient);
  }, [queryClient, setQueryClient]);

  useAppState();

  // Gates the render below, so nothing draws in the default theme or map style first. keep-comment: why the gate exists
  const setBasemap = useSetAtom(basemapAtom);
  const [preferencesRestored, setPreferencesRestored] = useState(false);
  useEffect(() => {
    void Promise.all([loadUserTheme(), loadBasemap()]).then(([userTheme, basemap]) => {
      setUserTheme(userTheme);
      setBasemap(basemap);
      setPreferencesRestored(true);
    });
  }, [setUserTheme, setBasemap]);

  useEffect(() => {
    loadStoredLanguage().catch((error: unknown) =>
      logger.warn("Loading the stored language failed", { errorMessage: String(error) }),
    );
    void pruneTrailCardCache();
    initOnlineStatus();
    initMapTiler();
    void initMapCache();
  }, []);

  useEffect(() => {
    if (!user) return;
    registerForPushNotificationsAsync().catch((error: unknown) =>
      logger.error("Push notification registration failed", { errorMessage: String(error) }),
    );
  }, [user]);

  const [fontsLoaded, fontError] = useFonts({ Inter_600SemiBold });

  useEffect(() => {
    if (fontError) logger.warn("Font loading failed", { errorMessage: String(fontError) });
  }, [fontError]);

  // keep-comment: nothing until the session resolves, or the signed-out screens blink at startup
  if (isLoading || !preferencesRestored || (!fontsLoaded && !fontError)) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={theme}>
        <StatusBar style={statusBarStyle} />
        <GestureHandlerRootView>
          <View testID="root-container" style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <PaperProvider theme={theme}>
              <NotificationHandler />
              <ActiveRecordingHandler />
              <Stack screenOptions={{ statusBarStyle: Platform.OS === "ios" ? statusBarStyle : undefined }}>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              </Stack>
              {/* keep-comment: a Portal, so it must stay inside PaperProvider's portal host */}
              <ConsentDialog />
              <BannedWriteDialog />
              <SessionRecovery />
              <DialogHost />
            </PaperProvider>
            {/* keep-comment: after the portal host, so it draws over every modal and dialog */}
            <PaperThemeProvider theme={theme}>
              <GlobalSnackbar />
            </PaperThemeProvider>
            <EnvironmentBadge environment={APP_ENVIRONMENT} />
          </View>
        </GestureHandlerRootView>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
