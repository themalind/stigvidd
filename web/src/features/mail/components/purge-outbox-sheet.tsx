// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { usePurgeOutbox } from "@/features/mail/api/mail-outbox";
import { describePurge, isValidPurgeCutoff } from "@/features/mail/utils/mail-outbox";

// keep-comment: below the sweep's own SentRetentionDays, which has already deleted anything older
const DEFAULT_PURGE_DAYS = 3;

interface Props {
  sentCount: number;
  onClose: () => void;
}

export function PurgeOutboxSheet({ sentCount, onClose }: Props) {
  const [purgeDays, setPurgeDays] = useState(String(DEFAULT_PURGE_DAYS));
  const purge = usePurgeOutbox();
  const days = Number(purgeDays);

  return (
    <Sheet open onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Purge sent mail</SheetTitle>
          <SheetDescription>{describePurge(days || 0, sentCount)}</SheetDescription>
        </SheetHeader>

        <div className="space-y-2 px-4">
          <Label htmlFor="purge-days">Older than (days)</Label>
          <Input
            id="purge-days"
            type="number"
            min={1}
            max={3650}
            value={purgeDays}
            onChange={(e) => setPurgeDays(e.target.value)}
            data-testid="purge-days"
          />
          <p className="text-xs text-muted-foreground">This cannot be undone.</p>
        </div>

        <SheetFooter>
          <Button
            variant="destructive"
            disabled={purge.isPending || !isValidPurgeCutoff(days)}
            onClick={() => purge.mutate(days, { onSuccess: onClose })}
            data-testid="confirm-purge"
          >
            {purge.isPending && <Loader2 className="size-4 animate-spin" />}
            Delete them
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Keep everything
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
