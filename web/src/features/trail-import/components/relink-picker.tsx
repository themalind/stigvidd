// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface RelinkTarget {
  identifier: string;
  name: string;
  trailLength: number;
}

const SHOWN = 8;

interface Props {
  trails: RelinkTarget[] | undefined;
  disabled: boolean;
  onPick: (trailIdentifier: string) => void;
  onCancel: () => void;
}

export function RelinkPicker({ trails, disabled, onPick, onCancel }: Props) {
  const [search, setSearch] = useState("");

  const matches = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const all = trails ?? [];
    return (needle ? all.filter((trail) => trail.name.toLowerCase().includes(needle)) : all).slice(0, SHOWN);
  }, [trails, search]);

  return (
    <div className="space-y-2 rounded-md border p-3">
      <Label htmlFor="trail-search">Link to another trail</Label>
      <Input
        id="trail-search"
        autoFocus
        value={search}
        placeholder="Search by name…"
        onChange={(event) => setSearch(event.target.value)}
      />
      <div className="max-h-56 space-y-1 overflow-y-auto">
        {matches.map((trail) => (
          <button
            key={trail.identifier}
            type="button"
            className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
            disabled={disabled}
            onClick={() => onPick(trail.identifier)}
          >
            <span>{trail.name}</span>
            <span className="text-xs text-muted-foreground tabular-nums">{trail.trailLength} km</span>
          </button>
        ))}
        {trails === undefined ? (
          <p className="px-2 py-1.5 text-sm text-muted-foreground">The trail list is not available.</p>
        ) : (
          matches.length === 0 && <p className="px-2 py-1.5 text-sm text-muted-foreground">No trail matches that.</p>
        )}
      </div>
      <Button variant="ghost" size="sm" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}
