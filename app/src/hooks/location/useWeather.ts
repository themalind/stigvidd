// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { apiFetch } from "@/api/core/api-config";
import { START_COORDINATE_BORAS } from "@/constants/constants";
import { WEATHER_STALE_TIME } from "@/constants/cache";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

// https://opendata.smhi.se/metfcst/snow1gv1/get_point_forecast

export interface WeatherData {
  temperature: number;
  symbolCode: number;
}

async function smhiFetch(lat: number, lon: number) {
  const url = `https://opendata-download-metfcst.smhi.se/api/category/snow1g/version/1/geotype/point/lon/${lon.toFixed(4)}/lat/${lat.toFixed(4)}/data.json`;
  const res = await apiFetch(url);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`SMHI ${res.status}: ${res.statusText}`);
  return res.json();
}

async function fetchWeather(lat: number, lon: number): Promise<WeatherData | null> {
  let data = await smhiFetch(lat, lon);
  if (!data) {
    data = await smhiFetch(START_COORDINATE_BORAS.latitude, START_COORDINATE_BORAS.longitude);
  }
  if (!data?.timeSeries?.length) return null;

  const current = data.timeSeries[0];
  const temperature = current.data?.air_temperature;
  const symbolCode = current.data?.symbol_code;
  if (temperature == null) return null;
  return {
    temperature: Math.round(temperature),
    symbolCode: symbolCode ?? 6,
  };
}

export function useWeather(lat?: number, lon?: number) {
  return useQuery<WeatherData | null>({
    queryKey: ["weather", lat, lon],
    queryFn: () => fetchWeather(lat!, lon!),
    enabled: lat != null && lon != null,
    staleTime: WEATHER_STALE_TIME,
    retry: false,
    placeholderData: keepPreviousData,
  });
}

// SMHI Wsymb2 symbol codes (1–27):
//  1 = Clear sky
//  2 = Nearly clear sky
//  3 = Variable cloudiness
//  4 = Halfclear sky
//  5 = Cloudy sky
//  6 = Overcast
//  7 = Fog
//  8 = Light rain showers
//  9 = Moderate rain showers
// 10 = Heavy rain showers
// 11 = Thunderstorm
// 12 = Light sleet showers
// 13 = Moderate sleet showers
// 14 = Heavy sleet showers
// 15 = Light snow showers
// 16 = Moderate snow showers
// 17 = Heavy snow showers
// 18 = Light rain
// 19 = Moderate rain
// 20 = Heavy rain
// 21 = Thunder
// 22 = Light sleet
// 23 = Moderate sleet
// 24 = Heavy sleet
// 25 = Light snowfall
// 26 = Moderate snowfall
// 27 = Heavy snowfall
