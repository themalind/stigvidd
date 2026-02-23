import { LatLng } from "react-native-maps";

export default function GetRegionFromTrail(coords: LatLng[]) {
  let minLat = coords[0].latitude;
  let maxLat = coords[0].latitude;
  let minLng = coords[0].longitude;
  let maxLng = coords[0].longitude;

  coords.forEach((c) => {
    minLat = Math.min(minLat, c.latitude);
    maxLat = Math.max(maxLat, c.latitude);
    minLng = Math.min(minLng, c.longitude);
    maxLng = Math.max(maxLng, c.longitude);
  });

  const latDelta = Math.max(maxLat - minLat, 0.01);
  const lngDelta = Math.max(maxLng - minLng, 0.01);

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: latDelta * 1.6,
    longitudeDelta: lngDelta * 1.6,
  };
}
