// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useMemo, useState, type ReactNode } from "react";
import { Check, ChevronsUpDown, MapPin } from "lucide-react";
import type { AdminCityAreaResponse } from "@/api/generated/model";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { matchesAll, searchTerms } from "@/utils/search";

function counts(area: AdminCityAreaResponse): string {
  return `${area.facilities.length} facilities · ${area.trails.length} trails`;
}

interface AreaSearchListProps {
  areas: AdminCityAreaResponse[];
  selectedIdentifiers: readonly string[];
  onSelect: (identifier: string) => void;
}

function AreaSearchList({ areas, selectedIdentifiers, onSelect }: AreaSearchListProps) {
  const [query, setQuery] = useState("");

  const sorted = useMemo(() => [...areas].sort((a, b) => a.name.localeCompare(b.name, "sv")), [areas]);
  const matches = useMemo(() => {
    const terms = searchTerms(query);
    return sorted.filter((area) => matchesAll(`${area.name} ${area.location}`, terms));
  }, [sorted, query]);

  return (
    <>
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
          const current = selectedIdentifiers.includes(area.identifier);
          return (
            <li key={area.identifier}>
              <button
                type="button"
                aria-pressed={current}
                onClick={() => onSelect(area.identifier)}
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
    </>
  );
}

interface AreaPopoverProps extends AreaSearchListProps {
  trigger: ReactNode;
  className?: string;
  closeOnSelect: boolean;
}

function AreaPopover({ trigger, className, closeOnSelect, onSelect, ...list }: AreaPopoverProps) {
  const [open, setOpen] = useState(false);

  function choose(identifier: string) {
    onSelect(identifier);
    if (closeOnSelect) setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="start" className={cn("p-2", className)}>
        {open && <AreaSearchList {...list} onSelect={choose} />}
      </PopoverContent>
    </Popover>
  );
}

interface AreaPickerProps {
  areas: AdminCityAreaResponse[];
  selected: AdminCityAreaResponse;
  onSelect: (identifier: string) => void;
}

export function AreaPicker({ areas, selected, onSelect }: AreaPickerProps) {
  return (
    <AreaPopover
      areas={areas}
      selectedIdentifiers={[selected.identifier]}
      onSelect={onSelect}
      closeOnSelect
      className="w-(--radix-popover-trigger-width)"
      trigger={
        <Button variant="outline" role="combobox" className="h-auto w-full max-w-md justify-between py-2">
          <span className="flex min-w-0 flex-col items-start">
            <span className="truncate font-medium">{selected.name}</span>
            <span className="text-muted-foreground text-xs font-normal">{counts(selected)}</span>
          </span>
          <ChevronsUpDown className="text-muted-foreground" />
        </Button>
      }
    />
  );
}

interface AreaChooserProps {
  areas: AdminCityAreaResponse[];
  label: string;
  selected: readonly string[];
  onToggle: (identifier: string) => void;
}

// keep-comment: stays open so several areas can be ticked in one go
export function AreaChooser({ areas, label, selected, onToggle }: AreaChooserProps) {
  return (
    <AreaPopover
      areas={areas}
      selectedIdentifiers={selected}
      onSelect={onToggle}
      closeOnSelect={false}
      className="w-72"
      trigger={
        <Button variant="ghost" size="sm" aria-label={label}>
          <MapPin />
          Choose area
        </Button>
      }
    />
  );
}
