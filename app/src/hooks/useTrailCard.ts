import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
import { getTrailCard, getTrailCards } from "@/api/trails";
import { TrailCard } from "@/data/types";

const CACHE_PREFIX = "@stigvidd_trail_card";
const TTL_MS = 60 * 60 * 1000; // 1 hour — ratings and images can change, so don't cache indefinitely

interface CacheEntry {
  data: TrailCard;
  cachedAt: number;
}

// Removes expired trail card entries from AsyncStorage.
// Call once at app startup — runs entirely in the background.
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
        if (now - entry.cachedAt >= TTL_MS) toDelete.push(key);
      } catch {
        toDelete.push(key);
      }
    }

    if (toDelete.length > 0) await AsyncStorage.multiRemove(toDelete);
  } catch {
    // Non-fatal — cache prune is best-effort
  }
}

export function useTrailCard(identifier: string | null): { card: TrailCard | null; isLoading: boolean } {
  const [card, setCard] = useState<TrailCard | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!identifier) {
      setCard(null);
      setIsLoading(false);
      return;
    }

    // cancelled flag prevents setState calls after the effect has been cleaned up
    // (e.g. user taps a different trail before the first fetch completes).
    let cancelled = false;

    async function load() {
      const key = `${CACHE_PREFIX}_${identifier}`;

      try {
        const raw = await AsyncStorage.getItem(key);
        if (cancelled) return;

        if (raw) {
          const entry = JSON.parse(raw) as CacheEntry;
          // Serve from cache without a loading indicator if still within TTL.
          if (Date.now() - entry.cachedAt < TTL_MS) {
            setCard(entry.data);
            return;
          }
        }
      } catch {
        if (cancelled) return;
      }

      // Cache miss or stale — fetch from network and show loading indicator.
      setIsLoading(true);

      try {
        const data = await getTrailCard(identifier!);
        if (cancelled) return;
        setCard(data);
        await AsyncStorage.setItem(key, JSON.stringify({ data, cachedAt: Date.now() } satisfies CacheEntry));
      } catch {
        // Keep card as null on error
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [identifier]);

  return { card, isLoading };
}

// Batch variant for lists (e.g. the map cluster carousel): serves what it can
// from the same per-trail AsyncStorage cache, then fetches everything missing or
// stale in a SINGLE request instead of one network call per card. Returns a map
// keyed by identifier so each card can read its own entry.
export function useTrailCards(identifiers: string[]): {
  cards: Record<string, TrailCard>;
  isLoading: boolean;
  isError: boolean;
  notFound: Set<string>;
  refetch: () => void;
} {
  const [cards, setCards] = useState<Record<string, TrailCard>>({});
  const [isLoading, setIsLoading] = useState(false);
  // Only reflects a failure of the batched network fetch for missing cards —
  // entries already served from cache stay visible regardless.
  const [isError, setIsError] = useState(false);
  // Identifiers the server omitted from an otherwise successful response (e.g. a
  // trail unverified/removed after its map marker loaded). Without this they would
  // never resolve and the card would spin forever.
  const [notFound, setNotFound] = useState<Set<string>>(new Set());
  // Bumping this re-runs the effect to retry after a failure.
  const [reloadIndex, setReloadIndex] = useState(0);

  // Depend on the identifier set, not the (per-render) array reference.
  const key = identifiers.join(",");

  const refetch = useCallback(() => setReloadIndex((i) => i + 1), []);

  useEffect(() => {
    if (identifiers.length === 0) {
      setCards({});
      setIsLoading(false);
      setIsError(false);
      setNotFound(new Set());
      return;
    }

    let cancelled = false;

    async function load() {
      setIsError(false);
      setNotFound(new Set());
      const resolved: Record<string, TrailCard> = {};
      const missing: string[] = [];

      // 1. Serve fresh entries straight from the cache.
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
            }
          } catch {
            // fall through to refetch
          }
          missing.push(id);
        }),
      );

      if (cancelled) return;
      if (Object.keys(resolved).length > 0) setCards({ ...resolved });
      if (missing.length === 0) return;

      // 2. One batched request for everything not cached / stale.
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

        // Flag any requested id the server didn't return so the UI can show a
        // "no longer available" state instead of an endless spinner.
        const returned = new Set(fetched.map((c) => c.identifier));
        const absent = missing.filter((id) => !returned.has(id));
        if (absent.length > 0) setNotFound(new Set(absent));
      } catch {
        // Keep whatever resolved from cache, but flag the failure so the UI can
        // offer a retry instead of spinning forever on the missing cards.
        if (!cancelled) setIsError(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, reloadIndex]);

  return { cards, isLoading, isError, notFound, refetch };
}
