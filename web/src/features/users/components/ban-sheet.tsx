// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useBanUser, type UserTarget } from "@/features/users/api/users";
import { displayName } from "@/utils/format";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export interface BanTarget extends UserTarget {
  strikes?: number | null;
}

interface Props {
  target: BanTarget;
  initialReason?: string;
  onClose: () => void;
}

export function BanSheet({ target, initialReason = "", onClose }: Props) {
  const [reason, setReason] = useState(initialReason);
  const ban = useBanUser();
  const strikes = target.strikes ?? 0;

  function confirm() {
    ban.mutate({ target, reason: reason.trim() || undefined }, { onSuccess: onClose });
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Ban this account?</SheetTitle>
          <SheetDescription data-testid="ban-body">
            {displayName(target.nickName)} keeps reading the app and stops being able to write to it — no reviews,
            obstacle reports, friend requests or shares — until you lift this. Their content stays where it is: remove
            that from the moderation queue instead. They have {strikes} strike
            {strikes === 1 ? "" : "s"}.
          </SheetDescription>
        </SheetHeader>

        <div className="px-4">
          <Textarea
            data-testid="ban-reason"
            placeholder="Why (optional)"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>

        <SheetFooter>
          <Button variant="destructive" data-testid="confirm-ban" disabled={ban.isPending} onClick={confirm}>
            {ban.isPending && <Loader2 className="size-4 animate-spin" />}
            Ban account
          </Button>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
