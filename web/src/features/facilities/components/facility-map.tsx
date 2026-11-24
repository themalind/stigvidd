// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Map as MapLibreMap, MapMouseEvent } from "maplibre-gl";
import { useEffect, useLayoutEffect, useRef } from "react";
import { useMapLibre } from "@/hooks/use-maplibre";
import { MAP_COLORS, upsertSource } from "@/lib/maplibre";
import { cn } from "@/lib/utils";
import type { LngLat } from "@/utils/geometry-edit";

export interface MapNeighbour {
  name: string;
  position: LngLat;
}

interface Props {
  position: LngLat | null;
  neighbours?: MapNeighbour[];
  satellite: boolean;
  onPick?: (position: LngLat) => void;
  className?: string;
}

const POINT = MAP_COLORS.end;
const NEIGHBOUR = "#6b7280";

function collection(features: GeoJSON.Feature[]): GeoJSON.FeatureCollection {
  return { type: "FeatureCollection", features };
}

function point(coordinates: LngLat, name = ""): GeoJSON.Feature {
  return { type: "Feature", properties: { name }, geometry: { type: "Point", coordinates } };
}

function draw(map: MapLibreMap, position: LngLat | null, neighbours: MapNeighbour[]) {
  upsertSource(map, "neighbours", collection(neighbours.map((n) => point(n.position, n.name))));
  upsertSource(map, "facility", collection(position ? [point(position)] : []));

  if (map.getLayer("facility")) return;

  map.addLayer({
    id: "neighbours",
    type: "circle",
    source: "neighbours",
    paint: {
      "circle-radius": 4,
      "circle-color": NEIGHBOUR,
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 1,
    },
  });
  map.addLayer({
    id: "facility",
    type: "circle",
    source: "facility",
    paint: { "circle-radius": 9, "circle-color": POINT, "circle-stroke-color": "#ffffff", "circle-stroke-width": 3 },
  });
}

const NO_NEIGHBOURS: MapNeighbour[] = [];
// keep-comment: long enough that "57.72" is not followed through 5 and 57 while it is typed
const FOLLOW_DELAY_MS = 400;

function pointKey(lng: number, lat: number): string {
  return `${lng.toFixed(6)},${lat.toFixed(6)}`;
}

export function FacilityMap({ position, neighbours = NO_NEIGHBOURS, satellite, onPick, className }: Props) {
  const onPickRef = useRef(onPick);
  useLayoutEffect(() => {
    onPickRef.current = onPick;
  });
  const picked = useRef<string | null>(null);

  const { containerRef, mapRef, redraw } = useMapLibre({
    satellite,
    zoom: 15,
    draw: (map) => draw(map, position, neighbours),
    fitPoints: () => (position ? [position] : []),
    fitPadding: 50,
    setup: (map) => {
      map.on("click", (event: MapMouseEvent) => {
        if (!onPickRef.current) return;
        picked.current = pointKey(event.lngLat.lng, event.lngLat.lat);
        onPickRef.current([event.lngLat.lng, event.lngLat.lat]);
      });
    },
  });

  const lng = position?.[0];
  const lat = position?.[1];
  useEffect(() => redraw(), [redraw, lng, lat, neighbours]);

  // keep-comment: follows a position typed into the form, which the map's first fit never saw; a clicked one is already in view
  useEffect(() => {
    if (lng === undefined || lat === undefined || picked.current === pointKey(lng, lat)) return;
    const timer = setTimeout(() => mapRef.current?.jumpTo({ center: [lng, lat] }), FOLLOW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [mapRef, lng, lat]);

  return (
    // keep-comment: shrink-0, since overflow-hidden drops a flex item's min-height to 0 and a scrolling form column squeezed it to a strip
    <div className={cn("relative h-[480px] w-full shrink-0 overflow-hidden rounded-sm border", className)}>
      {/* keep-comment: maplibre's unlayered .maplibregl-map sets position: relative, which beats Tailwind's layered "absolute", so size it explicitly (docs/notes/maplibre-css-beats-tailwind-v4-layered-utilities.md) */}
      <div
        ref={containerRef}
        data-testid="facility-map"
        className={cn("h-full w-full", onPick && "cursor-crosshair")}
      />
      {!position && (
        <p className="pointer-events-none absolute top-3 left-3 rounded-sm border bg-background/95 px-3 py-2 text-xs">
          {onPick ? "No position. Click the map to place it." : "This facility has no position."}
        </p>
      )}
    </div>
  );
}
