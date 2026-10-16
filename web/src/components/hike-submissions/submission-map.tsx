// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import "maplibre-gl/dist/maplibre-gl.css";
import maplibregl, { type GeoJSONSource, type Map as MapLibreMap, type MapLayerMouseEvent } from "maplibre-gl";
import { useEffect, useLayoutEffect, useRef } from "react";
import type { Jump, LngLat } from "@/lib/geometry-edit";
import { mapStyle } from "./map-style";

export type EditMode = "move" | "delete" | "redraw";

type Props = {
  path: LngLat[];
  keptRange: [number, number];
  jumps: Jump[];
  mode: EditMode;
  satellite: boolean;
  redrawAnchors: number[];
  draft: LngLat[];
  focus: LngLat[] | null;
  onMovePoint: (index: number, to: LngLat) => void;
  onPointClick: (index: number) => void;
  onMapClick: (at: LngLat) => void;
};

const KEPT = "#134a5b";
const TRIMMED = "#8a9799";
const JUMP = "#b3261e";
const DRAFT = "#0f766e";
const START = "#2e7d32";
const END = "#b3261e";

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

function line(coordinates: LngLat[]): GeoJSON.FeatureCollection {
  return coordinates.length < 2
    ? EMPTY
    : {
        type: "FeatureCollection",
        features: [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates } }],
      };
}

function pointsOf(path: LngLat[], keptRange: [number, number], anchors: number[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: path.map((coordinates, index) => ({
      type: "Feature",
      properties: {
        index,
        role:
          index === keptRange[0]
            ? "start"
            : index === keptRange[1]
              ? "end"
              : anchors.includes(index)
                ? "anchor"
                : "point",
      },
      geometry: { type: "Point", coordinates },
    })),
  };
}

function jumpsOf(path: LngLat[], jumps: Jump[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: jumps.map((jump) => ({
      type: "Feature",
      properties: { metres: Math.round(jump.metres) },
      geometry: { type: "LineString", coordinates: [path[jump.index], path[jump.index + 1]] },
    })),
  };
}

function setData(map: MapLibreMap, id: string, data: GeoJSON.FeatureCollection) {
  const source = map.getSource(id) as GeoJSONSource | undefined;
  if (source) source.setData(data);
  else map.addSource(id, { type: "geojson", data });
}

function ensureLayers(map: MapLibreMap) {
  if (map.getLayer("trimmed-line")) return;

  map.addLayer({
    id: "trimmed-line",
    type: "line",
    source: "trimmed",
    layout: { "line-join": "round", "line-cap": "round" },
    paint: { "line-color": TRIMMED, "line-width": 4, "line-dasharray": [2, 2] },
  });
  map.addLayer({
    id: "kept-casing",
    type: "line",
    source: "kept",
    layout: { "line-join": "round", "line-cap": "round" },
    paint: { "line-color": "#ffffff", "line-width": 8 },
  });
  map.addLayer({
    id: "kept-line",
    type: "line",
    source: "kept",
    layout: { "line-join": "round", "line-cap": "round" },
    paint: { "line-color": KEPT, "line-width": 5 },
  });
  map.addLayer({
    id: "jump-line",
    type: "line",
    source: "jumps",
    paint: { "line-color": JUMP, "line-width": 6, "line-dasharray": [1.5, 1] },
  });
  map.addLayer({
    id: "draft-line",
    type: "line",
    source: "draft",
    layout: { "line-join": "round", "line-cap": "round" },
    paint: { "line-color": DRAFT, "line-width": 4, "line-dasharray": [1, 1.5] },
  });
  map.addLayer({
    id: "points",
    type: "circle",
    source: "points",
    filter: ["==", ["get", "role"], "point"],
    minzoom: 14,
    paint: { "circle-radius": 4, "circle-color": "#ffffff", "circle-stroke-color": KEPT, "circle-stroke-width": 2 },
  });
  map.addLayer({
    id: "special-points",
    type: "circle",
    source: "points",
    filter: ["!=", ["get", "role"], "point"],
    paint: {
      "circle-radius": ["match", ["get", "role"], "anchor", 7, 9],
      "circle-color": ["match", ["get", "role"], "start", START, "end", END, DRAFT],
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 3,
    },
  });
}

