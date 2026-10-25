// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import "maplibre-gl/dist/maplibre-gl.css";
import maplibregl, { type GeoJSONSource, type Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { hasSatellite, mapStyle } from "../hike-submissions/map-style";

type Coordinates = GeoJSON.Position[];
type LngLat = [number, number];

type Props = {
  feature: Coordinates;
  trail?: Coordinates | null;
  className?: string;
};

const FEATURE_COLOR = "#ea580c";
const TRAIL_COLOR = "#0ea5e9";

function collection(features: GeoJSON.Feature[]): GeoJSON.FeatureCollection {
  return { type: "FeatureCollection", features };
}

function sources(feature: Coordinates, trail: Coordinates | null): Record<string, GeoJSON.FeatureCollection> {
  const trailLine = trail ?? [];
  const last = feature.length - 1;

  return {
    feature: collection(
      feature.length < 2
        ? []
        : [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: feature } }],
    ),
    trail: collection(
      trailLine.length < 2
        ? []
        : [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: trailLine } }],
    ),
    "feature-ends": collection(
      feature.length === 0
        ? []
        : [
            { type: "Feature", properties: { role: "start" }, geometry: { type: "Point", coordinates: feature[0] } },
            { type: "Feature", properties: { role: "end" }, geometry: { type: "Point", coordinates: feature[last] } },
          ],
    ),
  };
}

function draw(map: MapLibreMap, feature: Coordinates, trail: Coordinates | null) {
  for (const [id, data] of Object.entries(sources(feature, trail))) {
    const source = map.getSource(id) as GeoJSONSource | undefined;
    if (source) source.setData(data);
    else map.addSource(id, { type: "geojson", data });
  }

  if (map.getLayer("feature-line")) return;

  map.addLayer({
    id: "trail-line",
    type: "line",
    source: "trail",
    layout: { "line-join": "round", "line-cap": "round" },
    paint: { "line-color": TRAIL_COLOR, "line-width": 7, "line-opacity": 0.65 },
  });
  map.addLayer({
    id: "feature-line-casing",
    type: "line",
    source: "feature",
    layout: { "line-join": "round", "line-cap": "round" },
    paint: { "line-color": "#ffffff", "line-width": 5 },
  });
  map.addLayer({
    id: "feature-line",
    type: "line",
    source: "feature",
    layout: { "line-join": "round", "line-cap": "round" },
    paint: { "line-color": FEATURE_COLOR, "line-width": 3 },
  });
  // keep-comment: a loop's start and end coincide, so start is its own layer drawn on top to keep both visible
  map.addLayer({
    id: "feature-end",
    type: "circle",
    source: "feature-ends",
    filter: ["==", ["get", "role"], "end"],
    paint: {
      "circle-radius": 5,
      "circle-color": "#ffffff",
      "circle-stroke-color": FEATURE_COLOR,
      "circle-stroke-width": 2,
    },
  });
  map.addLayer({
    id: "feature-start",
    type: "circle",
    source: "feature-ends",
    filter: ["==", ["get", "role"], "start"],
    paint: {
      "circle-radius": 6,
      "circle-color": FEATURE_COLOR,
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 2,
    },
  });
}

function bounds(feature: Coordinates, trail: Coordinates | null): maplibregl.LngLatBounds | null {
  const points = [...feature, ...(trail ?? [])] as LngLat[];
  if (points.length === 0) return null;

  const box = new maplibregl.LngLatBounds(points[0], points[0]);
  for (const point of points) box.extend(point);

  return box;
}

export function ProposalMap({ feature, trail, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const propsRef = useRef({ feature, trail: trail ?? null });
  const [satellite, setSatellite] = useState(false);
  const [shown, setShown] = useState({ feature: true, trail: true });

  useLayoutEffect(() => {
    propsRef.current = { feature, trail: trail ?? null };
  });

  const hasGeometry = feature.length >= 2 || (trail?.length ?? 0) >= 2;

  useEffect(() => {
    if (!containerRef.current || !hasGeometry) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: mapStyle(satellite),
      center: (propsRef.current.feature[0] as LngLat | undefined) ?? [12.94, 57.72],
      zoom: 12,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-right");
    mapRef.current = map;

    map.on("style.load", () => {
      const { feature, trail } = propsRef.current;
      draw(map, feature, trail);

      const box = bounds(feature, trail);
      if (box) map.fitBounds(box, { padding: 48, duration: 0 });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keep-comment: built once from propsRef; later geometry/style changes go through the effects below, not a remount
  }, [hasGeometry]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    draw(map, feature, trail ?? null);

    const box = bounds(feature, trail ?? null);
    if (box) map.fitBounds(box, { padding: 48, duration: 0 });
  }, [feature, trail]);

  useEffect(() => {
    mapRef.current?.setStyle(mapStyle(satellite));
  }, [satellite]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer("feature-line")) return;

    const visibility = (on: boolean) => (on ? "visible" : "none");

    map.setLayoutProperty("feature-line", "visibility", visibility(shown.feature));
    map.setLayoutProperty("feature-line-casing", "visibility", visibility(shown.feature));
    map.setLayoutProperty("feature-start", "visibility", visibility(shown.feature));
    map.setLayoutProperty("feature-end", "visibility", visibility(shown.feature));
    map.setLayoutProperty("trail-line", "visibility", visibility(shown.trail));
  }, [shown]);

  if (!hasGeometry) {
    return (
      <div
        className={`flex items-center justify-center rounded-md border bg-muted/30 text-sm text-muted-foreground ${className ?? "h-64"}`}
      >
        No geometry to draw.
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-md border ${className ?? "h-64"}`}>
      <div ref={containerRef} data-testid="proposal-map" className="h-full w-full" />

      <div className="absolute top-2 left-2 flex flex-col items-start gap-0.5 rounded-md border bg-background/80 p-1.5 text-xs backdrop-blur-sm">
        <button
          type="button"
          aria-pressed={shown.feature}
          title="Show or hide the source feature"
          className={`flex cursor-pointer items-center gap-1.5 rounded px-1 py-0.5 hover:bg-accent ${shown.feature ? "" : "opacity-40"}`}
          onClick={() => setShown((current) => ({ ...current, feature: !current.feature }))}
        >
          <span className="h-0.5 w-4 rounded" style={{ background: FEATURE_COLOR }} />
          Source feature
        </button>
        {trail && trail.length > 1 && (
          <button
            type="button"
            aria-pressed={shown.trail}
            title="Show or hide the matched trail"
            className={`flex cursor-pointer items-center gap-1.5 rounded px-1 py-0.5 hover:bg-accent ${shown.trail ? "" : "opacity-40"}`}
            onClick={() => setShown((current) => ({ ...current, trail: !current.trail }))}
          >
            <span className="h-1.5 w-4 rounded" style={{ background: TRAIL_COLOR }} />
            Matched trail
          </button>
        )}
      </div>

      {hasSatellite && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="absolute top-12 right-2 bg-background/80"
          aria-pressed={satellite}
          onClick={() => setSatellite((s) => !s)}
        >
          {satellite ? "Map" : "Satellite"}
        </Button>
      )}
    </div>
  );
}
