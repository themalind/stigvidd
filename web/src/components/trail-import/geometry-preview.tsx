import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Crosshair, Maximize, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";

type Coordinates = number[][];

type Props = {
  /** [longitude, latitude] pairs, the order the API sends. */
  feature: Coordinates;
  trail?: Coordinates | null;
  className?: string;
};

// Metres per degree of latitude. Longitude shrinks towards the poles, so it is scaled by
// cos(latitude) — without that, a trail at 57°N is drawn almost twice as wide as it is.
const MetresPerDegree = 111_320;

// Roughly how many points a line is drawn with at the fitted view. Each zoom level halves
// the stride, so zooming in is what reveals detail rather than hiding it.
const MaxPoints = 1500;

// How far out and in the view may go, relative to the fitted extent.
const MaxZoomOut = 3;
const MinSpanMetres = 25;

const ZoomStep = 1.6;
const PanStep = 0.15;

type Point = { x: number; y: number };
type View = { x: number; y: number; w: number; h: number };
type Size = { w: number; h: number };

/** A round number for the scale bar: 1, 2 or 5 times a power of ten. */
function niceDistance(metres: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(metres));
  const normalised = metres / magnitude;
  const step = normalised >= 5 ? 5 : normalised >= 2 ? 2 : 1;

  return step * magnitude;
}

function formatDistance(metres: number): string {
  return metres >= 1000
    ? `${(metres / 1000).toLocaleString()} km`
    : `${Math.round(metres)} m`;
}

function boundsOf(lines: Point[][], padding: number): View {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const line of lines) {
    for (const point of line) {
      if (point.x < minX) minX = point.x;
      if (point.x > maxX) maxX = point.x;
      if (point.y < minY) minY = point.y;
      if (point.y > maxY) maxY = point.y;
    }
  }

  // A closed loop or a single straight line can have no extent in one direction.
  const width = Math.max(maxX - minX, 1);
  const height = Math.max(maxY - minY, 1);
  const pad = Math.max(width, height) * padding;

  return {
    x: minX - pad,
    y: minY - pad,
    w: width + pad * 2,
    h: height + pad * 2,
  };
}

// A power of two, so each zoom level draws a superset of the points the level before did.
function strideFor(count: number, detail: number): number {
  if (count <= MaxPoints) return 1;

  const base = 2 ** Math.ceil(Math.log2(count / MaxPoints));

  return Math.max(1, base / 2 ** detail);
}

// The line thinned to the stride for this zoom level, with everything outside the painted
// area dropped and the path broken there: a chord between two points far apart off-screen
// would otherwise be drawn straight across the picture.
function pathFor(points: Point[], area: View, detail: number): string {
  if (points.length < 2) return "";

  const stride = strideFor(points.length, detail);
  const margin = Math.max(area.w, area.h) * 0.15;
  const minX = area.x - margin;
  const maxX = area.x + area.w + margin;
  const minY = area.y - margin;
  const maxY = area.y + area.h + margin;

  const inside = (point: Point | undefined) =>
    point !== undefined &&
    point.x >= minX &&
    point.x <= maxX &&
    point.y >= minY &&
    point.y <= maxY;

  const last = points.length - 1;

  let d = "";
  let pen = "M";

  for (let i = 0; i <= last; i++) {
    if (i % stride !== 0 && i !== last) continue;

    // The neighbours on the drawn skeleton, so a segment entering the view is kept whole.
    const near =
      inside(points[i]) ||
      inside(points[i - stride]) ||
      inside(points[Math.min(i + stride, last)]);

    if (!near) {
      pen = "M";
      continue;
    }

    d += `${pen}${points[i].x.toFixed(1)} ${points[i].y.toFixed(1)}`;
    pen = "L";
  }

  return d;
}

