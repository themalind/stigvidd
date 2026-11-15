// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import type { AdminFacilityResponse } from "@/api/generated/model";
import { useConfirm } from "@/components/confirm-dialog";
import { FilterSelect } from "@/components/filter-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSearchState } from "@/hooks/use-search-state";
import { useDeleteFacility } from "@/features/facilities/api/facility";
import {
  FACILITY_AREAS,
  FACILITY_DUPLICATES,
  FACILITY_POSITIONS,
  FACILITY_SORTS,
  HAND_ENTERED,
  facilitySearchDefaults,
  facilitySources,
  filterFacilities,
  filtersFromSearch,
  type FacilitySearchFilters,
} from "@/features/facilities/utils/facility-filters";
import { FACILITY_TYPES, facilityTypeLabel } from "@/utils/facility-types";
import { FacilityEditor } from "./facility-editor";
import { FacilityMapDialog } from "./facility-map-dialog";
import type { MapNeighbour } from "./facility-map";

const TYPE_OPTIONS = [
  { value: "All", label: "All types" },
  ...FACILITY_TYPES.map(([bit, label]) => ({ value: String(bit), label })),
];

interface Props {
  facilities: AdminFacilityResponse[];
}

export function FacilityList({ facilities }: Props) {
  const search = useSearchState(facilitySearchDefaults);
  const [query, setQuery] = useState("");
  const filters = useMemo(() => ({ ...filtersFromSearch(search.values), query }), [search.values, query]);
  const visible = useMemo(() => filterFacilities(facilities, filters), [facilities, filters]);
  const sourceOptions = useMemo(
    () => [
      { value: "All", label: "All sources" },
      { value: HAND_ENTERED, label: "Entered by hand" },
      ...facilitySources(facilities).map((key) => ({ value: key, label: key })),
    ],
    [facilities],
  );
  const neighbours = useMemo<MapNeighbour[]>(
    () =>
      facilities.flatMap((f) =>
        f.latitude !== null && f.longitude !== null ? [{ name: f.name, position: [f.longitude, f.latitude] }] : [],
      ),
    [facilities],
  );
  const remove = useDeleteFacility();
  const [confirm, confirmDialog] = useConfirm();

  function update(key: keyof FacilitySearchFilters) {
    return (value: string) => search.update({ [key]: value });
  }

  function clear() {
    setQuery("");
    search.update(Object.fromEntries(Object.keys(facilitySearchDefaults).map((key) => [key, undefined])));
  }

  async function handleDelete(facility: AdminFacilityResponse) {
    const ok = await confirm({
      title: `Delete ${facility.name}?`,
      description: facility.sourceId
        ? "It is removed from the app and from its areas. The next import from its data source adds it again as new."
        : "It is removed from the app and from its areas.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (ok) remove.mutate(facility.identifier);
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          aria-label="Search facilities"
          placeholder="Search name, place, area or identifier"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-72"
        />
        <FilterSelect label="Type" value={filters.type} options={TYPE_OPTIONS} onChange={update("type")} />
        <FilterSelect
          label="Source"
          value={filters.source}
          options={sourceOptions}
          onChange={update("source")}
          className="w-52"
        />
        <FilterSelect
          label="Position"
          value={filters.position}
          options={FACILITY_POSITIONS}
          onChange={update("position")}
          className="w-36"
        />
        <FilterSelect
          label="Area"
          value={filters.area}
          options={FACILITY_AREAS}
          onChange={update("area")}
          className="w-36"
        />
        <FilterSelect
          label="Duplicates"
          value={filters.duplicates}
          options={FACILITY_DUPLICATES}
          onChange={update("duplicates")}
        />
        <FilterSelect label="Sort" value={filters.sort} options={FACILITY_SORTS} onChange={update("sort")} />
        <Button variant="ghost" onClick={clear}>
          Clear
        </Button>
        <span className="text-muted-foreground text-sm ml-auto">
          {visible.length} of {facilities.length} facilities
        </span>
      </div>

      <div className="rounded-xs border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-bold">Name</TableHead>
              <TableHead className="font-bold">Type</TableHead>
              <TableHead className="font-bold">Source</TableHead>
              <TableHead className="font-bold">Position</TableHead>
              <TableHead className="font-bold">Areas</TableHead>
              <TableHead className="font-bold">Updated</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((facility, index) => (
              <TableRow key={facility.identifier} className={index % 2 === 0 ? "bg-sidebar" : "bg-background"}>
                <TableCell>{facility.name}</TableCell>
                <TableCell>{facilityTypeLabel(facility.facilityType)}</TableCell>
                <TableCell>
                  {facility.sourceId ? (
                    <span title={facility.sourceId}>{facility.sourceKey}</span>
                  ) : (
                    <span className="text-muted-foreground">By hand</span>
                  )}
                </TableCell>
                <TableCell>
                  {facility.latitude !== null && facility.longitude !== null ? (
                    `${facility.latitude.toFixed(5)}, ${facility.longitude.toFixed(5)}`
                  ) : (
                    <span className="text-muted-foreground">None</span>
                  )}
                </TableCell>
                <TableCell>
                  {facility.areaNames.length > 0 ? (
                    facility.areaNames.join(", ")
                  ) : (
                    <span className="text-muted-foreground">None</span>
                  )}
                </TableCell>
                <TableCell>{new Date(facility.lastUpdatedAt).toLocaleDateString("sv-SE")}</TableCell>
                <TableCell className="flex justify-end gap-1">
                  <FacilityMapDialog facility={facility} neighbours={neighbours} />
                  <FacilityEditor facility={facility} />
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${facility.name}`}
                    disabled={remove.isPending}
                    onClick={() => void handleDelete(facility)}
                  >
                    <Trash2 />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {confirmDialog}
    </>
  );
}
