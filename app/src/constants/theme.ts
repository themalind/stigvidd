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
    // Primär (orange accent — knappar, toggles, ikoner, fokuserade fält)
    primary: "hsl(25, 95%, 55%)",
    onPrimary: "hsl(0, 0%, 8%)",
    primaryContainer: "hsl(25, 60%, 22%)",
    onPrimaryContainer: "hsl(25, 90%, 88%)",

    // Sekundär (neutral grå — sekundära knappar, chips)
    secondary: "hsl(0, 0%, 80%)",
    onSecondary: "hsl(0, 0%, 10%)",
    secondaryContainer: "hsl(0, 0%, 20%)",
    onSecondaryContainer: "hsl(0, 0%, 92%)",

    // Tertiär (svagare orange-variant för subtilare accenter)
    tertiary: "hsl(25, 70%, 70%)",
    onTertiary: "hsl(25, 80%, 12%)",
    tertiaryContainer: "hsl(25, 40%, 18%)",
    onTertiaryContainer: "hsl(25, 85%, 90%)",

    // Varning & fel
    warning: "hsl(35, 95%, 60%)",
    error: "hsl(0, 75%, 62%)",
    onError: "hsl(0, 0%, 100%)",
    errorContainer: "hsl(0, 35%, 20%)",
    onErrorContainer: "hsl(0, 90%, 90%)",

    // Bakgrund & ytor (svart → mörkgrå-trappa)
    background: "hsl(0, 0%, 4%)",
    onBackground: "hsl(0, 0%, 96%)",
    surface: "hsl(0, 0%, 10%)", // modaler/kort, som "Lägg till lägerplats"
    onSurface: "hsl(0, 0%, 96%)",
    surfaceVariant: "hsl(0, 0%, 16%)", // input-bakgrund, listrader
    onSurfaceVariant: "hsl(0, 0%, 75%)",

    // Konturer (orange som i bilden — input-fältens kanter)
    outline: "hsl(25, 90%, 55%)",
    outlineVariant: "hsl(0, 0%, 25%)",

    shadow: "rgb(0, 0, 0)",
    scrim: "rgb(0, 0, 0)",

    // Inverterade ytor (t.ex. snackbar)
    inverseSurface: "hsl(0, 0%, 94%)",
    inverseOnSurface: "hsl(0, 0%, 12%)",
    inversePrimary: "hsl(25, 90%, 40%)",

    // Elevation-trappa — mörkgrå med svag varm dragning
    elevation: {
      level0: "transparent",
      level1: "hsl(0, 0%, 9%)",
      level2: "hsl(0, 0%, 12%)",
      level3: "hsl(0, 0%, 14%)",
      level4: "hsl(0, 0%, 16%)",
      level5: "hsl(0, 0%, 18%)",
    },

    surfaceDisabled: "hsla(0, 0%, 96%, 0.12)",
    onSurfaceDisabled: "hsla(0, 0%, 96%, 0.38)",
    backdrop: "hsla(0, 0%, 0%, 0.6)",
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
