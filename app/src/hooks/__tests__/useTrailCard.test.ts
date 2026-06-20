import { act, renderHook, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { pruneTrailCardCache, useTrailCard, useTrailCards } from "../useTrailCard";
import { getTrailCard, getTrailCards } from "@/api/trails";
import { TrailCard } from "@/data/types";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  // setItem/multiRemove return resolved promises to match the real API — the
  // batch hook calls setItem(...).catch(...) without awaiting, so a non-thenable
  // mock would throw.
  setItem: jest.fn(() => Promise.resolve()),
  getAllKeys: jest.fn(),
  multiRemove: jest.fn(() => Promise.resolve()),
}));

jest.mock("@/api/trails", () => ({
  getTrailCard: jest.fn(),
  getTrailCards: jest.fn(),
}));

const mockGetItem = AsyncStorage.getItem as jest.Mock;
const mockSetItem = AsyncStorage.setItem as jest.Mock;
const mockGetAllKeys = AsyncStorage.getAllKeys as jest.Mock;
const mockMultiRemove = AsyncStorage.multiRemove as jest.Mock;
const mockGetTrailCard = getTrailCard as jest.Mock;
const mockGetTrailCards = getTrailCards as jest.Mock;

const CACHE_PREFIX = "@stigvidd_trail_card";
const HOUR_MS = 60 * 60 * 1000;

// Builds a getItem implementation backed by a key→entry map, so each trail's
// cache entry can be controlled independently across a batched read.
function cacheBackedGetItem(entries: Record<string, { data: TrailCard; cachedAt: number }>) {
  return (key: string) => {
    const id = key.replace(`${CACHE_PREFIX}_`, "");
    const entry = entries[id];
    return Promise.resolve(entry ? JSON.stringify(entry) : null);
  };
}

