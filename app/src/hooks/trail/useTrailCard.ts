// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
import { getTrailCard, getTrailCards } from "@/api/trails";
import { TrailCard } from "@/data/types";

const CACHE_PREFIX = "@stigvidd_trail_card";
const TTL_MS = 60 * 60 * 1000; // 1 hour — ratings and images can change, so don't cache indefinitely
const OFFLINE_FALLBACK_MS = 30 * 24 * 60 * 60 * 1000; // expired entries are still served when the fetch fails

interface CacheEntry {
  data: TrailCard;
  cachedAt: number;
}

export async function pruneTrailCardCache(): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const cardKeys = allKeys.filter((k) => k.startsWith(CACHE_PREFIX));
    const now = Date.now();
    const toDelete: string[] = [];

    for (const key of cardKeys) {
      try {
        const raw = await AsyncStorage.getItem(key);
        if (!raw) {
          toDelete.push(key);
          continue;
        }
        const entry = JSON.parse(raw) as CacheEntry;
        if (now - entry.cachedAt >= OFFLINE_FALLBACK_MS) toDelete.push(key);
      } catch {
        toDelete.push(key);
      }
    }

    if (toDelete.length > 0) await AsyncStorage.multiRemove(toDelete);
  } catch {
    // keep-comment: pruning must never block app start
  }
}

export function useTrailCard(identifier: string | null): { card: TrailCard | null; isLoading: boolean } {
  const [card, setCard] = useState<TrailCard | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!identifier && (card !== null || isLoading)) {
    setCard(null);
    setIsLoading(false);
  }

  useEffect(() => {
    if (!identifier) return;

    let cancelled = false;

    async function load(id: string) {
      const key = `${CACHE_PREFIX}_${id}`;
      let expired: TrailCard | null = null;

      try {
        const raw = await AsyncStorage.getItem(key);
        if (cancelled) return;

        if (raw) {
          const entry = JSON.parse(raw) as CacheEntry;
          if (Date.now() - entry.cachedAt < TTL_MS) {
            setCard(entry.data);
            return;
          }
          expired = entry.data;
        }
      } catch {
        if (cancelled) return;
      }

      setIsLoading(true);

      try {
        const data = await getTrailCard(id);
        if (cancelled) return;
        setCard(data);
        await AsyncStorage.setItem(key, JSON.stringify({ data, cachedAt: Date.now() } satisfies CacheEntry));
      } catch {
        if (!cancelled && expired) setCard(expired);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load(identifier);
    return () => {
      cancelled = true;
    };
  }, [identifier]);

  return { card, isLoading };
}

// keep-comment: one request for every card the shared cache lacks, not one per card
export function useTrailCards(identifiers: string[]): {
  cards: Record<string, TrailCard>;
  isLoading: boolean;
  isError: boolean;
  notFound: Set<string>;
  refetch: () => void;
} {
  const [cards, setCards] = useState<Record<string, TrailCard>>({});
  const [isLoading, setIsLoading] = useState(false);
  // keep-comment: cached cards stay visible when the fetch fails
  const [isError, setIsError] = useState(false);
  // keep-comment: ids a successful response left out (removed trails), or their card would spin forever
  const [notFound, setNotFound] = useState<Set<string>>(new Set());
  const [reloadIndex, setReloadIndex] = useState(0);

  // keep-comment: the set, not the array, which is new each render
  const key = identifiers.join(",");

  const refetch = useCallback(() => setReloadIndex((i) => i + 1), []);

  if (identifiers.length === 0 && (Object.keys(cards).length > 0 || isLoading || isError || notFound.size > 0)) {
    setCards({});
    setIsLoading(false);
    setIsError(false);
    setNotFound(new Set());
  }

  useEffect(() => {
    if (identifiers.length === 0) return;

    let cancelled = false;

    async function load() {
      setIsError(false);
      setNotFound(new Set());
      const resolved: Record<string, TrailCard> = {};
      const expired: Record<string, TrailCard> = {};
      const missing: string[] = [];

      await Promise.all(
        identifiers.map(async (id) => {
          try {
            const raw = await AsyncStorage.getItem(`${CACHE_PREFIX}_${id}`);
            if (raw) {
              const entry = JSON.parse(raw) as CacheEntry;
              if (Date.now() - entry.cachedAt < TTL_MS) {
                resolved[id] = entry.data;
                return;
              }
              expired[id] = entry.data;
            }
          } catch {
            // keep-comment: an unreadable entry is refetched
          }
          missing.push(id);
        }),
      );

      if (cancelled) return;
      if (Object.keys(resolved).length > 0) setCards({ ...resolved });
      if (missing.length === 0) return;

      setIsLoading(true);
      try {
        const fetched = await getTrailCards(missing);
        if (cancelled) return;
        for (const fetchedCard of fetched) {
          resolved[fetchedCard.identifier] = fetchedCard;
          AsyncStorage.setItem(
            `${CACHE_PREFIX}_${fetchedCard.identifier}`,
            JSON.stringify({ data: fetchedCard, cachedAt: Date.now() } satisfies CacheEntry),
          ).catch(() => {});
        }
        setCards({ ...resolved });

        const returned = new Set(fetched.map((c) => c.identifier));
        const absent = missing.filter((id) => !returned.has(id));
        if (absent.length > 0) setNotFound(new Set(absent));
      } catch {
        if (cancelled) return;
        if (Object.keys(expired).length > 0) setCards({ ...expired, ...resolved });
        setIsError(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, reloadIndex]);

  return { cards, isLoading, isError, notFound, refetch };
}
