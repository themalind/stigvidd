// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { AdminCityAreaResponse } from "@/api/generated/model";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type LinkKind, useRemoveExclusion } from "@/features/city-areas/api/city-areas";

type Row = { kind: LinkKind; identifier: string; name: string };

export function ExcludedCard({ area }: { area: AdminCityAreaResponse }) {
  const removeExclusion = useRemoveExclusion();

  const rows: Row[] = [
    ...area.excludedFacilities.map((f) => ({ kind: "facilities" as const, identifier: f.identifier, name: f.name })),
    ...area.excludedTrails.map((t) => ({ kind: "trails" as const, identifier: t.identifier, name: t.name })),
  ];

  if (rows.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Removed from the area</CardTitle>
        <CardDescription>
          Inside the boundary, but kept out of the area. Undo to let the boundary take them in again.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y rounded-xs border border-input">
          {rows.map((row) => (
            <li key={`${row.kind}-${row.identifier}`} className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{row.name}</p>
                <p className="text-xs text-muted-foreground">{row.kind === "trails" ? "Trail" : "Facility"}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                aria-label={`Undo removing ${row.name}`}
                disabled={removeExclusion.isPending}
                onClick={() =>
                  removeExclusion.mutate({ area: area.identifier, kind: row.kind, identifier: row.identifier })
                }
              >
                Undo
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
