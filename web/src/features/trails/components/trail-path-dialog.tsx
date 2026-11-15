// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Route } from "lucide-react";
import { useMemo } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { QueryBoundary } from "@/components/query-boundary";
import { trailPathQueryOptions } from "@/features/trails/api/trail";
import { findJumps, formatMetres, pathLengthMetres } from "@/utils/geometry-edit";
import type { AdminTrailListItemResponse } from "@/api/generated/model";
import { MapDialog } from "@/components/map-dialog";
import { TrailPathMap } from "./trail-path-map";
import { Button } from "@/components/ui/button";

interface Props {
  data: Pick<AdminTrailListItemResponse, "identifier" | "name" | "trailLength">;
}

// keep-comment: imported trails are sparser than GPS recordings, so DEFAULT_JUMP_METRES (40) would flag most of them
const GAP_METRES = 250;

export default function TrailPathDialog({ data }: Props) {
  return (
    <MapDialog
      title={data.name}
      description="The trail's stored coordinates. Zoom in to see the individual points."
      trigger={
        <Button variant="ghost" size="icon" aria-label="Show trail on map" title="Show trail on map">
          <Route />
        </Button>
      }
    >
      {(satellite) => (
        <QueryBoundary
          fallback={<p className="text-muted-foreground text-sm">Loading...</p>}
          errorFallback={({ retry }) => (
            <div className="flex items-center gap-3">
              <p className="text-muted-foreground text-sm">The coordinates could not be loaded.</p>
              <Button size="sm" variant="outline" onClick={retry}>
                Try again
              </Button>
            </div>
          )}
        >
          <TrailPath data={data} satellite={satellite} />
        </QueryBoundary>
      )}
    </MapDialog>
  );
}

function TrailPath({ data, satellite }: Props & { satellite: boolean }) {
  const { data: path } = useSuspenseQuery(trailPathQueryOptions(data.identifier));
  const gaps = useMemo(() => findJumps(path, GAP_METRES), [path]);

  if (path.length < 2) {
    return <p className="text-muted-foreground text-sm">This trail has no line to draw.</p>;
  }

  return (
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
  );
}
