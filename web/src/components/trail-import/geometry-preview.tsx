// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Crosshair, Maximize, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  paintedArea,
  pathFor,
  pixelsPerMetre,
  clampView,
  formatDistance,
  niceDistance,
  projectDrawing,
  type Coordinates,
  type Size,
  type View,
} from "@/lib/geometry-preview";

type Props = {
  /** [longitude, latitude] pairs, the order the API sends. */
  feature: Coordinates;
  trail?: Coordinates | null;
  className?: string;
};

// A transparent colour dims on a dark ground and pales on a light one, so each theme names
// its own pair: warm line, cool band, both read against the ground they sit on.
const FeatureStroke = "stroke-orange-600 dark:stroke-amber-400";
const FeatureFill = "fill-orange-600 dark:fill-amber-400";
const FeatureSwatch = "bg-orange-600 dark:bg-amber-400";
const TrailStroke = "stroke-sky-500/40 dark:stroke-sky-500/60";
const TrailSwatch = "bg-sky-500/40 dark:bg-sky-500/60";

const ZoomStep = 1.6;
const PanStep = 0.15;

export function GeometryPreview({ feature, trail, className }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);

  const [view, setView] = useState<View | null>(null);
  const [size, setSize] = useState<Size>({ w: 0, h: 0 });

  const drawing = useMemo(
    () => projectDrawing(feature, trail),
    [feature, trail],
  );

  // A different proposal is a different place, so the view drops back to fitted. Done
  // while rendering rather than in an effect: an effect would draw the old view first.
  const [drawnFor, setDrawnFor] = useState(drawing);

  // Which lines are drawn. Turning one off is how a stretch the other covers alone becomes
  // plain, without having to trust that two colours are telling the truth.
  const [shown, setShown] = useState({ feature: true, trail: true });

  if (drawing !== drawnFor) {
    setDrawnFor(drawing);
    setView(null);
  }

  useEffect(() => {
    const element = svgRef.current;
    if (!element) return;

    const observer = new ResizeObserver(([entry]) => {
      setSize({ w: entry.contentRect.width, h: entry.contentRect.height });
    });

    observer.observe(element);

    return () => observer.disconnect();
  }, [drawing]);

  const active = view ?? drawing?.fitAll ?? null;

  const zoomAt = useCallback(
    (clientX: number, clientY: number, factor: number) => {
      const element = svgRef.current;
      if (!element || !drawing || !active) return;

      const rect = element.getBoundingClientRect();
      const scale = pixelsPerMetre(active, { w: rect.width, h: rect.height });
      if (!scale) return;

      // "meet" centres the view in the box, so the empty margin has to come off first.
      const marginX = (rect.width - active.w * scale) / 2;
      const marginY = (rect.height - active.h * scale) / 2;
      const worldX = active.x + (clientX - rect.left - marginX) / scale;
      const worldY = active.y + (clientY - rect.top - marginY) / scale;

      const width = active.w / factor;
      const ratio = width / active.w;

      setView(
        clampView(
          {
            x: worldX - (worldX - active.x) * ratio,
            y: worldY - (worldY - active.y) * ratio,
            w: width,
            h: active.h * ratio,
          },
          drawing.fitAll,
        ),
      );
    },
    [active, drawing],
  );

  const zoomCentre = useCallback(
    (factor: number) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;

      zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor);
    },
    [zoomAt],
  );

  const panBy = useCallback(
    (dx: number, dy: number) => {
      if (!drawing || !active) return;

      setView(
        clampView(
          { ...active, x: active.x + dx, y: active.y + dy },
          drawing.fitAll,
        ),
      );
    },
    [active, drawing],
  );

  // React attaches wheel at the root as a passive listener, where preventDefault is
  // ignored, so the page would scroll while zooming. This one is attached directly.
  useEffect(() => {
    const element = boxRef.current;
    if (!element) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();

      // Firefox reports lines rather than pixels; a trackpad pinch arrives with ctrlKey.
      const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;

      zoomAt(event.clientX, event.clientY, Math.exp(-delta * 0.0016));
    };

    element.addEventListener("wheel", onWheel, { passive: false });

    return () => element.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  // The zoom controls sit inside the pan surface, and capturing the pointer for a drag
  // would swallow their click.
  const onAControl = (target: EventTarget | null) =>
    target instanceof Element && target.closest("button") !== null;

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || onAControl(event.target)) return;

    dragRef.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const from = dragRef.current;
    if (!from || !active) return;

    const rect = svgRef.current?.getBoundingClientRect();
    const scale = rect
      ? pixelsPerMetre(active, { w: rect.width, h: rect.height })
      : 0;
    if (!scale) return;

    dragRef.current = { x: event.clientX, y: event.clientY };
    panBy((from.x - event.clientX) / scale, (from.y - event.clientY) / scale);
  }

  function endDrag(event: React.PointerEvent<HTMLDivElement>) {
    dragRef.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!active || !drawing) return;

    const keys: Record<string, () => void> = {
      ArrowLeft: () => panBy(-active.w * PanStep, 0),
      ArrowRight: () => panBy(active.w * PanStep, 0),
      ArrowUp: () => panBy(0, -active.h * PanStep),
      ArrowDown: () => panBy(0, active.h * PanStep),
      "+": () => zoomCentre(ZoomStep),
      "=": () => zoomCentre(ZoomStep),
      "-": () => zoomCentre(1 / ZoomStep),
      "0": () => setView(drawing.fitAll),
    };

    const handler = keys[event.key];
    if (!handler) return;

    event.preventDefault();
    handler();
  }

  if (!drawing || !active) {
    return (
      <div
        className={`flex items-center justify-center rounded-md border bg-muted/30 text-sm text-muted-foreground ${className ?? "h-64"}`}
      >
        No geometry to draw.
      </div>
    );
  }

  // How far in the view is, in halvings of the fitted extent.
  const detail = Math.max(
    0,
    Math.floor(Math.log2(drawing.fitAll.w / active.w)),
  );

  const painted = paintedArea(active, size);

  const featurePath = pathFor(drawing.featurePoints, painted, detail);
  const trailPath = drawing.trailPoints
    ? pathFor(drawing.trailPoints, painted, detail)
    : null;
  const markerRadius = Math.max(active.w, active.h) * 0.012;

  const scale = pixelsPerMetre(active, size);
  const bar = niceDistance(active.w * 0.28);
  const zoomedIn = active.w < drawing.fitAll.w * 0.98;

  return (
    <div className="space-y-2">
      <div
        ref={boxRef}
        tabIndex={0}
        role="group"
        aria-label="Geometry preview. Drag to pan, scroll to zoom, arrow keys to move, plus and minus to zoom, zero to fit."
        className={`relative touch-none cursor-grab overflow-hidden rounded-md border bg-muted/20 outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring/50 active:cursor-grabbing ${className ?? "h-64"}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={(event) => {
          if (onAControl(event.target)) return;

          zoomAt(event.clientX, event.clientY, ZoomStep);
        }}
        onKeyDown={onKeyDown}
      >
        <svg
          ref={svgRef}
          viewBox={`${active.x} ${active.y} ${active.w} ${active.h}`}
          preserveAspectRatio="xMidYMid meet"
          className="size-full"
          role="img"
          aria-label="Source feature drawn against the trail it was matched to"
        >
          {/* The trail underneath, so the feature being reviewed reads on top of it. */}
          {trailPath && shown.trail && (
            <path
              d={trailPath}
              fill="none"
              strokeWidth={8}
              vectorEffect="non-scaling-stroke"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={TrailStroke}
            />
          )}

          {shown.feature && (
            <path
              d={featurePath}
              fill="none"
              strokeWidth={2.5}
              vectorEffect="non-scaling-stroke"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={FeatureStroke}
            />
          )}

          {/* Where the feature starts and stops — what tells a loop from an open line. */}
          {shown.feature &&
            drawing.featureEnds.map((point, index) => (
              <circle
                key={index}
                cx={point.x}
                cy={point.y}
                r={markerRadius}
                className={`${FeatureStroke} ${index === 0 ? FeatureFill : "fill-none"}`}
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
              />
            ))}
        </svg>

        {/* The key doubles as the switch: hiding one line is the surest way to see what the
            other covers on its own. */}
        <div className="absolute top-2 left-2 flex flex-col items-start gap-0.5 rounded-md border bg-background/80 p-1.5 text-xs backdrop-blur-sm">
          <button
            type="button"
            aria-pressed={shown.feature}
            title="Show or hide the source feature"
            className={`flex cursor-pointer items-center gap-1.5 rounded px-1 py-0.5 hover:bg-accent ${shown.feature ? "" : "opacity-40"}`}
            onClick={() =>
              setShown((current) => ({ ...current, feature: !current.feature }))
            }
          >
            <span className={`h-0.5 w-4 rounded ${FeatureSwatch}`} />
            Source feature
          </button>

          {drawing.trailPoints && (
            <button
              type="button"
              aria-pressed={shown.trail}
              title="Show or hide the matched trail"
              className={`flex cursor-pointer items-center gap-1.5 rounded px-1 py-0.5 hover:bg-accent ${shown.trail ? "" : "opacity-40"}`}
              onClick={() =>
                setShown((current) => ({ ...current, trail: !current.trail }))
              }
            >
              <span className={`h-1.5 w-4 rounded ${TrailSwatch}`} />
              Matched trail
            </button>
          )}

          <span className="flex items-center gap-1.5 px-1 py-0.5 text-muted-foreground">
            <span className={`size-2 rounded-full ${FeatureSwatch}`} />
            Start
            <span className="ml-1 size-2 rounded-full border border-orange-600 dark:border-amber-400" />
            End
          </span>
        </div>

        <div className="absolute top-2 right-2 flex flex-col gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            title="Zoom in"
            aria-label="Zoom in"
            onClick={() => zoomCentre(ZoomStep)}
          >
            <ZoomIn />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            title="Zoom out"
            aria-label="Zoom out"
            onClick={() => zoomCentre(1 / ZoomStep)}
          >
            <ZoomOut />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            title="Fit the feature"
            aria-label="Fit the feature"
            onClick={() => setView(drawing.fitFeature)}
          >
            <Crosshair />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            title="Fit both lines"
            aria-label="Fit both lines"
            onClick={() => setView(drawing.fitAll)}
          >
            <Maximize />
          </Button>
        </div>

        {/* Measured off the current view, so it stays honest at every zoom level. */}
        {scale > 0 && (
          <div className="absolute bottom-2 left-2 space-y-0.5">
            <span className="text-xs text-muted-foreground tabular-nums">
              {formatDistance(bar)}
            </span>
            <div
              className="h-1 border-x border-b border-muted-foreground/70"
              style={{ width: bar * scale }}
            />
          </div>
        )}
      </div>

      <p className="text-right text-xs text-muted-foreground">
        {zoomedIn ? "Drag to pan · 0 to fit" : "Scroll to zoom · drag to pan"}
      </p>
    </div>
  );
}
