import { HikeAccessors, useHikeFilters } from "@/hooks/hike/useHikeFilters";
import { act, renderHook } from "@testing-library/react-native";

// The two shapes the hook has to serve, with the field names that differ in the real
// API types: Hike uses name/createdAt, SharedHike uses hikeName/sharedAt and adds a sharer.
interface TestHike {
  identifier: string;
  name: string;
  hikeLength: number;
  duration: number;
  createdAt: string;
}

interface TestSharedHike {
  hikeIdentifier: string;
  hikeName: string;
  hikeLength: number;
  duration: number;
  sharedAt: string;
  sharedByName: string;
}

const MINUTE = 60_000;

// Declared at module level, as the screens are meant to: a fresh object literal on every
// render would give the hook a new dependency each time and defeat its memoisation.
const hikeAccessors: HikeAccessors<TestHike> = {
  name: (h) => h.name,
  length: (h) => h.hikeLength,
  duration: (h) => h.duration,
  date: (h) => h.createdAt,
};

const sharedAccessors: HikeAccessors<TestSharedHike> = {
  name: (h) => h.hikeName,
  length: (h) => h.hikeLength,
  duration: (h) => h.duration,
  date: (h) => h.sharedAt,
  sharedBy: (h) => h.sharedByName,
};

const HIKES: TestHike[] = [
  { identifier: "1", name: "Kvällsrundan", hikeLength: 3.2, duration: 45 * MINUTE, createdAt: "2026-03-10T18:00:00Z" },
  {
    identifier: "2",
    name: "Bokskogsrundan",
    hikeLength: 12,
    duration: 180 * MINUTE,
    createdAt: "2026-01-05T09:30:00Z",
  },
  {
    identifier: "3",
    name: "Ängspromenaden",
    hikeLength: 7.5,
    duration: 90 * MINUTE,
    createdAt: "2026-05-20T14:15:00Z",
  },
];

const SHARED: TestSharedHike[] = [
  {
    hikeIdentifier: "a",
    hikeName: "Sjöstigen",
    hikeLength: 5,
    duration: 60 * MINUTE,
    sharedAt: "2026-02-01T10:00:00Z",
    sharedByName: "Anna",
  },
  {
    hikeIdentifier: "b",
    hikeName: "Bergsleden",
    hikeLength: 9,
    duration: 120 * MINUTE,
    sharedAt: "2026-04-01T10:00:00Z",
    sharedByName: "Bosse",
  },
  {
    hikeIdentifier: "c",
    hikeName: "Åspromenaden",
    hikeLength: 2,
    duration: 30 * MINUTE,
    sharedAt: "2026-06-01T10:00:00Z",
    sharedByName: "Anna",
  },
];

const hikeNames = (hikes: TestHike[]) => hikes.map((h) => h.name);
const sharedNames = (hikes: TestSharedHike[]) => hikes.map((h) => h.hikeName);

