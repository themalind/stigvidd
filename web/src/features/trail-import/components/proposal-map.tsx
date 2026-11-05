// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useMapLibre } from "@/hooks/use-maplibre";
import { fitTo, hasSatellite, upsertSource } from "@/lib/maplibre";

type Coordinates = GeoJSON.Position[];
type Shown = { feature: boolean; trail: boolean };

const FEATURE_LAYERS = ["feature-line", "feature-line-casing", "feature-start", "feature-end"];

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

function draw(map: MapLibreMap, feature: Coordinates, trail: Coordinates | null, shown: Shown) {
  for (const [id, data] of Object.entries(sources(feature, trail))) upsertSource(map, id, data);
  ensureLayers(map);

  const visibility = (on: boolean) => (on ? "visible" : "none");
  for (const layer of FEATURE_LAYERS) map.setLayoutProperty(layer, "visibility", visibility(shown.feature));
  map.setLayoutProperty("trail-line", "visibility", visibility(shown.trail));
}

function ensureLayers(map: MapLibreMap) {
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

export function ProposalMap({ feature, trail, className }: Props) {
  const hasGeometry = feature.length >= 2 || (trail?.length ?? 0) >= 2;

  if (!hasGeometry) {
    return (
      <div
        className={`flex items-center justify-center rounded-md border bg-muted/30 text-sm text-muted-foreground ${className ?? "h-64"}`}
      >
        No geometry to draw.
      </div>
    );
  }

  return <ProposalCanvas feature={feature} trail={trail ?? null} className={className} />;
}

function ProposalCanvas({ feature, trail, className }: Props & { trail: Coordinates | null }) {
  const [satellite, setSatellite] = useState(false);
  const [shown, setShown] = useState<Shown>({ feature: true, trail: true });

  const { containerRef, mapRef, redraw } = useMapLibre({
    satellite,
    zoom: 12,
    draw: (map) => draw(map, feature, trail, shown),
    fitPoints: () => [...feature, ...(trail ?? [])],
    fitPadding: 48,
  });

  useEffect(() => {
    redraw();
    const map = mapRef.current;
    if (map) fitTo(map, [...feature, ...(trail ?? [])], { padding: 48, duration: 0 });
  }, [redraw, mapRef, feature, trail]);

  useEffect(() => redraw(), [redraw, shown]);

  return (
    <div className={`relative overflow-hidden rounded-md border ${className ?? "h-64"}`}>
      <div ref={containerRef} data-testid="proposal-map" className="h-full w-full" />

      <div className="absolute top-2 left-2 flex flex-col items-start gap-0.5 rounded-md border bg-background/80 p-1.5 text-xs backdrop-blur-sm">
        <button
          type="button"
          aria-pressed={shown.feature}
          title="Show or hide the source feature"
          className={`flex cursor-pointer items-center gap-1.5 rounded-md px-1 py-0.5 hover:bg-accent ${shown.feature ? "" : "opacity-40"}`}
          onClick={() => setShown((current) => ({ ...current, feature: !current.feature }))}
        >
          <span className="h-0.5 w-4 rounded-md" style={{ background: FEATURE_COLOR }} />
          Source feature
        </button>
        {trail && trail.length > 1 && (
          <button
            type="button"
            aria-pressed={shown.trail}
            title="Show or hide the matched trail"
            className={`flex cursor-pointer items-center gap-1.5 rounded-md px-1 py-0.5 hover:bg-accent ${shown.trail ? "" : "opacity-40"}`}
            onClick={() => setShown((current) => ({ ...current, trail: !current.trail }))}
          >
            <span className="h-1.5 w-4 rounded-md" style={{ background: TRAIL_COLOR }} />
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
