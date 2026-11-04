// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { ToneBadge } from "@/components/tone-badge";
import { statusTone } from "@/features/mail/utils/mail-outbox";

export function OutboxStatusBadge({ status }: { status: string }) {
  return <ToneBadge tone={statusTone(status)}>{status}</ToneBadge>;
}
