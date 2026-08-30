// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

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
