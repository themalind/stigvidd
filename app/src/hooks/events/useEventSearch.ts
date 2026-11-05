// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { EventSearchParams } from "@/data/types";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useRealUserLocation } from "@/hooks/useUserLocation";
import {
  activeFilterCount,
  changeFilters,
  DEFAULT_EVENT_FILTERS,
  EventFilters,
  toSearchParams,
} from "@/utils/event-search";
import { useMemo, useState } from "react";

export const SEARCH_DEBOUNCE_MS = 300;

export interface EventSearch {
  text: string;
  setText: (text: string) => void;
  filters: EventFilters;
  update: (patch: Partial<EventFilters>) => void;
  clearFilters: () => void;
  reset: () => void;
  hasLocation: boolean;
  activeCount: number;
  isActive: boolean;
  upcoming: EventSearchParams;
  past: EventSearchParams;
}

// showingPast: the list on screen ignores the date choice, so the count and empty state leave it out. keep-comment: what the flag changes
export function useEventSearch(showingPast: boolean): EventSearch {
  const [text, setText] = useState("");
  const [filters, setFilters] = useState<EventFilters>(DEFAULT_EVENT_FILTERS);
  const settledText = useDebouncedValue(text, SEARCH_DEBOUNCE_MS);
  const location = useRealUserLocation();

  // "Now" is read when the search changes, not per render, so the query key stays put. keep-comment: why the windows are memoised
  const { upcoming, past } = useMemo(() => {
    const now = new Date();
    return {
      upcoming: toSearchParams(settledText, filters, location, now),
      past: toSearchParams(settledText, filters, location, now, true),
    };
  }, [settledText, filters, location]);

  const activeCount = activeFilterCount(filters, showingPast);

  return {
    text,
    setText,
    filters,
    update: (patch) => setFilters((previous) => changeFilters(previous, patch)),
    clearFilters: () => setFilters(DEFAULT_EVENT_FILTERS),
    reset: () => {
      setText("");
      setFilters(DEFAULT_EVENT_FILTERS);
    },
    hasLocation: location !== null,
    activeCount,
    isActive: activeCount > 0 || text.trim().length > 0,
    upcoming,
    past,
  };
}
