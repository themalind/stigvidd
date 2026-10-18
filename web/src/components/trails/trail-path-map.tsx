// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import "maplibre-gl/dist/maplibre-gl.css";
import maplibregl, { type GeoJSONSource, type Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useLayoutEffect, useRef } from "react";
import type { Jump, LngLat } from "@/lib/geometry-edit";
import { mapStyle } from "../hike-submissions/map-style";

type Props = {
  path: LngLat[];
  gaps: Jump[];
  satellite: boolean;
};

const LINE = "#134a5b";
const GAP = "#b3261e";
const START = "#2e7d32";
const END = "#b3261e";

function collection(features: GeoJSON.Feature[]): GeoJSON.FeatureCollection {
  return { type: "FeatureCollection", features };
}

function sources(path: LngLat[], gaps: Jump[]): Record<string, GeoJSON.FeatureCollection> {
  const last = path.length - 1;
  return {
    line: collection(
      path.length < 2 ? [] : [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: path } }],
    ),
    gaps: collection(
      gaps.map((gap) => ({
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: [path[gap.index], path[gap.index + 1]] },
      })),
    ),
    points: collection(
      path.map((coordinates, index) => ({
        type: "Feature",
        properties: { role: index === 0 ? "start" : index === last ? "end" : "point" },
        geometry: { type: "Point", coordinates },
      })),
    ),
  };
}

function draw(map: MapLibreMap, path: LngLat[], gaps: Jump[]) {
  for (const [id, data] of Object.entries(sources(path, gaps))) {
    const source = map.getSource(id) as GeoJSONSource | undefined;
    if (source) source.setData(data);
    else map.addSource(id, { type: "geojson", data });
  }

  if (map.getLayer("line-casing")) return;

  map.addLayer({
    id: "line-casing",
    type: "line",
    source: "line",
    layout: { "line-join": "round", "line-cap": "round" },
    paint: { "line-color": "#ffffff", "line-width": 7 },
  });
  map.addLayer({
    id: "line",
    type: "line",
    source: "line",
    layout: { "line-join": "round", "line-cap": "round" },
    paint: { "line-color": LINE, "line-width": 4 },
  });
  map.addLayer({
    id: "gaps",
    type: "line",
    source: "gaps",
    paint: { "line-color": GAP, "line-width": 6, "line-dasharray": [1.5, 1] },
  });
  map.addLayer({
    id: "points",
    type: "circle",
    source: "points",
    filter: ["==", ["get", "role"], "point"],
    minzoom: 16,
    paint: { "circle-radius": 3, "circle-color": "#ffffff", "circle-stroke-color": LINE, "circle-stroke-width": 1.5 },
  });
  map.addLayer({
    id: "end",
    type: "circle",
    source: "points",
    filter: ["==", ["get", "role"], "end"],
    paint: { "circle-radius": 10, "circle-color": END, "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 },
  });
  // keep-comment: a loop's start and end coincide, so start is drawn smaller and on top to keep both visible
  map.addLayer({
    id: "start",
    type: "circle",
    source: "points",
    filter: ["==", ["get", "role"], "start"],
    paint: { "circle-radius": 5, "circle-color": START, "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 },
  });
}

export function TrailPathMap(props: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const propsRef = useRef(props);

  useLayoutEffect(() => {
    propsRef.current = props;
  });

  useEffect(() => {
    if (!containerRef.current) return;
    const { path, satellite } = propsRef.current;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: mapStyle(satellite),
      center: path[0] ?? [12.94, 57.72],
      zoom: 13,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-right");
    mapRef.current = map;

    let fitted = false;
    map.on("style.load", () => {
      const { path, gaps } = propsRef.current;
      draw(map, path, gaps);
      if (!fitted && path.length > 1) {
        const bounds = new maplibregl.LngLatBounds(path[0], path[0]);
        path.forEach((p) => bounds.extend(p));
        map.fitBounds(bounds, { padding: 50, duration: 0 });
        fitted = true;
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    mapRef.current?.setStyle(mapStyle(props.satellite));
  }, [props.satellite]);

  return (
    <div className="relative h-[520px] w-full overflow-hidden rounded-[5px] border">
      {/* keep-comment: maplibre's unlayered .maplibregl-map sets position: relative, which beats Tailwind's layered "absolute", so size it explicitly (docs/notes/maplibre-css-beats-tailwind-v4-layered-utilities.md) */}
      <div ref={containerRef} data-testid="trail-path-map" className="h-full w-full" />
      <div className="pointer-events-none absolute bottom-3 left-3 flex flex-col gap-1 rounded-[5px] border bg-background/95 px-3 py-2 text-xs">
        <span className="flex items-center gap-2">
          <span className="size-3 rounded-full" style={{ background: START }} />
          Start
        </span>
        <span className="flex items-center gap-2">
          <span className="size-3 rounded-full" style={{ background: END }} />
          End
        </span>
        <span className="flex items-center gap-2">
          <span className="h-0 w-5 border-t-4 border-dashed" style={{ borderColor: GAP }} />
          Long gap between points
        </span>
      </div>
    </div>
  );
}
