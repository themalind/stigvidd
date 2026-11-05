// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import { Link2 } from "lucide-react";
import type { AdminCityAreaResponse } from "@/api/generated/model";
import { Button } from "@/components/ui/button";
import { AreaChooser } from "@/features/city-areas/components/area-picker";
import {
  NO_SUGGESTION,
  suggestionReason,
  suggestionTitle,
  type UnlinkedRow,
} from "@/features/city-areas/utils/suggestion";

interface AreaToggleProps {
  name: string;
  note?: string;
  title?: string;
  pressed: boolean;
  onClick: () => void;
}

function AreaToggle({ name, note, title, pressed, onClick }: AreaToggleProps) {
  return (
    <Button
      size="sm"
      variant={pressed ? "default" : "outline"}
      aria-pressed={pressed}
      aria-label={note ? `${name}, ${note}` : name}
      title={title}
      onClick={onClick}
    >
      {name}
      {note && <span className="text-xs font-normal opacity-70">{note}</span>}
    </Button>
  );
}

interface Props {
  row: UnlinkedRow;
  areas: AdminCityAreaResponse[];
  onLink: (identifier: string, areas: string[]) => void;
}

// keep-comment: only the first suggestion starts ticked, so a second area is always a deliberate choice
export function UnlinkedItem({ row, areas, onLink }: Props) {
  const [selected, setSelected] = useState(() => row.suggestions.slice(0, 1).map((s) => s.areaIdentifier));

  const names = new Map(areas.map((area) => [area.identifier, area.name]));
  const suggested = new Set(row.suggestions.map((s) => s.areaIdentifier));
  const chosenElsewhere = selected.filter((identifier) => !suggested.has(identifier));
  const chosenNames = selected.map((identifier) => names.get(identifier) ?? identifier);

  function toggle(identifier: string) {
    setSelected((current) =>
      current.includes(identifier) ? current.filter((id) => id !== identifier) : [...current, identifier],
    );
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{row.label}</p>
        <p className="text-muted-foreground truncate text-xs">
          {[row.detail, row.suggestions.length === 0 ? NO_SUGGESTION : undefined].filter(Boolean).join(" · ")}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-1" role="group" aria-label={`Areas for ${row.label}`}>
        {row.suggestions.map((suggestion) => (
          <AreaToggle
            key={suggestion.areaIdentifier}
            name={suggestion.areaName}
            note={suggestionReason(suggestion)}
            title={suggestionTitle(suggestion)}
            pressed={selected.includes(suggestion.areaIdentifier)}
            onClick={() => toggle(suggestion.areaIdentifier)}
          />
        ))}
        {chosenElsewhere.map((identifier) => (
          <AreaToggle
            key={identifier}
            name={names.get(identifier) ?? identifier}
            pressed
            onClick={() => toggle(identifier)}
          />
        ))}
        <AreaChooser areas={areas} label={`Choose areas for ${row.label}`} selected={selected} onToggle={toggle} />
        <Button
          size="sm"
          disabled={selected.length === 0}
          aria-label={selected.length === 0 ? `Link ${row.label}` : `Link ${row.label} to ${chosenNames.join(" and ")}`}
          onClick={() => onLink(row.identifier, selected)}
        >
          <Link2 />
          Link
        </Button>
      </div>
    </li>
  );
}
