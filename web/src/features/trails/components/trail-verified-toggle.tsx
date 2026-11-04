// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { toast } from "sonner";
import type { AdminTrailListItemResponse } from "@/api/generated/model";
import { Checkbox } from "@/components/ui/checkbox";
import { useSetTrailVerified } from "@/features/trails/api/trail";

interface Props {
  data: Pick<AdminTrailListItemResponse, "identifier" | "name" | "isVerified">;
}

export default function TrailVerifiedToggle({ data }: Props) {
  const setVerified = useSetTrailVerified(data);

  function handleChange(checked: boolean) {
    setVerified.mutate(checked, {
      onSuccess: () =>
        toast.success(checked ? `${data.name} is now active in the app.` : `${data.name} is now hidden from the app.`),
    });
  }

  return (
    <Checkbox
      aria-label={`Active: ${data.name}`}
      checked={data.isVerified}
      disabled={setVerified.isPending}
      onCheckedChange={(checked) => handleChange(checked === true)}
    />
  );
}
