import { AppDefaultTheme } from "@/constants/theme";
import { useUserLocation } from "@/hooks/useUserLocation";
import { Ionicons } from "@expo/vector-icons";
import { type CameraRef } from "@maplibre/maplibre-react-native";
import { RefObject } from "react";
import { Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface Props {
  cameraRef: RefObject<CameraRef | null>;
  // Optional extra action run when the button is pressed, in addition to centering
  // (e.g. re-enabling auto-follow on a screen that pauses following on user pan).
  onPress?: () => void;
}

// Map controls sit on the always-light basemap, so they use the fixed light
// palette — never useTheme(), which would turn the button orange in dark mode.
const CONTROL_COLORS = AppDefaultTheme.colors;

export default function CenterOnUserButton({ cameraRef, onPress }: Props) {
  const insets = useSafeAreaInsets();
  const { data: location } = useUserLocation();

  const centerOnUser = () => {
    onPress?.();
    if (!location || location.isFallback) return;
    cameraRef.current?.flyTo({ center: [location.longitude, location.latitude], zoom: 14, duration: 800 });
  };

  if (!location || location.isFallback) return null;

  return (
    <Pressable
      style={[
        s.center,
        { bottom: insets.bottom + 18, backgroundColor: CONTROL_COLORS.primary, borderColor: CONTROL_COLORS.onPrimary },
      ]}
      onPress={centerOnUser}
    >
      <Ionicons name="locate" size={24} color={CONTROL_COLORS.onPrimary} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  center: {
    position: "absolute",
    right: 15,
    padding: 12,
    borderWidth: 2,
    borderRadius: 999,
  },
});
