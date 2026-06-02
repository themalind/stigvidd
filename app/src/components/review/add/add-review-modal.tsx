import { BORDER_RADIUS } from "@/constants/constants";
import { MaterialIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Dimensions, Pressable, StyleSheet, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { Modal, Portal, Text, useTheme } from "react-native-paper";
import AddReviewForm from "./add-review-form";

const { height } = Dimensions.get("screen");

interface AddReviewProps {
  trailIdentifier: string;
  trailName: string;
  trailLenght: number;
  visible: boolean;
  onDismiss: () => void;
}

export default function AddReview({ visible, onDismiss, trailIdentifier, trailName, trailLenght }: AddReviewProps) {
  const theme = useTheme();
  return (
    <Portal>
      {visible && <BlurView intensity={100} tint="dark" style={StyleSheet.absoluteFill} />}
      <Modal
        contentContainerStyle={[s.modalContainerStyle, { backgroundColor: theme.colors.surface }]}
        visible={visible}
        onDismiss={onDismiss}
      >
        <View style={s.keyboardAvoidingView}>
          <View style={s.modalContentContainer}>
            <View style={s.header}>
              <View style={s.headerLeft}>
                <View style={s.titleRow}>
                  <Text style={s.title}>Betygsätt leden</Text>
                  <MaterialIcons name="star-outline" size={18} color={theme.colors.primary} />
                </View>
                <Text style={[s.subtitle, { color: theme.colors.onSurfaceVariant }]}>
                  {`${trailName} · ${trailLenght} km`}
                </Text>
              </View>
              <Pressable hitSlop={12} onPress={onDismiss}>
                <MaterialIcons name="close" size={24} color={theme.colors.onSurface} />
              </Pressable>
            </View>

            <KeyboardAwareScrollView
              keyboardShouldPersistTaps="handled"
              enableOnAndroid={true}
              extraScrollHeight={20}
              style={s.scrollView}
              contentContainerStyle={s.scrollContent}
            >
              <AddReviewForm trailIdentifier={trailIdentifier} onSuccess={onDismiss} />
            </KeyboardAwareScrollView>
          </View>
        </View>
      </Modal>
    </Portal>
  );
}

const s = StyleSheet.create({
  modalContainerStyle: {
    height: height * 0.8,
    borderRadius: BORDER_RADIUS,
    padding: 15,
    gap: 5,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  modalContentContainer: {
    flex: 1,
    gap: 20,
    justifyContent: "flex-start",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
    paddingTop: 10,
    justifyContent: "space-between",
  },
  headerLeft: {
    flexDirection: "column",
    gap: 2,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  title: {
    fontWeight: "700",
    fontSize: 18,
    letterSpacing: 0.4,
  },
  subtitle: {
    fontSize: 13,
  },
});
