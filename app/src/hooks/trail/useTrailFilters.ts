import { TrailShortInfoResponse } from "@/data/types";
import { getDistance } from "geolib";
import { useMemo, useState } from "react";

export type SortOption = "name-asc" | "name-desc" | "length-asc" | "length-desc" | "distance-asc";

interface FilterOptions {
  city?: string;
  minLength?: number;
  maxLenght?: number;
  accessibility?: boolean;
  classification?: number;
  nearMe?: boolean;
  maxDistance?: number;
}

interface UserLocation {
  latitude: number;
  longitude: number;
}

export const useTrailFilters = (trails: TrailShortInfoResponse[] | undefined, userLocation: UserLocation | null) => {
  const [filters, setFilters] = useState<FilterOptions>({});
  const [sortBy, setSortBy] = useState("name-asc");

  const cities = useMemo(() => {
    if (!trails) {
      return [];
    }
    return [...new Set(trails.map((trail) => trail.city))].sort();
  }, [trails]);

  const classifications = useMemo(() => {
    if (!trails) {
      return [];
    }
    return [...new Set(trails.map((trail) => trail.classification))].filter((cf) => cf.valueOf() !== 0).sort();
  }, [trails]);

  const trailsWithDistance = useMemo(() => {
    if (!trails) {
      return;
    }
    if (!userLocation) {
      return trails.map((trail) => ({ ...trail, distanceKm: undefined as number | undefined }));
    }

    return trails.map((trail) => {
      let distanceKm: number | undefined;
      if (trail.startLatitude != null && trail.startLongitude != null) {
        const meters = getDistance(
          { latitude: userLocation.latitude, longitude: userLocation.longitude },
          { latitude: trail.startLatitude, longitude: trail.startLongitude },
        );
        distanceKm = meters / 1000;
      }
      return { ...trail, distanceKm };
    });
  }, [trails, userLocation]);

  const filteredTrails = useMemo(() => {
    if (!trails || !trailsWithDistance) {
      return [];
    }

    let result = [...trailsWithDistance];

    if (filters.city) {
      result = result.filter((trail) => trail.city === filters.city);
    }

    const minLength = filters.minLength;
    if (minLength !== undefined) {
      result = result.filter((trail) => trail.trailLength >= minLength);
    }

    const maxLength = filters.maxLenght;
    if (maxLength !== undefined) {
      result = result.filter((trail) => trail.trailLength <= maxLength);
    }

    if (filters.accessibility) {
      result = result.filter((trail) => trail.accessibility === filters.accessibility);
    }

    if (filters.classification) {
      result = result.filter((trail) => trail.classification === filters.classification);
    }

    if (filters.nearMe && userLocation) {
      const maxDistance = filters.maxDistance || 50;
      result = result.filter((trail) => trail.distanceKm != null && trail.distanceKm <= maxDistance);
    }

    switch (sortBy) {
      case "name-asc":
        result.sort((a, b) => a.name.localeCompare(b.name, "sv"));
        break;
      case "name-desc":
        result.sort((a, b) => b.name.localeCompare(a.name, "sv"));
        break;
      case "length-asc":
        result.sort((a, b) => Number(a.trailLength) - Number(b.trailLength));
        break;
      case "length-desc":
        result.sort((a, b) => Number(b.trailLength) - Number(a.trailLength));
        break;
      case "distance-asc":
        result.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
    }
    return result;
  }, [trailsWithDistance, trails, filters, sortBy, userLocation]);

  const updateFilter = (key: keyof FilterOptions, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    if (key === "minLength" || key === "maxLenght") {
      setSortBy("length-asc");
    }
    if (key === "nearMe" && value === true) {
      setSortBy("distance-asc");
    }
  };

  const clearFilters = () => {
    setFilters({});
    setSortBy("name-asc");
  };

  return {
    filters,
    updateFilter,
    clearFilters,
    sortBy,
    setSortBy,
    filteredTrails,
    cities,
    classifications,
    totalCount: trails?.length ?? 0,
    filteredCount: filteredTrails.length,
  };
};
