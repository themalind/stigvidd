// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useRef, useState } from "react";
import { FileSearch, Loader2 } from "lucide-react";
import { FileDrop } from "@/components/file-drop";
import { MunicipalitySelect } from "@/components/municipality-select";
import { Button } from "@/components/ui/button";
import type { SourceFile } from "@/features/facility-import/api/facility-import";
import { useImportSources } from "@/features/facility-import/api/sources";
import { inspectGeoJson, type Inspection } from "@/features/facility-import/utils/inspect";
import { initialMapping, mappingProblem, toRequest, type MappingDraft } from "@/features/facility-import/utils/mapping";
import { MappingForm } from "./mapping-form";
import { SourceSelect } from "./source-select";

interface Props {
  busy: boolean;
  onPreview: (file: SourceFile) => void;
  onChange: () => void;
}

interface ReadFile {
  file: File;
  geoJson: string;
  inspection: Inspection;
}

function missingStep(file: File | null, municipalityIdentifier: string, sourceIdentifier: string): string | null {
  if (!municipalityIdentifier) return "Choose a municipality to preview.";
  if (!sourceIdentifier) return "Choose a data source to preview.";
  if (!file) return "Choose a file to preview.";
  return null;
}

function readProblem(current: ReadFile | null): string | null {
  if (!current) return "Reading the file…";
  return current.inspection.ok ? null : current.inspection.error;
}

export function SourceForm({ busy, onPreview, onChange }: Props) {
  const sources = useImportSources();
  const [municipalityIdentifier, setMunicipalityIdentifier] = useState("");
  const [sourceIdentifier, setSourceIdentifier] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [read, setRead] = useState<ReadFile | null>(null);
  // keep-comment: null until edited; until then the mapping follows the file and the data source's last one
  const [edited, setEdited] = useState<MappingDraft | null>(null);
  const latest = useRef<File | null>(null);

  const source = sources.data?.find((s) => s.identifier === sourceIdentifier);
  const current = read?.file === file ? read : null;
  const summary = current?.inspection.ok ? current.inspection.summary : null;
  const draft = summary ? (edited ?? initialMapping(summary, source?.mapping)) : null;
  const problem =
    missingStep(file, municipalityIdentifier, sourceIdentifier) ??
    readProblem(current) ??
    (draft && summary ? mappingProblem(draft, summary) : null);
  const ready = problem === null && current !== null && draft !== null;

  function changed(reset: () => void) {
    reset();
    setEdited(null);
    onChange();
  }

  async function handleFile(chosen: File | null) {
    latest.current = chosen;
    changed(() => setFile(chosen));
    if (!chosen) return;

    let next: ReadFile;
    try {
      const geoJson = await chosen.text();
      next = { file: chosen, geoJson, inspection: inspectGeoJson(geoJson) };
    } catch {
      next = { file: chosen, geoJson: "", inspection: { ok: false, error: "The file could not be read." } };
    }

    // keep-comment: a slow read of a file that was since replaced must not take the newer file's place
    if (latest.current === chosen) setRead(next);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <MunicipalitySelect
          value={municipalityIdentifier}
          disabled={busy}
          onChange={(identifier) =>
            changed(() => {
              setMunicipalityIdentifier(identifier);
              setSourceIdentifier("");
            })
          }
        />
        <SourceSelect
          municipalityIdentifier={municipalityIdentifier}
          value={sourceIdentifier}
          disabled={busy}
          onChange={(identifier) => changed(() => setSourceIdentifier(identifier))}
        />
      </div>

      <FileDrop
        label="File"
        accept=".geojson,.json,application/geo+json,application/json"
        hint="GeoJSON (.geojson or .json) with points in WGS84"
        file={file}
        disabled={busy}
        onChange={(chosen) => void handleFile(chosen)}
      />

      {summary && draft && (
        <MappingForm
          summary={summary}
          draft={draft}
          remembered={Boolean(source?.mapping)}
          disabled={busy}
          onChange={(next) => {
            setEdited(next);
            onChange();
          }}
        />
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          disabled={!ready || busy}
          onClick={() => {
            if (!current || !draft) return;
            onPreview({ sourceIdentifier, geoJson: current.geoJson, mapping: toRequest(draft) });
          }}
        >
          {busy ? <Loader2 className="animate-spin" /> : <FileSearch />}
          Preview
        </Button>
        {problem && (
          <span
            role={current && !current.inspection.ok ? "alert" : undefined}
            className="text-xs text-muted-foreground"
          >
            {problem}
          </span>
        )}
      </div>
    </div>
  );
}
