import { START_COORDINATE_BORAS } from "@/constants/constants";
import { useQuery } from "@tanstack/react-query";

// https://opendata.smhi.se/metfcst/snow1gv1/get_point_forecast

export interface WeatherData {
  temperature: number;
  symbolCode: number;
}

async function smhiFetch(lat: number, lon: number) {
  const url = `https://opendata-download-metfcst.smhi.se/api/category/snow1g/version/1/geotype/point/lon/${lon.toFixed(4)}/lat/${lat.toFixed(4)}/data.json`;
  const res = await fetch(url);
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
    staleTime: 1000 * 60 * 30,
    retry: false,
  });
}

// SMHI Wsymb2 symbol codes (1–27):
//  1 = Klart
//  2 = Nästan klart
//  3 = Växlande molnighet
//  4 = Halvklart
//  5 = Molnigt
//  6 = Mulet
//  7 = Dimma
//  8 = Lätta regnskurar
//  9 = Måttliga regnskurar
// 10 = Kraftiga regnskurar
// 11 = Åskväder
// 12 = Lätta byar av snöblandat regn
// 13 = Måttliga byar av snöblandat regn
// 14 = Kraftiga byar av snöblandat regn
// 15 = Lätta snöbyar
// 16 = Måttliga snöbyar
// 17 = Kraftiga snöbyar
// 18 = Lätt regn
// 19 = Måttligt regn
// 20 = Kraftigt regn
// 21 = Åska
// 22 = Lätt snöblandat regn
// 23 = Måttligt snöblandat regn
// 24 = Kraftigt snöblandat regn
// 25 = Lätt snöfall
// 26 = Måttligt snöfall
// 27 = Kraftigt snöfall
