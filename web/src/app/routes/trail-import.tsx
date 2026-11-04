// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useSuspenseQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { pollWhileAnalysing, sessionsQueryOptions } from "@/features/trail-import/api/trail-import";
import { SessionCard } from "@/features/trail-import/components/session-card";
import { UploadCard } from "@/features/trail-import/components/upload-card";
import { QueryBoundary } from "@/components/query-boundary";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

function Sessions() {
  const { data: sessions, refetch } = useSuspenseQuery({
    ...sessionsQueryOptions(),
    refetchInterval: (query) => pollWhileAnalysing(query.state.data),
  });
  const analysing = pollWhileAnalysing(sessions) !== false;

  return (
    <>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Sessions</h2>
        <Button variant="ghost" size="sm" onClick={() => void refetch()}>
          <RefreshCw className={analysing ? "animate-spin" : ""} />
          Refresh
        </Button>
      </div>

      {sessions.length === 0 && (
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          No sessions yet. Upload an export to start one.
        </p>
      )}

      <div className="space-y-3">
        {sessions.map((session) => (
          <SessionCard key={session.id} session={session} />
        ))}
      </div>
    </>
  );
}

export default function TrailImportPage() {
  return (
    <main>
      <div className="container mx-auto max-w-5xl space-y-6 py-10">
        <UploadCard />
        <QueryBoundary fallback={<Skeleton className="h-32 w-full" />}>
          <Sessions />
        </QueryBoundary>
      </div>
    </main>
  );
}
