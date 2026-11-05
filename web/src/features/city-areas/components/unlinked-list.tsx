// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useMemo, type ReactNode } from "react";
import type { AdminCityAreaResponse } from "@/api/generated/model";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UnlinkedItem } from "@/features/city-areas/components/unlinked-item";
import { bySuggestedArea, type UnlinkedRow } from "@/features/city-areas/utils/suggestion";

interface Props {
  title: string;
  description: string;
  rows: UnlinkedRow[];
  areas: AdminCityAreaResponse[];
  onLink: (identifier: string, areas: string[]) => void;
  filter?: ReactNode;
}

export function UnlinkedList({ title, description, rows, areas, onLink, filter }: Props) {
  const sorted = useMemo(() => [...rows].sort(bySuggestedArea), [rows]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {title} <span className="text-muted-foreground font-normal">({rows.length})</span>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {filter}
        {sorted.length === 0 ? (
          <p className="text-muted-foreground text-sm">Everything here belongs to an area.</p>
        ) : (
          <ul aria-label={title} className="divide-y rounded-xs border border-input">
            {sorted.map((row) => (
              <UnlinkedItem key={row.identifier} row={row} areas={areas} onLink={onLink} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
