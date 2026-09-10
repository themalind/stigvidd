// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { START_COORDINATE_BORAS } from "@/constants/constants";
import { useWeather, WeatherData } from "@/hooks/useWeather";
import { flushUntil, settle } from "@/test/flush";
import { staleTimeOf } from "@/test/query";
import { renderWithProviders } from "@/test/render";
import { UseQueryResult } from "@tanstack/react-query";

type Result = UseQueryResult<WeatherData | null>;

function renderHook(latitude?: number, longitude?: number) {
  let query!: Result;
  function Probe() {
    query = useWeather(latitude, longitude);
    return null;
  }
  const rendered = renderWithProviders(<Probe />);
  return {
    ...rendered,
    query: () => query,
    settled: () => flushUntil(() => query.isSuccess || query.isError),
  };
}

function forecast(temperature: number | null, symbol?: number) {
  return {
    timeSeries: [{ data: { air_temperature: temperature, symbol_code: symbol } }],
  };
}

function respond(...responses: { status?: number; ok?: boolean; body?: unknown; statusText?: string }[]) {
  const fetchMock = jest.fn();
  for (const { status = 200, ok = status < 400, body = {}, statusText = "" } of responses) {
    fetchMock.mockResolvedValueOnce({
      status,
      ok,
      statusText,
      json: jest.fn().mockResolvedValue(body),
    } as unknown as Response);
  }
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("asking SMHI", () => {
  it("asks for the point forecast at the given position", async () => {
    const fetchMock = respond({ body: forecast(7, 3) });
    const harness = renderHook(57.7209612, 12.9381634);
    await harness.settled();

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://opendata-download-metfcst.smhi.se/api/category/snow1g/version/1/geotype/point/lon/12.9382/lat/57.7210/data.json",
    );
  });

  // SMHI's grid does not cover the whole planet, and a 404 is how it says "outside my area".
  it("falls back to Borås when the position is outside the forecast area", async () => {
    const fetchMock = respond({ status: 404, ok: false }, { body: forecast(2) });
    const harness = renderHook(0, 0);
    await harness.settled();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toContain(
      `lon/${START_COORDINATE_BORAS.longitude.toFixed(4)}/lat/${START_COORDINATE_BORAS.latitude.toFixed(4)}`,
    );
    expect(harness.query().data).toEqual({ temperature: 2, symbolCode: 6 });
  });

  it("does not fall back when the first answer is usable", async () => {
    const fetchMock = respond({ body: forecast(7, 3) });
    const harness = renderHook(57.72, 12.94);
    await harness.settled();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // Anything but a 404 is a real failure; the banner shows nothing rather than a stale guess.
  it("fails on a server error rather than falling back", async () => {
    respond({ status: 500, ok: false, statusText: "Internal Server Error" });
    const harness = renderHook(57.72, 12.94);
    await harness.settled();

    expect(harness.query().isError).toBe(true);
    expect(harness.query().error?.message).toBe("SMHI 500: Internal Server Error");
  });

  it("asks for nothing without a position", async () => {
    const fetchMock = respond({ body: forecast(7) });
    const harness = renderHook(undefined, undefined);
    await settle();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(harness.query().fetchStatus).toBe("idle");
  });

  it("asks for nothing with only half a position", async () => {
    const fetchMock = respond({ body: forecast(7) });
    const harness = renderHook(57.72, undefined);
    await settle();

    expect(fetchMock).not.toHaveBeenCalled();
    // Not merely a failed fetch: the query must never start.
    expect(harness.query().fetchStatus).toBe("idle");
  });

  // Latitude 0 is a real coordinate, and a falsy check here would refuse to look it up.
  it("treats a zero coordinate as a position", async () => {
    const fetchMock = respond({ body: forecast(7) });
    const harness = renderHook(0, 0);
    await harness.settled();

    expect(fetchMock).toHaveBeenCalled();
  });
});

describe("reading the forecast", () => {
  it("rounds the temperature to whole degrees", async () => {
    respond({ body: forecast(7.4) });
    const harness = renderHook(57.72, 12.94);
    await harness.settled();

    expect(harness.query().data?.temperature).toBe(7);
  });

  it("rounds a negative temperature the same way", async () => {
    respond({ body: forecast(-3.5) });
    const harness = renderHook(57.72, 12.94);
    await harness.settled();

    expect(harness.query().data?.temperature).toBe(-3);
  });

  it("takes the first entry, which is the current hour", async () => {
    respond({
      body: { timeSeries: [{ data: { air_temperature: 7, symbol_code: 1 } }, { data: { air_temperature: 20 } }] },
    });
    const harness = renderHook(57.72, 12.94);
    await harness.settled();

    expect(harness.query().data).toEqual({ temperature: 7, symbolCode: 1 });
  });

  // Overcast is the least wrong thing to draw when the symbol is missing.
  it("shows overcast when SMHI sends no symbol", async () => {
    respond({ body: forecast(7) });
    const harness = renderHook(57.72, 12.94);
    await harness.settled();

    expect(harness.query().data?.symbolCode).toBe(6);
  });

  // A temperature is the whole point of the banner; without one there is nothing to show.
  it("reports nothing when the entry has no temperature", async () => {
    respond({ body: forecast(null, 3) });
    const harness = renderHook(57.72, 12.94);
    await harness.settled();

    expect(harness.query().data).toBeNull();
  });

  it("reports nothing when the series is empty", async () => {
    respond({ body: { timeSeries: [] } }, { body: { timeSeries: [] } });
    const harness = renderHook(57.72, 12.94);
    await harness.settled();

    expect(harness.query().data).toBeNull();
  });

  it("reports nothing when both the position and Borås come back empty", async () => {
    respond({ status: 404, ok: false }, { status: 404, ok: false });
    const harness = renderHook(57.72, 12.94);
    await harness.settled();

    expect(harness.query().data).toBeNull();
  });
});

describe("caching", () => {
  it("keeps a forecast for half an hour", async () => {
    respond({ body: forecast(7) });
    const harness = renderHook(57.72, 12.94);
    await harness.settled();

    expect(staleTimeOf(harness.queryClient, ["weather", 57.72, 12.94])).toBe(1000 * 60 * 30);
  });

  // A failed forecast fails the same way every time; retrying only delays the empty banner.
  it("does not retry a failure", async () => {
    const fetchMock = respond({ status: 500, ok: false }, { status: 500, ok: false });
    const harness = renderHook(57.72, 12.94);
    await harness.settled();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
