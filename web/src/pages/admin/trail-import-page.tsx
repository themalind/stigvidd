// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useCallback, useEffect, useRef, useState } from "react";
import { NavLink } from "react-router";
import { toast } from "sonner";
import { FileUp, Loader2, Play, RefreshCw, Trash2, Upload } from "lucide-react";
import {
  analyzeSession,
  createSession,
  deleteSession,
  getSessions,
  type Session,
} from "@/api/trail-import";
import { StatusBadge } from "@/components/trail-import/badges";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

// A session left analysing has a worker holding it, so the list refreshes itself until
// nothing is in flight. Analysing the full export takes tens of seconds.
const PollIntervalMs = 4000;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} kB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatMoment(value?: string | null): string {
  return value ? new Date(value).toLocaleString() : "—";
}

export default function TrailImportPage() {
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState("");
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      setSessions(await getSessions());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The sessions could not be listed.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const analysing = sessions?.some((session) => session.status === "Analyzing") ?? false;

  useEffect(() => {
    if (!analysing) return;

    const timer = setInterval(() => void load(), PollIntervalMs);
    return () => clearInterval(timer);
  }, [analysing, load]);

  async function handleUpload() {
    if (!file) return;

    setUploading(true);
    try {
      const session = await createSession(file, source.trim() || undefined);

      if (session.duplicateOf && session.duplicateOf.length > 0) {
        toast.warning(
          `This file has been uploaded before (${session.duplicateOf.length} earlier session(s)). Analysing it again is fine.`,
          { duration: 8000 },
        );
      } else {
        toast.success(`${session.fileName} uploaded.`);
      }

      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function handleAnalyze(sessionId: number, force = false) {
    setBusyId(sessionId);
    try {
      await analyzeSession(sessionId, force);
      toast.success("Analysis queued. This page updates itself while it runs.");
      await load();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "The analysis could not be queued.";

      // The API refuses rather than silently replacing decided proposals, and says how many.
      if (!force && message.includes("discard")) {
        if (window.confirm(`${message}\n\nRun it anyway?`)) {
          await handleAnalyze(sessionId, true);
          return;
        }
      } else {
        toast.error(message);
      }
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(session: Session) {
    if (!window.confirm(`Delete ${session.fileName} and everything proposed from it?`)) return;

    setBusyId(session.id);
    try {
      await deleteSession(session.id);
      toast.success("Session deleted.");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The session could not be deleted.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main>
      <div className="container mx-auto max-w-5xl space-y-6 py-10">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileUp className="size-5" />
              Upload a source export
            </CardTitle>
            <CardDescription>
              A GeoJSON export from the municipality. Uploading only stores the file — nothing is
              compared against the trails until you run the analysis, and nothing is written to
              them until the session is applied.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="export">Export (.geojson or .json)</Label>
              <Input
                id="export"
                ref={fileInputRef}
                type="file"
                accept=".geojson,.json,application/geo+json,application/json"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                disabled={uploading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="source">Source</Label>
              <Input
                id="source"
                value={source}
                placeholder="boras-stad"
                onChange={(event) => setSource(event.target.value)}
                disabled={uploading}
              />
              <p className="text-xs text-muted-foreground">
                Which dataset the file comes from. Links are unique per source, so two
                municipalities can publish the same stretch without colliding. Leave it empty for
                boras-stad.
              </p>
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={handleUpload} disabled={!file || uploading}>
              {uploading ? <Loader2 className="animate-spin" /> : <Upload />}
              {uploading ? "Uploading…" : "Upload"}
            </Button>
          </CardFooter>
        </Card>

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Sessions</h2>
          <Button variant="ghost" size="sm" onClick={() => void load()}>
            <RefreshCw className={analysing ? "animate-spin" : ""} />
            Refresh
          </Button>
        </div>

        {sessions === null && <Skeleton className="h-32 w-full" />}

        {sessions?.length === 0 && (
          <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
            No sessions yet. Upload an export to start one.
          </p>
        )}

        <div className="space-y-3">
          {sessions?.map((session) => (
            <Card key={session.id}>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-3">
                  <CardTitle className="text-base">{session.fileName}</CardTitle>
                  <StatusBadge status={session.status} />
                  <span className="text-xs text-muted-foreground">{session.source}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {formatBytes(session.fileSizeBytes ?? 0)}
                  </span>
                </div>
                <CardDescription>
                  Uploaded {formatMoment(session.createdAt)}
                  {session.uploadedBy ? ` by ${session.uploadedBy}` : ""}
                  {session.analyzedAt ? ` · analysed ${formatMoment(session.analyzedAt)}` : ""}
                  {session.featureCount ? ` · ${session.featureCount} features` : ""}
                </CardDescription>
                {session.errorMessage && (
                  <p className="text-sm text-destructive">{session.errorMessage}</p>
                )}
              </CardHeader>
              <CardFooter className="gap-2">
                {session.status === "AwaitingReview" && (
                  <Button asChild size="sm">
                    <NavLink to={`/trail-import/${session.id}`}>Review</NavLink>
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleAnalyze(session.id)}
                  disabled={
                    busyId === session.id ||
                    session.status === "Analyzing" ||
                    session.status === "Applying" ||
                    session.status === "Applied"
                  }
                >
                  {session.status === "Analyzing" ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Play />
                  )}
                  {session.analyzedAt ? "Analyse again" : "Analyse"}
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto text-destructive hover:text-destructive"
                  onClick={() => void handleDelete(session)}
                  disabled={busyId === session.id}
                >
                  <Trash2 />
                  Delete
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}
