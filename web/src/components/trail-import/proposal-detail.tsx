import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Ban,
  Check,
  Copy,
  ExternalLink,
  Info,
  Link2,
  Loader2,
  Plus,
  RotateCcw,
  SkipForward,
} from "lucide-react";
import {
  decideProposal,
  getPreview,
  type Decision,
  type LinkRole,
  type Preview,
  type Proposal,
} from "@/api/trail-import";
import type { TrailShortInfoResponse } from "@/types/types";
import { ConfidenceBadge, DecisionBadge } from "./badges";
import { GeometryPreview } from "./geometry-preview";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type Props = {
  sessionId: number;
  proposal: Proposal;
  trails: TrailShortInfoResponse[];
  onDecided: () => void;
  /** Set by the page's keyboard shortcuts; cleared once acted on. */
  pendingShortcut: Decision | null;
  onShortcutHandled: () => void;
};

function percent(value?: number): string {
  return `${Math.round((value ?? 0) * 100)}%`;
}

function CoverageBar({
  label,
  value,
  hint,
}: {
  label: string;
  value?: number;
  hint: string;
}) {
  return (
    <div className="space-y-1" title={hint}>
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{percent(value)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: percent(value) }}
        />
      </div>
    </div>
  );
}

function Fact({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`text-sm font-medium tabular-nums ${warn ? "text-amber-600" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}

function km(value?: number | null): string {
  return value === null || value === undefined
    ? "—"
    : `${value.toLocaleString()} km`;
}

const decisionHelp: { label: string; key: string; text: string }[] = [
  {
    label: "Accept",
    key: "a",
    text: "Keeps the match the analysis found and links the feature to that trail. The trail's name and length stay as they are unless you say otherwise.",
  },
  {
    label: "Relink",
    key: "r",
    text: "Links it to a trail you pick instead — for when the suggestion is the wrong one of two trails that run along each other.",
  },
  {
    label: "New trail",
    key: "n",
    text: "Opens a panel where you name the trail and pick its length, then creates it from this feature's line.",
  },
  {
    label: "Exclude",
    key: "x",
    text: "The feature never becomes a trail. The exclusion is remembered by the shape of the line, so later imports keep it out even though the source renumbers its ids.",
  },
  {
    label: "Skip",
    key: "s",
    text: "No decision, but the row is set apart from the ones you have not looked at yet.",
  },
  {
    label: "Undo",
    key: "u",
    text: "Clears the decision and everything that came with it: the trail, the note, and the name and length you picked. An exclusion inherited from an earlier import comes back at the next analysis.",
  },
];

/** Hover text for a decision. The span keeps it working while the button is disabled. */
function Hint({ text, children }: { text: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex shrink-0">{children}</span>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">{text}</TooltipContent>
    </Tooltip>
  );
}

/** Only the two roles a reviewer may pick; Excluded is set by the server for Exclude. */
const roleChoices: { value: LinkRole; label: string; hint: string }[] = [
  {
    value: "Segment",
    label: "Segment",
    hint: "Part of the trail's route. Its geometry is merged into the trail's path.",
  },
  {
    value: "Duplicate",
    label: "Duplicate",
    hint: "Belongs to the trail but adds no geometry, such as an aggregate of several stages.",
  },
];

export function ProposalDetail({
  sessionId,
  proposal,
  trails,
  onDecided,
  pendingShortcut,
  onShortcutHandled,
}: Props) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [relinking, setRelinking] = useState(false);
  const [trailSearch, setTrailSearch] = useState("");
  const [role, setRole] = useState<LinkRole>("Segment");
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newLength, setNewLength] = useState<"measured" | "source">("measured");
  const [rewriteLength, setRewriteLength] = useState(false);

  // Kept apart from the preview fetch: deciding rewrites the note, and that must not cost
  // another round trip for geometry that has not changed.
  useEffect(() => {
    setNote(proposal.note ?? "");
    // The source's name is where a new trail starts, and the reviewer shortens it there.
    setNewName(proposal.decidedName ?? proposal.featureName);
    // A decided proposal reopens on the role it was given; Excluded is not a choice here.
    setRole(proposal.decidedRole === "Duplicate" ? "Duplicate" : "Segment");
  }, [
    proposal.id,
    proposal.note,
    proposal.decidedRole,
    proposal.decidedName,
    proposal.featureName,
  ]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setPreview(null);
    setRelinking(false);
    setCreating(false);
    setTrailSearch("");
    setNewLength("measured");
    setRewriteLength(false);

    getPreview(sessionId, proposal.id)
      .then((result) => {
        if (!cancelled) setPreview(result);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          toast.error(
            error instanceof Error
              ? error.message
              : "The preview could not be loaded.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId, proposal.id]);

  const matches = useMemo(() => {
    const needle = trailSearch.trim().toLowerCase();
    if (!needle) return trails.slice(0, 8);

    return trails
      .filter((trail) => trail.name.toLowerCase().includes(needle))
      .slice(0, 8);
  }, [trails, trailSearch]);

  async function decide(
    decision: Decision,
    picked?: {
      trailIdentifier?: string;
      name?: string;
      lengthKm?: number;
      role?: LinkRole;
    },
  ) {
    setSaving(true);
    try {
      await decideProposal(sessionId, proposal.id, {
        decision,
        trailIdentifier: picked?.trailIdentifier,
        // Only these two link to a trail the reviewer picked; the rest have no role to set.
        role:
          decision === "Accept" || decision === "Relink"
            ? (picked?.role ?? role)
            : undefined,
        note: note.trim() || undefined,
        name: picked?.name,
        lengthKm: picked?.lengthKm,
      });
      setCreating(false);
      onDecided();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "The decision could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  // The page owns the key handling; this runs whatever it captured for the current row.
  useEffect(() => {
    if (!pendingShortcut) return;

    onShortcutHandled();

    if (pendingShortcut === "Accept" && !proposal.suggestedTrailId) {
      toast.error(
        "Nothing was suggested for this feature. Relink it or create a new trail.",
      );
      return;
    }

    if (pendingShortcut === "Relink") {
      setRelinking(true);
      return;
    }

    // Creating asks for a name first, so a keypress alone never adds a trail.
    if (pendingShortcut === "CreateNew") {
      setCreating(true);
      return;
    }

    // Undoing a row that was never decided would report a decision that did not happen.
    if (pendingShortcut === "Pending" && proposal.decision === "Pending")
      return;

    // Nor is there anything to save in deciding a row exactly as it already stands.
    if (pendingShortcut === "Accept" && settledAsAccept) return;
    if (pendingShortcut === "Exclude" && proposal.decision === "Exclude")
      return;
    if (pendingShortcut === "Skip" && proposal.decision === "Skip") return;

    void decide(pendingShortcut);
    // decide is re-created every render; the shortcut is the only trigger that matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingShortcut]);

  // The municipality's own page for the feature. Its length is a third opinion when the
  // sparlangd field and the geometry disagree, which they do for eleven of the features.
  const sourcePage = useMemo(() => {
    if (!preview?.featureProperties) return null;

    try {
      const link = (JSON.parse(preview.featureProperties) as { link?: unknown })
        .link;
      if (typeof link !== "string") return null;

      const url = new URL(link);

      return url.protocol === "https:" || url.protocol === "http:"
        ? url.href
        : null;
    } catch {
      return null;
    }
  }, [preview]);

  const canAccept = Boolean(proposal.suggestedTrailId);

  // The trail's curated length against what its own line measures, when the two are far
  // enough apart to mean something. Half a kilometre and a tenth of the length, so the
  // half-kilometre rounding on the signs stays out of the way.
  const lengthGap = useMemo(() => {
    const curated = preview?.trailCuratedLengthKm;
    const measured = preview?.trailMeasuredLengthKm;

    if (curated == null || measured == null || curated <= 0) return null;

    const gap = Math.abs(curated - measured);

    if (gap < 0.5 || gap / curated < 0.1) return null;

    return { measured, longer: measured > curated };
  }, [preview]);

  const measuredTrailLength = lengthGap?.measured ?? null;

  // Features that would link to the same trail as this one. Excluded and CreateNew rows
  // aim at no trail, so the server leaves them out.
  const sharing = preview?.sharingTheTrail ?? [];

  // Which of them is carrying the trail's route. A trail whose features are all duplicates
  // has nothing to build its line from and keeps the one it has, so the offer here is
  // whichever role the trail is still missing.
  // A decision already made, with nothing on the panel that would change it. Pressing it
  // again would save the same row and step on, which reads as the screen flinching.
  const settledAsAccept =
    proposal.decision === "Accept" &&
    proposal.decidedRole === role &&
    !rewriteLength;

  const carrier = sharing.find(
    (other) =>
      (other.decision === "Accept" || other.decision === "Relink") &&
      other.decidedRole === "Segment",
  );

  // A created trail is stored with the source's line, so its measured length is the one
  // that matches the geometry. The stated figure is only better when the line is broken.
  const newTrailLength =
    newLength === "source"
      ? (preview?.sourceStatedLengthKm ?? undefined)
      : preview?.featureLengthKm;

  return (
    <div className="space-y-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">
            {proposal.featureName || "(no name in source)"}
          </h2>
          <ConfidenceBadge confidence={proposal.confidence} />
          <DecisionBadge decision={proposal.decision} />
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span>
            Source id {proposal.externalId || "—"}
            {proposal.decidedBy ? ` · decided by ${proposal.decidedBy}` : ""}
          </span>
          {sourcePage && (
            <a
              href={sourcePage}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-foreground"
            >
              <ExternalLink className="size-3" />
              Source page
            </a>
          )}
          {proposal.decidedName && (
            <span>· to be created as {proposal.decidedName}</span>
          )}
          {proposal.decidedLengthKm != null && (
            <span>· length {km(proposal.decidedLengthKm)}</span>
          )}
        </div>
      </div>

      {proposal.matchReason && (
        <p className="rounded-md bg-muted/50 px-3 py-2 text-sm">
          {proposal.matchReason}
        </p>
      )}

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : preview ? (
        <>
          <GeometryPreview
            feature={preview.featureCoordinates ?? []}
            trail={preview.trailCoordinates}
            className="h-72"
          />

          {preview.trailIsNearestOnly && preview.trailName && (
            <p className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
              Drawn alongside is{" "}
              <span className="font-medium">{preview.trailName}</span>, the
              nearest trail. Nothing matched this feature, so it is only what
              the coverage was measured against — not a suggestion.
            </p>
          )}

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Fact
              label="Feature, measured"
              value={km(preview.featureLengthKm)}
            />
            <Fact
              label="Source says"
              value={km(preview.sourceStatedLengthKm)}
              warn={preview.sourceLengthDisagrees}
            />
            <Fact
              label="Trail, curated"
              value={km(preview.trailCuratedLengthKm)}
            />
            <Fact
              label="Trail, measured"
              value={km(preview.trailMeasuredLengthKm)}
            />
          </div>

          {preview.sourceLengthDisagrees && (
            <p className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              The length the source states is far from what its own geometry
              measures. Trust the measurement, not the label.
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <CoverageBar
              label="Feature lies on the trail"
              value={proposal.coverageForward}
              hint="How much of the source feature runs along the matched trail, within 15 m"
            />
            <CoverageBar
              label="Trail lies on the feature"
              value={proposal.coverageBackward}
              hint="How much of the trail runs along the source feature, within 15 m"
            />
          </div>

          {proposal.hausdorffMeters != null && (
            <p className="text-xs text-muted-foreground">
              Largest deviation between the two lines:{" "}
              <span className="font-medium tabular-nums">
                {Math.round(proposal.hausdorffMeters).toLocaleString()} m
              </span>
              . This measures distance, not length — a rerouted stretch can
              deviate far and still be the same trail.
            </p>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">No preview available.</p>
      )}

      <Separator />

      {(canAccept || relinking) && (
        <div className="space-y-2">
          <p className="text-sm font-medium">
            What this feature is to the trail
          </p>
          <RadioGroup
            value={role}
            onValueChange={(value) => setRole(value as LinkRole)}
          >
            {roleChoices.map((choice) => (
              <label
                key={choice.value}
                className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 ${
                  role === choice.value ? "border-primary bg-accent/40" : ""
                }`}
              >
                <RadioGroupItem
                  value={choice.value}
                  className="mt-0.5"
                  disabled={saving}
                />
                <span>
                  <span className="text-sm font-medium">{choice.label}</span>
                  <span className="block text-xs text-muted-foreground">
                    {choice.hint}
                  </span>
                </span>
              </label>
            ))}
          </RadioGroup>
        </div>
      )}

      {sharing.length > 0 && (
        <div className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
          <p className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>
              {sharing.length === 1
                ? "Another feature in this session points at the same trail:"
                : `${sharing.length} other features in this session point at the same trail:`}{" "}
              {sharing.map((other) => other.featureName).join(", ")}.{" "}
              {carrier
                ? `${carrier.featureName} is carrying the trail's route, so this one is a duplicate — linked to the trail, adding no geometry.`
                : "None of them is carrying the trail's route yet. One has to, or the trail is left with the line it already has — right only where the geometry is curated on purpose."}
            </span>
          </p>
          {canAccept &&
            (carrier ? (
              <Button
                size="sm"
                variant="outline"
                disabled={saving}
                onClick={() => void decide("Accept", { role: "Duplicate" })}
              >
                <Copy />
                Accept as duplicate
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                disabled={saving}
                onClick={() => void decide("Accept", { role: "Segment" })}
              >
                <Check />
                Accept as segment
              </Button>
            ))}
        </div>
      )}

      {canAccept && !relinking && lengthGap != null && (
        <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3">
          <Checkbox
            checked={rewriteLength}
            onCheckedChange={(checked) => setRewriteLength(checked === true)}
            disabled={saving}
            className="mt-0.5"
          />
          <span>
            <span className="text-sm font-medium">
              Set the trail's length to {km(lengthGap.measured)}
            </span>
            <span className="block text-xs text-muted-foreground">
              It carries {km(preview?.trailCuratedLengthKm)} today, and its own
              line {lengthGap.longer ? "runs longer" : "runs shorter"} than
              that. A line that falls short can be a line cut off as easily as a
              length that was never right, and the drawing above is what tells
              them apart.
            </span>
          </span>
        </label>
      )}

      <div className="space-y-2">
        <Label htmlFor="note">Note</Label>
        <Textarea
          id="note"
          rows={2}
          value={note}
          placeholder="Why this decision, for whoever reads the session later"
          onChange={(event) => setNote(event.target.value)}
        />
      </div>

      {relinking && (
        <div className="space-y-2 rounded-md border p-3">
          <Label htmlFor="trail-search">Link to another trail</Label>
          <Input
            id="trail-search"
            autoFocus
            value={trailSearch}
            placeholder="Search by name…"
            onChange={(event) => setTrailSearch(event.target.value)}
          />
          <div className="max-h-56 space-y-1 overflow-y-auto">
            {matches.map((trail) => (
              <button
                key={trail.identifier}
                type="button"
                className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
                disabled={saving}
                onClick={() =>
                  void decide("Relink", { trailIdentifier: trail.identifier })
                }
              >
                <span>{trail.name}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {trail.trailLength} km
                </span>
              </button>
            ))}
            {matches.length === 0 && (
              <p className="px-2 py-1.5 text-sm text-muted-foreground">
                No trail matches that.
              </p>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={() => setRelinking(false)}>
            Cancel
          </Button>
        </div>
      )}

      {creating && (
        <div className="space-y-3 rounded-md border p-3">
          <div className="space-y-2">
            <Label htmlFor="new-name">Name for the new trail</Label>
            <Input
              id="new-name"
              autoFocus
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              The source calls it "{proposal.featureName || "(no name)"}". This
              is the only place the import writes a name, so what stands here is
              what the trail is called.
            </p>
          </div>

          {preview?.sourceStatedLengthKm != null &&
          preview.sourceLengthDisagrees ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">Length</p>
              <RadioGroup
                value={newLength}
                onValueChange={(value) =>
                  setNewLength(value as "measured" | "source")
                }
              >
                <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3">
                  <RadioGroupItem
                    value="measured"
                    className="mt-0.5"
                    disabled={saving}
                  />
                  <span>
                    <span className="text-sm font-medium">
                      {km(preview.featureLengthKm)}, measured from the line
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      Matches the geometry the trail is stored with.
                    </span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3">
                  <RadioGroupItem
                    value="source"
                    className="mt-0.5"
                    disabled={saving}
                  />
                  <span>
                    <span className="text-sm font-medium">
                      {km(preview.sourceStatedLengthKm)}, what the source states
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      Pick this when the line is the broken one, such as a loop
                      drawn half way.
                    </span>
                  </span>
                </label>
              </RadioGroup>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Length {km(preview?.featureLengthKm)}, measured from the line.
            </p>
          )}

          <div className="flex gap-2">
            <Button
              onClick={() =>
                void decide("CreateNew", {
                  name: newName.trim(),
                  lengthKm: newTrailLength,
                })
              }
              disabled={saving || !newName.trim()}
            >
              {saving ? <Loader2 className="animate-spin" /> : <Plus />}
              Create trail
            </Button>
            <Button
              variant="ghost"
              onClick={() => setCreating(false)}
              disabled={saving}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      <TooltipProvider delayDuration={200}>
        <div className="flex flex-wrap items-center gap-2">
          <Hint
            text={
              settledAsAccept
                ? "Already accepted as it stands. Change the role or the length to save it again, or undo it (u)."
                : canAccept
                  ? "Links the feature to the suggested trail and keeps that match. The trail's own name and length stay as they are. (a)"
                  : "Nothing was suggested for this feature. Relink it to a trail you pick, or create a new one."
            }
          >
            <Button
              variant={settledAsAccept ? "secondary" : "default"}
              onClick={() =>
                void decide("Accept", {
                  lengthKm: rewriteLength
                    ? (measuredTrailLength ?? undefined)
                    : undefined,
                })
              }
              disabled={saving || !canAccept || settledAsAccept}
            >
              {saving ? <Loader2 className="animate-spin" /> : <Check />}
              {settledAsAccept ? "Accepted" : "Accept"}
            </Button>
          </Hint>
          <Hint text="Links it to a trail you pick instead of the suggested one, for when two trails run along each other. (r)">
            <Button
              variant="outline"
              onClick={() => setRelinking(true)}
              disabled={saving}
            >
              <Link2 />
              Relink
            </Button>
          </Hint>
          <Hint text="Opens a panel where you name the trail and pick its length, then creates it from this line. (n)">
            <Button
              variant="outline"
              onClick={() => setCreating(true)}
              disabled={saving}
            >
              <Plus />
              New trail
            </Button>
          </Hint>
          <Hint
            text={
              proposal.decision === "Exclude"
                ? "Already excluded. Undo it (u) to put it back in play."
                : "The feature never becomes a trail. Remembered by the shape of the line, so later imports keep it out. (x)"
            }
          >
            <Button
              variant={
                proposal.decision === "Exclude" ? "secondary" : "outline"
              }
              onClick={() => void decide("Exclude")}
              disabled={saving || proposal.decision === "Exclude"}
            >
              <Ban />
              {proposal.decision === "Exclude" ? "Excluded" : "Exclude"}
            </Button>
          </Hint>
          <Hint
            text={
              proposal.decision === "Skip"
                ? "Already skipped. Pick a decision, or undo it (u)."
                : "No decision. Sets the row apart from the ones you have not looked at yet. (s)"
            }
          >
            <Button
              variant={proposal.decision === "Skip" ? "secondary" : "ghost"}
              onClick={() => void decide("Skip")}
              disabled={saving || proposal.decision === "Skip"}
            >
              <SkipForward />
              {proposal.decision === "Skip" ? "Skipped" : "Skip"}
            </Button>
          </Hint>

          <div className="ml-auto flex items-center gap-2">
            {proposal.decision !== "Pending" && (
              <Hint text="Clears the decision and everything that came with it: the trail, the note, the name and the length. (u)">
                <Button
                  variant="ghost"
                  onClick={() => void decide("Pending")}
                  disabled={saving}
                >
                  <RotateCcw />
                  Undo
                </Button>
              </Hint>
            )}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="What the decisions do"
                >
                  <Info />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-96">
                <dl className="space-y-3">
                  {decisionHelp.map((entry) => (
                    <div key={entry.label}>
                      <dt className="flex items-center gap-2 text-sm font-medium">
                        {entry.label}
                        <kbd className="rounded border px-1 text-xs font-normal text-muted-foreground">
                          {entry.key}
                        </kbd>
                      </dt>
                      <dd className="text-xs text-muted-foreground">
                        {entry.text}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">
                  Accept and Relink also ask what the feature is to the trail:
                  Segment merges its line into the route, Duplicate links it
                  without adding geometry.
                </p>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </TooltipProvider>
    </div>
  );
}