describe("useHikeFilters", () => {
  describe("defaults", () => {
    it("sorts by name ascending, matching the order the backend delivers", () => {
      const { result } = renderHook(() => useHikeFilters(HIKES, hikeAccessors));

      expect(result.current.sortBy).toBe("name-asc");
      expect(hikeNames(result.current.filteredHikes)).toEqual([
        "Bokskogsrundan",
        "Kvällsrundan",
        "Ängspromenaden",
      ]);
    });

    it("returns an empty list rather than throwing when hikes are undefined", () => {
      const { result } = renderHook(() => useHikeFilters(undefined, hikeAccessors));

      expect(result.current.filteredHikes).toEqual([]);
      expect(result.current.sharedByNames).toEqual([]);
      expect(result.current.totalCount).toBe(0);
      expect(result.current.filteredCount).toBe(0);
    });

    it("reports counts before and after filtering", () => {
      const { result } = renderHook(() => useHikeFilters(HIKES, hikeAccessors));

      act(() => result.current.setSearchQuery("rundan"));

      expect(result.current.totalCount).toBe(3);
      expect(result.current.filteredCount).toBe(2);
    });

    it("returns the original objects, not copies", () => {
      const { result } = renderHook(() => useHikeFilters(HIKES, hikeAccessors));

      act(() => result.current.setSearchQuery("bokskog"));

      // The screens pass the result straight back into HikeDetails, so identity matters.
      expect(result.current.filteredHikes[0]).toBe(HIKES[1]);
    });
  });

  describe("sharedByNames", () => {
    it("lists unique sharer names in Swedish order", () => {
      const { result } = renderHook(() => useHikeFilters(SHARED, sharedAccessors));

      expect(result.current.sharedByNames).toEqual(["Anna", "Bosse"]);
    });

    it("is empty when the accessor is absent", () => {
      const { result } = renderHook(() => useHikeFilters(HIKES, hikeAccessors));

      expect(result.current.sharedByNames).toEqual([]);
    });
  });

  describe("search", () => {
    it("matches on name, case-insensitively", () => {
      const { result } = renderHook(() => useHikeFilters(HIKES, hikeAccessors));

      act(() => result.current.setSearchQuery("KVÄLLS"));

      expect(hikeNames(result.current.filteredHikes)).toEqual(["Kvällsrundan"]);
    });

    it("matches on the sharer's name when that accessor exists", () => {
      const { result } = renderHook(() => useHikeFilters(SHARED, sharedAccessors));

      act(() => result.current.setSearchQuery("anna"));

      expect(sharedNames(result.current.filteredHikes)).toEqual(["Sjöstigen", "Åspromenaden"]);
    });

    it("ignores surrounding whitespace", () => {
      const { result } = renderHook(() => useHikeFilters(HIKES, hikeAccessors));

      act(() => result.current.setSearchQuery("   bokskog   "));

      expect(hikeNames(result.current.filteredHikes)).toEqual(["Bokskogsrundan"]);
    });

    it("treats a whitespace-only query as no query at all", () => {
      const { result } = renderHook(() => useHikeFilters(HIKES, hikeAccessors));

      act(() => result.current.setSearchQuery("   "));

      expect(result.current.filteredHikes).toHaveLength(3);
    });

    it("returns nothing when the query matches no hike", () => {
      const { result } = renderHook(() => useHikeFilters(HIKES, hikeAccessors));

      act(() => result.current.setSearchQuery("finns inte"));

      expect(result.current.filteredHikes).toEqual([]);
    });
  });

  describe("shared-by filter", () => {
    it("keeps only hikes shared by the chosen person", () => {
      const { result } = renderHook(() => useHikeFilters(SHARED, sharedAccessors));

      act(() => result.current.updateFilter("sharedBy", "Anna"));

      expect(sharedNames(result.current.filteredHikes)).toEqual(["Sjöstigen", "Åspromenaden"]);
    });

    it("is a no-op on a list without a sharer accessor", () => {
      const { result } = renderHook(() => useHikeFilters(HIKES, hikeAccessors));

      act(() => result.current.updateFilter("sharedBy", "Anna"));

      expect(result.current.filteredHikes).toHaveLength(3);
    });
  });

  describe("range filters", () => {
    it("applies a length range inclusively at both ends", () => {
      const { result } = renderHook(() => useHikeFilters(HIKES, hikeAccessors));

      act(() => result.current.updateRangeFilter("length", 3.2, 7.5));

      // Both boundary values survive; the 12 km hike does not.
      expect(result.current.filteredHikes.map((h) => h.hikeLength).sort((a, b) => a - b)).toEqual([3.2, 7.5]);
    });

    it("applies a duration range given in minutes against a value stored in milliseconds", () => {
      const { result } = renderHook(() => useHikeFilters(HIKES, hikeAccessors));

      act(() => result.current.updateRangeFilter("duration", 45, 90));

      expect(result.current.filteredHikes.map((h) => h.duration / MINUTE).sort((a, b) => a - b)).toEqual([45, 90]);
    });

    it("excludes durations just outside the range", () => {
      const { result } = renderHook(() => useHikeFilters(HIKES, hikeAccessors));

      act(() => result.current.updateRangeFilter("duration", 46, 89));

      expect(result.current.filteredHikes).toEqual([]);
    });

    it("keeps the two ranges independent of each other", () => {
      const { result } = renderHook(() => useHikeFilters(HIKES, hikeAccessors));

      act(() => result.current.updateRangeFilter("length", 0, 50));
      act(() => result.current.updateRangeFilter("duration", 0, 60));

      expect(result.current.filters).toEqual({
        minLength: 0,
        maxLength: 50,
        minDuration: 0,
        maxDuration: 60,
      });
      expect(hikeNames(result.current.filteredHikes)).toEqual(["Kvällsrundan"]);
    });

    it("combines a range with the shared-by filter", () => {
      const { result } = renderHook(() => useHikeFilters(SHARED, sharedAccessors));

      act(() => result.current.updateFilter("sharedBy", "Anna"));
      act(() => result.current.updateRangeFilter("length", 4, 10));

      expect(sharedNames(result.current.filteredHikes)).toEqual(["Sjöstigen"]);
    });
  });

  describe("clearFilters", () => {
    it("resets filters, search and sort order to the defaults", () => {
      const { result } = renderHook(() => useHikeFilters(SHARED, sharedAccessors));

      act(() => result.current.updateFilter("sharedBy", "Anna"));
      act(() => result.current.updateRangeFilter("duration", 0, 45));
      act(() => result.current.setSearchQuery("sjö"));
      act(() => result.current.setSortBy("duration-desc"));

      act(() => result.current.clearFilters());

      expect(result.current.filters).toEqual({});
      expect(result.current.searchQuery).toBe("");
      expect(result.current.sortBy).toBe("name-asc");
      expect(result.current.filteredHikes).toHaveLength(3);
    });
  });

  describe("sorting", () => {
    it("sorts by name descending", () => {
      const { result } = renderHook(() => useHikeFilters(HIKES, hikeAccessors));

      act(() => result.current.setSortBy("name-desc"));

      expect(hikeNames(result.current.filteredHikes)).toEqual([
        "Ängspromenaden",
        "Kvällsrundan",
        "Bokskogsrundan",
      ]);
    });

    it("orders å, ä and ö last, as Swedish collation requires", () => {
      const { result } = renderHook(() => useHikeFilters(SHARED, sharedAccessors));

      // Bergsleden, Sjöstigen, then Åspromenaden — Å sorts after Z in Swedish.
      expect(sharedNames(result.current.filteredHikes)).toEqual(["Bergsleden", "Sjöstigen", "Åspromenaden"]);
    });

    it("sorts by date in both directions", () => {
      const { result } = renderHook(() => useHikeFilters(HIKES, hikeAccessors));

      act(() => result.current.setSortBy("date-desc"));
      expect(hikeNames(result.current.filteredHikes)).toEqual([
        "Ängspromenaden",
        "Kvällsrundan",
        "Bokskogsrundan",
      ]);

      act(() => result.current.setSortBy("date-asc"));
      expect(hikeNames(result.current.filteredHikes)).toEqual([
        "Bokskogsrundan",
        "Kvällsrundan",
        "Ängspromenaden",
      ]);
    });

    it("sorts shared hikes by the date they were shared", () => {
      const { result } = renderHook(() => useHikeFilters(SHARED, sharedAccessors));

      act(() => result.current.setSortBy("date-desc"));

      expect(sharedNames(result.current.filteredHikes)).toEqual(["Åspromenaden", "Bergsleden", "Sjöstigen"]);
    });

    it("sorts by length in both directions", () => {
      const { result } = renderHook(() => useHikeFilters(HIKES, hikeAccessors));

      act(() => result.current.setSortBy("length-asc"));
      expect(result.current.filteredHikes.map((h) => h.hikeLength)).toEqual([3.2, 7.5, 12]);

      act(() => result.current.setSortBy("length-desc"));
      expect(result.current.filteredHikes.map((h) => h.hikeLength)).toEqual([12, 7.5, 3.2]);
    });

    it("sorts by duration in both directions", () => {
      const { result } = renderHook(() => useHikeFilters(HIKES, hikeAccessors));

      act(() => result.current.setSortBy("duration-asc"));
      expect(result.current.filteredHikes.map((h) => h.duration / MINUTE)).toEqual([45, 90, 180]);

      act(() => result.current.setSortBy("duration-desc"));
      expect(result.current.filteredHikes.map((h) => h.duration / MINUTE)).toEqual([180, 90, 45]);
    });

    it("sorts what is left after filtering, not the whole list", () => {
      const { result } = renderHook(() => useHikeFilters(HIKES, hikeAccessors));

      act(() => result.current.updateRangeFilter("length", 0, 8));
      act(() => result.current.setSortBy("length-desc"));

      expect(hikeNames(result.current.filteredHikes)).toEqual(["Ängspromenaden", "Kvällsrundan"]);
    });
  });
});
