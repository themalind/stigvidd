import { userThemeAtom } from "@/atoms/user-theme-atom";
import { AppDarkTheme, AppDefaultTheme } from "@/constants/theme";
import * as NavigationBar from "expo-navigation-bar";
import { useAtom } from "jotai";
import { useEffect } from "react";
import { Platform, useColorScheme } from "react-native";

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
