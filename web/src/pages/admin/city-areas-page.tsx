// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import LinkedItemsCard, { type LinkItem } from "@/components/city-areas/linked-items-card";
import { getAdminCityAreas, setFacilityLinked, setTrailLinked } from "@/api/city-areas";
import { getAllFacilities } from "@/api/facility";
import { getAllTrails } from "@/api/trail";
import type { AdminCityAreaResponse } from "@/api/generated/model";
import type { AdminTrailListItem, FacilityResponse } from "@/types/types";
import { facilityTypeLabel } from "@/lib/facility-types";
import { cn } from "@/lib/utils";

function facilityItem(facility: { identifier: string; name?: string; facilityType: number }): LinkItem {
  return {
    identifier: facility.identifier,
    label: facility.name ?? facility.identifier,
    detail: facilityTypeLabel(facility.facilityType),
  };
}

function trailItem(trail: { identifier: string; name: string; isVerified: boolean; city?: string }): LinkItem {
  const parts = [trail.city, trail.isVerified ? undefined : "inactive"].filter(Boolean);
  return { identifier: trail.identifier, label: trail.name, detail: parts.join(" · ") || undefined };
}

export default function CityAreasPage() {
  const [areas, setAreas] = useState<AdminCityAreaResponse[] | null>(null);
  const [facilities, setFacilities] = useState<FacilityResponse[]>([]);
  const [trails, setTrails] = useState<AdminTrailListItem[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();

  const loadAreas = useCallback(async () => {
    try {
      setAreas(await getAdminCityAreas());
    } catch (err) {
      setAreas((current) => current ?? []);
      toast.error(err instanceof Error ? err.message : "Could not load the areas.");
    }
  }, []);

  useEffect(() => {
    getAdminCityAreas()
      .then(setAreas)
      .catch(() => {
        setAreas([]);
        toast.error("Could not load the areas.");
      });
    getAllFacilities()
      .then(setFacilities)
      .catch(() => toast.error("Could not load the facilities."));
    getAllTrails()
      .then(setTrails)
      .catch(() => toast.error("Could not load the trails."));
  }, []);

  const selected = useMemo(() => {
    const identifier = searchParams.get("area");
    return areas?.find((area) => area.identifier === identifier) ?? areas?.[0] ?? null;
  }, [areas, searchParams]);

  const trailCities = useMemo(() => new Map(trails.map((t) => [t.identifier, t.city])), [trails]);

  async function change(action: () => Promise<void>, success: string) {
    try {
      await action();
      toast.success(success);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update the area.");
    }
    await loadAreas();
  }

  return (
    <main className="container mx-auto max-w-6xl space-y-6 py-10">
      <Card>
        <CardHeader>
          <CardTitle>Areas</CardTitle>
          <CardDescription>
            Which fire pits, shelters, bathing spots and trails belong to each area. The app shows them on the area's
            page.
          </CardDescription>
        </CardHeader>
      </Card>

      {areas === null && <Skeleton className="h-64 w-full" />}

      {areas !== null && areas.length === 0 && (
        <p className="text-center text-sm text-muted-foreground">No areas exist yet.</p>
      )}

      {areas !== null && selected && (
        <div className="grid gap-6 md:grid-cols-[16rem_1fr]">
          <nav aria-label="Areas" className="space-y-1">
            {areas.map((area) => (
              <button
                key={area.identifier}
                type="button"
                aria-current={area.identifier === selected.identifier ? "page" : undefined}
                onClick={() => setSearchParams({ area: area.identifier })}
                className={cn(
                  "block w-full rounded-xs px-3 py-2 text-left text-sm transition-colors hover:bg-accent/50",
                  area.identifier === selected.identifier && "bg-accent font-medium",
                )}
              >
                <span className="block truncate">{area.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {area.facilities.length} facilities · {area.trails.length} trails
                </span>
              </button>
            ))}
          </nav>

          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold">{selected.name}</h2>
              <p className="text-sm text-muted-foreground">{selected.location}</p>
            </div>

            <LinkedItemsCard
              title="Facilities"
              description="Fire pits, shelters, fishing and swimming spots, nature reserves."
              searchLabel="Search facilities to link"
              linked={selected.facilities.map(facilityItem)}
              available={facilities.map(facilityItem)}
              onLink={(id) => change(() => setFacilityLinked(selected.identifier, id, true), "Facility linked.")}
              onUnlink={(id) => change(() => setFacilityLinked(selected.identifier, id, false), "Facility unlinked.")}
            />

            <LinkedItemsCard
              title="Trails"
              description="Walks and trails in the area. Inactive trails stay hidden in the app."
              searchLabel="Search trails to link"
              linked={selected.trails.map((t) => trailItem({ ...t, city: trailCities.get(t.identifier) }))}
              available={trails.map(trailItem)}
              onLink={(id) => change(() => setTrailLinked(selected.identifier, id, true), "Trail linked.")}
              onUnlink={(id) => change(() => setTrailLinked(selected.identifier, id, false), "Trail unlinked.")}
            />
          </div>
        </div>
      )}
    </main>
  );
}
