import { useUserLocation } from "@/hooks/useUserLocation";
import { Ionicons } from "@expo/vector-icons";
import { type CameraRef } from "@maplibre/maplibre-react-native";
import { RefObject } from "react";
import { Pressable, StyleSheet } from "react-native";
import { useTheme } from "react-native-paper";

interface Props {
  cameraRef: RefObject<CameraRef | null>;
}

export default function CenterOnUserButton({ cameraRef }: Props) {
  const theme = useTheme();
  const { data: location } = useUserLocation();

  const centerOnUser = () => {
    if (!location || location.isFallback) return;
    cameraRef.current?.flyTo({ center: [location.longitude, location.latitude], zoom: 14, duration: 800 });
  };

  if (!location || location.isFallback) return null;

  return (
    <Pressable
      style={[s.center, { backgroundColor: theme.colors.primary, borderColor: theme.colors.onPrimary }]}
      onPress={centerOnUser}
    >
      <Ionicons name="locate" size={24} color={theme.colors.onPrimary} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  center: {
    position: "absolute",
    right: 15,
    bottom: 18,
    padding: 12,
    borderWidth: 2,
    borderRadius: 999,
  },
});
