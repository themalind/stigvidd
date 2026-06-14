import { authLoadingAtom, initAuthAtom, userAtom } from "@/atoms/auth-atoms";
import { pruneTrailCardCache } from "@/hooks/useTrailCard";
import { pruneTrailPathCache } from "@/services/trail-path-cache";
import { loadUserTheme, userThemeAtom } from "@/atoms/user-theme-atom";
import { GlobalSnackbar } from "@/components/global-snackbar";
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
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { queryClientAtom } from "jotai-tanstack-query";
import { Inter_600SemiBold, useFonts } from "@expo-google-fonts/inter";
import React, { useEffect, useMemo, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { PaperProvider } from "react-native-paper";
import "react-native-reanimated";

function NotificationHandler() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAtomValue(userAtom);
  const lastResponse = Notifications.useLastNotificationResponse();

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
  useEffect(() => {
    if (!lastResponse || !user) return;
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
  const initAuth = useSetAtom(initAuthAtom);
  const setUserTheme = useSetAtom(userThemeAtom);
  const theme = useUserTheme();
  const [user] = useAtom(userAtom);
  const authLoading = useAtomValue(authLoadingAtom);
  const statusBarStyle = theme.dark ? "light" : "dark";

  // stableKey is null until auth has resolved for the first time.
  // This ensures the component tree mounts once with the correct key,
  // so there is no remount-blink at startup. Subsequent changes (login/logout)
  // still trigger a remount, resetting all local state as before.
  const [stableKey, setStableKey] = useState<string | null>(null);
  useEffect(() => {
    if (!authLoading) {
      setStableKey(user?.uid ?? "guest");
    }
  }, [user, authLoading]);

  // Fresh QueryClient per stableKey — resets cache on login/logout.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const queryClient = useMemo(() => new QueryClient(), [stableKey]);

  const setQueryClient = useSetAtom(queryClientAtom);
  useEffect(() => {
    setQueryClient(queryClient);
  }, [queryClient, setQueryClient]);

  // Fetch location on mount
  useInitLocation();

  useEffect(() => {
    const unsubscribe = initAuth();
    return () => unsubscribe?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load theme
  useEffect(() => {
    loadUserTheme().then(setUserTheme);
  }, [setUserTheme]);

  useEffect(() => {
    loadStoredLanguage();
    pruneTrailPathCache();
    pruneTrailCardCache();
  }, []);

  // Register for push notifications once the user is signed in.
  useEffect(() => {
    if (!user) return;
    registerForPushNotificationsAsync().catch(console.error);
  }, [user?.uid]);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    NavigationBar.setButtonStyleAsync(theme.dark ? "light" : "dark");
  }, [theme.dark]);

  const [fontsLoaded] = useFonts({ Inter_600SemiBold });

  // Render nothing until auth has resolved — prevents the remount-blink that
  // happened when the key changed from "guest" to user.uid at startup.
  // Firebase reads auth state from local cache so this is only ~100–200 ms.
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
