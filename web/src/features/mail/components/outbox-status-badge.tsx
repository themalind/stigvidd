// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Badge } from "@/components/ui/badge";
import { statusTone } from "@/features/mail/utils/mail-outbox";

const toneStyle: Record<ReturnType<typeof statusTone>, string> = {
  ok: "bg-emerald-600 text-white",
  busy: "bg-sky-600 text-white",
  bad: "bg-destructive text-white",
  muted: "bg-muted text-muted-foreground border-border",
  warn: "bg-amber-500 text-black",
};

export function OutboxStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={toneStyle[statusTone(status)]}>
      {status}
    </Badge>
  );
}
