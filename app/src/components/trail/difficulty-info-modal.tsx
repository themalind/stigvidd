import { BORDER_RADIUS } from "@/constants/constants";
import { classificationParser } from "@/utils/classification-parser";
import { getDifficultyIcon } from "@/utils/getDifficultyIcon";
import { BlurView } from "expo-blur";
import { Dimensions, Pressable, StyleSheet, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { Icon, Modal, Portal, Text, useTheme } from "react-native-paper";

interface Props {
  difficulty: number;
  visible: boolean;
  onDismiss: () => void;
}

interface DifficultyInfo {
  value: number;
  label: string;
  description: string;
}

const DIFFICULTIES: DifficultyInfo[] = [
  {
    value: 1,
    label: "Lätt",
    description:
      "På leder som har svårighetsnivå lätt är det möjligt att ta sig fram med barnvagn. Underlaget på leden är till största delen hårdgjord yta.",
  },
  {
    value: 2,
    label: "Medel",
    description:
      "De leder som har svårighetsnivå medel går ofta på mindre vägar och naturstigar. Under normala väderförhållanden krävs inga kängor eller stövlar här, och för en person med normal kondition är nivåskillnaden inga problem.",
  },
  {
    value: 3,
    label: "Svår",
    description:
      "En led med svårighetsnivå svår går ofta på naturstig. Här finns sträckor som innehåller stora nivåskillnader eller branta passager, och därför behövs god kondition och ordentliga vandringskängor eller stövlar.",
  },
  {
    value: 0,
    label: "Inte klassificerad",
    description: "Ingen officiell klassificering finns.",
  },
];

const { height } = Dimensions.get("screen");

export default function DifficultyInfoModal({ difficulty, visible, onDismiss }: Props) {
  const theme = useTheme();
  const modalStyle = [s.modalContainerStyle, { backgroundColor: theme.colors.surface }];

  return (
    <Portal>
      {visible && <BlurView intensity={100} tint="dark" style={StyleSheet.absoluteFill} />}
      <Modal contentContainerStyle={modalStyle} visible={visible} onDismiss={onDismiss}>
        <KeyboardAwareScrollView
          keyboardShouldPersistTaps="handled"
          enableOnAndroid={true}
          extraScrollHeight={20}
          contentContainerStyle={s.scrollContent}
        >
          <View style={s.content}>
            <View style={s.header}>
              <Text style={s.title}>Svårighetsgrader</Text>
              <Pressable onPress={onDismiss}>
                <Icon source="close" size={20} color={theme.colors.onSurface} />
              </Pressable>
            </View>

            {DIFFICULTIES.map((item) => {
              const isActive = difficulty === item.value;
              return (
                <View
                  key={item.value}
                  style={[
                    s.classificationSection,
                    {
                      backgroundColor: isActive ? theme.colors.surfaceVariant : theme.colors.surface,
                      borderColor: isActive ? theme.colors.primary : theme.colors.outlineVariant,
                    },
                  ]}
                >
                  <View style={s.classificationIcon}>
                    {getDifficultyIcon(classificationParser(item.value))}
                    <Text style={s.infoLabel}>{item.label}</Text>
                  </View>
                  <Text style={s.infoBody}>{item.description}</Text>
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
    gap: 25,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 5,
  },
  title: {
    fontWeight: "700",
    fontSize: 16,
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
  classificationSection: {
    borderWidth: 1.5,
    borderRadius: BORDER_RADIUS,
    padding: 10,
    gap: 5,
  },
  classificationIcon: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
});
