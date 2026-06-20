import type { TFunction } from "i18next";
import { Alert, Linking, Platform } from "react-native";

// Hands off to the device's maps app for turn-by-turn directions to a coordinate —
// Apple Maps on iOS, Google Maps elsewhere (both accept the same daddr/destination
// query). Confirms first so an accidental tap doesn't yank the user out of the app.
export function openDirectionsToStart(position: GeoJSON.Position, t: TFunction) {
  const [lng, lat] = position;
  const url = Platform.select({
    ios: `http://maps.apple.com/?daddr=${lat},${lng}`,
    default: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
  });
  if (!url) return;

  Alert.alert(t("map.directionsTitle"), t("map.directionsMessage"), [
    { text: t("common.cancel"), style: "cancel" },
    { text: t("map.directionsConfirm"), onPress: () => Linking.openURL(url).catch(() => undefined) },
  ]);
}
