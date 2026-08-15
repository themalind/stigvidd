import { useMemo, useState } from "react";

export type HikeSortOption =
  | "name-asc"
  | "name-desc"
  | "date-asc"
  | "date-desc"
  | "length-asc"
  | "length-desc"
  | "duration-asc"
  | "duration-desc";

export interface HikeFilterOptions {
  minLength?: number;
  maxLength?: number;
  minDuration?: number; // minutes — duration itself is stored in ms
  maxDuration?: number;
  sharedBy?: string;
}

export interface HikeAccessors<T> {
  name: (h: T) => string;
  length: (h: T) => number;
  duration: (h: T) => number; // ms
  date: (h: T) => string; // ISO
  sharedBy?: (h: T) => string;
}

/** Upper bounds and step sizes for the range sliders. Duration is in minutes. */
export interface HikeFilterRanges {
  lengthMax: number;
  lengthStep: number;
  durationMax: number;
  durationStep: number;
}

const roundUpTo = (value: number, step: number) => Math.ceil(value / step) * step;

export const useHikeFilters = <T>(hikes: T[] | undefined, accessors: HikeAccessors<T>) => {
  const [filters, setFilters] = useState<HikeFilterOptions>({});
  const [sortBy, setSortBy] = useState<HikeSortOption>("name-asc");
  const [searchQuery, setSearchQuery] = useState("");

  // Unique sharer names, driving the "shared by" dropdown.
  const sharedByNames = useMemo(() => {
    const read = accessors.sharedBy;
    if (!hikes || !read) return [];
    return [...new Set(hikes.map(read))].sort((a, b) => a.localeCompare(b, "sv"));
  }, [hikes, accessors]);

  // Slider bounds follow the collection, so the thumbs spread across the whole track
  // instead of bunching in the first few pixels. Read from the unfiltered hikes, so the
  // scale holds still while you drag. Steps get finer for short collections.
  const ranges: HikeFilterRanges = useMemo(() => {
    let longestKm = 0;
    let longestMinutes = 0;
    for (const hike of hikes ?? []) {
      const km = accessors.length(hike);
      if (Number.isFinite(km)) longestKm = Math.max(longestKm, km);
      const minutes = accessors.duration(hike) / 60000;
      if (Number.isFinite(minutes)) longestMinutes = Math.max(longestMinutes, minutes);
    }

    const lengthStep = longestKm <= 10 ? 0.5 : 1;
    const durationStep = longestMinutes <= 120 ? 5 : 15;
    return {
      // Floors keep a single two-minute walk from collapsing the track to one stop.
      lengthMax: Math.max(roundUpTo(longestKm, lengthStep), 1),
      lengthStep,
      durationMax: Math.max(roundUpTo(longestMinutes, durationStep), 30),
      durationStep,
    };
  }, [hikes, accessors]);

  const filteredHikes = useMemo(() => {
    if (!hikes) return [];
    let result = [...hikes];

    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      result = result.filter(
        (h) =>
          accessors.name(h).toLowerCase().includes(query) ||
          (accessors.sharedBy?.(h).toLowerCase().includes(query) ?? false),
      );
    }

    if (filters.sharedBy && accessors.sharedBy) {
      const read = accessors.sharedBy;
      result = result.filter((h) => read(h) === filters.sharedBy);
    }

    const { minLength, maxLength, minDuration, maxDuration } = filters;
    if (minLength !== undefined) result = result.filter((h) => accessors.length(h) >= minLength);
    if (maxLength !== undefined) result = result.filter((h) => accessors.length(h) <= maxLength);
    // The only place ms meets minutes.
    if (minDuration !== undefined) result = result.filter((h) => accessors.duration(h) / 60000 >= minDuration);
    if (maxDuration !== undefined) result = result.filter((h) => accessors.duration(h) / 60000 <= maxDuration);

    switch (sortBy) {
      case "name-asc":
        result.sort((a, b) => accessors.name(a).localeCompare(accessors.name(b), "sv"));
        break;
      case "name-desc":
        result.sort((a, b) => accessors.name(b).localeCompare(accessors.name(a), "sv"));
        break;
      case "date-asc":
        result.sort((a, b) => Date.parse(accessors.date(a)) - Date.parse(accessors.date(b)));
        break;
      case "date-desc":
        result.sort((a, b) => Date.parse(accessors.date(b)) - Date.parse(accessors.date(a)));
        break;
      case "length-asc":
        result.sort((a, b) => accessors.length(a) - accessors.length(b));
        break;
      case "length-desc":
        result.sort((a, b) => accessors.length(b) - accessors.length(a));
        break;
      case "duration-asc":
        result.sort((a, b) => accessors.duration(a) - accessors.duration(b));
        break;
      case "duration-desc":
        result.sort((a, b) => accessors.duration(b) - accessors.duration(a));
    }
    return result;
  }, [hikes, accessors, filters, sortBy, searchQuery]);

  const updateFilter = (key: keyof HikeFilterOptions, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const updateRangeFilter = (key: "length" | "duration", min: number, max: number) => {
    setFilters((prev) =>
      key === "length" ? { ...prev, minLength: min, maxLength: max } : { ...prev, minDuration: min, maxDuration: max },
    );
  };

  const clearFilters = () => {
    setFilters({});
    setSortBy("name-asc");
    setSearchQuery("");
  };

  return {
    filters,
    updateFilter,
    updateRangeFilter,
    clearFilters,
    sortBy,
    setSortBy,
    filteredHikes,
    sharedByNames,
    ranges,
    totalCount: hikes?.length ?? 0,
    filteredCount: filteredHikes.length,
    searchQuery,
    setSearchQuery,
  };
};
