// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useMemo } from "react";
import { useSearchParams } from "react-router";
import { useSuspenseQueries } from "@tanstack/react-query";
import type { AdminCityAreaResponse, AdminFacilityResponse, AdminTrailListItemResponse } from "@/api/generated/model";
import { EmptyState } from "@/components/empty-state";
import LinkedItemsCard, { type LinkItem } from "@/components/linked-items-card";
import { Page, PageHeader } from "@/components/page";
import { cityAreasQueryOptions, useSetFacilityLink, useSetTrailLink } from "@/features/city-areas/api/city-areas";
import { AreaPicker } from "@/features/city-areas/components/area-picker";
import { facilitiesQueryOptions } from "@/features/facilities/api/facility";
import { FacilityEditor } from "@/features/facilities/components/facility-editor";
import { facilityTypeLabel } from "@/features/facilities/utils/facility-types";
import { trailsQueryOptions } from "@/features/trails/api/trail";

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
  const [searchParams, setSearchParams] = useSearchParams();

  const selected = areas.find((area) => area.identifier === searchParams.get("area")) ?? areas.at(0);

  return (
    <Page width="wide">
      <PageHeader
        title="Areas"
        description="Which fire pits, shelters, bathing spots and trails belong to each area. The app shows them on the area's page."
      />

      {selected ? (
        <div className="space-y-6">
          <AreaPicker
            areas={areas}
            selected={selected}
            onSelect={(identifier) => setSearchParams({ area: identifier })}
          />
          <AreaLinks area={selected} facilities={facilities} trails={trails} />
        </div>
      ) : (
        <EmptyState>No areas exist yet.</EmptyState>
      )}
    </Page>
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
    if (item) setFacilityLink.mutate({ area: area.identifier, item, linked });
  }

  function linkTrail(identifier: string, linked: boolean) {
    const item = linked ? trailsById.get(identifier) : area.trails.find((t) => t.identifier === identifier);
    if (item) setTrailLink.mutate({ area: area.identifier, item, linked });
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
