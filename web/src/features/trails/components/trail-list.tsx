// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useMemo, useState } from "react";
import type { AdminTrailListItemResponse } from "@/api/generated/model";
import { useSearchState } from "@/hooks/use-search-state";
import { CLASSIFICATION } from "@/utils/classification";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FilterSelect } from "@/components/filter-select";
import {
  TRAIL_ACCESSIBILITY,
  TRAIL_MISSING,
  TRAIL_SORTS,
  TRAIL_STATUSES,
  TRAIL_UPDATED,
  filterTrails,
  filtersFromSearch,
  trailCities,
  trailSearchDefaults,
  type TrailSearchFilters,
  type TrailTextFilters,
} from "@/features/trails/utils/trail-filters";
import type { TableColumn } from "./trail-columns";
import TrailsTable from "./trails-table";

const EMPTY_TEXT: TrailTextFilters = { query: "", minKm: "", maxKm: "" };

const CLASSIFICATION_OPTIONS = [
  { value: "All", label: "All difficulties" },
  ...Object.entries(CLASSIFICATION).map(([value, label]) => ({ value, label })),
];

interface Props {
  trails: AdminTrailListItemResponse[];
  columns: TableColumn<AdminTrailListItemResponse>[];
  noun: string;
}

export function TrailList({ trails, columns, noun }: Props) {
  const search = useSearchState(trailSearchDefaults);
  const [text, setText] = useState(EMPTY_TEXT);
  const filters = useMemo(() => ({ ...filtersFromSearch(search.values), ...text }), [search.values, text]);

  const cityOptions = useMemo(
    () => [{ value: "All", label: "All cities" }, ...trailCities(trails).map((city) => ({ value: city, label: city }))],
    [trails],
  );
  const visible = useMemo(() => filterTrails(trails, filters), [trails, filters]);

  function update(key: keyof TrailSearchFilters) {
    return (value: string) => search.update({ [key]: value });
  }

  function type(key: keyof TrailTextFilters) {
    return (value: string) => setText((current) => ({ ...current, [key]: value }));
  }

  function clear() {
    setText(EMPTY_TEXT);
    search.update(Object.fromEntries(Object.keys(trailSearchDefaults).map((key) => [key, undefined])));
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          aria-label={`Search ${noun}`}
          placeholder="Search name, city or identifier"
          value={filters.query}
          onChange={(e) => type("query")(e.target.value)}
          className="w-72"
        />
        <FilterSelect
          label="Status"
          value={filters.status}
          options={TRAIL_STATUSES}
          onChange={update("status")}
          className="w-36"
        />
        <FilterSelect label="City" value={filters.city} options={cityOptions} onChange={update("city")} />
        <FilterSelect
          label="Classification"
          value={filters.classification}
          options={CLASSIFICATION_OPTIONS}
          onChange={update("classification")}
        />
        <FilterSelect
          label="Accessibility"
          value={filters.accessibility}
          options={TRAIL_ACCESSIBILITY}
          onChange={update("accessibility")}
        />
        <FilterSelect
          label="Missing"
          value={filters.missing}
          options={TRAIL_MISSING}
          onChange={update("missing")}
          className="w-52"
        />
        <FilterSelect
          label="Updated"
          value={filters.updatedWithinDays}
          options={TRAIL_UPDATED}
          onChange={update("updatedWithinDays")}
          className="w-48"
        />
        <Input
          aria-label="Minimum length in km"
          placeholder="Min km"
          inputMode="decimal"
          value={filters.minKm}
          onChange={(e) => type("minKm")(e.target.value)}
          className="w-24"
        />
        <Input
          aria-label="Maximum length in km"
          placeholder="Max km"
          inputMode="decimal"
          value={filters.maxKm}
          onChange={(e) => type("maxKm")(e.target.value)}
          className="w-24"
        />
        <FilterSelect label="Sort" value={filters.sort} options={TRAIL_SORTS} onChange={update("sort")} />
        <Button variant="ghost" onClick={clear}>
          Clear
        </Button>
        <span className="text-muted-foreground text-sm ml-auto">
          {visible.length} of {trails.length} {noun}
        </span>
      </div>
      <TrailsTable columns={columns} trails={visible} />
    </>
  );
}
