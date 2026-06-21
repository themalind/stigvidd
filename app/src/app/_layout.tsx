import { pruneTrailCardCache } from "@/hooks/useTrailCard";
import { loadUserTheme, userThemeAtom } from "@/atoms/user-theme-atom";
import { GlobalSnackbar } from "@/components/global-snackbar";
import { useAppState } from "@/hooks/useAppState";
import { useInitLocation } from "@/hooks/useInitLocation";
import { useUserTheme } from "@/hooks/useUserTheme";
import { loadStoredLanguage } from "@/i18n";
import "@/services/location-task";
import {
  NOTIFICATION_QUERY_KEYS,
  NOTIFICATION_ROUTES,
  registerForPushNotificationsAsync,
} from "@/services/notifications";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import * as NavigationBar from "expo-navigation-bar";
import * as Notifications from "expo-notifications";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSetAtom } from "jotai";
import { queryClientAtom } from "jotai-tanstack-query";
import { Inter_600SemiBold, useFonts } from "@expo-google-fonts/inter";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { PaperProvider } from "react-native-paper";
import "react-native-reanimated";
import { useAuth, useInitAuth } from "@/components/auth/auth-provider";


function NotificationHandler() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const lastResponse = Notifications.useLastNotificationResponse();
  const handledNotificationId = useRef<string | null>(null);

  // Foreground: notification arrives while app is open — just refresh data, no navigation.
  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      const type = notification.request.content.data?.type as string | undefined;
      const keys = type ? NOTIFICATION_QUERY_KEYS[type] : undefined;
      if (keys) queryClient.invalidateQueries({ queryKey: keys });
    });
    return () => subscription.remove();
  }, [queryClient]);

  // Background tap or cold-start tap: navigate to the right screen after auth resolves.
  // handledNotificationId prevents re-navigation if the app is restarted after a tap.
  useEffect(() => {
    if (!lastResponse || !user) return;
    const notifId = lastResponse.notification.request.identifier;
    if (notifId === handledNotificationId.current) return;
    handledNotificationId.current = notifId;
    const type = lastResponse.notification.request.content.data?.type as string | undefined;
    if (!type) return;
    const keys = NOTIFICATION_QUERY_KEYS[type];
    if (keys) queryClient.invalidateQueries({ queryKey: keys });
    const route = NOTIFICATION_ROUTES[type];
    if (route) router.push(route as never);
  }, [lastResponse, user, queryClient, router]);

  return null;
}

export default function RootLayout() {
  const setUserTheme = useSetAtom(userThemeAtom);
  const theme = useUserTheme();
  const statusBarStyle = theme.dark ? "light" : "dark";

  // Restore the Keycloak session once on startup (outside the render gate below).
  useInitAuth();
  const { user, isAuthenticated, isLoading } = useAuth();

  // stableKey is null until auth has resolved for the first time.
  // This ensures the component tree mounts once with the correct key,
  // so there is no remount-blink at startup. Subsequent changes (login/logout)
  // still trigger a remount, resetting all local state as before.
  const [stableKey, setStableKey] = useState<string | null>(null);
  const prevStableKey = useRef<string | null>(null);
  useEffect(() => {
      if (isLoading) return;
      setStableKey((isAuthenticated && user?.id) ? user.id : "guest");
  }, [user, isAuthenticated, isLoading]);

  const router = useRouter();
  useEffect(() => {
    // Navigate to profile after login remount. prevStableKey is above the key
    // boundary so it survives the GestureHandlerRootView remount, letting us
    // detect "guest → uid" (login) vs a cold start when already authenticated.
    if (prevStableKey.current === "guest" && stableKey && user) {
      router.replace("/(tabs)/(profile-stack)/profile-page");
    }
    prevStableKey.current = stableKey;
    // Intentionally keyed on stableKey only — this should run once per login/logout
    // remount, not whenever router/user identities change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stableKey]);

  // Fresh QueryClient per stableKey — resets cache on login/logout.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const queryClient = useMemo(() => new QueryClient(), [stableKey]);

  const setQueryClient = useSetAtom(queryClientAtom);
  useEffect(() => {
    setQueryClient(queryClient);
  }, [queryClient, setQueryClient]);

  // Fetch location on mount
  useInitLocation();

  // Wires AppState changes to React Query's focusManager, so queries refetch
  // when the app returns to the foreground — regardless of how it was opened
  // (notification tap, app switcher, or tapping the home screen icon).
  useAppState();

  // Load theme
  useEffect(() => {
    loadUserTheme().then(setUserTheme);
  }, [setUserTheme]);

  useEffect(() => {
    loadStoredLanguage();
    pruneTrailCardCache();
  }, []);

  // Register for push notifications once the user is signed in.
  useEffect(() => {
    if (!user) return;
    registerForPushNotificationsAsync().catch(console.error);
  }, [user]);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    NavigationBar.setButtonStyleAsync(theme.dark ? "light" : "dark");
  }, [theme.dark]);

  const [fontsLoaded] = useFonts({ Inter_600SemiBold });

  // Render nothing until auth has resolved — prevents the remount-blink that
  // happened when the key changed from "guest" to user.uid at startup.
  // Session is restored from the stored refresh token, so this is brief.
  if (stableKey === null || !fontsLoaded) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <PaperProvider theme={theme}>
        <StatusBar style={statusBarStyle} />
        <GestureHandlerRootView key={stableKey}>
          <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <NotificationHandler />
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            </Stack>
            <GlobalSnackbar />
          </View>
        </GestureHandlerRootView>
      </PaperProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
