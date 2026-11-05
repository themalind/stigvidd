// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useMemo } from "react";
import { useSuspenseQueries, useSuspenseQuery } from "@tanstack/react-query";
import type { AdminCityAreaResponse, AdminFacilityResponse, AdminTrailListItemResponse } from "@/api/generated/model";
import { EmptyState } from "@/components/empty-state";
import { FilterRow } from "@/components/filter-row";
import LinkedItemsCard, { type LinkItem } from "@/components/linked-items-card";
import { Page, PageHeader } from "@/components/page";
import { QueryBoundary } from "@/components/query-boundary";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  cityAreasQueryOptions,
  linkSuggestionsQueryOptions,
  useSetFacilityLink,
  useSetTrailLink,
} from "@/features/city-areas/api/city-areas";
import { AreaPicker } from "@/features/city-areas/components/area-picker";
import { UnlinkedList } from "@/features/city-areas/components/unlinked-list";
import { facilitiesQueryOptions } from "@/features/facilities/api/facility";
import { FacilityEditor } from "@/features/facilities/components/facility-editor";
import { FACILITY_TYPES, facilityTypeLabel } from "@/features/facilities/utils/facility-types";
import { trailsQueryOptions } from "@/features/trails/api/trail";
import { useSearchState } from "@/hooks/use-search-state";

function facilityItem(facility: { identifier: string; name: string; facilityType: number }): LinkItem {
  return { identifier: facility.identifier, label: facility.name, detail: facilityTypeLabel(facility.facilityType) };
}

function trailItem(trail: { identifier: string; name: string; isVerified: boolean }, city?: string): LinkItem {
  const parts = [city, trail.isVerified ? undefined : "inactive"].filter(Boolean);
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
      />

      {selected ? (
        <Tabs value={values.view} onValueChange={(view) => update({ view })}>
          <TabsList>
            <TabsTrigger value="areas">By area</TabsTrigger>
            <TabsTrigger value="unlinked">Not in an area</TabsTrigger>
          </TabsList>
          <TabsContent value="areas" className="space-y-6 pt-4">
            <AreaPicker areas={areas} selected={selected} onSelect={(area) => update({ area })} />
            <AreaLinks area={selected} facilities={facilities} trails={trails} />
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
  facilities: AdminFacilityResponse[];
  trails: AdminTrailListItemResponse[];
}

function AreaLinks({ area, facilities, trails }: AreaLinksProps) {
  const setFacilityLink = useSetFacilityLink();
  const setTrailLink = useSetTrailLink();

  const facilitiesById = useMemo(() => new Map(facilities.map((f) => [f.identifier, f])), [facilities]);
  const trailsById = useMemo(() => new Map(trails.map((t) => [t.identifier, t])), [trails]);

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
      <div>
        <h2 className="text-xl font-semibold">{area.name}</h2>
        <p className="text-sm text-muted-foreground">{area.location}</p>
      </div>

      <LinkedItemsCard
        title="Facilities"
        description="Fire pits, shelters, fishing and swimming spots, nature reserves."
        searchLabel="Search facilities to link"
        linked={area.facilities.map(facilityItem)}
        available={facilities.map(facilityItem)}
        onLink={(id) => linkFacility(id, true)}
        onUnlink={(id) => linkFacility(id, false)}
        actions={editFacility}
      />

      <LinkedItemsCard
        title="Trails"
        description="Walks and trails in the area. Inactive trails stay hidden in the app."
        searchLabel="Search trails to link"
        linked={area.trails.map((t) => trailItem(t, trailsById.get(t.identifier)?.city))}
        available={trails.map((t) => trailItem(t, t.city))}
        onLink={(id) => linkTrail(id, true)}
        onUnlink={(id) => linkTrail(id, false)}
      />
    </div>
  );
}
