// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import type { RouteEditor } from "@/features/hike-submissions/hooks/use-route-editor";
import { formatMetres, type LngLat, pathLengthMetres } from "@/utils/geometry-edit";

interface Props {
  editor: RouteEditor;
  savedPath: LngLat[];
  saving: boolean;
  onSave: () => void;
}

export function TrimCard({ editor, savedPath, saving, onSave }: Props) {
  const { path, range, kept, dirty } = editor;

  return (
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
          onValueChange={(v) => editor.setRange([v[0], v[1]])}
        />
        <div className="flex justify-between text-sm">
          <span>Trimmed at start: {formatMetres(pathLengthMetres(path.slice(0, range[0] + 1)))}</span>
          <span>At end: {formatMetres(pathLengthMetres(path.slice(range[1])))}</span>
        </div>
        <div className="flex justify-between border-t pt-3 text-sm">
          <span>Length</span>
          <span data-testid="review-length">
            {dirty && <s className="mr-2 text-muted-foreground">{formatMetres(pathLengthMetres(savedPath))}</s>}
            <b>{formatMetres(pathLengthMetres(kept))}</b>
          </span>
        </div>
        <Button className="w-full" disabled={!dirty || saving || kept.length < 2} onClick={onSave}>
          Save route
        </Button>
      </CardContent>
    </Card>
  );
}
