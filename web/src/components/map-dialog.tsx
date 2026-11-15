// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, type ReactNode } from "react";
import { DialogFrame } from "@/components/dialog-frame";
import { Button } from "@/components/ui/button";
import { hasSatellite } from "@/lib/maplibre";

interface Props {
  title: string;
  description: ReactNode;
  // keep-comment: the icon button that opens the dialog
  trigger: ReactNode;
  // keep-comment: mounted only while open, so a closed dialog loads no map or data
  children: (satellite: boolean) => ReactNode;
}

export function MapDialog({ title, description, trigger, children }: Props) {
  const [satellite, setSatellite] = useState(false);

  return (
    <DialogFrame
      title={title}
      description={description}
      trigger={trigger}
      width="lg"
      actions={
        hasSatellite && (
          <Button size="sm" variant="outline" aria-pressed={satellite} onClick={() => setSatellite((s) => !s)}>
            {satellite ? "Map" : "Satellite"}
          </Button>
        )
      }
    >
      {children(satellite)}
    </DialogFrame>
  );
}
