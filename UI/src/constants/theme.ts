import {
  DarkTheme as NavigationDarkTheme,
  DefaultTheme as NavigationDefaultTheme,
} from "@react-navigation/native";
import merge from "deepmerge";
import {
  MD3DarkTheme,
  MD3LightTheme,
  adaptNavigationTheme,
} from "react-native-paper";

const { LightTheme, DarkTheme } = adaptNavigationTheme({
  reactNavigationLight: NavigationDefaultTheme,
  reactNavigationDark: NavigationDarkTheme,
});

const CombinedDefaultTheme = merge(MD3LightTheme, LightTheme);
const CombinedDarkTheme = merge(MD3DarkTheme, DarkTheme);

export const AppDefaultTheme = merge(CombinedDefaultTheme, {
  colors: {
    primary: "rgb(12, 41, 15)",
    onPrimary: "rgb(255, 255, 255)",
    primaryContainer: "rgb(168, 245, 166)",
    onPrimaryContainer: "rgb(0, 33, 5)",
    secondary: "rgb(82, 99, 79)",
    onSecondary: "rgb(255, 255, 255)",
    secondaryContainer: "rgb(213, 232, 207)",
    onSecondaryContainer: "rgb(16, 31, 16)",
    tertiary: "rgb(57, 101, 107)",
    onTertiary: "rgb(255, 255, 255)",
    tertiaryContainer: "rgb(188, 235, 241)",
    onTertiaryContainer: "rgb(0, 31, 35)",
    error: "rgb(186, 26, 26)",
    onError: "rgb(255, 255, 255)",
    errorContainer: "rgb(255, 218, 214)",
    onErrorContainer: "rgb(65, 0, 2)",
    background: "rgb(252, 253, 247)",
    onBackground: "rgb(26, 28, 25)",
    surface: "rgb(252, 253, 247)",
    onSurface: "rgb(26, 28, 25)",
    surfaceVariant: "rgb(222, 229, 217)",
    onSurfaceVariant: "rgb(66, 73, 64)",
    outline: "rgb(114, 121, 111)",
    outlineVariant: "rgb(194, 201, 189)",
    shadow: "rgb(0, 0, 0)",
    scrim: "rgb(0, 0, 0)",
    inverseSurface: "rgb(47, 49, 45)",
    inverseOnSurface: "rgb(240, 241, 235)",
    inversePrimary: "rgb(140, 216, 140)",
    elevation: {
      level0: "transparent",
      level1: "rgb(241, 246, 237)",
      level2: "rgb(235, 241, 231)",
      level3: "rgb(228, 237, 225)",
      level4: "rgb(226, 236, 223)",
      level5: "rgb(222, 233, 219)",
    },
    surfaceDisabled: "rgba(26, 28, 25, 0.12)",
    onSurfaceDisabled: "rgba(26, 28, 25, 0.38)",
    backdrop: "rgba(44, 50, 42, 0.4)",
  },
});

export const AppDarkTheme = merge(CombinedDarkTheme, {
  colors: {
    primary: "rgb(140, 216, 140)",
    onPrimary: "rgb(0, 57, 14)",
    primaryContainer: "rgb(0, 83, 24)",
    onPrimaryContainer: "rgb(168, 245, 166)",
    secondary: "rgb(185, 204, 180)",
    onSecondary: "rgb(37, 52, 36)",
    secondaryContainer: "rgb(59, 75, 57)",
    onSecondaryContainer: "rgb(213, 232, 207)",
    tertiary: "rgb(161, 206, 213)",
    onTertiary: "rgb(0, 54, 60)",
    tertiaryContainer: "rgb(31, 77, 83)",
    onTertiaryContainer: "rgb(188, 235, 241)",
    error: "rgb(255, 180, 171)",
    onError: "rgb(105, 0, 5)",
    errorContainer: "rgb(147, 0, 10)",
    onErrorContainer: "rgb(255, 180, 171)",
    background: "rgb(26, 28, 25)",
    onBackground: "rgb(226, 227, 221)",
    surface: "rgb(26, 28, 25)",
    onSurface: "rgb(226, 227, 221)",
    surfaceVariant: "rgb(66, 73, 64)",
    onSurfaceVariant: "rgb(194, 201, 189)",
    outline: "rgb(140, 147, 136)",
    outlineVariant: "rgb(66, 73, 64)",
    shadow: "rgb(0, 0, 0)",
    scrim: "rgb(0, 0, 0)",
    inverseSurface: "rgb(226, 227, 221)",
    inverseOnSurface: "rgb(47, 49, 45)",
    inversePrimary: "rgb(12, 41, 15)",
    elevation: {
      level0: "transparent",
      level1: "rgb(32, 37, 31)",
      level2: "rgb(35, 43, 34)",
      level3: "rgb(39, 49, 38)",
      level4: "rgb(40, 51, 39)",
      level5: "rgb(42, 54, 41)",
    },
    surfaceDisabled: "rgba(226, 227, 221, 0.12)",
    onSurfaceDisabled: "rgba(226, 227, 221, 0.38)",
    backdrop: "rgba(44, 50, 42, 0.4)",
  },
});
