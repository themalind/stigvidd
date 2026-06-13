import { renderHook, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTrailCard } from "../useTrailCard";
import { getTrailCard } from "@/api/trails";
import { TrailCard } from "@/data/types";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

jest.mock("@/api/trails", () => ({
  getTrailCard: jest.fn(),
}));

const mockGetItem = AsyncStorage.getItem as jest.Mock;
const mockSetItem = AsyncStorage.setItem as jest.Mock;
const mockGetTrailCard = getTrailCard as jest.Mock;

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
