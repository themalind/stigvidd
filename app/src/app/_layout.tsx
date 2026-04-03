import { initAuthAtom, userAtom } from "@/atoms/auth-atoms";
import { loadUserTheme, userThemeAtom } from "@/atoms/user-theme-atom";
import { GlobalSnackbar } from "@/components/global-snackbar";
import { useInitLocation } from "@/hooks/useInitLocation";
import { useUserTheme } from "@/hooks/useUserTheme";
import "@/services/location-task";
import * as NavigationBar from "expo-navigation-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useAtom, useSetAtom } from "jotai";
import { queryClientAtom } from "jotai-tanstack-query";
import React, { useEffect, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { PaperProvider } from "react-native-paper";
import "react-native-reanimated";

export default function RootLayout() {
  const initAuth = useSetAtom(initAuthAtom);
  const setUserTheme = useSetAtom(userThemeAtom);
  const theme = useUserTheme();
  const [user] = useAtom(userAtom);
  const statusBarStyle = theme.dark ? "light" : "dark";

  // Create a unique key based on the current user
  // When this key changes (user logs in/out), React will unmount and remount
  // the entire component tree, resetting all local state
  const appKey = user?.uid || "guest";

  // Create a QueryClient with useMemo to avoid recreating on every render.
  // appKey as dependency ensures a fresh QueryClient (empty cache) when user changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const queryClient = useMemo(() => new QueryClient(), [appKey]);

  // Sync queryClientAtom (used by jotai-tanstack-query atoms) with the same QueryClient
  // as QueryClientProvider so there is only one QueryClient in the app.
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

  // Keep Android navigation bar color in sync with the tab bar background
  useEffect(() => {
    NavigationBar.setBackgroundColorAsync(theme.colors.background);
  }, [theme.colors.background]);

  return (
    <QueryClientProvider client={queryClient}>
      <PaperProvider theme={theme}>
        <StatusBar style={statusBarStyle} />
        <GestureHandlerRootView key={appKey}>
          <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
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
