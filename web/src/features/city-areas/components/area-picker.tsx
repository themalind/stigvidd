// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import type { AdminCityAreaResponse } from "@/api/generated/model";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface Props {
  areas: AdminCityAreaResponse[];
  selected: AdminCityAreaResponse;
  onSelect: (identifier: string) => void;
}

function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("sv");
}

function counts(area: AdminCityAreaResponse): string {
  return `${area.facilities.length} facilities · ${area.trails.length} trails`;
}

export function AreaPicker({ areas, selected, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const sorted = useMemo(() => [...areas].sort((a, b) => a.name.localeCompare(b.name, "sv")), [areas]);
  const matches = useMemo(() => {
    const term = fold(query.trim());
    return term === "" ? sorted : sorted.filter((area) => fold(`${area.name} ${area.location}`).includes(term));
  }, [sorted, query]);

  function choose(identifier: string) {
    onSelect(identifier);
    setOpen(false);
    setQuery("");
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-auto w-full max-w-md justify-between py-2"
        >
          <span className="flex min-w-0 flex-col items-start">
            <span className="truncate font-medium">{selected.name}</span>
            <span className="text-muted-foreground text-xs font-normal">{counts(selected)}</span>
          </span>
          <ChevronsUpDown className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-2">
        <Input
          aria-label="Search areas"
          placeholder="Search areas"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          autoFocus
        />
        <p className="text-muted-foreground px-1 pt-2 text-xs">
          {matches.length} of {areas.length} areas
        </p>
        <ul aria-label="Areas" className="mt-1 max-h-80 overflow-y-auto">
          {matches.map((area) => {
            const current = area.identifier === selected.identifier;
            return (
              <li key={area.identifier}>
                <button
                  type="button"
                  aria-current={current ? "page" : undefined}
                  onClick={() => choose(area.identifier)}
                  className={cn(
                    "hover:bg-accent/50 flex w-full items-center gap-2 rounded-xs px-2 py-2 text-left text-sm",
                    current && "bg-accent",
                  )}
                >
                  <Check className={cn("size-4 shrink-0", current ? "opacity-100" : "opacity-0")} />
                  <span className="min-w-0">
                    <span className="block truncate">{area.name}</span>
                    <span className="text-muted-foreground block text-xs">{counts(area)}</span>
                  </span>
                </button>
              </li>
            );
          })}
          {matches.length === 0 && <li className="text-muted-foreground px-2 py-2 text-sm">No areas match.</li>}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
