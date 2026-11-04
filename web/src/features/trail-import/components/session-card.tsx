// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { NavLink } from "react-router";
import { Loader2, Play, Trash2 } from "lucide-react";
import { useAnalyzeSession, useDeleteSession, type Session } from "@/features/trail-import/api/trail-import";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBytes, formatDateTime } from "@/utils/format";
import { StatusBadge } from "./badges";

const UNANALYSABLE = ["Analyzing", "Applying", "Applied"];

export function SessionCard({ session }: { session: Session }) {
  const analyze = useAnalyzeSession();
  const remove = useDeleteSession();
  const busy = analyze.isPending || remove.isPending;

  function handleDelete() {
    if (!window.confirm(`Delete ${session.fileName} and everything proposed from it?`)) return;
    remove.mutate(session.id);
  }

  return (
    <Card data-testid="session-card">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-3">
          <CardTitle className="text-base">{session.fileName}</CardTitle>
          <StatusBadge status={session.status} />
          <span className="text-xs text-muted-foreground">{session.source}</span>
          <span className="ml-auto text-xs text-muted-foreground">{formatBytes(session.fileSizeBytes)}</span>
        </div>
        <CardDescription>
          Uploaded {formatDateTime(session.createdAt)}
          {session.uploadedBy ? ` by ${session.uploadedBy}` : ""}
          {session.analyzedAt ? ` · analysed ${formatDateTime(session.analyzedAt)}` : ""}
          {session.featureCount ? ` · ${session.featureCount} features` : ""}
        </CardDescription>
        {session.errorMessage && <p className="text-sm text-destructive">{session.errorMessage}</p>}
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
          onClick={() =>
            analyze.mutate({
              sessionId: session.id,
              confirmDiscard: (message) => window.confirm(`${message}\n\nRun it anyway?`),
            })
          }
          disabled={busy || UNANALYSABLE.includes(session.status)}
        >
          {session.status === "Analyzing" ? <Loader2 className="animate-spin" /> : <Play />}
          {session.analyzedAt ? "Analyse again" : "Analyse"}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="ml-auto text-destructive hover:text-destructive"
          onClick={handleDelete}
          disabled={busy}
        >
          <Trash2 />
          Delete
        </Button>
      </CardFooter>
    </Card>
  );
}
