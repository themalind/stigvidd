// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { trailsQueryOptions } from "@/features/trails/api/trail";
import { trailColumns } from "@/features/trails/components/trail-columns";
import { CLASSIFICATION } from "@/utils/classification";
import { Page } from "@/components/page";
import TrailsTable from "@/features/trails/components/trails-table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FilterSelect } from "@/components/filter-select";
import {
  TRAIL_MISSING,
  TRAIL_SORTS,
  TRAIL_STATUSES,
  TRAIL_UPDATED,
  emptyTrailFilters,
  filterTrails,
  filtersFromSearch,
  trailCities,
  type TrailFilterState,
} from "@/features/trails/utils/trail-filters";

const ACCESSIBILITY_OPTIONS = [
  { value: "All", label: "Any accessibility" },
  { value: "Accessible", label: "Accessible" },
  { value: "NotAccessible", label: "Not accessible" },
] as const;

const CLASSIFICATION_OPTIONS = [
  { value: "All", label: "All difficulties" },
  ...Object.entries(CLASSIFICATION).map(([value, label]) => ({ value, label })),
];

export default function TrailsPage() {
  const { data: trails } = useSuspenseQuery(trailsQueryOptions());
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState<TrailFilterState>(() => filtersFromSearch(searchParams));

  const cityOptions = useMemo(
    () => [{ value: "All", label: "All cities" }, ...trailCities(trails).map((city) => ({ value: city, label: city }))],
    [trails],
  );
  const visible = useMemo(() => filterTrails(trails, filters), [trails, filters]);

  function update(key: keyof TrailFilterState) {
    return (value: string) => setFilters((current) => ({ ...current, [key]: value }));
  }

  return (
    <Page width="full">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          aria-label="Search trails"
          placeholder="Search name, city or identifier"
          value={filters.query}
          onChange={(e) => update("query")(e.target.value)}
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
          options={ACCESSIBILITY_OPTIONS}
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
          onChange={(e) => update("minKm")(e.target.value)}
          className="w-24"
        />
        <Input
          aria-label="Maximum length in km"
          placeholder="Max km"
          inputMode="decimal"
          value={filters.maxKm}
          onChange={(e) => update("maxKm")(e.target.value)}
          className="w-24"
        />
        <FilterSelect label="Sort" value={filters.sort} options={TRAIL_SORTS} onChange={update("sort")} />
        <Button variant="ghost" onClick={() => setFilters(emptyTrailFilters)}>
          Clear
        </Button>
        <span className="text-muted-foreground text-sm ml-auto">
          {visible.length} of {trails.length} trails
        </span>
      </div>
      <TrailsTable columns={trailColumns} trails={visible} />
    </Page>
  );
}
