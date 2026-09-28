// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  cancelMediaReprocessJob,
  getMediaReprocessJob,
  getMediaReprocessJobs,
  retryMediaReprocessJob,
  type ReprocessJobSummary,
} from "@/api/media";
import { groupFailures, type FailureGroup } from "@/lib/media-reprocess-failures";

const POLL_MS = 3000;

function statusVariant(status: string): "default" | "secondary" | "outline" {
  if (status === "Processing") return "default";
  if (status === "Pending") return "secondary";
  return "outline";
}

interface Props {
  refreshKey: number;
}

export default function MediaReprocessJobs({ refreshKey }: Props) {
  const [jobs, setJobs] = useState<ReprocessJobSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [openFailuresId, setOpenFailuresId] = useState<string | null>(null);
  const [failures, setFailures] = useState<FailureGroup[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  // keep-comment: a slow poll can land after a later load (e.g. the one after Retry), so only the newest request may set state
  const latestLoad = useRef(0);
  const loadInFlight = useRef(false);
  // keep-comment: a failing poll would otherwise toast every 3 s; toast once, then again only after a success
  const failureToasted = useRef(false);
  const failuresRequestedFor = useRef<string | null>(null);

  const load = useCallback(async () => {
    const request = ++latestLoad.current;
    loadInFlight.current = true;
    try {
      const page = await getMediaReprocessJobs(1, 50);
      if (request !== latestLoad.current) return;
      setJobs(page.items ?? []);
      setLoadFailed(false);
      failureToasted.current = false;
    } catch {
      if (request !== latestLoad.current) return;
      setLoadFailed(true);
      if (!failureToasted.current) toast.error("Failed to load batch jobs.");
      failureToasted.current = true;
    } finally {
      if (request === latestLoad.current) {
        loadInFlight.current = false;
        setLoading(false);
      }
    }
  }, []);

  const poll = useCallback(() => {
    if (!loadInFlight.current) void load();
  }, [load]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const inProgress = jobs.some((j) => j.status === "Pending" || j.status === "Processing");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!inProgress) return;
    timerRef.current = setInterval(poll, POLL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [inProgress, poll]);

  async function handleCancel(identifier: string) {
    setCancellingId(identifier);
    try {
      await cancelMediaReprocessJob(identifier);
      await load();
    } catch {
      toast.error("Failed to cancel the batch.");
    } finally {
      setCancellingId(null);
    }
  }

  async function handleRetry(identifier: string) {
    setRetryingId(identifier);
    try {
      const retried = await retryMediaReprocessJob(identifier);
      if (openFailuresId === identifier) closeFailures();
      toast.success(`Retrying ${retried.pendingCount ?? 0} failed image(s).`);
      await load();
    } catch {
      toast.error("Failed to retry the batch.");
    } finally {
      setRetryingId(null);
    }
  }

  function closeFailures() {
    failuresRequestedFor.current = null;
    setOpenFailuresId(null);
    setFailures(null);
  }

  async function toggleFailures(identifier: string) {
    if (openFailuresId === identifier) {
      closeFailures();
      return;
    }

    // keep-comment: opening A then B quickly must not let A's late answer fill B's panel
    failuresRequestedFor.current = identifier;
    setOpenFailuresId(identifier);
    setFailures(null);
    try {
      const detail = await getMediaReprocessJob(identifier);
      if (failuresRequestedFor.current !== identifier) return;
      setFailures(groupFailures(detail.items ?? []));
    } catch {
      if (failuresRequestedFor.current !== identifier) return;
      toast.error("Failed to load the batch's failures.");
      closeFailures();
    }
  }

  if (loading) {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }

  if (loadFailed && jobs.length === 0) {
    return (
      <div className="text-muted-foreground flex items-center gap-3 text-sm">
        <span>The batches could not be loaded.</span>
        <Button variant="outline" size="sm" onClick={() => void load()}>
          Try again
        </Button>
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">No batches yet. Select images in Browse and choose "Optimize".</p>
    );
  }

  return (
    <div className="space-y-2">
      {jobs.map((job) => {
        const failed = job.failedCount ?? 0;
        const settled = (job.pendingCount ?? 0) === 0 && (job.processingCount ?? 0) === 0;
        const failuresOpen = openFailuresId === job.identifier;

        return (
          <div key={job.identifier} className="space-y-3 rounded-xs border p-3">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant={statusVariant(job.status)}>{job.status}</Badge>
                  <span className="text-muted-foreground text-xs">
                    {job.succeededCount ?? 0}/{job.totalCount ?? 0} succeeded
                    {failed > 0 ? ` · ${failed} failed` : ""}
                    {(job.cancelledCount ?? 0) > 0 ? ` · ${job.cancelledCount} cancelled` : ""}
                  </span>
                </div>
                <p className="text-muted-foreground font-mono text-[10px] break-all">{job.identifier}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                {failed > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-expanded={failuresOpen}
                    onClick={() => toggleFailures(job.identifier)}
                  >
                    {failuresOpen ? "Hide failures" : "Show failures"}
                  </Button>
                )}
                {failed > 0 && settled && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={retryingId === job.identifier}
                    onClick={() => handleRetry(job.identifier)}
                  >
                    Retry failed
                  </Button>
                )}
                {(job.pendingCount ?? 0) > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={cancellingId === job.identifier}
                    onClick={() => handleCancel(job.identifier)}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </div>
            {failuresOpen && (
              <div className="space-y-1 border-t pt-2">
                {failures === null ? (
                  <p className="text-muted-foreground text-xs">Loading failures…</p>
                ) : (
                  failures.map((group) => (
                    <details key={group.reason} className="text-xs">
                      <summary className="cursor-pointer">
                        <span className="font-medium">{group.mediaIdentifiers.length}×</span> {group.reason}
                      </summary>
                      <ul className="text-muted-foreground mt-1 ml-4 font-mono text-[10px] break-all">
                        {group.mediaIdentifiers.map((id) => (
                          <li key={id}>{id}</li>
                        ))}
                      </ul>
                    </details>
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