// Keeps the span within the zoom limits and the centre near the drawn lines, so a fast
// drag cannot leave the reviewer looking at empty space with no way back.
function clampView(view: View, fit: View): View {
  const maxWidth = fit.w * MaxZoomOut;
  const minWidth = Math.max(MinSpanMetres, fit.w / 500);
  const width = Math.min(maxWidth, Math.max(minWidth, view.w));
  const height = width * (view.h / view.w);

  const centreX = Math.min(
    fit.x + fit.w + width / 2,
    Math.max(fit.x - width / 2, view.x + view.w / 2),
  );
  const centreY = Math.min(
    fit.y + fit.h + height / 2,
    Math.max(fit.y - height / 2, view.y + view.h / 2),
  );

  return {
    x: centreX - width / 2,
    y: centreY - height / 2,
    w: width,
    h: height,
  };
}

/** Pixels per metre once preserveAspectRatio="meet" has fitted the view into the box. */
function pixelsPerMetre(view: View, size: Size): number {
  if (!size.w || !size.h) return 0;

  return Math.min(size.w / view.w, size.h / view.h);
}

/** The world rectangle actually painted: "meet" shows more than the view along one axis. */
function paintedArea(view: View, size: Size): View {
  const scale = pixelsPerMetre(view, size);
  if (!scale) return view;

  const width = size.w / scale;
  const height = size.h / scale;

  return {
    x: view.x + view.w / 2 - width / 2,
    y: view.y + view.h / 2 - height / 2,
    w: width,
    h: height,
  };
}

export function GeometryPreview({ feature, trail, className }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);

  const [view, setView] = useState<View | null>(null);
  const [size, setSize] = useState<Size>({ w: 0, h: 0 });

  const drawing = useMemo(() => {
    const lines = [feature, trail ?? []].filter((line) => line.length >= 2);
    if (lines.length === 0) return null;

    // Walked rather than spread: Sjuhäradsrundan alone is 59 000 points, and
    // Math.min(...points) at that size overruns the argument limit.
    let minLon = Infinity;
    let maxLon = -Infinity;
    let minLat = Infinity;
    let maxLat = -Infinity;

    for (const line of lines) {
      for (const [lon, lat] of line) {
        if (lon < minLon) minLon = lon;
        if (lon > maxLon) maxLon = lon;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }
    }

    const metresPerLon =
      MetresPerDegree * Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);

    const project = (line: Coordinates): Point[] =>
      line.map(([lon, lat]) => ({
        x: (lon - minLon) * metresPerLon,
        y: (maxLat - lat) * MetresPerDegree,
      }));

    const featurePoints = project(feature);
    const trailPoints = trail && trail.length >= 2 ? project(trail) : null;

    return {
      featurePoints,
      trailPoints,
      featureEnds: [featurePoints[0], featurePoints[featurePoints.length - 1]],
      fitFeature: boundsOf([featurePoints], 0.1),
      fitAll: boundsOf(
        trailPoints ? [featurePoints, trailPoints] : [featurePoints],
        0.06,
      ),
    };
  }, [feature, trail]);

  // A different proposal is a different place, so the view drops back to fitted. Done
  // while rendering rather than in an effect: an effect would draw the old view first.
  const [drawnFor, setDrawnFor] = useState(drawing);

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
          {trailPath && (
            <path
              d={trailPath}
              fill="none"
              stroke="currentColor"
              strokeWidth={6}
              vectorEffect="non-scaling-stroke"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-muted-foreground/50"
            />
          )}

          <path
            d={featurePath}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-primary"
          />

          {/* Where the feature starts and stops — what tells a loop from an open line. */}
          {drawing.featureEnds.map((point, index) => (
            <circle
              key={index}
              cx={point.x}
              cy={point.y}
              r={markerRadius}
              className={
                index === 0 ? "fill-primary" : "fill-none stroke-primary"
              }
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>

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

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded bg-primary" />
          Source feature
        </span>
        {trailPath && (
          <span className="flex items-center gap-1.5">
            <span className="h-1 w-4 rounded bg-muted-foreground/50" />
            Matched trail
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-primary" />
          Start
          <span className="ml-2 size-2 rounded-full border border-primary" />
          End
        </span>
        <span className="ml-auto">
          {zoomedIn ? "Drag to pan · 0 to fit" : "Scroll to zoom · drag to pan"}
        </span>
      </div>
    </div>
  );
}
