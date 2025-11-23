import { AppDarkTheme, AppDefaultTheme } from "@/constants/theme";
import * as NavigationBar from "expo-navigation-bar";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useAtom } from "jotai";
import React, { useEffect } from "react";
import { Platform, StyleSheet, useColorScheme, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { PaperProvider } from "react-native-paper";
import "react-native-reanimated";
import { userThemeAtom } from "../providers/user-theme-atom";

export default function RootLayout() {
  const [userTheme] = useAtom(userThemeAtom);
  const colorScheme = useColorScheme();

  let theme = colorScheme === "dark" ? AppDarkTheme : AppDefaultTheme;
  if (userTheme !== "auto") {
    theme = userTheme === "dark" ? AppDarkTheme : AppDefaultTheme;
  }

  useEffect(() => {
    if (Platform.OS === "android") {
      NavigationBar.setButtonStyleAsync(theme.dark ? "light" : "dark");
    }
  }, [theme.dark]);

  const statusBarStyle = "light";

  return (
    <PaperProvider theme={theme}>
      <StatusBar style={statusBarStyle} />
      <GestureHandlerRootView>
        <View
          style={[
            styles.container,
            { backgroundColor: theme.colors.background },
          ]}
        >
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          </Stack>
        </View>
      </GestureHandlerRootView>
    </PaperProvider>
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
