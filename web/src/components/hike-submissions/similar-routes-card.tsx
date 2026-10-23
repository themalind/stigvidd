// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Link } from "react-router";
import type { SimilarRoute } from "@/api/hike-submissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const KIND_LABELS: Record<string, string> = {
  Trail: "Trail",
  Contribution: "User walk",
  Submission: "Other submission",
};

const percent = (share: number | undefined) => `${Math.round((share ?? 0) * 100)} %`;

type Props = {
  // keep-comment: null while loading
  routes: SimilarRoute[] | null;
  failed: boolean;
};

export function SimilarRoutesCard({ routes, failed }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Already on the map?</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {failed ? (
          <p className="text-sm text-destructive">Could not compare with the existing trails.</p>
        ) : routes === null ? (
          <Skeleton className="h-12 w-full" />
        ) : routes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No trail or other submission follows this route.</p>
        ) : (
          routes.map((route) => (
            <div
              key={route.identifier}
              data-testid="similar-route"
              className={
                route.likelyDuplicate
                  ? "rounded-[5px] border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm"
                  : "rounded-[5px] border px-3 py-2 text-sm"
              }
            >
              {route.likelyDuplicate && <b className="text-destructive">Likely the same route. </b>}
              {route.kind === "Submission" ? (
                <Link to={`/hike-submissions/${route.identifier}`} className="font-medium text-primary hover:underline">
                  {route.name}
                </Link>
              ) : (
                <span className="font-medium">{route.name}</span>
              )}
              <span className="text-muted-foreground"> · {KIND_LABELS[route.kind] ?? route.kind}</span>
              <br />
              {percent(route.walkOnRoute)} of this walk runs along it, {percent(route.routeOnWalk)} of it along this
              walk.
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
