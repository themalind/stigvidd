// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import {
  reprocessJobsQueryOptions,
  useCancelReprocessJob,
  useRetryReprocessJob,
  type ReprocessJobSummary,
} from "@/features/media/api/media";
import { ReprocessJobFailures } from "./reprocess-job-failures";

function statusVariant(status: string): "default" | "secondary" | "outline" {
  if (status === "Processing") return "default";
  if (status === "Pending") return "secondary";
  return "outline";
}

export default function MediaReprocessJobs() {
  const { data } = useSuspenseQuery(reprocessJobsQueryOptions());
  const [openFailuresId, setOpenFailuresId] = useState<string | null>(null);

  if (data.items.length === 0) {
    return <EmptyState>No batches yet. Select images in Browse and choose "Optimize".</EmptyState>;
  }

  return (
    <div className="space-y-2">
      {data.items.map((job) => (
        <ReprocessJobRow
          key={job.identifier}
          job={job}
          failuresOpen={openFailuresId === job.identifier}
          onFailuresOpenChange={(open) =>
            setOpenFailuresId((current) => (open ? job.identifier : current === job.identifier ? null : current))
          }
        />
      ))}
    </div>
  );
}

interface RowProps {
  job: ReprocessJobSummary;
  failuresOpen: boolean;
  onFailuresOpenChange: (open: boolean) => void;
}

function ReprocessJobRow({ job, failuresOpen, onFailuresOpenChange }: RowProps) {
  const cancel = useCancelReprocessJob();
  const retry = useRetryReprocessJob();
  const failed = job.failedCount;
  const settled = job.pendingCount === 0 && job.processingCount === 0;

  return (
    <div className="space-y-3 rounded-xs border p-3">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant={statusVariant(job.status)}>{job.status}</Badge>
            <span className="text-muted-foreground text-xs">
              {job.succeededCount}/{job.totalCount} succeeded
              {failed > 0 ? ` · ${failed} failed` : ""}
              {job.cancelledCount > 0 ? ` · ${job.cancelledCount} cancelled` : ""}
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
              onClick={() => onFailuresOpenChange(!failuresOpen)}
            >
              {failuresOpen ? "Hide failures" : "Show failures"}
            </Button>
          )}
          {failed > 0 && settled && (
            <Button
              variant="outline"
              size="sm"
              disabled={retry.isPending}
              onClick={() => retry.mutate(job.identifier, { onSuccess: () => onFailuresOpenChange(false) })}
            >
              Retry failed
            </Button>
          )}
          {job.pendingCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              disabled={cancel.isPending}
              onClick={() => cancel.mutate(job.identifier)}
            >
              Cancel
            </Button>
          )}
        </div>
      </div>
      {failuresOpen && <ReprocessJobFailures identifier={job.identifier} />}
    </div>
  );
}
