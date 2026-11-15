// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FileDrop } from "@/components/file-drop";
import { Button } from "@/components/ui/button";
import type { Inspection } from "@/features/facility-import/utils/inspect";

interface Props {
  file: File | null;
  // keep-comment: null while the chosen file is still being read
  inspection: Inspection | null;
  onFile: (file: File | null) => void;
  onContinue: () => void;
}

function problemOf(file: File | null, inspection: Inspection | null): string | null {
  if (!file) return "Choose a file to continue.";
  if (!inspection) return "Reading the file…";
  return inspection.ok ? null : inspection.error;
}

export function FileStep({ file, inspection, onFile, onContinue }: Props) {
  const problem = problemOf(file, inspection);
  const unreadable = inspection !== null && !inspection.ok;

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Choose the file</h2>
        <p className="text-sm text-muted-foreground">
          GeoJSON with points in WGS84 (.geojson or .json), as a municipality&apos;s open data catalogue exports it.
        </p>
      </div>

      <FileDrop
        label="File"
        accept=".geojson,.json,application/geo+json,application/json"
        hint="GeoJSON (.geojson or .json) with points in WGS84"
        file={file}
        onChange={onFile}
      />

      {inspection?.ok && (
        <p className="text-sm text-muted-foreground">
          {inspection.summary.points} {inspection.summary.points === 1 ? "point" : "points"} read.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={problem !== null} onClick={onContinue}>
          Continue
        </Button>
        {problem && (
          <span role={unreadable ? "alert" : undefined} className="text-xs text-muted-foreground">
            {problem}
          </span>
        )}
      </div>
    </section>
  );
}
