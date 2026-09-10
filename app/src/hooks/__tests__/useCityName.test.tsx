// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { useCityName } from "@/hooks/useCityName";
import { flushUntil, settle } from "@/test/flush";
import { staleTimeOf } from "@/test/query";
import { renderWithProviders } from "@/test/render";
import { UseQueryResult } from "@tanstack/react-query";

const mockReverseGeocode = jest.fn();

jest.mock("expo-location", () => ({
  reverseGeocodeAsync: (...args: unknown[]) => mockReverseGeocode(...args),
}));

type Result = UseQueryResult<string | null>;

function renderHook(latitude?: number, longitude?: number) {
  let query!: Result;
  function Probe() {
    query = useCityName(latitude, longitude);
    return null;
  }
  const rendered = renderWithProviders(<Probe />);
  return {
    ...rendered,
    query: () => query,
    settled: () => flushUntil(() => query.isSuccess || query.isError),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("looking a position up", () => {
  it("reverse-geocodes the position it was given", async () => {
    mockReverseGeocode.mockResolvedValue([{ city: "Borås" }]);
    const harness = renderHook(57.72, 12.94);
    await harness.settled();

    expect(mockReverseGeocode).toHaveBeenCalledWith({ latitude: 57.72, longitude: 12.94 });
    expect(harness.query().data).toBe("Borås");
  });

  // Reverse geocoding needs foreground permission, so a stand-in coordinate would either
  // name the wrong town or throw.
  it("looks nothing up without a position", async () => {
    const harness = renderHook(undefined, undefined);
    await settle();

    expect(mockReverseGeocode).not.toHaveBeenCalled();
    expect(harness.query().fetchStatus).toBe("idle");
  });

  it("looks nothing up with only half a position", async () => {
    renderHook(57.72, undefined);
    await settle();

    expect(mockReverseGeocode).not.toHaveBeenCalled();
  });

  // Latitude 0 is a real coordinate, and a falsy check here would refuse to look it up.
  it("treats a zero coordinate as a position", async () => {
    mockReverseGeocode.mockResolvedValue([{ city: "Null Island" }]);
    const harness = renderHook(0, 0);
    await harness.settled();

    expect(mockReverseGeocode).toHaveBeenCalledWith({ latitude: 0, longitude: 0 });
  });
});

describe("choosing a name", () => {
  it("prefers the city", async () => {
    mockReverseGeocode.mockResolvedValue([{ city: "Borås", district: "Norrby", subregion: "Borås kommun" }]);
    const harness = renderHook(57.72, 12.94);
    await harness.settled();

    expect(harness.query().data).toBe("Borås");
  });

  it("falls back to the district", async () => {
    mockReverseGeocode.mockResolvedValue([{ city: null, district: "Norrby", subregion: "Borås kommun" }]);
    const harness = renderHook(57.72, 12.94);
    await harness.settled();

    expect(harness.query().data).toBe("Norrby");
  });

  it("falls back to the subregion", async () => {
    mockReverseGeocode.mockResolvedValue([{ city: null, district: null, subregion: "Borås kommun" }]);
    const harness = renderHook(57.72, 12.94);
    await harness.settled();

    expect(harness.query().data).toBe("Borås kommun");
  });

  // Expo does not always give the town its own field, so the second line of the formatted
  // address is the last resort — with the postcode stripped off it.
  it("digs the town out of the formatted address as a last resort", async () => {
    mockReverseGeocode.mockResolvedValue([{ formattedAddress: "Stora Vägen 1, 501 15 Borås, Sverige" }]);
    const harness = renderHook(57.72, 12.94);
    await harness.settled();

    expect(harness.query().data).toBe("Borås");
  });

  it("reports nothing when the address has no second line", async () => {
    mockReverseGeocode.mockResolvedValue([{ formattedAddress: "Sverige" }]);
    const harness = renderHook(57.72, 12.94);
    await harness.settled();

    expect(harness.query().data).toBeNull();
  });

  // Null rather than a fallback string, so the wording and its translation stay in the
  // component that renders the banner.
  it("reports nothing when the geocoder has nothing to offer", async () => {
    mockReverseGeocode.mockResolvedValue([]);
    const harness = renderHook(57.72, 12.94);
    await harness.settled();

    expect(harness.query().data).toBeNull();
  });

  it("takes the first result when the geocoder returns several", async () => {
    mockReverseGeocode.mockResolvedValue([{ city: "Borås" }, { city: "Göteborg" }]);
    const harness = renderHook(57.72, 12.94);
    await harness.settled();

    expect(harness.query().data).toBe("Borås");
  });
});

describe("caching", () => {
  it("keeps a name for ten minutes", async () => {
    mockReverseGeocode.mockResolvedValue([{ city: "Borås" }]);
    const harness = renderHook(57.72, 12.94);
    await harness.settled();

    expect(staleTimeOf(harness.queryClient, ["reverseGeocode", 57.72, 12.94])).toBe(1000 * 60 * 10);
  });

  // A missing permission fails every attempt identically; retrying only delays the banner
  // settling on its "location unknown" wording.
  it("does not retry a failure", async () => {
    mockReverseGeocode.mockRejectedValue(new Error("permission denied"));
    const harness = renderHook(57.72, 12.94);
    await harness.settled();

    expect(harness.query().isError).toBe(true);
    expect(mockReverseGeocode).toHaveBeenCalledTimes(1);
  });
});
