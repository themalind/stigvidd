import { createTrailObstacle } from "@/api/trail-obstacles";
import { userLocationAtom } from "@/atoms/location-atoms";
import { showErrorAtom, showSuccessAtom } from "@/atoms/snackbar-atoms";
import { BORDER_RADIUS } from "@/constants/constants";
import { CreateTrailObstacleRequest } from "@/data/types";
import issueTypeParser from "@/utils/issue-type-parser";
import { MaterialIcons } from "@expo/vector-icons";
import { zodResolver } from "@hookform/resolvers/zod";
import { Picker } from "@react-native-picker/picker";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BlurView } from "expo-blur";
import * as Location from "expo-location";
import { useAtomValue, useSetAtom } from "jotai";
import { Controller, SubmitHandler, useForm } from "react-hook-form";
import {
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from "react-native";
import { Button, Modal, Portal, Surface, Text, TextInput, useTheme } from "react-native-paper";
import { z } from "zod";

const obstacleFields = z.object({
  description: z
    .string({ required_error: "Ge en kort beskrivning" })
    .min(15, "Beskrivning för kort minst 15 tecken")
    .max(500),

  issueType: z.string().nonempty(),

  useLocation: z.boolean().optional(),

  incidentLatitude: z.number().nullable().optional(),
  incidentLongitude: z.number().nullable().optional(),
});

type FormFields = z.infer<typeof obstacleFields>;
const { height, width } = Dimensions.get("screen");

interface Props {
  trailIdentifier: string;
  visible: boolean;
  onDismiss: () => void;
}

const issueTypes: string[] = ["Other", "FallenTree", "Mud", "Flooding", "Shelter", "FirePit", "Walkway", "Signage"];

export default function TrailObstacleForm({ trailIdentifier, visible, onDismiss }: Props) {
  const theme = useTheme();
  const pickerStyle = {
    color: theme.colors.onSurface,
    backgroundColor: theme.colors.surfaceVariant,
    fontWeight: "600" as const,
  };
  const setErrorMesg = useSetAtom(showErrorAtom);
  const setSuccessMsg = useSetAtom(showSuccessAtom);
  const userlocation = useAtomValue(userLocationAtom);
  const queryClient = useQueryClient();

  const { mutate, isPending } = useMutation({
    mutationFn: (obstacle: CreateTrailObstacleRequest) => createTrailObstacle(obstacle),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["obstacles", trailIdentifier] });
    },
  });

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormFields>({
    resolver: zodResolver(obstacleFields),
    defaultValues: {
      issueType: "Other",
      useLocation: false,
      incidentLatitude: null,
      incidentLongitude: null,
    },
  });

  const onSubmit: SubmitHandler<FormFields> = async (data) => {
    try {
      console.log("onsubmit: " ,data.incidentLatitude);
      const newTrailObstacle: CreateTrailObstacleRequest = {
        trailIdentifier,
        description: data.description,
        issueType: data.issueType,
        incidentLatitude: data.incidentLatitude ?? null,
        incidentLongitude: data.incidentLongitude ?? null,
      };

      reset();
      mutate(newTrailObstacle);
      onDismiss();
      setSuccessMsg("Sparat! Tack för att du har rapporterat");
    } catch (error) {
      console.log("TrailObstacleForm -> submit: ", error);
      setErrorMesg("Kunde inte spara, försök igen senare");
    }
  };

  return (
    <Portal>
      {visible && <BlurView intensity={100} tint="dark" style={StyleSheet.absoluteFill} />}
      <Modal
        contentContainerStyle={[s.modalContainerStyle, { backgroundColor: theme.colors.surface }]}
        visible={visible}
        onDismiss={onDismiss}
      >
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={s.keyboardAvoidingView}>
          <View style={s.modalContentContainer}>
            <View style={s.header}>
              <View style={s.headerLeft}>
                <MaterialIcons name="warning-amber" size={18} color={theme.colors.error} />
                <Text style={s.title}>Rapportera hinder</Text>
              </View>
              <Pressable hitSlop={12} onPress={onDismiss}>
                <MaterialIcons name="close" size={24} color={theme.colors.onSurface} />
              </Pressable>
            </View>
            <Surface style={s.surface}>
              <Text style={s.bold}>Upptäcker du något som påverkar framkomligheten eller säkerheten på leden? </Text>
              <Text>
                Använd formuläret för att berätta om hinder, skador eller andra händelser längs promenaden som kan vara
                bra för andra att känna till.
              </Text>
            </Surface>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              style={s.scrollView}
              contentContainerStyle={s.scrollContent}
            >
              <Text style={s.bold}>Välj en kategori</Text>
              <Controller
                control={control}
                render={({ field: { onChange, onBlur, value } }) => (
                  <Picker
                    dropdownIconColor={theme.colors.onSurface}
                    style={pickerStyle}
                    selectedValue={value}
                    onBlur={onBlur}
                    onValueChange={(value) => onChange(value)}
                    mode="dropdown"
                  >
                    {issueTypes.map((type) => (
                      <Picker.Item key={type} label={issueTypeParser(type)} value={type} style={pickerStyle} />
                    ))}
                  </Picker>
                )}
                name="issueType"
              />
              {errors.issueType && <Text>{errors.issueType.message}</Text>}
              <Text style={s.bold}>Lägg till en beskrivning max 500 tecken</Text>
              <Controller
                control={control}
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    mode="outlined"
                    error={!!errors.description}
                    style={[s.textInput, { backgroundColor: theme.colors.surfaceVariant }]}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    maxLength={500}
                    label="Beskrivning"
                    autoCapitalize="sentences"
                    multiline
                    scrollEnabled={false}
                    textAlignVertical="top"
                    theme={{
                      colors: {
                        primary: theme.colors.onSurface,
                      },
                    }}
                  />
                )}
                name="description"
              />
              {errors.description && (
                <Text
                  style={{
                    color: theme.colors.error,
                    fontWeight: 700,
                  }}
                >
                  {errors.description.message}
                </Text>
              )}
              {userlocation && (
                <>
                  <Text style={s.bold}>Dela din plats (valfritt)</Text>

                  <Controller
                    control={control}
                    name="useLocation"
                    render={({ field: { value, onChange } }) => (
                      <Switch
                        value={value}
                        onValueChange={async (enabled) => {
                          onChange(enabled);

                          if (enabled) {
                            try {
                              const location = await Location.getCurrentPositionAsync({});

                              setValue("incidentLatitude", location.coords.latitude);
                              console.log(location.coords.latitude);
                              setValue("incidentLongitude", location.coords.longitude);
                            } catch (e) {
                              console.log("Kunde inte hämta plats", e);
                            }
                          } else {
                            setValue("incidentLatitude", null);
                            setValue("incidentLongitude", null);
                          }
                        }}
                      />
                    )}
                  />
                  {watch("useLocation") && <Text>📍 Plats kommer att bifogas</Text>}
                </>
              )}
            </ScrollView>
            <Button onPress={handleSubmit(onSubmit)} mode="contained" style={s.button} disabled={isPending}>
              {isPending ? "Skickar..." : "Skicka"}
            </Button>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Portal>
  );
}

const s = StyleSheet.create({
  modalContainerStyle: {
    height: height * 0.8,
    justifyContent: "flex-start",
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
    gap: 10,
  },
  surface: {
    padding: 10,
    gap: 5,
    justifyContent: "flex-start",
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
    gap: 5,
    alignItems: "center",
  },
  title: {
    fontWeight: "700",
    fontSize: 18,
  },
  bold: {
    fontWeight: "700",
  },
  button: {
    borderRadius: BORDER_RADIUS,
  },
});
