import { AppDefaultTheme } from "@/constants/theme";
import { MapMarkerFilter } from "@/data/types";

// Marker categories that have their own coloured pin on the map. "accessibility"
// is a cross-cutting modifier (filters every category to accessible items), not a
// marker type of its own, so it is excluded here.
export type MarkerCategory = Exclude<keyof MapMarkerFilter, "accessibility">;

export interface MarkerColors {
  fill: string;
  stroke: string;
}

// The basemap is always the light Thunderforest "Outdoors" style — even in the
// app's dark mode, since there is no dark topo variant (see map-style.ts). So
// markers always use the light palette: it reads best on that map and the light
// colours are simply nicer. These are theme-independent on purpose — a single
// source of truth shared by the map's CircleLayers and the filter menu legend so
// a category's pin always matches its filter swatch.
const colors = AppDefaultTheme.colors;

export const MARKER_COLORS: Record<MarkerCategory, MarkerColors> = {
  trails: { fill: colors.primary, stroke: colors.onPrimary },
  shelters: { fill: colors.tertiary, stroke: colors.onTertiary },
  firePits: { fill: colors.secondary, stroke: colors.onSecondary },
};
