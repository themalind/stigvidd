import { AppDarkTheme, AppDefaultTheme } from "@/constants/theme";
import { useEffect } from "react";
import { Platform, useColorScheme } from "react-native";
import { userThemeAtom } from "@/providers/user-theme-atom";
import * as NavigationBar from "expo-navigation-bar";
import { useAtom } from "jotai";

export function useUserTheme() {
  const [userTheme] = useAtom(userThemeAtom);
  const colorScheme = useColorScheme();

  // Bestäm tema baserat på userTheme eller systemets colorScheme
  const theme =
    userTheme !== "auto"
      ? userTheme === "dark"
        ? AppDarkTheme
        : AppDefaultTheme
      : colorScheme === "dark"
        ? AppDarkTheme
        : AppDefaultTheme;

  // Uppdatera navigation bar på Android
  useEffect(() => {
    if (Platform.OS === "android") {
      NavigationBar.setButtonStyleAsync(theme.dark ? "light" : "dark");
    }
  }, [theme.dark]);

  return theme;
}
