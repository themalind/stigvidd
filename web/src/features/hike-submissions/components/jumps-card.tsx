// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RouteEditor } from "@/features/hike-submissions/hooks/use-route-editor";
import type { LngLat } from "@/utils/geometry-edit";

interface Props {
  editor: RouteEditor;
  onFocus: (points: LngLat[]) => void;
}

export function JumpsCard({ editor: { path, jumps }, onFocus }: Props) {
  return (
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
            onClick={() => onFocus([path[jump.index], path[jump.index + 1]])}
          >
            <b className="text-destructive">Jump of {Math.round(jump.metres)} m between two points</b>
            <br />
            Point {jump.index} to {jump.index + 1}. Click to zoom there.
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
