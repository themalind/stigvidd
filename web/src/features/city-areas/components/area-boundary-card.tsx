// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { AdminCityAreaResponse, AdminCityAreaTrailPathResponse } from "@/api/generated/model";
import { useConfirm } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type BoundaryCoordinates,
  trailPathsQueryOptions,
  usePreviewBoundary,
  useRemoveBoundary,
  useSaveBoundary,
  useSuggestBoundary,
} from "@/features/city-areas/api/city-areas";
import { AreaMap, type AreaMapNeighbour, type AreaMapPlace } from "@/features/city-areas/components/area-map";
import { BoundaryPreviewSummary } from "@/features/city-areas/components/boundary-preview-summary";

type Props = {
  area: AdminCityAreaResponse;
  places: AreaMapPlace[];
  neighbours: AreaMapNeighbour[];
};

type State =
  | { kind: "view" }
  | { kind: "suggestion"; coordinates: BoundaryCoordinates }
  | { kind: "editing"; initial: BoundaryCoordinates; draft: BoundaryCoordinates };

const VIEW: State = { kind: "view" };
// keep-comment: a stable empty list, so the map does not redraw and refit on every render while the paths load
const NO_TRAILS: AdminCityAreaTrailPathResponse[] = [];
const PREVIEW_DELAY_MS = 400;

function description(state: State, hasBoundary: boolean): string {
  if (state.kind === "editing") {
    return "Drawing the boundary. Nothing is saved until you press Save boundary.";
  }
  if (state.kind === "suggestion") {
    return "Check the suggested boundary on the map before you use it.";
  }
  return hasBoundary
    ? "Trails with at least a quarter of their length inside, and facilities inside, belong to the area."
    : "No boundary yet. Suggest one from the trails and facilities linked below, then check it on the map.";
}

export function AreaBoundaryCard({ area, places, neighbours }: Props) {
  const [state, setState] = useState<State>(VIEW);
  const { data: trails = NO_TRAILS } = useQuery(trailPathsQueryOptions(area.identifier));
  const suggest = useSuggestBoundary();
  const save = useSaveBoundary();
  const remove = useRemoveBoundary();
  const [confirm, confirmDialog] = useConfirm();
  const { data: preview, mutate: requestPreview, reset: clearPreview } = usePreviewBoundary();
  const pending = state.kind === "suggestion" ? state.coordinates : state.kind === "editing" ? state.draft : null;

  // keep-comment: waits for a pause in the dragging, so one preview goes out per change rather than per pointer move
  useEffect(() => {
    if (!pending || pending.length === 0) {
      clearPreview();
      return;
    }
    const timer = setTimeout(() => requestPreview({ area: area.identifier, coordinates: pending }), PREVIEW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [pending, area.identifier, requestPreview, clearPreview]);

  function requestSuggestion() {
    suggest.mutate(area.identifier, { onSuccess: (coordinates) => setState({ kind: "suggestion", coordinates }) });
  }

  function edit(initial: BoundaryCoordinates) {
    setState({ kind: "editing", initial, draft: initial });
  }

  function saveBoundary(coordinates: BoundaryCoordinates) {
    save.mutate({ area: area.identifier, coordinates }, { onSuccess: () => setState(VIEW) });
  }

  async function removeBoundary() {
    const confirmed = await confirm({
      title: `Remove the boundary of ${area.name}?`,
      description: "Links that came from the boundary are removed. Manual links stay.",
      confirmLabel: "Remove boundary",
      destructive: true,
    });
    if (confirmed) remove.mutate(area.identifier);
  }

  const busy = suggest.isPending || save.isPending || remove.isPending;
  const editing = state.kind === "editing";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Boundary</CardTitle>
        <CardDescription>{description(state, Boolean(area.boundary))}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <AreaMap
          neighbours={neighbours}
          boundary={editing ? null : area.boundary}
          suggestion={state.kind === "suggestion" ? state.coordinates : null}
          trails={trails}
          places={places}
          preview={pending ? (preview ?? null) : null}
          editing={editing ? state.initial : null}
          onEdit={(draft) => setState((current) => (current.kind === "editing" ? { ...current, draft } : current))}
        />
        <div className="flex flex-wrap gap-2">
          {state.kind === "view" && (
            <>
              <Button variant="outline" onClick={requestSuggestion} disabled={busy}>
                Suggest boundary from links
              </Button>
              <Button variant="outline" onClick={() => edit(area.boundary ?? [])} disabled={busy}>
                {area.boundary ? "Edit boundary" : "Draw boundary"}
              </Button>
              {area.boundary && (
                <Button variant="ghost" className="text-destructive" onClick={removeBoundary} disabled={busy}>
                  Remove boundary
                </Button>
              )}
            </>
          )}
          {state.kind === "suggestion" && (
            <>
              <Button onClick={() => saveBoundary(state.coordinates)} disabled={busy}>
                Use suggestion
              </Button>
              <Button variant="outline" onClick={() => edit(state.coordinates)} disabled={busy}>
                Adjust on map
              </Button>
              <Button variant="outline" onClick={() => setState(VIEW)} disabled={busy}>
                Discard
              </Button>
            </>
          )}
          {state.kind === "editing" && (
            <>
              <Button onClick={() => saveBoundary(state.draft)} disabled={busy || state.draft.length === 0}>
                Save boundary
              </Button>
              <Button variant="outline" onClick={() => setState(VIEW)} disabled={busy}>
                Cancel
              </Button>
            </>
          )}
        </div>
        {state.kind === "suggestion" && (
          <p className="text-sm text-muted-foreground">
            The dashed outline is a suggestion and nothing is saved yet.
            {area.boundary ? " Using it replaces the current boundary." : ""}
          </p>
        )}
        {pending && preview && <BoundaryPreviewSummary preview={preview} />}
      </CardContent>
      {confirmDialog}
    </Card>
  );
}
