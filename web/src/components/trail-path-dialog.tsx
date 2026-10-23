// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Dialog } from "radix-ui";
import { Route } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { getTrailPath } from "@/api/trail";
import { findJumps, formatMetres, pathLengthMetres, type LngLat } from "@/lib/geometry-edit";
import type { AdminTrailListItem } from "@/types/types";
import { hasSatellite } from "./hike-submissions/map-style";
import { TrailPathMap } from "./trails/trail-path-map";
import { Button } from "./ui/button";

interface Props {
  data: Pick<AdminTrailListItem, "identifier" | "name" | "trailLength">;
}

// keep-comment: imported trails are sparser than GPS recordings, so DEFAULT_JUMP_METRES (40) would flag most of them
const GAP_METRES = 250;

export default function TrailPathDialog({ data }: Props) {
  const [path, setPath] = useState<LngLat[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [satellite, setSatellite] = useState(false);

  const gaps = useMemo(() => (path ? findJumps(path, GAP_METRES) : []), [path]);

  async function handleOpenChange(open: boolean) {
    if (!open) return;
    setLoading(true);
    setPath(null);
    try {
      setPath(await getTrailPath(data.identifier));
    } catch {
      toast.error("Failed to load the trail's coordinates.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog.Root onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild>
        <Button variant="ghost" size="icon" aria-label="Show trail on map" title="Show trail on map">
          <Route />
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-4xl -translate-x-1/2 -translate-y-1/2 rounded-xs border p-6 shadow-lg">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-foreground mb-1 font-semibold">{data.name}</Dialog.Title>
              <Dialog.Description className="text-muted-foreground text-sm">
                The trail's stored coordinates. Zoom in to see the individual points.
              </Dialog.Description>
            </div>
            {hasSatellite && (
              <Button size="sm" variant="outline" aria-pressed={satellite} onClick={() => setSatellite((s) => !s)}>
                {satellite ? "Map" : "Satellite"}
              </Button>
            )}
          </div>

          {loading ? (
            <p className="text-muted-foreground text-sm">Loading...</p>
          ) : !path ? (
            <p className="text-muted-foreground text-sm">The coordinates could not be loaded.</p>
          ) : path.length < 2 ? (
            <p className="text-muted-foreground text-sm">This trail has no line to draw.</p>
          ) : (
            <>
              <dl className="mb-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                <div className="flex gap-1">
                  <dt className="text-muted-foreground">Points</dt>
                  <dd>{path.length}</dd>
                </div>
                <div className="flex gap-1">
                  <dt className="text-muted-foreground">Measured length</dt>
                  <dd>{formatMetres(pathLengthMetres(path))}</dd>
                </div>
                <div className="flex gap-1">
                  <dt className="text-muted-foreground">Stated length</dt>
                  <dd>{data.trailLength} km</dd>
                </div>
                <div className="flex gap-1">
                  <dt className="text-muted-foreground">Gaps over {GAP_METRES} m</dt>
                  <dd className={gaps.length > 0 ? "text-destructive" : undefined}>{gaps.length}</dd>
                </div>
              </dl>
              <TrailPathMap path={path} gaps={gaps} satellite={satellite} />
            </>
          )}

          <div className="mt-4 flex justify-end">
            <Dialog.Close asChild>
              <Button variant="outline">Close</Button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
