import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { getTrailCard } from "@/api/trails";
import { TrailCard } from "@/data/types";

const CACHE_PREFIX = "@stigvidd_trail_card";
const TTL_MS = 60 * 60 * 1000; // 1 hour — ratings and images can change, so don't cache indefinitely

interface CacheEntry {
  data: TrailCard;
  cachedAt: number;
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
