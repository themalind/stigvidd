// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { reprocessFailuresQueryOptions } from "@/features/media/api/media";

export function ReprocessJobFailures({ identifier }: { identifier: string }) {
  const { data: failures, isError, refetch } = useQuery(reprocessFailuresQueryOptions(identifier));

  if (isError) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 border-t pt-2 text-xs">
        <span>The batch's failures could not be loaded.</span>
        <Button variant="outline" size="sm" onClick={() => void refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-1 border-t pt-2">
      {failures === undefined ? (
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
  );
}
