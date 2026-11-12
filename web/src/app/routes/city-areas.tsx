// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useMemo } from "react";
import { useSuspenseQueries, useSuspenseQuery } from "@tanstack/react-query";
import type { AdminCityAreaResponse, AdminFacilityResponse, AdminTrailListItemResponse } from "@/api/generated/model";
import { EmptyState } from "@/components/empty-state";
import { FilterRow } from "@/components/filter-row";
import LinkedItemsCard, { type LinkItem } from "@/components/linked-items-card";
import { MunicipalitySelect } from "@/components/municipality-select";
import { Page, PageHeader } from "@/components/page";
import { QueryBoundary } from "@/components/query-boundary";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  cityAreasQueryOptions,
  linkSuggestionsQueryOptions,
  useSetFacilityLink,
  useSetMunicipality,
  useSetTrailLink,
} from "@/features/city-areas/api/city-areas";
import { AreaBoundaryCard } from "@/features/city-areas/components/area-boundary-card";
import { AreaPicker } from "@/features/city-areas/components/area-picker";
import { ExcludedCard } from "@/features/city-areas/components/excluded-card";
import { RecalculateAreasButton } from "@/features/city-areas/components/recalculate-areas-button";
import { UnlinkedList } from "@/features/city-areas/components/unlinked-list";
import { facilitiesQueryOptions } from "@/features/facilities/api/facility";
import { FacilityEditor } from "@/features/facilities/components/facility-editor";
import { FACILITY_TYPES, facilityTypeLabel } from "@/utils/facility-types";
import { trailsQueryOptions } from "@/features/trails/api/trail";
import { useSearchState } from "@/hooks/use-search-state";

// keep-comment: origin is only worth showing once the area has a boundary; before that every link is manual
function origin(link: { isManual?: boolean }, hasBoundary: boolean): string | undefined {
  if (!hasBoundary || link.isManual === undefined) return undefined;
  return link.isManual ? "manual" : "from boundary";
}

function facilityItem(
  facility: { identifier: string; name: string; facilityType: number; isManual?: boolean },
  hasBoundary = false,
): LinkItem {
  const parts = [facilityTypeLabel(facility.facilityType), origin(facility, hasBoundary)].filter(Boolean);
  return { identifier: facility.identifier, label: facility.name, detail: parts.join(" · ") };
}

function trailItem(
  trail: { identifier: string; name: string; isVerified: boolean; isManual?: boolean },
  city?: string,
  hasBoundary = false,
): LinkItem {
  const parts = [city, trail.isVerified ? undefined : "inactive", origin(trail, hasBoundary)].filter(Boolean);
  return { identifier: trail.identifier, label: trail.name, detail: parts.join(" · ") || undefined };
}

export default function CityAreasPage() {
  const [{ data: areas }, { data: facilities }, { data: trails }] = useSuspenseQueries({
    queries: [cityAreasQueryOptions(), facilitiesQueryOptions(), trailsQueryOptions()],
  });
  const { values, update } = useSearchState({ area: "", view: "areas" });

  const selected = areas.find((area) => area.identifier === values.area) ?? areas.at(0);

  return (
    <Page width="wide">
      <PageHeader
        title="Areas"
        description="Which fire pits, shelters, bathing spots and trails belong to each area. The app shows them on the area's page."
        actions={<RecalculateAreasButton />}
      />

      {selected ? (
        <Tabs value={values.view} onValueChange={(view) => update({ view })}>
          <TabsList>
            <TabsTrigger value="areas">By area</TabsTrigger>
            <TabsTrigger value="unlinked">Not in an area</TabsTrigger>
          </TabsList>
          <TabsContent value="areas" className="space-y-6 pt-4">
            <AreaPicker areas={areas} selected={selected} onSelect={(area) => update({ area })} />
            <AreaLinks area={selected} areas={areas} facilities={facilities} trails={trails} />
          </TabsContent>
          <TabsContent value="unlinked" className="pt-4">
            <QueryBoundary>
              <Unlinked areas={areas} />
            </QueryBoundary>
          </TabsContent>
        </Tabs>
      ) : (
        <EmptyState>No areas exist yet.</EmptyState>
      )}
    </Page>
  );
}

const ALL_TYPES = "All";

