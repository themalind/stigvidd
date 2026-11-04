// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import "maplibre-gl/dist/maplibre-gl.css";
import maplibregl, { type FitBoundsOptions, type GeoJSONSource, type Map as MapLibreMap } from "maplibre-gl";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { mapStyle } from "@/lib/map-style";

const BORAS: [number, number] = [12.94, 57.72];

export function upsertSource(map: MapLibreMap, id: string, data: GeoJSON.FeatureCollection): void {
  const source = map.getSource<GeoJSONSource>(id);
  if (source) source.setData(data);
  else map.addSource(id, { type: "geojson", data });
}

export function fitTo(map: MapLibreMap, points: GeoJSON.Position[], options: FitBoundsOptions): void {
  if (points.length < 2) return;

  const bounds = new maplibregl.LngLatBounds();
  for (const [lng, lat] of points) bounds.extend([lng, lat]);
  map.fitBounds(bounds, options);
}

interface Options {
  satellite: boolean;
  zoom: number;
  // keep-comment: a style swap drops every source and layer, so draw must rebuild them, not assume they exist
  draw: (map: MapLibreMap) => void;
  fitPoints: () => GeoJSON.Position[];
  fitPadding: number;
  setup?: (map: MapLibreMap) => void;
}

export function useMapLibre({ satellite, zoom, draw, fitPoints, fitPadding, setup }: Options) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const styleReadyRef = useRef(false);
  const latest = useRef({ satellite, zoom, draw, fitPoints, fitPadding, setup });

  useLayoutEffect(() => {
    latest.current = { satellite, zoom, draw, fitPoints, fitPadding, setup };
  });

  // keep-comment: not isStyleLoaded(), which stays false until every tile has arrived and so skips draws
  const redraw = useCallback(() => {
    const map = mapRef.current;
    if (map && styleReadyRef.current) latest.current.draw(map);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const { satellite, zoom, fitPoints, setup } = latest.current;
    const [lng, lat] = fitPoints()[0] ?? BORAS;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: mapStyle(satellite),
      center: [lng, lat],
      zoom,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-right");
    mapRef.current = map;

    let fitted = false;
    map.on("style.load", () => {
      styleReadyRef.current = true;
      latest.current.draw(map);
      if (!fitted) {
        fitTo(map, latest.current.fitPoints(), { padding: latest.current.fitPadding, duration: 0 });
        fitted = true;
      }
    });
    setup?.(map);

    return () => {
      map.remove();
      mapRef.current = null;
      styleReadyRef.current = false;
    };
  }, []);

  const styleShown = useRef(satellite);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || styleShown.current === satellite) return;

    styleShown.current = satellite;
    styleReadyRef.current = false;
    map.setStyle(mapStyle(satellite), { diff: false });
  }, [satellite]);

  return { containerRef, mapRef, redraw };
}
