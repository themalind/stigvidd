// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { setTrailVerified } from "@/api/trail";
import type { AdminTrailListItem } from "@/types/types";
import { useState } from "react";
import { toast } from "sonner";
import { Checkbox } from "./ui/checkbox";

interface Props {
  data: AdminTrailListItem;
  onChange?: (isVerified: boolean) => void;
}

export default function TrailVerifiedToggle({ data, onChange }: Props) {
  const [isVerified, setIsVerified] = useState(data.isVerified);
  const [saving, setSaving] = useState(false);

  async function handleChange(checked: boolean) {
    setSaving(true);
    try {
      await setTrailVerified(data.identifier, checked);
      setIsVerified(checked);
      onChange?.(checked);
      toast.success(checked ? `${data.name} is now active in the app.` : `${data.name} is now hidden from the app.`);
    } catch {
      toast.error(`Failed to update ${data.name}.`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Checkbox
      aria-label={`Active: ${data.name}`}
      checked={isVerified}
      disabled={saving}
      onCheckedChange={(checked) => void handleChange(checked === true)}
    />
  );
}
