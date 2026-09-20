// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  cancelMediaReprocessJob,
  getMediaReprocessJobs,
  type ReprocessJobSummary,
} from "@/api/media";

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

  const load = useCallback(async () => {
    try {
      const page = await getMediaReprocessJobs(1, 50);
      setJobs(page.items ?? []);
    } catch {
      toast.error("Failed to load batch jobs.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const inProgress = jobs.some((j) => j.status === "Pending" || j.status === "Processing");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!inProgress) return;
    timerRef.current = setInterval(load, POLL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [inProgress, load]);

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

  if (loading) {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }

  if (jobs.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No batches yet. Select images in Browse and choose "Optimize selected".
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {jobs.map((job) => (
        <div
          key={job.identifier}
          className="flex items-center justify-between gap-4 rounded-xs border p-3"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant={statusVariant(job.status)}>{job.status}</Badge>
              <span className="text-muted-foreground text-xs">
                {job.succeededCount ?? 0}/{job.totalCount ?? 0} succeeded
                {(job.failedCount ?? 0) > 0 ? ` · ${job.failedCount} failed` : ""}
                {(job.cancelledCount ?? 0) > 0 ? ` · ${job.cancelledCount} cancelled` : ""}
              </span>
            </div>
            <p className="text-muted-foreground font-mono text-[10px] break-all">
              {job.identifier}
            </p>
          </div>
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
      ))}
    </div>
  );
}
