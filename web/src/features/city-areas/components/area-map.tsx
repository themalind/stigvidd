// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { type ExpressionSpecification, type Map as MapLibreMap, Marker } from "maplibre-gl";
import { type ReactNode, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useMapLibre } from "@/hooks/use-maplibre";
import { fitTo, MAP_COLORS, upsertSource } from "@/lib/maplibre";
import type { AdminCityAreaBoundaryPreviewResponse, AdminCityAreaPreviewFacilityResponse } from "@/api/generated/model";
import type { BoundaryCoordinates } from "@/features/city-areas/api/city-areas";
import { useBoundaryEditor } from "@/features/city-areas/hooks/use-boundary-editor";

export interface AreaMapPlace {
  identifier: string;
  name: string;
  position: GeoJSON.Position;
}

export interface AreaMapTrail {
  identifier: string;
  path: number[][];
}

export interface AreaMapNeighbour {
  identifier: string;
  name: string;
  boundary: BoundaryCoordinates;
}

type Shapes = {
  neighbours: AreaMapNeighbour[];
  boundary: BoundaryCoordinates | null;
  suggestion: BoundaryCoordinates | null;
  trails: AreaMapTrail[];
  places: AreaMapPlace[];
  preview: AdminCityAreaBoundaryPreviewResponse | null;
};

const BOUNDARY = MAP_COLORS.start;
const SUGGESTION = "#e65100";
const TRAIL = MAP_COLORS.trail;
const PLACE = "#6a1b9a";
const NEIGHBOUR = "#616161";
const ADDED = "#00c853";
const REMOVED = "#d50000";
const PADDING = 40;
const CHANGE_COLOR: ExpressionSpecification = ["match", ["get", "change"], "added", ADDED, REMOVED];

function collection(features: GeoJSON.Feature[]): GeoJSON.FeatureCollection {
  return { type: "FeatureCollection", features };
}

function lines(paths: { path: number[][] }[], change?: string): GeoJSON.Feature[] {
  return paths
    .filter((trail) => trail.path.length > 1)
    .map((trail) => ({
      type: "Feature",
      properties: { change },
      geometry: { type: "LineString", coordinates: trail.path },
    }));
}

function points(positions: GeoJSON.Position[], change?: string): GeoJSON.Feature[] {
  return positions.map((coordinates) => ({
    type: "Feature",
    properties: { change },
    geometry: { type: "Point", coordinates },
  }));
}

function facilityPositions(facilities: AdminCityAreaPreviewFacilityResponse[]): GeoJSON.Position[] {
  return facilities.map((facility) => [facility.longitude, facility.latitude]);
}

function area(coordinates: BoundaryCoordinates | null, name?: string): GeoJSON.Feature[] {
  return coordinates && coordinates.length > 0
    ? [{ type: "Feature", properties: { name }, geometry: { type: "MultiPolygon", coordinates } }]
    : [];
}

function sources(shapes: Shapes): Record<string, GeoJSON.FeatureCollection> {
  const { neighbours, boundary, suggestion, trails, places, preview } = shapes;
  return {
    neighbours: collection(neighbours.flatMap((neighbour) => area(neighbour.boundary, neighbour.name))),
    boundary: collection(area(boundary)),
    suggestion: collection(area(suggestion)),
    trails: collection(lines(trails)),
    places: collection(points(places.map((place) => place.position))),
    "preview-trails": collection([
      ...lines(preview?.addedTrails ?? [], "added"),
      ...lines(preview?.removedTrails ?? [], "removed"),
    ]),
    "preview-places": collection([
      ...points(facilityPositions(preview?.addedFacilities ?? []), "added"),
      ...points(facilityPositions(preview?.removedFacilities ?? []), "removed"),
    ]),
  };
}

function areaMapPoints({
  boundary,
  suggestion,
  trails,
  places,
}: Pick<Shapes, "boundary" | "suggestion" | "trails" | "places">): GeoJSON.Position[] {
  const rings = [...(suggestion ?? []), ...(boundary ?? [])].flat(2);
  return [...rings, ...trails.flatMap((trail) => trail.path), ...places.map((place) => place.position)];
}

