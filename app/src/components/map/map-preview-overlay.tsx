import { openDirectionsToStart } from "@/utils/open-directions";
import { MaterialIcons } from "@expo/vector-icons";
import { Dimensions, Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Text, useTheme } from "react-native-paper";

// On narrow phones the two corner pills would crowd each other, so the directions
// pill drops its label and shows just the icon below this width (app is portrait-locked).
const COMPACT_DIRECTIONS = Dimensions.get("window").width < 380;

interface Props {
  // Badge text — "Se på karta" for trails, "Visa kartvy" for hikes.
  label: string;
  onPress: () => void;
  // When given, a directions pill is drawn for this start point. Needed because the
  // full-cover Pressable below swallows map touches, so the start marker's own tap
  // handler can't be reached while this overlay is mounted.
  startPosition?: GeoJSON.Position;
}

// The chrome that turns a static map preview into a button: the whole surface opens the
// fullscreen follow view, with a corner badge saying so. Shared by the trail detail
// preview and the hike/shared-hike detail modals so the affordance is identical.
export default function MapPreviewOverlay({ label, onPress, startPosition }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <>
      <Pressable style={s.overlay} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
        <View style={[s.badge, { backgroundColor: theme.colors.surface }]}>
          <MaterialIcons name="open-in-full" size={16} color={theme.colors.onSurface} />
          <Text style={[s.badgeText, { color: theme.colors.onSurface }]}>{label}</Text>
        </View>
      </Pressable>
      {/* Sits on top of the overlay so its tap opens directions instead of the
          follow view; rendered last to win the touch in its corner. */}
      {startPosition && (
        <Pressable
          style={[s.directions, { backgroundColor: theme.colors.surface }]}
          onPress={() => openDirectionsToStart(startPosition, t)}
          hitSlop={6}
          accessibilityLabel={t("map.directions")}
        >
          <MaterialIcons name="directions" size={16} color={theme.colors.onSurface} />
          {!COMPACT_DIRECTIONS && (
            <Text style={[s.badgeText, { color: theme.colors.onSurface }]}>{t("map.directions")}</Text>
          )}
        </Pressable>
      )}
    </>
  );
}

const s = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "flex-end",
    justifyContent: "flex-end",
    padding: 10,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    opacity: 0.95,
  },
  directions: {
    position: "absolute",
    left: 10,
    bottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    opacity: 0.95,
  },
  badgeText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
});
