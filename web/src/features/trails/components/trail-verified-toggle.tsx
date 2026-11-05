// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { AdminTrailListItemResponse } from "@/api/generated/model";
import { Checkbox } from "@/components/ui/checkbox";
import { useSetTrailVerified } from "@/features/trails/api/trail";

interface Props {
  data: Pick<AdminTrailListItemResponse, "identifier" | "name" | "isVerified">;
}

export default function TrailVerifiedToggle({ data }: Props) {
  const setVerified = useSetTrailVerified(data);

  return (
    <Checkbox
      aria-label={`Active: ${data.name}`}
      checked={data.isVerified}
      disabled={setVerified.isPending}
      onCheckedChange={(checked) => setVerified.mutate(checked === true)}
    />
  );
}
