// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import {
  approveSubmission,
  deleteSubmissionImage,
  getSimilarRoutes,
  getSubmission,
  rejectSubmission,
  type SimilarRoute,
  type SubmissionDetail,
  updateSubmission,
  updateSubmissionGeometry,
} from "@/api/hike-submissions";
import { hasSatellite } from "@/components/hike-submissions/map-style";
import { SimilarRoutesCard } from "@/components/hike-submissions/similar-routes-card";
import { type EditMode, SubmissionMap } from "@/components/hike-submissions/submission-map";
import TrailImagesDialog from "@/components/trail-images-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import {
  deletePoint,
  extendPath,
  findJumps,
  formatMetres,
  insertPoint,
  type LngLat,
  movePoint,
  parseCoordinates,
  pathLengthMetres,
  replaceSection,
  reversePath,
  serializeCoordinates,
  startLoopAt,
  trimPath,
} from "@/lib/geometry-edit";

const CLASSIFICATIONS = [
  { value: 1, label: "Easy" },
  { value: 2, label: "Medium" },
  { value: 3, label: "Hard" },
];

const MODES: { mode: EditMode; label: string }[] = [
  { mode: "move", label: "Move point" },
  { mode: "delete", label: "Delete point" },
  { mode: "cut", label: "Cut section" },
  { mode: "redraw", label: "Redraw section" },
  { mode: "extend", label: "Extend" },
  { mode: "start", label: "Set start" },
];

type Fields = {
  name: string;
  description: string;
  classification: number;
  gettingThere: string;
  parking: string;
  publicTransport: string;
  accessibilityInfo: string;
  city: string;
};

function fieldsOf(detail: SubmissionDetail): Fields {
  return {
    name: detail.name,
    description: detail.description,
    classification: detail.classification ?? 0,
    gettingThere: detail.gettingThere,
    parking: detail.parking,
    publicTransport: detail.publicTransport,
    accessibilityInfo: detail.accessibilityInfo,
    city: detail.city,
  };
}

