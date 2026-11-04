// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import { TriangleAlert } from "lucide-react";
import { FilterRow } from "@/components/filter-row";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  describeMediaFilters,
  emptyMediaFilters,
  MEDIA_SORTS,
  type MediaFilterState,
  type MediaSortValue,
} from "@/features/media/utils/media-browse";

const OWNER_TYPES = ["All", "Trail", "Facility", "TrailSymbol"];
const FORMATS = ["All", "jpeg", "png", "webp"];

interface Props {
  filters: MediaFilterState;
  onFiltersChange: (next: MediaFilterState) => void;
  sort: MediaSortValue;
  onSortChange: (next: MediaSortValue) => void;
}

export function MediaFilters({ filters, onFiltersChange, sort, onSortChange }: Props) {
  const [draft, setDraft] = useState(filters);
  const [showMore, setShowMore] = useState(false);
  const narrowedBy = describeMediaFilters(filters);

  function apply(next: MediaFilterState) {
    setDraft(next);
    onFiltersChange(next);
  }

  const applyChip = (patch: Partial<MediaFilterState>) => {
    setDraft((current) => ({ ...current, ...patch }));
    onFiltersChange({ ...filters, ...patch });
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          size="sm"
          variant={filters.needsWork ? "default" : "outline"}
          aria-pressed={filters.needsWork}
          onClick={() => applyChip({ needsWork: !filters.needsWork })}
        >
          <TriangleAlert className="size-3.5" />
          Needs work
        </Button>

        <FilterRow
          label="Owner"
          options={OWNER_TYPES}
          value={filters.ownerType}
          onChange={(ownerType) => applyChip({ ownerType })}
          optionLabel={(option) => (option === "TrailSymbol" ? "Symbols" : option)}
        />

        <FilterRow
          label="Format"
          options={FORMATS}
          value={filters.format}
          onChange={(format) => applyChip({ format })}
          optionLabel={(option) => (option === "All" ? "All" : option.toUpperCase())}
        />

        <div className="flex items-center gap-1 text-sm">
          <label className="text-muted-foreground" htmlFor="media-sort">
            Sort
          </label>
          <select
            id="media-sort"
            className="border-input bg-background h-8 rounded-xs border px-2 text-sm"
            value={sort}
            onChange={(e) => onSortChange(e.target.value as MediaSortValue)}
          >
            {MEDIA_SORTS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <Button size="sm" variant="outline" onClick={() => setShowMore((v) => !v)}>
          {showMore ? "Fewer filters" : "More filters"}
        </Button>
      </div>

      {showMore && (
        <form
          className="grid grid-cols-1 gap-3 rounded-xs border p-3 sm:grid-cols-2 lg:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            onFiltersChange(draft);
          }}
        >
          <NumberRange
            label="Width (px)"
            minLabel="Minimum width"
            maxLabel="Maximum width"
            min={draft.minWidth}
            max={draft.maxWidth}
            onMin={(minWidth) => setDraft({ ...draft, minWidth })}
            onMax={(maxWidth) => setDraft({ ...draft, maxWidth })}
          />
          <NumberRange
            label="Height (px)"
            minLabel="Minimum height"
            maxLabel="Maximum height"
            min={draft.minHeight}
            max={draft.maxHeight}
            onMin={(minHeight) => setDraft({ ...draft, minHeight })}
            onMax={(maxHeight) => setDraft({ ...draft, maxHeight })}
          />
          <NumberRange
            label="Size (KB)"
            minLabel="Minimum size in KB"
            maxLabel="Maximum size in KB"
            min={draft.minSizeKb}
            max={draft.maxSizeKb}
            onMin={(minSizeKb) => setDraft({ ...draft, minSizeKb })}
            onMax={(maxSizeKb) => setDraft({ ...draft, maxSizeKb })}
          />
          <div className="space-y-1.5">
            <Label className="text-xs">Uploaded</Label>
            <div className="flex items-center gap-1">
              <Input
                type="date"
                aria-label="Uploaded from"
                className="h-8"
                value={draft.uploadedFrom}
                onChange={(e) => setDraft({ ...draft, uploadedFrom: e.target.value })}
              />
              <Input
                type="date"
                aria-label="Uploaded to"
                className="h-8"
                value={draft.uploadedTo}
                onChange={(e) => setDraft({ ...draft, uploadedTo: e.target.value })}
              />
            </div>
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <Button size="sm" type="submit">
              Apply filters
            </Button>
          </div>
        </form>
      )}

      {narrowedBy.length > 0 && (
        <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
          <span>Showing: {narrowedBy.join(" · ")}</span>
          <Button size="sm" variant="link" className="h-auto p-0 text-xs" onClick={() => apply(emptyMediaFilters)}>
            Show all
          </Button>
        </div>
      )}
    </>
  );
}

interface NumberRangeProps {
  label: string;
  minLabel: string;
  maxLabel: string;
  min: string;
  max: string;
  onMin: (value: string) => void;
  onMax: (value: string) => void;
}

function NumberRange({ label, minLabel, maxLabel, min, max, onMin, onMax }: NumberRangeProps) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-1">
        <Input
          type="number"
          min={0}
          aria-label={minLabel}
          placeholder="min"
          className="h-8"
          value={min}
          onChange={(e) => onMin(e.target.value)}
        />
        <Input
          type="number"
          min={0}
          aria-label={maxLabel}
          placeholder="max"
          className="h-8"
          value={max}
          onChange={(e) => onMax(e.target.value)}
        />
      </div>
    </div>
  );
}