function Unlinked({ areas }: { areas: AdminCityAreaResponse[] }) {
  const { data } = useSuspenseQuery(linkSuggestionsQueryOptions());
  const { values, update } = useSearchState({ type: ALL_TYPES });
  const setFacilityLink = useSetFacilityLink();
  const setTrailLink = useSetTrailLink();

  const typesPresent = FACILITY_TYPES.filter(([bit]) => data.facilities.some((f) => (f.facilityType & bit) !== 0));
  // keep-comment: a type with nothing left (the last shelter just linked) counts as All, or the list empties with no filter to undo it
  const typeBit = typesPresent.find(([, label]) => label === values.type)?.[0];
  const activeType = typeBit === undefined ? ALL_TYPES : values.type;

  const facilityRows = data.facilities
    .filter((f) => typeBit === undefined || (f.facilityType & typeBit) !== 0)
    .map((f) => ({ ...facilityItem(f), suggestions: f.suggestions }));
  const trailRows = data.trails.map((t) => ({ ...trailItem(t, t.city), suggestions: t.suggestions }));

  function linkFacility(identifier: string, areas: string[]) {
    const item = data.facilities.find((f) => f.identifier === identifier);
    if (item) setFacilityLink.mutate({ areas, item, linked: true });
  }

  function linkTrail(identifier: string, areas: string[]) {
    const item = data.trails.find((t) => t.identifier === identifier);
    if (item) setTrailLink.mutate({ areas, item, linked: true });
  }

  return (
    <div className="space-y-6">
      <UnlinkedList
        title="Facilities"
        description="Not shown on any area's page in the app. Suggestions come from the name and the closest linked place."
        rows={facilityRows}
        areas={areas}
        onLink={linkFacility}
        filter={
          typesPresent.length > 1 && (
            <FilterRow
              label="Type"
              options={[ALL_TYPES, ...typesPresent.map(([, label]) => label)]}
              value={activeType}
              onChange={(type) => update({ type })}
            />
          )
        }
      />
      <UnlinkedList
        title="Trails"
        description="Curated trails that no area lists. User walks are left out."
        rows={trailRows}
        areas={areas}
        onLink={linkTrail}
      />
    </div>
  );
}

interface AreaLinksProps {
  area: AdminCityAreaResponse;
  areas: AdminCityAreaResponse[];
  facilities: AdminFacilityResponse[];
  trails: AdminTrailListItemResponse[];
}

function AreaLinks({ area, areas, facilities, trails }: AreaLinksProps) {
  const setFacilityLink = useSetFacilityLink();
  const setTrailLink = useSetTrailLink();
  const setMunicipality = useSetMunicipality();

  const facilitiesById = useMemo(() => new Map(facilities.map((f) => [f.identifier, f])), [facilities]);
  const trailsById = useMemo(() => new Map(trails.map((t) => [t.identifier, t])), [trails]);
  const neighbours = useMemo(
    () =>
      areas.flatMap((other) =>
        other.identifier !== area.identifier && other.boundary
          ? [{ identifier: other.identifier, name: other.name, boundary: other.boundary }]
          : [],
      ),
    [areas, area.identifier],
  );
  const places = useMemo(
    () =>
      area.facilities.flatMap((linked) => {
        const facility = facilitiesById.get(linked.identifier);
        return facility?.longitude != null && facility.latitude != null
          ? [{ identifier: linked.identifier, name: linked.name, position: [facility.longitude, facility.latitude] }]
          : [];
      }),
    [area.facilities, facilitiesById],
  );
  const hasBoundary = area.boundary !== null;

  function linkFacility(identifier: string, linked: boolean) {
    const item = linked ? facilitiesById.get(identifier) : area.facilities.find((f) => f.identifier === identifier);
    if (item) setFacilityLink.mutate({ areas: [area.identifier], item, linked });
  }

  function linkTrail(identifier: string, linked: boolean) {
    const item = linked ? trailsById.get(identifier) : area.trails.find((t) => t.identifier === identifier);
    if (item) setTrailLink.mutate({ areas: [area.identifier], item, linked });
  }

  function editFacility(item: LinkItem) {
    const facility = facilitiesById.get(item.identifier);
    return facility ? <FacilityEditor facility={facility} /> : null;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">{area.name}</h2>
          <p className="text-sm text-muted-foreground">{area.location}</p>
        </div>
        <div className="w-64">
          <MunicipalitySelect
            value={area.municipalityIdentifier ?? ""}
            disabled={setMunicipality.isPending}
            noneLabel="No municipality"
            onChange={(municipality) => {
              if (municipality !== (area.municipalityIdentifier ?? ""))
                setMunicipality.mutate({ area: area.identifier, municipality: municipality || null });
            }}
          />
        </div>
      </div>

      <AreaBoundaryCard key={area.identifier} area={area} places={places} neighbours={neighbours} />

      <LinkedItemsCard
        title="Facilities"
        description="Fire pits, shelters, fishing and swimming spots, nature reserves."
        searchLabel="Search facilities to link"
        linked={area.facilities.map((f) => facilityItem(f, hasBoundary))}
        available={facilities.map((f) => facilityItem(f))}
        onLink={(id) => linkFacility(id, true)}
        onUnlink={(id) => linkFacility(id, false)}
        actions={editFacility}
      />

      <LinkedItemsCard
        title="Trails"
        description="Walks and trails in the area. Inactive trails stay hidden in the app."
        searchLabel="Search trails to link"
        linked={area.trails.map((t) => trailItem(t, trailsById.get(t.identifier)?.city, hasBoundary))}
        available={trails.map((t) => trailItem(t, t.city))}
        onLink={(id) => linkTrail(id, true)}
        onUnlink={(id) => linkTrail(id, false)}
      />

      <ExcludedCard area={area} />
    </div>
  );
}
