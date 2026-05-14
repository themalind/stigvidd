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
    primary: "hsl(195, 65%, 22%)",
    onPrimary: "rgb(255, 255, 255)",
    primaryContainer: "rgb(196, 226, 234)",
    onPrimaryContainer: "rgb(0, 32, 42)",
    secondary: "rgb(108, 96, 84)",
    onSecondary: "rgb(255, 255, 255)",
    secondaryContainer: "rgb(232, 222, 210)",
    onSecondaryContainer: "rgb(40, 28, 18)",
    tertiary: "rgb(196, 92, 38)",
    onTertiary: "rgb(255, 255, 255)",
    tertiaryContainer: "rgb(252, 214, 196)",
    onTertiaryContainer: "rgb(58, 18, 0)",
    warning: "#dd2222",
    error: "rgb(186, 26, 26)",
    onError: "rgb(255, 255, 255)",
    errorContainer: "rgb(255, 218, 214)",
    onErrorContainer: "rgb(65, 0, 2)",
    background: "hsl(180, 12%, 94%)",
    onBackground: "rgb(22, 28, 30)",
    surface: "rgb(252, 254, 254)",
    onSurface: "rgb(22, 28, 30)",
    surfaceVariant: "rgb(216, 226, 226)",
    onSurfaceVariant: "rgb(60, 70, 72)",
    outline: "rgb(120, 132, 134)",
    outlineVariant: "rgb(204, 214, 214)",
    shadow: "rgb(0, 0, 0)",
    scrim: "rgb(0, 0, 0)",
    inverseSurface: "hsl(195, 14%, 16%)",
    inverseOnSurface: "rgb(240, 244, 244)",
    inversePrimary: "rgb(160, 208, 220)",
    elevation: {
      level0: "transparent",
      level1: "rgb(240, 244, 244)",
      level2: "rgb(234, 240, 240)",
      level3: "rgb(228, 236, 236)",
      level4: "rgb(226, 234, 234)",
      level5: "rgb(222, 232, 232)",
    },
    surfaceDisabled: "rgba(22, 28, 30, 0.12)",
    onSurfaceDisabled: "rgba(22, 28, 30, 0.38)",
    backdrop: "rgba(20, 40, 44, 0.4)",
  },
});

export const AppDarkTheme = merge(CombinedDarkTheme, {
  colors: {
    primary: "hsl(25, 92%, 58%)",
    onPrimary: "rgb(60, 22, 0)",
    primaryContainer: "rgb(132, 60, 14)",
    onPrimaryContainer: "rgb(255, 220, 192)",
    secondary: "rgb(220, 188, 168)",
    onSecondary: "rgb(58, 36, 24)",
    secondaryContainer: "rgb(82, 58, 44)",
    onSecondaryContainer: "rgb(252, 220, 200)",
    tertiary: "rgb(248, 208, 110)",
    onTertiary: "rgb(56, 40, 0)",
    tertiaryContainer: "rgb(82, 58, 0)",
    onTertiaryContainer: "rgb(252, 226, 156)",
    warning: "#ffaa3c",
    error: "hsl(0, 76%, 65%)",
    onError: "rgb(105, 0, 5)",
    errorContainer: "hsl(0, 28%, 18%)",
    onErrorContainer: "rgb(255, 180, 171)",
    background: "rgb(0, 0, 0)",
    onBackground: "rgb(238, 230, 224)",
    surface: "hsl(20, 5%, 11%)",
    onSurface: "rgb(238, 230, 224)",
    surfaceVariant: "hsl(22, 8%, 17%)",
    onSurfaceVariant: "rgb(216, 200, 188)",
    outline: "hsl(25, 55%, 52%)",
    outlineVariant: "rgb(60, 50, 44)",
    shadow: "rgb(0, 0, 0)",
    scrim: "rgb(0, 0, 0)",
    inverseSurface: "rgb(238, 230, 224)",
    inverseOnSurface: "rgb(50, 38, 30)",
    inversePrimary: "hsl(25, 90%, 38%)",
    elevation: {
      level0: "transparent",
      level1: "rgb(18, 14, 10)",
      level2: "rgb(28, 22, 16)",
      level3: "rgb(38, 28, 20)",
      level4: "rgb(42, 30, 22)",
      level5: "rgb(48, 34, 24)",
    },
    surfaceDisabled: "rgba(238, 230, 224, 0.12)",
    onSurfaceDisabled: "rgba(238, 230, 224, 0.38)",
    backdrop: "rgba(0, 0, 0, 0.6)",
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
