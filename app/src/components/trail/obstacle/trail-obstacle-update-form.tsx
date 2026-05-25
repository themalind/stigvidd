import { getObstacleIssueTypes, updateTrailObstacle } from "@/api/trail-obstacles";
import { showErrorAtom, showSuccessAtom } from "@/atoms/snackbar-atoms";
import SelectInput from "@/components/select-input";
import { BORDER_RADIUS } from "@/constants/constants";
import { UpdateTrailObstacleRequest } from "@/data/types";
import issueTypeParser from "@/utils/issue-type-parser";
import { MaterialIcons } from "@expo/vector-icons";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BlurView } from "expo-blur";
import { useSetAtom } from "jotai";
import { Controller, SubmitHandler, useForm } from "react-hook-form";
import { Dimensions, Pressable, StyleSheet, View } from "react-native";
import { Button, Modal, Portal, Text, TextInput, useTheme } from "react-native-paper";
import { useTranslation } from "react-i18next";
import { z } from "zod";

const updateObstacleFields = z.object({
  description: z
    .string({ required_error: "obstacle.descriptionRequired" })
    .min(15, "obstacle.descriptionTooShort")
    .max(500),
  issueType: z.string().nonempty(),
});

type FormFields = z.infer<typeof updateObstacleFields>;

const { height, width } = Dimensions.get("screen");

interface Props {
  obstacleIdentifier: string;
  trailIdentifier: string;
  initialDescription: string;
  initialIssueType: string;
  visible: boolean;
  onDismiss: () => void;
}

export default function TrailObstacleUpdateForm({
  obstacleIdentifier,
  trailIdentifier,
  initialDescription,
  initialIssueType,
  visible,
  onDismiss,
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const setErrorMsg = useSetAtom(showErrorAtom);
  const setSuccessMsg = useSetAtom(showSuccessAtom);
  const queryClient = useQueryClient();

  const { data: issueTypes } = useQuery({
    queryKey: ["issueTypes", "obstacle"],
    queryFn: () => getObstacleIssueTypes(),
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (request: UpdateTrailObstacleRequest) => updateTrailObstacle(obstacleIdentifier, request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["obstacles", trailIdentifier] });
      onDismiss();
      setSuccessMsg(t("obstacle.updated"));
    },
    onError: () => {
      setErrorMsg(t("obstacle.updateError"));
    },
  });

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormFields>({
    resolver: zodResolver(updateObstacleFields),
    defaultValues: {
      description: initialDescription,
      issueType: initialIssueType,
    },
  });

  const onSubmit: SubmitHandler<FormFields> = (data) => {
    mutate({ description: data.description, issueType: data.issueType });
  };

  return (
    <Portal>
      {visible && <BlurView intensity={100} tint="dark" style={StyleSheet.absoluteFill} />}
      <Modal
        contentContainerStyle={[s.modalContainerStyle, { backgroundColor: theme.colors.surface }]}
        visible={visible}
        onDismiss={onDismiss}
      >
        <View style={s.modalContentContainer}>
          <View style={s.header}>
            <View style={s.headerLeft}>
              <MaterialIcons name="edit-note" size={28} color={theme.colors.onSurface} />
              <Text style={s.title}>{t("obstacle.editTitle")}</Text>
            </View>
            <Pressable hitSlop={12} onPress={onDismiss}>
              <MaterialIcons name="close" size={24} color={theme.colors.onSurface} />
            </Pressable>
          </View>

          <View style={s.fieldGroup}>
            <Text style={[s.fieldLabel, { color: theme.colors.onSurfaceVariant }]}>{t("obstacle.selectCategory")}</Text>
            {issueTypes?.length && (
              <Controller
                control={control}
                name="issueType"
                render={({ field: { onChange, value } }) => (
                  <SelectInput
                    selectedValue={value}
                    onValueChange={onChange}
                    options={issueTypes.map((type) => ({ label: issueTypeParser(type), value: type }))}
                  />
                )}
              />
            )}
            {errors.issueType && <Text style={{ color: theme.colors.error }}>{errors.issueType.message}</Text>}
          </View>

          <View style={s.fieldGroup}>
            <Text style={[s.fieldLabel, { color: theme.colors.onSurfaceVariant }]}>{t("obstacle.descriptionMax")}</Text>
            <Controller
              control={control}
              name="description"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  mode="outlined"
                  error={!!errors.description}
                  style={[s.textInput, { backgroundColor: theme.colors.surfaceVariant }]}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  maxLength={500}
                  label={t("obstacle.description")}
                  autoCapitalize="sentences"
                  multiline
                  scrollEnabled={false}
                  textAlignVertical="top"
                  theme={{ colors: { primary: theme.colors.onSurface } }}
                />
              )}
            />
            {errors.description && (
              <Text style={[s.bold, { color: theme.colors.error }]}>
                {errors.description.message ? t(errors.description.message) : ""}
              </Text>
            )}
          </View>

          <Button onPress={handleSubmit(onSubmit)} mode="contained" style={s.button} disabled={isPending}>
            {isPending ? t("common.saving") : t("common.save")}
          </Button>
        </View>
      </Modal>
    </Portal>
  );
}

const s = StyleSheet.create({
  modalContainerStyle: {
    height: height * 0.6,
    justifyContent: "flex-start",
    borderRadius: BORDER_RADIUS,
    padding: 15,
  },
  modalContentContainer: {
    gap: 40,
  },
  textInput: {
    width: width * 0.92,
    minHeight: 80,
  },
  header: {
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
    paddingTop: 10,
    justifyContent: "space-between",
  },
  headerLeft: {
    flexDirection: "row",
    gap: 15,
    alignItems: "center",
  },
  title: {
    fontWeight: "700",
    fontSize: 18,
    letterSpacing: 0.4,
  },
  bold: {
    fontWeight: "700",
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  fieldGroup: {
    gap: 5,
  },
  button: {
    borderRadius: BORDER_RADIUS,
  },
});
