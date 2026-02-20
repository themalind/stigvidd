import { FilterOptions, TrailShortInfoResponse } from "@/data/types";
import { getDistance } from "geolib";
import { useMemo, useState } from "react";
import { LatLng } from "react-native-maps";

export type SortOption = "name-asc" | "name-desc" | "length-asc" | "length-desc" | "distance-asc";

export const useTrailFilters = (trails: TrailShortInfoResponse[] | undefined, userLocation: LatLng | null) => {
  const [filters, setFilters] = useState<FilterOptions>({});
  const [sortBy, setSortBy] = useState("name-asc");
  const [searchQuery, setSearchQuery] = useState("");

  // Extracts a sorted list of unique city names from the trails
  const cities = useMemo(() => {
    if (!trails) {
      return [];
    }
    return [...new Set(trails.map((trail) => trail.city))].sort();
  }, [trails]);

  // Extracts a sorted list of unique non-zero trail classifications
  const classifications = useMemo(() => {
    if (!trails) {
      return [];
    }
    return [...new Set(trails.map((trail) => trail.classification))].filter((cf) => cf.valueOf() !== 0).sort();
  }, [trails]);

  // Memoizes a list of trails with added distance information.
  // If trails are missing, returns undefined.
  // If the user's location is unavailable, returns the trails with distanceKm set to undefined.
  // Otherwise, calculates the distance (in kilometers) from the user’s location
  // to each trail’s start coordinates (when available) and adds it as distanceKm.
  // Recomputes only when trails or userLocation change.
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

  // Applies all active filters and sorts the trails based on the selected sort option
  const filteredTrails = useMemo(() => {
    if (!trails || !trailsWithDistance) {
      return [];
    }

    let result = [...trailsWithDistance];

    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      result = result.filter(
        (trail) => trail.name.toLowerCase().includes(query) || trail.city.toLowerCase().includes(query),
      );
    }

    if (filters.city) {
      result = result.filter((trail) => trail.city === filters.city);
    }

    const minLength = filters.minLength;
    if (minLength !== undefined) {
      result = result.filter((trail) => trail.trailLength >= minLength);
    }

    const maxLength = filters.maxLength;
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
  }, [trailsWithDistance, trails, filters, sortBy, userLocation, searchQuery]);

  // Updates a single filter and auto-selects a relevant sort order
  const updateFilter = (key: keyof FilterOptions, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    if (key === "nearMe" && value === true) {
      setSortBy("distance-asc");
    }
  };

  // Updates min and max length in a single state update
  const updateLengthFilter = (min: number, max: number) => {
    setFilters((prev) => ({ ...prev, minLength: min, maxLength: max }));
    setSortBy("length-asc");
  };

  // Resets all filters and restores the default sort order
  const clearFilters = () => {
    setFilters({});
    setSortBy("name-asc");
    setSearchQuery("");
  };

  return {
    filters,
    updateFilter,
    updateLengthFilter,
    clearFilters,
    sortBy,
    setSortBy,
    filteredTrails,
    cities,
    classifications,
    totalCount: trails?.length ?? 0,
    filteredCount: filteredTrails.length,
    searchQuery,
    setSearchQuery,
  };
};
