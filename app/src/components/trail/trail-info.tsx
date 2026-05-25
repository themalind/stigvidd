import { SURFACE_BORDER_RADIUS } from "@/constants/constants";
import { Trail } from "@/data/types";
import { classificationParser } from "@/utils/classification-parser";
import { getDifficultyIcon } from "@/utils/getDifficultyIcon";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Icon, Surface, useTheme } from "react-native-paper";
import { useTranslation } from "react-i18next";
import AccesibilityInfoModal from "./accessibility-info-modal";
import DifficultyInfoModal from "./difficulty-info-modal";

interface TrailinfoProps {
  trail: Trail;
}

export default function TrailInfo({ trail }: TrailinfoProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [difficultyModal, setDifficultyModal] = useState(false);
  const [accessibiltyModal, setAccessibilityModal] = useState(false);

  return (
    <Surface elevation={2} style={[s.container, { backgroundColor: theme.colors.surface }]}>
      <Text style={[s.sectionTitle, { color: theme.colors.onSurface }]}>{t("trail.info")}</Text>
      <View style={s.grid}>
        <View style={s.item}>
          <Text style={[s.label, { color: theme.colors.onSurfaceVariant }]}>{t("trail.marking")}</Text>
          <Text style={[s.value, { color: theme.colors.onSurface }]}>{trail.trailSymbol}</Text>
        </View>
        <View style={s.item}>
          <Text style={[s.label, { color: theme.colors.onSurfaceVariant }]}>{t("trail.length")}</Text>
          <Text style={[s.value, { color: theme.colors.onSurface }]}>{trail.trailLenght} km</Text>
        </View>
        <View style={s.item}>
          <View style={s.infoIconContainer}>
            <Text style={[s.label, { color: theme.colors.onSurfaceVariant }]}>{t("trail.difficulty")}</Text>
            <Pressable hitSlop={16} onPress={() => setDifficultyModal(true)}>
              <Icon source="information" size={17} color={theme.colors.secondary} />
            </Pressable>
            <DifficultyInfoModal
              difficulty={trail.classification}
              onDismiss={() => setDifficultyModal(false)}
              visible={difficultyModal}
            />
          </View>
          <View style={s.iconRow}>
            {getDifficultyIcon(classificationParser(trail.classification))}
            <Text style={[s.value, { color: theme.colors.onSurface }]}>
              {classificationParser(trail.classification)}
            </Text>
          </View>
        </View>
        <View style={s.item}>
          <View style={s.infoIconContainer}>
            <Text style={[s.label, { color: theme.colors.onSurfaceVariant }]}>{t("trail.accessibility")}</Text>
            <Pressable hitSlop={16} onPress={() => setAccessibilityModal(true)}>
              <Icon source="information" size={17} color={theme.colors.secondary} />
            </Pressable>
            <AccesibilityInfoModal onDismiss={() => setAccessibilityModal(false)} visible={accessibiltyModal} />
          </View>
          <Text style={[s.value, { color: theme.colors.onSurface }]}>
            {trail.accessibility ? t("trail.adapted") : t("trail.notAdapted")}
          </Text>
        </View>
        <View style={s.itemFull}>
          <Text style={[s.label, { color: theme.colors.onSurfaceVariant }]}>{t("trail.variation")}</Text>
          <Text style={[s.value, { color: theme.colors.onSurface }]}>{trail.accessibilityInfo}</Text>
        </View>
      </View>
    </Surface>
  );
}

const s = StyleSheet.create({
  container: {
    padding: 20,
    borderRadius: SURFACE_BORDER_RADIUS,
    gap: 12,
  },
  sectionTitle: {
    fontWeight: "700",
    fontSize: 15,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  item: {
    flexBasis: "45%",
    flexGrow: 1,
    gap: 2,
  },
  itemFull: {
    flexBasis: "100%",
    gap: 2,
  },
  label: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontWeight: "600",
  },
  value: {
    fontSize: 14,
  },
  iconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  infoIconContainer: {
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
  },
});
