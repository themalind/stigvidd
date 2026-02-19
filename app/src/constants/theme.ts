import { DarkTheme as NavigationDarkTheme, DefaultTheme as NavigationDefaultTheme } from "@react-navigation/native";
import merge from "deepmerge";
import { MD3DarkTheme, MD3LightTheme, adaptNavigationTheme } from "react-native-paper";

const { LightTheme, DarkTheme } = adaptNavigationTheme({
  reactNavigationLight: NavigationDefaultTheme,
  reactNavigationDark: NavigationDarkTheme,
});

const CombinedDefaultTheme = merge(MD3LightTheme, LightTheme);
const CombinedDarkTheme = merge(MD3DarkTheme, DarkTheme);

export const AppDefaultTheme = merge(CombinedDefaultTheme, {
  colors: {
    primary: "hsl(100, 45%, 12%)",
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
    background: "hsl(39, 19%, 90%)",
    onBackground: "rgb(26, 28, 25)",
    surface: "rgb(255, 255, 255)",
    onSurface: "rgb(26, 28, 25)",
    surfaceVariant: "rgb(222, 229, 217)",
    onSurfaceVariant: "rgb(66, 73, 64)",
    outline: "rgb(114, 121, 111)",
    outlineVariant: "rgb(194, 201, 189)",
    shadow: "rgb(0, 0, 0)",
    scrim: "rgb(0, 0, 0)",
    inverseSurface: "hsl(90, 4%, 18%)",
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
    primary: "rgb(66, 73, 64)",
    onPrimary: "rgb(255,255,255)",
    primaryContainer: "rgb(31, 77, 83)",
    onPrimaryContainer: "rgb(0,0,0)",
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
    background: "rgb(0,0,0)",
    onBackground: "rgb(226, 227, 221)",
    surface: "rgb(26, 28, 25)",
    onSurface: "rgb(226, 227, 221)",
    surfaceVariant: "rgb(71, 71, 78)",
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

export const retroMapTheme = [
  {
    featureType: "administrative",
    elementType: "labels.text.fill",
    stylers: [
      {
        color: "#6195a0",
      },
    ],
  },
  {
    featureType: "administrative.province",
    elementType: "geometry.stroke",
    stylers: [
      {
        visibility: "off",
      },
    ],
  },
  {
    featureType: "landscape",
    elementType: "geometry",
    stylers: [
      {
        lightness: "0",
      },
      {
        saturation: "0",
      },
      {
        color: "#f5f5f2",
      },
      {
        gamma: "1",
      },
    ],
  },
  {
    featureType: "landscape.man_made",
    elementType: "all",
    stylers: [
      {
        lightness: "-3",
      },
      {
        gamma: "1.00",
      },
    ],
  },
  {
    featureType: "landscape.natural.terrain",
    elementType: "all",
    stylers: [
      {
        visibility: "off",
      },
    ],
  },
  {
    featureType: "poi",
    elementType: "all",
    stylers: [
      {
        visibility: "off",
      },
    ],
  },
  {
    featureType: "poi.park",
    elementType: "geometry.fill",
    stylers: [
      {
        color: "#bae5ce",
      },
      {
        visibility: "on",
      },
    ],
  },
  {
    featureType: "road",
    elementType: "all",
    stylers: [
      {
        saturation: -100,
      },
      {
        lightness: 45,
      },
      {
        visibility: "simplified",
      },
    ],
  },
  {
    featureType: "road.highway",
    elementType: "all",
    stylers: [
      {
        visibility: "simplified",
      },
    ],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.fill",
    stylers: [
      {
        color: "#fac9a9",
      },
      {
        visibility: "simplified",
      },
    ],
  },
  {
    featureType: "road.highway",
    elementType: "labels.text",
    stylers: [
      {
        color: "#4e4e4e",
      },
    ],
  },
  {
    featureType: "road.arterial",
    elementType: "labels.text.fill",
    stylers: [
      {
        color: "#787878",
      },
    ],
  },
  {
    featureType: "road.arterial",
    elementType: "labels.icon",
    stylers: [
      {
        visibility: "off",
      },
    ],
  },
  {
    featureType: "transit",
    elementType: "all",
    stylers: [
      {
        visibility: "simplified",
      },
    ],
  },
  {
    featureType: "transit.station.airport",
    elementType: "labels.icon",
    stylers: [
      {
        hue: "#0a00ff",
      },
      {
        saturation: "-77",
      },
      {
        gamma: "0.57",
      },
      {
        lightness: "0",
      },
    ],
  },
  {
    featureType: "transit.station.rail",
    elementType: "labels.text.fill",
    stylers: [
      {
        color: "#43321e",
      },
    ],
  },
  {
    featureType: "transit.station.rail",
    elementType: "labels.icon",
    stylers: [
      {
        hue: "#ff6c00",
      },
      {
        lightness: "4",
      },
      {
        gamma: "0.75",
      },
      {
        saturation: "-68",
      },
    ],
  },
  {
    featureType: "water",
    elementType: "all",
    stylers: [
      {
        color: "#eaf6f8",
      },
      {
        visibility: "on",
      },
    ],
  },
  {
    featureType: "water",
    elementType: "geometry.fill",
    stylers: [
      {
        color: "#c7eced",
      },
    ],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [
      {
        lightness: "-49",
      },
      {
        saturation: "-53",
      },
      {
        gamma: "0.79",
      },
    ],
  },
];

export const nightMapTheme = [
  { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d59563" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d59563" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#263c3f" }],
  },
  {
    featureType: "poi.park",
    elementType: "labels.text.fill",
    stylers: [{ color: "#6b9a76" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#38414e" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#212a37" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#9ca5b3" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#746855" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#1f2835" }],
  },
  {
    featureType: "road.highway",
    elementType: "labels.text.fill",
    stylers: [{ color: "#f3d19c" }],
  },
  {
    featureType: "transit",
    elementType: "geometry",
    stylers: [{ color: "#2f3948" }],
  },
  {
    featureType: "transit.station",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d59563" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#17263c" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#515c6d" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.stroke",
    stylers: [{ color: "#17263c" }],
  },
];
