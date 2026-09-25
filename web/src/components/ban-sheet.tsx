// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { banUser } from "@/api/users";
import { displayName } from "@/lib/moderation-statistics";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export interface BanTarget {
  identifier: string;
  nickName?: string | null;
  strikes?: number | null;
}

interface Props {
  target: BanTarget;
  initialReason?: string;
  onClose: () => void;
  onBanned: () => void;
}

export function BanSheet({ target, initialReason = "", onClose, onBanned }: Props) {
  const [reason, setReason] = useState(initialReason);
  const [saving, setSaving] = useState(false);
  const strikes = target.strikes ?? 0;

  async function ban() {
    setSaving(true);

    try {
      await banUser(target.identifier, reason.trim() || undefined);
      toast.success(`${displayName(target.nickName)} can no longer write in the app.`);
      onBanned();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The account could not be banned.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Ban this account?</SheetTitle>
          <SheetDescription data-testid="ban-body">
            {displayName(target.nickName)} keeps reading the app and stops being able to write to
            it — no reviews, obstacle reports, friend requests or shares — until you lift this.
            Their content stays where it is: remove that from the moderation queue instead.
            They have {strikes} strike
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
          <Button
            variant="destructive"
            data-testid="confirm-ban"
            disabled={saving}
            onClick={() => void ban()}
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
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
