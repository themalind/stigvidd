import { createTrailObstacle } from "@/api/trail-obstacles";
import { getCoordinatesByTrailIdentifier } from "@/api/trails";
import { showErrorAtom, showSuccessAtom } from "@/atoms/snackbar-atoms";
import SelectInput from "@/components/select-input";
import { BORDER_RADIUS } from "@/constants/constants";
import { CreateTrailObstacleRequest } from "@/data/types";
import CoordinateParser from "@/utils/coordinate-parser";
import { isNearTrail } from "@/utils/haversine";
import issueTypeParser from "@/utils/issue-type-parser";
import { MaterialIcons } from "@expo/vector-icons";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BlurView } from "expo-blur";
import * as ExpoLinking from "expo-linking";
import * as Location from "expo-location";
import { useSetAtom } from "jotai";
import { useState } from "react";
import { Controller, SubmitHandler, useForm } from "react-hook-form";
import { Dimensions, Pressable, StyleSheet, Switch, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
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

const issueTypes: string[] = ["Other", "FallenTree", "Mud", "Flooding", "Shelter", "FirePit", "Walkway", "Signage"];

interface Props {
  trailIdentifier: string;
  visible: boolean;
  onDismiss: () => void;
}

export default function TrailObstacleForm({ trailIdentifier, visible, onDismiss }: Props) {
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const theme = useTheme();
  const setErrorMsg = useSetAtom(showErrorAtom);
  const setSuccessMsg = useSetAtom(showSuccessAtom);
  const queryClient = useQueryClient();

  const { mutate, isPending } = useMutation({
    mutationFn: (obstacle: CreateTrailObstacleRequest) => createTrailObstacle(obstacle),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["obstacles", trailIdentifier] });
      reset();
      onDismiss();
      setSuccessMsg("Sparat! Tack för att du har rapporterat");
    },
    onError: () => {
      setErrorMsg("Någor gick fel försök igen senare");
    },
  });

  const { data: trailCords } = useQuery({
    queryKey: ["cords", trailIdentifier],
    queryFn: () => getCoordinatesByTrailIdentifier(trailIdentifier),
    enabled: !!trailIdentifier,
  });

  const parsed = trailCords ? CoordinateParser({ data: trailCords.coordinates, identifier: trailIdentifier }) : [];
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

  const onSubmit: SubmitHandler<FormFields> = (data) => {
    const newObstacle: CreateTrailObstacleRequest = {
      trailIdentifier,
      description: data.description,
      issueType: data.issueType,
      incidentLatitude: data.incidentLatitude ?? null,
      incidentLongitude: data.incidentLongitude ?? null,
    };
    mutate(newObstacle);
  };

  const handleLocationToggle = async (enabled: boolean, onChange: (val: boolean) => void) => {
    // If switch is not set to add location set coordinates to null
    if (!enabled) {
      onChange(false);
      setValue("incidentLatitude", null);
      setValue("incidentLongitude", null);
      setLocationError(null);
      return;
    }

    setIsLocating(true);
    setLocationError(null);

    // Check that the user accepted location
    try {
      const { granted } = await Location.getForegroundPermissionsAsync();

      if (!granted) {
        setLocationError("Platsbehörighet saknas. Aktivera i systeminställningarna.");
        await ExpoLinking.openSettings();
        return;
      }

      // Get user position
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      // Check if the user is on the trail or near it.
      if (parsed.length === 0 || !isNearTrail(location.coords.latitude, location.coords.longitude, parsed)) {
        setLocationError("Du verkar inte befinna dig på leden. Platsen kan inte bifogas.");
        return;
      }

      // Save the coords
      onChange(true); // Syncs switch state back to React Hook Form, also activates the watch
      setValue("incidentLatitude", location.coords.latitude);
      setValue("incidentLongitude", location.coords.longitude);
    } catch (e) {
      console.log("Kunde inte hämta plats", e);
      setLocationError("Kunde inte hämta plats, försök igen.");
    } finally {
      setIsLocating(false);
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
        <View style={s.keyboardAvoidingView}>
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
              <Text style={[s.infoLabel, { color: theme.colors.onSurfaceVariant }]}>
                Upptäcker du något som påverkar framkomligheten eller säkerheten på leden?
              </Text>
              <Text style={[s.infoBody, { color: theme.colors.onSurfaceVariant }]}>
                Använd formuläret för att berätta om hinder, skador eller andra händelser längs promenaden som kan vara
                bra för andra att känna till.
              </Text>
            </Surface>

            <KeyboardAwareScrollView
              keyboardShouldPersistTaps="handled"
              style={s.scrollView}
              contentContainerStyle={s.scrollContent}
            >
              <View style={s.fieldGroup}>
                <Text style={[s.fieldLabel, { color: theme.colors.onSurfaceVariant }]}>Välj en kategori</Text>
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
                {errors.issueType && <Text>{errors.issueType.message}</Text>}
              </View>
              <View style={s.fieldGroup}>
                <Text style={[s.fieldLabel, { color: theme.colors.onSurfaceVariant }]}>
                  Lägg till en beskrivning max 500 tecken
                </Text>
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
                      label="Beskrivning"
                      autoCapitalize="sentences"
                      multiline
                      scrollEnabled={false}
                      textAlignVertical="top"
                      theme={{ colors: { primary: theme.colors.onSurface } }}
                    />
                  )}
                />
                {errors.description && (
                  <Text style={[s.bold, { color: theme.colors.error }]}>{errors.description.message}</Text>
                )}
              </View>
              <View style={s.locationRow}>
                <Text style={[s.locationLabel, { color: theme.colors.onSurfaceVariant }]}>
                  Dela din plats (valfritt)
                </Text>
                <Controller
                  control={control}
                  name="useLocation"
                  render={({ field: { value, onChange } }) => (
                    <Switch
                      trackColor={{ false: theme.colors.outlineVariant, true: theme.colors.tertiary }}
                      thumbColor={value ? theme.colors.outlineVariant : theme.colors.tertiary}
                      style={s.switch}
                      value={value}
                      disabled={isLocating}
                      onValueChange={(enabled) => handleLocationToggle(enabled, onChange)}
                    />
                  )}
                />
              </View>
              {watch("useLocation") && <Text>📍 Plats kommer att bifogas</Text>}
              {locationError && <Text style={[s.bold, { color: theme.colors.error }]}>{locationError}</Text>}
            </KeyboardAwareScrollView>

            <Button onPress={handleSubmit(onSubmit)} mode="contained" style={s.button} disabled={isPending}>
              {isPending ? "Skickar..." : "Skicka"}
            </Button>
          </View>
        </View>
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
    gap: 25,
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
    letterSpacing: 0.4,
  },
  bold: {
    fontWeight: "700",
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
  fieldLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  fieldGroup: {
    gap: 5,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    justifyContent: "space-between",
    padding: 5,
  },
  locationLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  switch: {
    transform: [{ scaleX: 1.1 }, { scaleY: 1.1 }],
  },
  button: {
    borderRadius: BORDER_RADIUS,
  },
});
