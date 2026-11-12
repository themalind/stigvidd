// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import { FileUp, Loader2, Upload } from "lucide-react";
import { useCreateSession } from "@/features/trail-import/api/trail-import";
import { FileDrop } from "@/components/file-drop";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function UploadCard() {
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState("");
  const upload = useCreateSession();

  function handleUpload() {
    if (!file) return;

    upload.mutate({ file, source: source.trim() || undefined }, { onSuccess: () => setFile(null) });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileUp className="size-5" />
          Upload a source export
        </CardTitle>
        <CardDescription>
          A GeoJSON export from the municipality. Uploading only stores the file — nothing is compared against the
          trails until you run the analysis, and nothing is written to them until the session is applied.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <FileDrop
          label="Export"
          accept=".geojson,.json,application/geo+json,application/json"
          hint="GeoJSON (.geojson or .json)"
          file={file}
          disabled={upload.isPending}
          onChange={setFile}
        />
        <div className="space-y-2">
          <Label htmlFor="source">Source</Label>
          <Input
            id="source"
            value={source}
            placeholder="boras-stad"
            onChange={(event) => setSource(event.target.value)}
            disabled={upload.isPending}
          />
          <p className="text-xs text-muted-foreground">
            Which dataset the file comes from. Links are unique per source, so two municipalities can publish the same
            stretch without colliding. Leave it empty for boras-stad.
          </p>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleUpload} disabled={!file || upload.isPending}>
          {upload.isPending ? <Loader2 className="animate-spin" /> : <Upload />}
          {upload.isPending ? "Uploading…" : "Upload"}
        </Button>
      </CardFooter>
    </Card>
  );
}
