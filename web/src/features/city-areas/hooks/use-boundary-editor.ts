// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Map as MapLibreMap } from "maplibre-gl";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  type GeoJSONStoreFeatures,
  TerraDraw,
  TerraDrawPolygonMode,
  TerraDrawSelectMode,
  ValidateNotSelfIntersecting,
} from "terra-draw";
import { TerraDrawMapLibreGLAdapter } from "terra-draw-maplibre-gl-adapter";
import type { BoundaryCoordinates } from "@/features/city-areas/api/city-areas";

const EDIT = "#e65100";

export function toFeatures(boundary: BoundaryCoordinates): GeoJSONStoreFeatures[] {
  return boundary.map((polygon) => ({
    id: crypto.randomUUID(),
    type: "Feature",
    geometry: { type: "Polygon", coordinates: polygon },
    properties: { mode: "polygon" },
  }));
}

// keep-comment: the snapshot also holds the polygon still being drawn and the select mode's handles, which are not parts of the boundary
export function toBoundary(features: GeoJSONStoreFeatures[]): BoundaryCoordinates {
  return features.flatMap((feature) =>
    feature.geometry.type === "Polygon" && feature.properties.mode === "polygon" && !feature.properties.currentlyDrawing
      ? [feature.geometry.coordinates]
      : [],
  );
}

type Options = {
  map: MapLibreMap | null;
  initial: BoundaryCoordinates | null;
  onChange: (boundary: BoundaryCoordinates) => void;
};

// keep-comment: editing runs while initial is set; a new initial (another area, a fresh suggestion) starts over from it
export function useBoundaryEditor({ map, initial, onChange }: Options) {
  const drawRef = useRef<TerraDraw | null>(null);
  const [selected, setSelected] = useState<string | number | null>(null);
  const onChangeRef = useRef(onChange);

  useLayoutEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    if (!map || !initial) return;

    const draw = new TerraDraw({
      adapter: new TerraDrawMapLibreGLAdapter({ map }),
      modes: [
        new TerraDrawPolygonMode({
          validation: ValidateNotSelfIntersecting,
          styles: { fillColor: EDIT, fillOpacity: 0.15, outlineColor: EDIT, outlineWidth: 2 },
        }),
        new TerraDrawSelectMode({
          flags: {
            polygon: {
              feature: {
                validation: ValidateNotSelfIntersecting,
                coordinates: { draggable: true, deletable: true, midpoints: true },
              },
            },
          },
          styles: { selectedPolygonColor: EDIT, selectedPolygonOutlineColor: EDIT, selectedPolygonFillOpacity: 0.2 },
        }),
      ],
    });

    const emit = () => onChangeRef.current(toBoundary(draw.getSnapshot()));

    draw.start();
    draw.addFeatures(toFeatures(initial));
    draw.setMode(initial.length === 0 ? "polygon" : "select");
    draw.on("change", emit);
    draw.on("finish", () => {
      emit();
      draw.setMode("select");
    });
    draw.on("select", (id) => setSelected(id));
    draw.on("deselect", () => setSelected(null));
    drawRef.current = draw;

    return () => {
      draw.stop();
      drawRef.current = null;
      setSelected(null);
    };
  }, [map, initial]);

  const drawPart = useCallback(() => {
    drawRef.current?.setMode("polygon");
  }, []);

  const deleteSelected = useCallback(() => {
    const draw = drawRef.current;
    if (!draw || selected === null) return;
    draw.deselectFeature(selected);
    draw.removeFeatures([selected]);
    setSelected(null);
    onChangeRef.current(toBoundary(draw.getSnapshot()));
  }, [selected]);

  return { drawPart, deleteSelected, hasSelection: selected !== null };
}
