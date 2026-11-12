// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useConfirm } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { useRecalculateAll } from "@/features/city-areas/api/city-areas";

export function RecalculateAreasButton() {
  const recalculate = useRecalculateAll();
  const [confirm, confirmDialog] = useConfirm();

  async function run() {
    const confirmed = await confirm({
      title: "Recalculate every area?",
      description:
        "Each area with a boundary gets its links from the boundary again. Manual links and removed items stay as they are.",
      confirmLabel: "Recalculate",
    });
    if (confirmed) recalculate.mutate();
  }

  return (
    <>
      <Button variant="outline" onClick={run} disabled={recalculate.isPending}>
        Recalculate all areas
      </Button>
      {confirmDialog}
    </>
  );
}
