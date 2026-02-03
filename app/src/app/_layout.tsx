import { initAuthAtom, userAtom } from "@/atoms/auth-atoms";
import { loadUserTheme, userThemeAtom } from "@/atoms/user-theme-atom";
import { GlobalSnackbar } from "@/components/global-snackbar";
import { useUserTheme } from "@/hooks/appUserTheme";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useAtom, useSetAtom } from "jotai";
import React, { useEffect, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { PaperProvider } from "react-native-paper";
import "react-native-reanimated";

export default function RootLayout() {
  const initAuth = useSetAtom(initAuthAtom);
  const setUserTheme = useSetAtom(userThemeAtom);
  const theme = useUserTheme();
  const user = useAtom(userAtom);
  const statusBarStyle = "light";

  // Create a QueryClient with useMemo to avoid recreating on every render.
  const queryClient = useMemo(() => new QueryClient(), []);

  useEffect(() => {
    const unsubscribe = initAuth();
    return () => unsubscribe?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clear React Query cache when user logs out
  useEffect(() => {
    if (!user) {
      queryClient.clear();
    }
  }, [user, queryClient]);

  // Ladda temat när komponenten mountas
  useEffect(() => {
    loadUserTheme().then(setUserTheme);
  }, [setUserTheme]);

  // Create a unique key based on the current user
  // When this key changes (user logs in/out), React will unmount and remount
  // the entire component tree, resetting all local state
  const appKey = user?.[0]?.uid || "guest";

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