function makeCard(identifier: string): TrailCard {
  return {
    identifier,
    name: `Trail ${identifier}`,
    trailLength: 5.0,
    classification: 2,
    isAccessible: false,
    averageRating: 4.2,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("useTrailCard", () => {
  it("returns null card and no loading when identifier is null", () => {
    const { result } = renderHook(() => useTrailCard(null));
    expect(result.current.card).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it("returns card from cache when entry is within TTL, without network fetch", async () => {
    const card = makeCard("trail-1");
    mockGetItem.mockResolvedValue(JSON.stringify({ data: card, cachedAt: Date.now() }));

    const { result } = renderHook(() => useTrailCard("trail-1"));

    await waitFor(() => {
      expect(result.current.card).toEqual(card);
    });
    expect(result.current.isLoading).toBe(false);
    expect(mockGetTrailCard).not.toHaveBeenCalled();
  });

  it("fetches from network on cache miss and stores result in AsyncStorage", async () => {
    mockGetItem.mockResolvedValue(null);
    const card = makeCard("trail-1");
    mockGetTrailCard.mockResolvedValue(card);

    const { result } = renderHook(() => useTrailCard("trail-1"));

    await waitFor(() => {
      expect(result.current.card).toEqual(card);
    });
    expect(result.current.isLoading).toBe(false);
    expect(mockGetTrailCard).toHaveBeenCalledWith("trail-1");
    expect(mockSetItem).toHaveBeenCalledWith(
      "@stigvidd_trail_card_trail-1",
      expect.stringContaining('"identifier":"trail-1"'),
    );
  });

  it("refetches from network when cached entry is older than 1 hour", async () => {
    const oldCard = makeCard("trail-1");
    const newCard = { ...oldCard, name: "Updated Trail Name" };
    // 61 minutes ago — beyond the 1-hour TTL
    const staleEntry = { data: oldCard, cachedAt: Date.now() - 61 * 60 * 1000 };
    mockGetItem.mockResolvedValue(JSON.stringify(staleEntry));
    mockGetTrailCard.mockResolvedValue(newCard);

    const { result } = renderHook(() => useTrailCard("trail-1"));

    await waitFor(() => {
      expect(result.current.card).toEqual(newCard);
    });
    expect(mockGetTrailCard).toHaveBeenCalledWith("trail-1");
  });

  it("shows loading indicator while network fetch is in flight", async () => {
    let resolveCard!: (c: TrailCard) => void;
    const cardPromise = new Promise<TrailCard>((resolve) => {
      resolveCard = resolve;
    });
    mockGetItem.mockResolvedValue(null);
    mockGetTrailCard.mockReturnValue(cardPromise);

    const { result } = renderHook(() => useTrailCard("trail-1"));

    // After AsyncStorage.getItem resolves with null, the hook sets isLoading=true
    await waitFor(() => expect(result.current.isLoading).toBe(true));

    resolveCard(makeCard("trail-1"));

    await waitFor(() => {
      expect(result.current.card).toEqual(makeCard("trail-1"));
      expect(result.current.isLoading).toBe(false);
    });
  });

  it("loads the new card when identifier changes", async () => {
    const card1 = makeCard("trail-1");
    const card2 = makeCard("trail-2");
    mockGetItem.mockResolvedValue(null);
    mockGetTrailCard.mockResolvedValueOnce(card1).mockResolvedValueOnce(card2);

    const { result, rerender } = renderHook(({ id }: { id: string | null }) => useTrailCard(id), {
      initialProps: { id: "trail-1" as string | null },
    });

    await waitFor(() => expect(result.current.card).toEqual(card1));

    rerender({ id: "trail-2" });

    await waitFor(() => expect(result.current.card).toEqual(card2));
    expect(mockGetTrailCard).toHaveBeenCalledWith("trail-2");
  });

  it("resets card to null when identifier changes to null", async () => {
    const card = makeCard("trail-1");
    mockGetItem.mockResolvedValue(JSON.stringify({ data: card, cachedAt: Date.now() }));

    const { result, rerender } = renderHook(({ id }: { id: string | null }) => useTrailCard(id), {
      initialProps: { id: "trail-1" as string | null },
    });

    await waitFor(() => expect(result.current.card).toEqual(card));

    rerender({ id: null });

    await waitFor(() => expect(result.current.card).toBeNull());
    expect(result.current.isLoading).toBe(false);
  });

  it("returns null card and clears loading when network fetch throws", async () => {
    mockGetItem.mockResolvedValue(null);
    mockGetTrailCard.mockRejectedValue(new Error("network error"));

    const { result } = renderHook(() => useTrailCard("trail-1"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.card).toBeNull();
  });

  it("falls through to a network fetch when AsyncStorage.getItem throws", async () => {
    mockGetItem.mockRejectedValue(new Error("storage unavailable"));
    const card = makeCard("trail-1");
    mockGetTrailCard.mockResolvedValue(card);

    const { result } = renderHook(() => useTrailCard("trail-1"));

    await waitFor(() => expect(result.current.card).toEqual(card));
    expect(mockGetTrailCard).toHaveBeenCalledWith("trail-1");
    expect(result.current.isLoading).toBe(false);
  });

  it("treats a cache entry that is exactly 1 hour old as stale and refetches", async () => {
    const staleCard = makeCard("trail-1");
    const freshCard = { ...staleCard, name: "Refetched Trail" };
    // Exactly at TTL boundary: Date.now() - 3600000 ms — condition is < TTL_MS so this is stale
    const atBoundary = { data: staleCard, cachedAt: Date.now() - 60 * 60 * 1000 };
    mockGetItem.mockResolvedValue(JSON.stringify(atBoundary));
    mockGetTrailCard.mockResolvedValue(freshCard);

    const { result } = renderHook(() => useTrailCard("trail-1"));

    await waitFor(() => expect(result.current.card).toEqual(freshCard));
    expect(mockGetTrailCard).toHaveBeenCalledWith("trail-1");
  });
});

describe("useTrailCards", () => {
  it("returns empty cards for an empty identifier list and never hits the network", async () => {
    const { result } = renderHook(() => useTrailCards([]));

    expect(result.current.cards).toEqual({});
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(false);
    expect(mockGetTrailCards).not.toHaveBeenCalled();
  });

  it("serves every card from cache when all entries are fresh, without a batch fetch", async () => {
    const card1 = makeCard("t1");
    const card2 = makeCard("t2");
    mockGetItem.mockImplementation(
      cacheBackedGetItem({
        t1: { data: card1, cachedAt: Date.now() },
        t2: { data: card2, cachedAt: Date.now() },
      }),
    );

    const { result } = renderHook(() => useTrailCards(["t1", "t2"]));

    await waitFor(() => expect(result.current.cards).toEqual({ t1: card1, t2: card2 }));
    expect(mockGetTrailCards).not.toHaveBeenCalled();
    expect(result.current.isError).toBe(false);
  });

  it("fetches only the missing/stale cards in a single batched request and merges them", async () => {
    const cachedCard = makeCard("t1");
    const fetchedStale = makeCard("t2");
    const fetchedMissing = makeCard("t3");
    mockGetItem.mockImplementation(
      cacheBackedGetItem({
        t1: { data: cachedCard, cachedAt: Date.now() }, // fresh → from cache
        t2: { data: fetchedStale, cachedAt: Date.now() - 2 * HOUR_MS }, // stale → refetch
        // t3 absent → missing → refetch
      }),
    );
    mockGetTrailCards.mockResolvedValue([fetchedStale, fetchedMissing]);

    const { result } = renderHook(() => useTrailCards(["t1", "t2", "t3"]));

    await waitFor(() =>
      expect(result.current.cards).toEqual({ t1: cachedCard, t2: fetchedStale, t3: fetchedMissing }),
    );
    // Exactly one batched call, for only the missing/stale ids.
    expect(mockGetTrailCards).toHaveBeenCalledTimes(1);
    expect(mockGetTrailCards).toHaveBeenCalledWith(["t2", "t3"]);
  });

  it("flags an error and keeps cached cards when the batch fetch fails", async () => {
    const cachedCard = makeCard("t1");
    mockGetItem.mockImplementation(
      cacheBackedGetItem({
        t1: { data: cachedCard, cachedAt: Date.now() },
        // t2 missing
      }),
    );
    mockGetTrailCards.mockRejectedValue(new Error("network error"));

    const { result } = renderHook(() => useTrailCards(["t1", "t2"]));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.cards).toEqual({ t1: cachedCard });
    expect(result.current.cards.t2).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
  });

  it("retries the batch fetch and clears the error when refetch is called", async () => {
    const fetched = makeCard("t1");
    mockGetItem.mockResolvedValue(null); // nothing cached
    mockGetTrailCards.mockRejectedValueOnce(new Error("network error")).mockResolvedValueOnce([fetched]);

    const { result } = renderHook(() => useTrailCards(["t1"]));

    await waitFor(() => expect(result.current.isError).toBe(true));

    await act(async () => {
      result.current.refetch();
    });

    await waitFor(() => expect(result.current.cards).toEqual({ t1: fetched }));
    expect(result.current.isError).toBe(false);
    expect(mockGetTrailCards).toHaveBeenCalledTimes(2);
  });
});

describe("pruneTrailCardCache", () => {
  it("removes only entries older than the TTL and keeps fresh ones", async () => {
    mockGetAllKeys.mockResolvedValue([`${CACHE_PREFIX}_fresh`, `${CACHE_PREFIX}_stale`, "unrelated_key"]);
    mockGetItem.mockImplementation((key: string) => {
      if (key === `${CACHE_PREFIX}_fresh`) {
        return Promise.resolve(JSON.stringify({ data: makeCard("fresh"), cachedAt: Date.now() }));
      }
      if (key === `${CACHE_PREFIX}_stale`) {
        return Promise.resolve(JSON.stringify({ data: makeCard("stale"), cachedAt: Date.now() - 2 * HOUR_MS }));
      }
      return Promise.resolve(null);
    });

    await pruneTrailCardCache();

    // Only the stale card key is removed; the unrelated key is never inspected.
    expect(mockMultiRemove).toHaveBeenCalledWith([`${CACHE_PREFIX}_stale`]);
  });

  it("removes corrupt and empty entries", async () => {
    mockGetAllKeys.mockResolvedValue([`${CACHE_PREFIX}_corrupt`, `${CACHE_PREFIX}_empty`]);
    mockGetItem.mockImplementation((key: string) => {
      if (key === `${CACHE_PREFIX}_corrupt`) return Promise.resolve("not-json");
      return Promise.resolve(null); // empty
    });

    await pruneTrailCardCache();

    expect(mockMultiRemove).toHaveBeenCalledWith(
      expect.arrayContaining([`${CACHE_PREFIX}_corrupt`, `${CACHE_PREFIX}_empty`]),
    );
  });

  it("does not call multiRemove when there is nothing to prune", async () => {
    mockGetAllKeys.mockResolvedValue([`${CACHE_PREFIX}_fresh`]);
    mockGetItem.mockResolvedValue(JSON.stringify({ data: makeCard("fresh"), cachedAt: Date.now() }));

    await pruneTrailCardCache();

    expect(mockMultiRemove).not.toHaveBeenCalled();
  });

  it("is best-effort and swallows storage errors", async () => {
    mockGetAllKeys.mockRejectedValue(new Error("storage unavailable"));

    await expect(pruneTrailCardCache()).resolves.toBeUndefined();
    expect(mockMultiRemove).not.toHaveBeenCalled();
  });
});
