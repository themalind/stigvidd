// App-owned geographic coordinate in the device/wire format ({ latitude, longitude }).
// Used by GPS tracking, geolib distance and the hike-creation request payload.
// Map rendering uses GeoJSON Position ([lng, lat]) instead — see utils/geojson.ts.
export interface LatLng {
  latitude: number;
  longitude: number;
}

export type LocationData = {
  data: LatLng;
  timeStamp: number;
};

export type Segment = {
  coordinates: LocationData[];
  distance: number;
  startTime: number;
  endTime?: number;
};

export type ActiveHike = {
  segments: Segment[];
  totalDistance: number;
  totalTime: number;
};

export type MapMarkerFilter = {
  trails: boolean;
  shelters: boolean;
  firePits: boolean;
  accessibility: boolean;
};
