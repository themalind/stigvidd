import { useUserLocation } from "@/hooks/useUserLocation";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet } from "react-native";
import MapView from "react-native-maps";
import { useTheme } from "react-native-paper";

interface Props {
  mapRef: React.RefObject<MapView | null>;
}

export default function CenterOnUserButton({ mapRef }: Props) {
  const theme = useTheme();
  const { data: location } = useUserLocation();

  const centerOnUser = () => {
    if (!location || location.isFallback) return;
    mapRef.current?.animateToRegion(
      {
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      },
      800,
    );
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
    elevation: 5,
  },
});
