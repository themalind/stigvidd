import { BORDER_RADIUS } from "@/constants/constants";
import { ACCESSIBILITY_INFO } from "@/data/trail-content";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Dimensions, Pressable, StyleSheet, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { Icon, Modal, Portal, Text, useTheme } from "react-native-paper";
import { useTranslation } from "react-i18next";

interface Props {
  visible: boolean;
  onDismiss: () => void;
}

const { height } = Dimensions.get("screen");

export default function AccesibilityInfoModal({ visible, onDismiss }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <Portal>
      {visible && <BlurView intensity={100} tint="dark" style={StyleSheet.absoluteFill} />}
      <Modal
        contentContainerStyle={[s.modalContainerStyle, { backgroundColor: theme.colors.surface }]}
        visible={visible}
        onDismiss={onDismiss}
      >
        <KeyboardAwareScrollView
          keyboardShouldPersistTaps="handled"
          enableOnAndroid={true}
          extraScrollHeight={20}
          contentContainerStyle={s.scrollContent}
        >
          <View style={s.content}>
            <View style={s.header}>
              <View style={s.headerLeft}>
                <View style={[s.headerIconCircle, { borderColor: theme.colors.primary }]}>
                  <Icon size={20} source="human-handsup" color={theme.colors.tertiary} />
                </View>
                <Text style={s.title}>{t("trail.accessibilityTitle")}</Text>
              </View>
              <Pressable hitSlop={16} onPress={onDismiss}>
                <Icon source="close" size={20} color={theme.colors.onSurface} />
              </Pressable>
            </View>

            {ACCESSIBILITY_INFO.map((info) => {
              const paragraphs = t(info.description)
                .split("\n")
                .filter((p) => p.trim().length > 0);

              return (
                <View
                  key={info.title}
                  style={[
                    s.infoCard,
                    {
                      borderColor: theme.colors.outlineVariant,
                      backgroundColor: theme.colors.secondaryContainer,
                    },
                  ]}
                >
                  <View style={s.infoHeader}>
                    <MaterialCommunityIcons name={info.iconName} size={24} color={theme.colors.primary} />
                    <Text style={s.infoLabel}>{t(info.title)}</Text>
                  </View>
                  {paragraphs.map((paragraph, i) => (
                    <Text key={i} style={[s.infoBody, i > 0 && s.infoBodySpacing]}>
                      {paragraph.trim()}
                    </Text>
                  ))}
                </View>
              );
            })}
          </View>
        </KeyboardAwareScrollView>
      </Modal>
    </Portal>
  );
}

const s = StyleSheet.create({
  modalContainerStyle: {
    height: height * 0.8,
    borderRadius: BORDER_RADIUS,
    padding: 10,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    gap: 15,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 5,
  },
  headerLeft: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  headerIconCircle: {
    borderWidth: 0.5,
    borderRadius: 100,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontWeight: "700",
    fontSize: 16,
  },
  infoCard: {
    borderWidth: 0.5,
    padding: 12,
    borderRadius: BORDER_RADIUS,
    gap: 8,
  },
  infoHeader: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    marginBottom: 4,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  infoBody: {
    fontSize: 13,
    lineHeight: 20,
  },
  infoBodySpacing: {
    marginTop: 8,
  },
});
