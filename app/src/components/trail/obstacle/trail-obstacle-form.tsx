import { BORDER_RADIUS } from "@/constants/constants";
import { TrailObstacle } from "@/data/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { BlurView } from "expo-blur";
import { SubmitHandler, useForm } from "react-hook-form";
import { Dimensions, StyleSheet, View } from "react-native";
import { Modal, Portal } from "react-native-paper";
import { z } from "zod";

const obstacleFields = z.object({
  description: z
    .string({ required_error: "Ge en kort beskrivning" })
    .min(15, "Beskrivning för kort minst 15 tecken")
    .max(500),
});

type FormFields = z.infer<typeof obstacleFields>;
const { height } = Dimensions.get("screen");

interface Props {
  visible: boolean;
  onDismiss: () => void;
  obstacle: TrailObstacle;
}

export default function TrailObstacleForm({ visible, onDismiss, obstacle }: Props) {
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormFields>({ resolver: zodResolver(obstacleFields) });

  const onSubmit: SubmitHandler<FormFields> = async (data) => {};

  return (
    <Portal>
      {visible && <BlurView intensity={100} tint="dark" style={StyleSheet.absoluteFill} />}
      <Modal contentContainerStyle={s.modalContainerStyle} visible={visible} onDismiss={onDismiss}>
        <View></View>
      </Modal>
    </Portal>
  );
}

const s = StyleSheet.create({
  modalContainerStyle: {
    height: height * 0.9,
    borderRadius: BORDER_RADIUS,
    padding: 10,
    gap: 5,
  },
});
