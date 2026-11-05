// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { AlertTriangle, Check, Copy } from "lucide-react";
import type { TrailSourceLinkRole } from "@/api/generated/model";
import type { Preview } from "@/features/trail-import/api/trail-import";
import { carrierOf } from "@/features/trail-import/utils/proposal-detail";
import { Button } from "@/components/ui/button";

interface Props {
  sharing: Preview["sharingTheTrail"];
  canAccept: boolean;
  disabled: boolean;
  onAccept: (role: TrailSourceLinkRole) => void;
}

export function SharingWarning({ sharing, canAccept, disabled, onAccept }: Props) {
  if (sharing.length === 0) return null;

  const carrier = carrierOf(sharing);

  return (
    <div className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
      <p className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <span>
          {sharing.length === 1
            ? "Another feature in this session points at the same trail:"
            : `${sharing.length} other features in this session point at the same trail:`}{" "}
          {sharing.map((other) => other.featureName).join(", ")}.{" "}
          {carrier
            ? `${carrier.featureName} is carrying the trail's route, so this one is a duplicate — linked to the trail, adding no geometry.`
            : "None of them is carrying the trail's route yet. One has to, or the trail is left with the line it already has — right only where the geometry is curated on purpose."}
        </span>
      </p>
      {canAccept &&
        (carrier ? (
          <Button size="sm" variant="outline" disabled={disabled} onClick={() => onAccept("Duplicate")}>
            <Copy />
            Accept as duplicate
          </Button>
        ) : (
          <Button size="sm" variant="outline" disabled={disabled} onClick={() => onAccept("Segment")}>
            <Check />
            Accept as segment
          </Button>
        ))}
    </div>
  );
}