function ringArea(ring: GeoJSON.Position[]): number {
  const xs = ring.map(([x]) => x);
  const ys = ring.map(([, y]) => y);
  return (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
}

function labelPosition(boundary: BoundaryCoordinates): GeoJSON.Position | null {
  const rings = boundary.map((polygon) => polygon[0]).filter((ring) => ring && ring.length > 0);
  if (rings.length === 0) return null;
  const largest = rings.reduce((best, ring) => (ringArea(ring) > ringArea(best) ? ring : best));
  const xs = largest.map(([x]) => x);
  const ys = largest.map(([, y]) => y);
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
}

function nameLabel(name: string): HTMLElement {
  const element = document.createElement("span");
  element.className =
    "pointer-events-none rounded-xs bg-background/85 px-1.5 py-0.5 text-xs font-medium text-muted-foreground shadow-sm";
  element.textContent = name;
  return element;
}

function draw(map: MapLibreMap, props: Shapes) {
  for (const [id, data] of Object.entries(sources(props))) upsertSource(map, id, data);

  if (map.getLayer("boundary-fill")) return;

  map.addLayer({
    id: "neighbours-fill",
    type: "fill",
    source: "neighbours",
    paint: { "fill-color": NEIGHBOUR, "fill-opacity": 0.08 },
  });
  map.addLayer({
    id: "neighbours-line",
    type: "line",
    source: "neighbours",
    paint: { "line-color": NEIGHBOUR, "line-width": 1.5, "line-dasharray": [3, 2] },
  });
  map.addLayer({
    id: "boundary-fill",
    type: "fill",
    source: "boundary",
    paint: { "fill-color": BOUNDARY, "fill-opacity": 0.12 },
  });
  map.addLayer({
    id: "boundary-line",
    type: "line",
    source: "boundary",
    paint: { "line-color": BOUNDARY, "line-width": 2 },
  });
  map.addLayer({
    id: "suggestion-fill",
    type: "fill",
    source: "suggestion",
    paint: { "fill-color": SUGGESTION, "fill-opacity": 0.15 },
  });
  map.addLayer({
    id: "suggestion-line",
    type: "line",
    source: "suggestion",
    paint: { "line-color": SUGGESTION, "line-width": 2.5, "line-dasharray": [2, 1.5] },
  });
  map.addLayer({
    id: "trails",
    type: "line",
    source: "trails",
    layout: { "line-join": "round", "line-cap": "round" },
    paint: { "line-color": TRAIL, "line-width": 3 },
  });
  map.addLayer({
    id: "places",
    type: "circle",
    source: "places",
    paint: { "circle-radius": 6, "circle-color": PLACE, "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 },
  });
  map.addLayer({
    id: "preview-trails",
    type: "line",
    source: "preview-trails",
    layout: { "line-join": "round", "line-cap": "round" },
    paint: { "line-color": CHANGE_COLOR, "line-width": 4, "line-dasharray": [2, 1] },
  });
  map.addLayer({
    id: "preview-places",
    type: "circle",
    source: "preview-places",
    paint: {
      "circle-radius": 7,
      "circle-color": CHANGE_COLOR,
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 2,
    },
  });
}

type AreaMapProps = Shapes & {
  editing: BoundaryCoordinates | null;
  onEdit: (boundary: BoundaryCoordinates) => void;
};

export function AreaMap({ editing, onEdit, ...props }: AreaMapProps) {
  const [loadedMap, setLoadedMap] = useState<MapLibreMap | null>(null);
  const { containerRef, mapRef, redraw } = useMapLibre({
    satellite: false,
    zoom: 12,
    draw: (map) => draw(map, props),
    fitPoints: () => areaMapPoints(props),
    fitPadding: PADDING,
    setup: (map) => map.on("style.load", () => setLoadedMap(map)),
  });
  const { neighbours, boundary, suggestion, trails, places, preview } = props;
  const editor = useBoundaryEditor({ map: loadedMap, initial: editing, onChange: onEdit });

  useEffect(() => redraw(), [redraw, neighbours, boundary, suggestion, trails, places, preview]);

  // keep-comment: DOM labels, because the OSM fallback style has no glyphs to draw text with
  useEffect(() => {
    if (!loadedMap) return;
    const markers = neighbours.flatMap((neighbour) => {
      const position = labelPosition(neighbour.boundary);
      if (!position) return [];
      const [lng, lat] = position;
      return [new Marker({ element: nameLabel(neighbour.name) }).setLngLat([lng, lat]).addTo(loadedMap)];
    });
    return () => markers.forEach((marker) => marker.remove());
  }, [loadedMap, neighbours]);

  // keep-comment: a suggestion can reach past what the map first framed, so frame it when it arrives
  useEffect(() => {
    const map = mapRef.current;
    if (map && suggestion) {
      fitTo(map, areaMapPoints({ boundary, suggestion, trails, places }), { padding: PADDING });
    }
  }, [mapRef, suggestion, boundary, trails, places]);

  return (
    <div className="relative h-[420px] w-full overflow-hidden rounded-sm border">
      {/* keep-comment: maplibre's unlayered .maplibregl-map sets position: relative, so size it explicitly (docs/notes/maplibre-css-beats-tailwind-v4-layered-utilities.md) */}
      <div ref={containerRef} data-testid="area-map" className="h-full w-full" />
      {editing && (
        <div className="absolute top-3 left-3 flex flex-col gap-2 rounded-sm border bg-background/95 p-2 text-xs">
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={editor.drawPart}>
              Draw a part
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-destructive"
              onClick={editor.deleteSelected}
              disabled={!editor.hasSelection}
            >
              Delete selected part
            </Button>
          </div>
          <p className="max-w-64 text-muted-foreground">
            Click a part to select it, then drag its corners. Drag a midpoint to add a corner. Click the first corner to
            close a new part.
          </p>
        </div>
      )}
      <div className="pointer-events-none absolute bottom-3 left-3 flex flex-col gap-1 rounded-sm border bg-background/95 px-3 py-2 text-xs">
        <Legend swatch={<span className="size-3 border-2" style={{ borderColor: BOUNDARY }} />} label="Boundary" />
        {neighbours.length > 0 && (
          <Legend
            swatch={<span className="size-3 border-2 border-dashed" style={{ borderColor: NEIGHBOUR }} />}
            label="Other areas"
          />
        )}
        {suggestion && (
          <Legend
            swatch={<span className="size-3 border-2 border-dashed" style={{ borderColor: SUGGESTION }} />}
            label="Suggested boundary"
          />
        )}
        <Legend swatch={<span className="h-0 w-4 border-t-[3px]" style={{ borderColor: TRAIL }} />} label="Trail" />
        <Legend swatch={<span className="size-3 rounded-full" style={{ background: PLACE }} />} label="Facility" />
        {preview && (
          <>
            <Legend
              swatch={<span className="size-3 rounded-full" style={{ background: ADDED }} />}
              label="Saving adds"
            />
            <Legend
              swatch={<span className="size-3 rounded-full" style={{ background: REMOVED }} />}
              label="Saving removes"
            />
          </>
        )}
      </div>
    </div>
  );
}

function Legend({ swatch, label }: { swatch: ReactNode; label: string }) {
  return (
    <span className="flex items-center gap-2">
      {swatch}
      {label}
    </span>
  );
}