export function SubmissionMap(props: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const propsRef = useRef(props);
  const draggingRef = useRef<number | null>(null);
  const fittedRef = useRef(false);

  useLayoutEffect(() => {
    propsRef.current = props;
  });

  const sync = () => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const { path, keptRange, jumps, redrawAnchors, draft } = propsRef.current;
    const anchors = redrawAnchors.map((i) => path[i]).filter(Boolean);
    const draftLine = anchors.length === 2 ? [anchors[0], ...draft, anchors[1]] : [...anchors, ...draft];

    setData(map, "trimmed", line(path));
    setData(map, "kept", line(path.slice(keptRange[0], keptRange[1] + 1)));
    setData(map, "jumps", jumpsOf(path, jumps));
    setData(map, "draft", line(draftLine));
    setData(map, "points", pointsOf(path, keptRange, redrawAnchors));
    ensureLayers(map);
  };

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: mapStyle(propsRef.current.satellite),
      center: propsRef.current.path[0] ?? [12.94, 57.72],
      zoom: 13,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-right");
    mapRef.current = map;

    map.on("style.load", () => {
      sync();
      const path = propsRef.current.path;
      if (!fittedRef.current && path.length > 1) {
        const bounds = new maplibregl.LngLatBounds(path[0], path[0]);
        path.forEach((p) => bounds.extend(p));
        map.fitBounds(bounds, { padding: 60, duration: 0 });
        fittedRef.current = true;
      }
    });

    const pointLayers = ["points", "special-points"];

    const onPointDown = (event: MapLayerMouseEvent) => {
      const index = event.features?.[0]?.properties?.index;
      if (typeof index !== "number") return;
      const { mode } = propsRef.current;
      if (mode === "move") {
        event.preventDefault();
        draggingRef.current = index;
        map.getCanvas().style.cursor = "grabbing";
      }
    };

    const onPointClick = (event: MapLayerMouseEvent) => {
      const index = event.features?.[0]?.properties?.index;
      if (typeof index !== "number") return;
      if (propsRef.current.mode !== "move") propsRef.current.onPointClick(index);
    };

    const onMove = (event: maplibregl.MapMouseEvent) => {
      const index = draggingRef.current;
      if (index === null) return;
      const at: LngLat = [event.lngLat.lng, event.lngLat.lat];
      const { path, keptRange, redrawAnchors } = propsRef.current;
      const live = path.map((p, i) => (i === index ? at : p));
      setData(map, "points", pointsOf(live, keptRange, redrawAnchors));
      setData(map, "kept", line(live.slice(keptRange[0], keptRange[1] + 1)));
    };

    const onUp = (event: maplibregl.MapMouseEvent) => {
      const index = draggingRef.current;
      if (index === null) return;
      draggingRef.current = null;
      map.getCanvas().style.cursor = "";
      propsRef.current.onMovePoint(index, [event.lngLat.lng, event.lngLat.lat]);
    };

    const onClick = (event: maplibregl.MapMouseEvent) => {
      if (propsRef.current.mode !== "redraw") return;
      const hit = map.queryRenderedFeatures(event.point, { layers: pointLayers });
      if (hit.length > 0) return;
      propsRef.current.onMapClick([event.lngLat.lng, event.lngLat.lat]);
    };

    for (const layer of pointLayers) {
      map.on("mousedown", layer, onPointDown);
      map.on("click", layer, onPointClick);
      map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
    }
    map.on("mousemove", onMove);
    map.on("mouseup", onUp);
    map.on("click", onClick);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    mapRef.current?.setStyle(mapStyle(props.satellite));
  }, [props.satellite]);

  useEffect(() => {
    sync();
  }, [props.path, props.keptRange, props.jumps, props.redrawAnchors, props.draft]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !props.focus || props.focus.length === 0) return;
    const bounds = new maplibregl.LngLatBounds(props.focus[0], props.focus[0]);
    props.focus.forEach((p) => bounds.extend(p));
    map.fitBounds(bounds, { padding: 120, maxZoom: 17, duration: 400 });
  }, [props.focus]);

  return (
    <div className="relative h-[620px] w-full overflow-hidden rounded-[5px] border">
      {/* keep-comment: maplibre's unlayered .maplibregl-map sets position: relative, which beats Tailwind's layered "absolute", so size it explicitly (docs/notes/maplibre-css-beats-tailwind-v4-layered-utilities.md) */}
      <div ref={containerRef} data-testid="submission-map" className="h-full w-full" />
      <div className="pointer-events-none absolute bottom-3 left-3 flex flex-col gap-1 rounded-[5px] border bg-background/95 px-3 py-2 text-xs">
        <span className="flex items-center gap-2">
          <span className="h-1 w-5" style={{ background: KEPT }} />
          Linjen som publiceras
        </span>
        <span className="flex items-center gap-2">
          <span className="h-0 w-5 border-t-4 border-dashed" style={{ borderColor: TRIMMED }} />
          Bortklippt
        </span>
        <span className="flex items-center gap-2">
          <span className="h-0 w-5 border-t-4 border-dashed" style={{ borderColor: JUMP }} />
          Misstänkt hopp
        </span>
        <span className="flex items-center gap-2">
          <span className="h-0 w-5 border-t-4 border-dotted" style={{ borderColor: DRAFT }} />
          Omritat avsnitt
        </span>
      </div>
    </div>
  );
}
