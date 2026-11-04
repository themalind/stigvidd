// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { paths } from "@/config/paths";
import { similarRoutesQueryOptions } from "@/features/hike-submissions/api/hike-submissions";

const KIND_LABELS: Record<string, string> = {
  Trail: "Trail",
  Contribution: "User walk",
  Submission: "Other submission",
};

const percent = (share: number) => `${Math.round(share * 100)} %`;

export function SimilarRoutesCard({ identifier }: { identifier: string }) {
  const { data: routes, isError } = useQuery(similarRoutesQueryOptions(identifier));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Already on the map?</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {!routes ? (
          isError ? (
            <p className="text-sm text-destructive">Could not compare with the existing trails.</p>
          ) : (
            <Skeleton className="h-12 w-full" />
          )
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
                <Link to={paths.hikeSubmission(route.identifier)} className="font-medium text-primary hover:underline">
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