export default function HikeSubmissionReviewPage() {
  const { identifier = "" } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<SubmissionDetail | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [path, setPath] = useState<LngLat[]>([]);
  const [history, setHistory] = useState<LngLat[][]>([]);
  const [range, setRange] = useState<[number, number]>([0, 0]);
  const [mode, setMode] = useState<EditMode>("move");
  const [anchors, setAnchors] = useState<number[]>([]);
  const [draft, setDraft] = useState<LngLat[]>([]);
  const [extendFrom, setExtendFrom] = useState<"start" | "end">("end");
  const [satellite, setSatellite] = useState(false);
  const [focus, setFocus] = useState<LngLat[] | null>(null);
  const [fields, setFields] = useState<Fields | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [similar, setSimilar] = useState<SimilarRoute[] | null>(null);
  const [similarFailed, setSimilarFailed] = useState(false);

  useEffect(() => {
    let current = true;

    async function load() {
      try {
        const loaded = await getSubmission(identifier);
        if (!current) return;
        const parsed = parseCoordinates(loaded.coordinates);
        setDetail(loaded);
        setPath(parsed);
        setRange([0, Math.max(0, parsed.length - 1)]);
        setFields(fieldsOf(loaded));
      } catch {
        if (current) setLoadFailed(true);
      }
    }

    void load();
    return () => {
      current = false;
    };
  }, [identifier]);

  const savedCoordinates = detail?.coordinates;
  useEffect(() => {
    if (savedCoordinates === undefined) return;
    let current = true;
    setSimilar(null);
    setSimilarFailed(false);
    getSimilarRoutes(identifier)
      .then((routes) => current && setSimilar(routes))
      .catch(() => current && setSimilarFailed(true));
    return () => {
      current = false;
    };
  }, [identifier, savedCoordinates]);

  const kept = useMemo(() => trimPath(path, range[0], range[1]), [path, range]);
  const jumps = useMemo(
    () => findJumps(path).filter((j) => j.index >= range[0] && j.index + 1 <= range[1]),
    [path, range],
  );
  const savedPath = useMemo(() => (detail ? parseCoordinates(detail.coordinates) : []), [detail]);
  const routeDirty = history.length > 0 || range[0] > 0 || range[1] < path.length - 1;
  const fieldsDirty = detail !== null && fields !== null && JSON.stringify(fields) !== JSON.stringify(fieldsOf(detail));
  const pending = detail?.status === "Pending";
  const editable = pending || (detail?.status === "Approved" && Boolean(detail.publishedTrailIdentifier));

  const edit = (next: LngLat[]) => {
    if (next === path) return;
    setHistory((h) => [...h, path]);
    setPath(next);
    setRange(([start, end]) => [Math.min(start, next.length - 2), Math.min(Math.max(end, 1), next.length - 1)]);
  };

  // keep-comment: works on the kept part, so the trim is applied first and the result is kept whole
  const replaceKept = (next: LngLat[]) => {
    setHistory((h) => [...h, path]);
    setPath(next);
    setRange([0, next.length - 1]);
  };

  const setStart = (index: number) => {
    if (index < range[0] || index > range[1]) return;
    const rotated = startLoopAt(kept, index - range[0]);
    if (!rotated) {
      if (index === range[0]) return;
      if (index === range[1]) {
        toast.error("The start must leave at least two points.");
        return;
      }
      replaceKept(kept.slice(index - range[0]));
      toast.info("Not a loop, so everything before the new start was trimmed.");
      return;
    }
    if (rotated !== kept) replaceKept(rotated);
  };

  const onInsertPoint = (afterIndex: number, at: LngLat) => {
    const next = insertPoint(path, afterIndex, at);
    if (next === path) return;
    setHistory((h) => [...h, path]);
    setPath(next);
    setRange(([start, end]) => [afterIndex < start ? start + 1 : start, afterIndex < end ? end + 1 : end]);
  };

  const undo = () => {
    const previous = history.at(-1);
    if (!previous) return;
    setHistory((h) => h.slice(0, -1));
    setPath(previous);
    setRange(([start, end]) => [Math.min(start, previous.length - 2), Math.min(end, previous.length - 1)]);
  };

  const reset = (to: LngLat[]) => {
    setHistory([]);
    setPath(to);
    setRange([0, Math.max(0, to.length - 1)]);
    setAnchors([]);
    setDraft([]);
  };

  const changeMode = (next: EditMode) => {
    setMode(next);
    setAnchors([]);
    setDraft([]);
  };

  const onPointClick = (index: number) => {
    if (mode === "delete") {
      edit(deletePoint(path, index));
    } else if (mode === "redraw" || mode === "cut") {
      setAnchors((current) => (current.length >= 2 ? [index] : [...current, index]));
      setDraft([]);
    } else if (mode === "start") {
      setStart(index);
    }
  };

  const onMapClick = (at: LngLat) => {
    if ((mode === "redraw" && anchors.length === 2) || mode === "extend") setDraft((d) => [...d, at]);
  };

  const applyRedraw = () => {
    if (anchors.length !== 2) return;
    edit(replaceSection(path, anchors[0], anchors[1], draft));
    setAnchors([]);
    setDraft([]);
  };

  const applyExtend = () => {
    if (draft.length === 0) return;
    replaceKept(extendPath(kept, extendFrom, draft));
    setDraft([]);
  };

  const changeExtendFrom = (from: "start" | "end") => {
    setExtendFrom(from);
    setDraft([]);
  };

  const run = async (action: () => Promise<void>, failure: string) => {
    setBusy(true);
    try {
      await action();
    } catch {
      toast.error(failure);
    } finally {
      setBusy(false);
    }
  };

  const saveRoute = () =>
    run(async () => {
      const updated = await updateSubmissionGeometry(identifier, serializeCoordinates(kept));
      setDetail(updated);
      reset(parseCoordinates(updated.coordinates));
      toast.success("Route saved.");
    }, "Could not save the route.");

  const saveFields = () =>
    run(async () => {
      if (!fields || !detail) return;
      const updated = await updateSubmission(identifier, {
        ...fields,
        parking: fields.parking || null,
        publicTransport: fields.publicTransport || null,
        accessibilityInfo: fields.accessibilityInfo || null,
        lastUpdatedAt: detail.lastUpdatedAt,
      });
      setDetail(updated);
      setFields(fieldsOf(updated));
      toast.success("Details saved.");
    }, "Could not save the details. If the trail was changed elsewhere, reload the page and try again.");

  const removeImage = (imageIdentifier: string) =>
    run(async () => {
      await deleteSubmissionImage(identifier, imageIdentifier);
      setDetail((d) => (d ? { ...d, images: d.images?.filter((i) => i.identifier !== imageIdentifier) } : d));
    }, "Could not remove the photo.");

  const approve = () =>
    run(async () => {
      await approveSubmission(identifier);
      toast.success("Published as a user walk.");
      void navigate("/hike-submissions");
    }, "Could not approve the submission.");

  const reject = () =>
    run(async () => {
      await rejectSubmission(identifier, rejectReason.trim());
      toast.success("Submission rejected.");
      void navigate("/hike-submissions");
    }, "Could not reject the submission.");

  if (loadFailed) {
    return (
      <main className="container mx-auto max-w-6xl space-y-4 py-10">
        <Link to="/hike-submissions" className="text-sm font-medium text-primary hover:underline">
          Back to submissions
        </Link>
        <p>Could not load this submission.</p>
      </main>
    );
  }

  if (!detail || !fields) {
    return (
      <main className="container mx-auto max-w-6xl space-y-4 py-10">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-[620px] w-full" />
      </main>
    );
  }

  const images = detail.images ?? [];
  const lengthBefore = pathLengthMetres(savedPath);
  const lengthAfter = pathLengthMetres(kept);

  return (
    <main className="mx-auto w-full max-w-[1500px] space-y-5 px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <Link
            to="/hike-submissions"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to submissions
          </Link>
          <h1 className="text-2xl font-semibold">{detail.name}</h1>
          <p className="text-sm text-muted-foreground">
            Submitted {new Date(detail.createdAt ?? "").toLocaleString("sv-SE")} by{" "}
            {detail.submitterNickName ?? "a deleted account"} · nickname {detail.showSubmitterName ? "shown" : "hidden"}{" "}
            · transfer accepted {new Date(detail.transferAcceptedAt ?? "").toLocaleString("sv-SE")}
          </p>
        </div>
        <Badge variant={pending ? "secondary" : "outline"}>{detail.status}</Badge>
      </div>

      <div className="flex flex-wrap items-start gap-5">
        <section className="min-w-0 flex-[999_1_640px] space-y-3">
          {editable && (
            <div className="flex flex-wrap items-center gap-2 rounded-[5px] border p-2">
              {MODES.map(({ mode: m, label }) => (
                <Button
                  key={m}
                  size="sm"
                  variant={mode === m ? "default" : "ghost"}
                  aria-pressed={mode === m}
                  onClick={() => changeMode(m)}
                >
                  {label}
                </Button>
              ))}
              <span className="mx-1 h-6 w-px bg-border" />
              <Button size="sm" variant="ghost" onClick={() => replaceKept(reversePath(kept))}>
                Reverse
              </Button>
              <Button size="sm" variant="ghost" disabled={history.length === 0} onClick={undo}>
                Undo
              </Button>
              <Button size="sm" variant="ghost" onClick={() => reset(parseCoordinates(detail.originalCoordinates))}>
                Reset to original
              </Button>
              <span className="flex-1" />
              {hasSatellite && (
                <Button size="sm" variant="outline" aria-pressed={satellite} onClick={() => setSatellite((s) => !s)}>
                  {satellite ? "Map" : "Satellite"}
                </Button>
              )}
            </div>
          )}

          <SubmissionMap
            path={path}
            keptRange={range}
            jumps={jumps}
            mode={editable ? mode : "move"}
            satellite={satellite}
            redrawAnchors={mode === "extend" ? [extendFrom === "start" ? range[0] : range[1]] : anchors}
            draft={draft}
            focus={focus}
            onMovePoint={(index, to) => editable && edit(movePoint(path, index, to))}
            onInsertPoint={(afterIndex, at) => editable && onInsertPoint(afterIndex, at)}
            onPointClick={onPointClick}
            onMapClick={onMapClick}
          />

          {editable && (mode === "redraw" || mode === "cut") && (
            <div className="flex flex-wrap items-center gap-3 rounded-[5px] border p-3 text-sm">
              {anchors.length < 2 ? (
                <span>
                  {`Click the two points the section ${mode === "cut" ? "to remove lies" : "should run"} between (${anchors.length}/2).`}
                </span>
              ) : mode === "cut" ? (
                <span>Everything between the two points goes, and they are joined by a straight line.</span>
              ) : (
                <span>Click on the map to draw the new path ({draft.length} points).</span>
              )}
              <span className="flex-1" />
              <Button size="sm" disabled={anchors.length !== 2} onClick={applyRedraw}>
                {mode === "cut" ? "Cut section" : "Replace section"}
              </Button>
            </div>
          )}
          {editable && mode === "extend" && (
            <div className="flex flex-wrap items-center gap-3 rounded-[5px] border p-3 text-sm">
              <span>Extend from</span>
              {(["start", "end"] as const).map((from) => (
                <Button
                  key={from}
                  size="sm"
                  variant={extendFrom === from ? "default" : "ghost"}
                  aria-pressed={extendFrom === from}
                  onClick={() => changeExtendFrom(from)}
                >
                  {from === "start" ? "Start" : "End"}
                </Button>
              ))}
              <span>Click on the map to draw outward ({draft.length} points).</span>
              <span className="flex-1" />
              <Button size="sm" disabled={draft.length === 0} onClick={applyExtend}>
                Add to route
              </Button>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Zoom in to see every GPS point. Move point: drag a point, or drag a small handle between two points to add
            one. Delete point: click it. Cut section: click two points to remove what lies between. Redraw section:
            click two points, then click the new path between them. Extend: draw onward from the start or end. Set
            start: click a point; a loop is turned to begin there, any other walk is trimmed to it.
          </p>
          {editable && !pending && (
            <p className="text-sm text-muted-foreground">
              This walk is published. Saved changes go straight to trail {detail.publishedTrailIdentifier}.
            </p>
          )}
        </section>

        <aside className="min-w-0 flex-[1_1_340px] space-y-4">
          {editable && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Trim start and end</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Slider
                  value={range}
                  min={0}
                  max={Math.max(1, path.length - 1)}
                  step={1}
                  minStepsBetweenThumbs={1}
                  thumbLabel="Trim"
                  onValueChange={(v) => setRange([v[0], v[1]] as [number, number])}
                />
                <div className="flex justify-between text-sm">
                  <span>Trimmed at start: {formatMetres(pathLengthMetres(path.slice(0, range[0] + 1)))}</span>
                  <span>At end: {formatMetres(pathLengthMetres(path.slice(range[1])))}</span>
                </div>
                <div className="flex justify-between border-t pt-3 text-sm">
                  <span>Length</span>
                  <span data-testid="review-length">
                    {routeDirty && <s className="mr-2 text-muted-foreground">{formatMetres(lengthBefore)}</s>}
                    <b>{formatMetres(lengthAfter)}</b>
                  </span>
                </div>
                <Button
                  className="w-full"
                  disabled={!routeDirty || busy || kept.length < 2}
                  onClick={() => void saveRoute()}
                >
                  Save route
                </Button>
              </CardContent>
            </Card>
          )}

          <SimilarRoutesCard routes={similar} failed={similarFailed} />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">To check</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {jumps.length === 0 && <p className="text-sm text-muted-foreground">No suspicious jumps.</p>}
              {jumps.map((jump) => (
                <button
                  key={jump.index}
                  type="button"
                  className="w-full rounded-[5px] border border-destructive/40 bg-destructive/5 px-3 py-2 text-left text-sm hover:bg-destructive/10"
                  onClick={() => setFocus([path[jump.index], path[jump.index + 1]])}
                >
                  <b className="text-destructive">Jump of {Math.round(jump.metres)} m between two points</b>
                  <br />
                  Point {jump.index} to {jump.index + 1}. Click to zoom there.
                </button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <FieldInput
                label="Name"
                value={fields.name}
                disabled={!editable}
                onChange={(name) => setFields({ ...fields, name })}
              />
              <FieldInput
                label="City"
                value={fields.city}
                disabled={!editable}
                onChange={(city) => setFields({ ...fields, city })}
              />
              <div className="space-y-1">
                <Label htmlFor="review-description">Description</Label>
                <Textarea
                  id="review-description"
                  value={fields.description}
                  disabled={!editable}
                  onChange={(e) => setFields({ ...fields, description: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="review-classification">Difficulty</Label>
                <select
                  id="review-classification"
                  className="h-9 w-full rounded-[5px] border bg-background px-2 text-sm"
                  value={fields.classification}
                  disabled={!editable}
                  onChange={(e) => setFields({ ...fields, classification: Number(e.target.value) })}
                >
                  {CLASSIFICATIONS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <FieldInput
                label="Getting there"
                value={fields.gettingThere}
                disabled={!editable}
                onChange={(gettingThere) => setFields({ ...fields, gettingThere })}
              />
              <FieldInput
                label="Parking"
                value={fields.parking}
                disabled={!editable}
                onChange={(parking) => setFields({ ...fields, parking })}
              />
              <FieldInput
                label="Public transport"
                value={fields.publicTransport}
                disabled={!editable}
                onChange={(publicTransport) => setFields({ ...fields, publicTransport })}
              />
              <FieldInput
                label="Variation"
                value={fields.accessibilityInfo}
                disabled={!editable}
                onChange={(accessibilityInfo) => setFields({ ...fields, accessibilityInfo })}
              />
              {editable && (
                <Button
                  className="w-full"
                  variant="outline"
                  disabled={!fieldsDirty || busy}
                  onClick={() => void saveFields()}
                >
                  Save details
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Photos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {editable && !pending && detail.publishedTrailIdentifier ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    The photos now belong to the published trail. Add your own or remove the example images there.
                  </p>
                  <TrailImagesDialog
                    data={{ identifier: detail.publishedTrailIdentifier, name: fields.name }}
                    selected
                    label="Manage photos"
                  />
                </>
              ) : (
                images.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No photos. The trail gets the example images; you can replace them on the trail afterwards.
                  </p>
                )
              )}
              <div className="flex flex-wrap gap-2">
                {images.map((image) => (
                  <div key={image.identifier} className="relative">
                    <img src={image.imageUrl} alt="" className="h-20 w-28 rounded-[5px] object-cover" />
                    {pending && (
                      <button
                        type="button"
                        aria-label="Remove photo"
                        className="absolute right-1 top-1 rounded-[5px] bg-background/90 p-1"
                        onClick={() => void removeImage(image.identifier)}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {pending ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Decide</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(routeDirty || fieldsDirty) && (
                  <p className="text-sm text-destructive">Save your changes before approving.</p>
                )}
                {!detail.city.trim() && <p className="text-sm text-destructive">Add a city before approving.</p>}
                {similar?.some((r) => r.likelyDuplicate) && (
                  <p className="text-sm text-destructive">
                    This looks like a route that already exists. Check "Already on the map?" before approving.
                  </p>
                )}
                <Button
                  className="w-full"
                  disabled={busy || routeDirty || fieldsDirty || !detail.city.trim()}
                  onClick={() => void approve()}
                >
                  {busy && <Loader2 className="size-4 animate-spin" />}
                  Approve and publish
                </Button>
                <div className="space-y-1 border-t pt-3">
                  <Label htmlFor="review-reject-reason">Reason the user will see</Label>
                  <Textarea
                    id="review-reject-reason"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                  />
                </div>
                <Button
                  className="w-full"
                  variant="destructive"
                  disabled={busy || rejectReason.trim().length === 0}
                  onClick={() => void reject()}
                >
                  Reject
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-4 text-sm">
                {detail.status} by {detail.decidedBy ?? "unknown"}
                {detail.decidedAt ? ` on ${new Date(detail.decidedAt).toLocaleString("sv-SE")}` : ""}.
                {detail.rejectionReason && <p className="mt-2">Reason: {detail.rejectionReason}</p>}
                {detail.publishedTrailIdentifier && (
                  <p className="mt-2">Published as trail {detail.publishedTrailIdentifier}.</p>
                )}
              </CardContent>
            </Card>
          )}
        </aside>
      </div>
    </main>
  );
}

function FieldInput({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const id = `review-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
