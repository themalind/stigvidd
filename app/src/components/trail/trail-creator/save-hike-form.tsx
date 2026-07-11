import { createHike } from "@/api/hikes";
import { showErrorAtom } from "@/atoms/snackbar-atoms";
import { stigviddUserAtom } from "@/atoms/user-atoms";
import Map from "@/components/map/map";
import { BORDER_RADIUS } from "@/constants/constants";
import { ActiveHike, CreateHikeRequest } from "@/data/types";
import { asTranslationKey } from "@/i18n";
import FormattedTime from "@/utils/format-time-from-ms";
import { lineStringFromPositions } from "@/utils/geojson";
import getBoundsFromTrail from "@/utils/get-bounds-from-trail";
import { recomputeTrimmedHike } from "@/utils/trim-hike";
import { MaterialIcons } from "@expo/vector-icons";
import { zodResolver } from "@hookform/resolvers/zod";
import { Camera, type CameraRef, GeoJSONSource, Layer } from "@maplibre/maplibre-react-native";
import { Slider } from "@miblanchard/react-native-slider";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useAtomValue, useSetAtom } from "jotai";
import { useCallback, useMemo, useRef, useState } from "react";
import { Controller, SubmitHandler, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";
import { Divider, Text, TextInput, useTheme } from "react-native-paper";
import { z } from "zod";

interface Props {
  hike: ActiveHike;
  onDismiss: () => void;
  onSaveSuccess: () => void;
}

const saveHikeFields = z.object({
  hikeName: z.string({ required_error: "hike.nameRequired" }).min(3, "hike.nameTooShort").max(40, "hike.nameTooLong"),
});

type SaveHikeFormData = z.infer<typeof saveHikeFields>;

export default function SaveHikeForm({ hike, onDismiss, onSaveSuccess }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const setErrorMsg = useSetAtom(showErrorAtom);
  const cameraRef = useRef<CameraRef>(null);
  const queryClient = useQueryClient();
  const user = useAtomValue(stigviddUserAtom);

  const { mutate, isPending } = useMutation({
    mutationFn: (newHike: CreateHikeRequest) => createHike(newHike),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hikes", user.data?.identifier] });
      onSaveSuccess();
      onDismiss();
      router.replace("/(tabs)/(profile-stack)/user/my-hikes");
    },
    onError: () => {
      setErrorMsg(t("hike.errorSaving"));
    },
  });

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<SaveHikeFormData>({
    resolver: zodResolver(saveHikeFields),
    defaultValues: { hikeName: "" },
  });

  // Total recorded points across all segments — the trim slider's domain.
  const totalPoints = useMemo(
    () => hike.segments.reduce((sum, segment) => sum + segment.coordinates.length, 0),
    [hike.segments],
  );

  // Inclusive [start, end] index window the user keeps. Defaults to the full route.
  const [trim, setTrim] = useState<[number, number]>(() => [0, Math.max(0, totalPoints - 1)]);

  // Distance, duration and coordinates recomputed for the kept window.
  const trimmed = useMemo(() => recomputeTrimmedHike(hike.segments, trim[0], trim[1]), [hike.segments, trim]);

  const canTrim = totalPoints > 2;

  // The backend rejects a hike with no distance or duration; guard here so the user
  // gets a clear message instead of a generic save error after a too-tight trim.
  const canSave = trimmed.distance > 0 && trimmed.duration > 0;

  const submit: SubmitHandler<SaveHikeFormData> = async (data) => {
    const newHike: CreateHikeRequest = {
      name: data.hikeName,
      hikeLength: trimmed.distance,
      duration: trimmed.duration,
      coordinates: trimmed.coordinates,
    };
    mutate(newHike);
  };

  // Full route shown faded for context; the kept portion drawn solid on top.
  const fullPositions = useMemo<GeoJSON.Position[]>(
    () =>
      hike.segments.flatMap((segment) =>
        segment.coordinates.map((c) => [c.data.longitude, c.data.latitude] as GeoJSON.Position),
      ),
    [hike.segments],
  );
  const keptPositions = useMemo<GeoJSON.Position[]>(
    () => trimmed.coordinates.map((c) => [c.longitude, c.latitude] as GeoJSON.Position),
    [trimmed.coordinates],
  );

  const fullShape = useMemo(() => lineStringFromPositions(fullPositions), [fullPositions]);
  const keptShape = useMemo(() => lineStringFromPositions(keptPositions), [keptPositions]);
  const bounds = useMemo(() => getBoundsFromTrail(fullPositions), [fullPositions]);

  const fitToRoute = useCallback(() => {
    if (bounds)
      cameraRef.current?.fitBounds(bounds, { padding: { top: 30, right: 30, bottom: 30, left: 30 }, duration: 0 });
  }, [bounds]);

  const openDialogIfValid = handleSubmit(submit);

  return (
    <View style={s.container}>
      <Controller
        name="hikeName"
        control={control}
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            error={!!errors.hikeName}
            style={{ backgroundColor: theme.colors.surface }}
            onChangeText={onChange}
            onBlur={onBlur}
            value={value}
            label={t("hike.name")}
            mode="outlined"
            maxLength={40}
          />
        )}
      />
      {errors.hikeName?.message && (
        <Text style={[s.errorText, { color: theme.colors.error }]}>{t(asTranslationKey(errors.hikeName.message))}</Text>
      )}

      <View style={[s.statsCard, { backgroundColor: theme.colors.outlineVariant }]}>
        <View style={s.statItem}>
          <Text variant="labelSmall" style={[s.statLabel, { color: theme.colors.onSurfaceVariant }]}>
            {t("hike.distance")}
          </Text>
          <Text variant="headlineSmall" style={s.statValue}>
            {trimmed.distance > 100 ? `${(trimmed.distance / 1000).toFixed(2)} km` : `${trimmed.distance} m`}
          </Text>
        </View>
        <Divider style={[s.statDivider, { backgroundColor: theme.colors.outline }]} />
        <View style={s.statItem}>
          <Text variant="labelSmall" style={[s.statLabel, { color: theme.colors.onSurfaceVariant }]}>
            {t("hike.time")}
          </Text>
          <Text variant="headlineSmall" style={s.statValue}>
            {FormattedTime(trimmed.duration)}
          </Text>
        </View>
      </View>

      {fullPositions.length > 0 && (
        <View style={s.mapContainer}>
          <Map style={s.map} showsUserLocation={false} onDidFinishLoadingMap={fitToRoute}>
            <Camera ref={cameraRef} />
            {/* Full route, faded — the trimmed-away portions stay visible for context. */}
            <GeoJSONSource id="save-hike-route-full" data={fullShape}>
              <Layer
                type="line"
                id="save-hike-route-full-line"
                layout={{ "line-join": "round", "line-cap": "round" }}
                paint={{ "line-color": theme.colors.outline, "line-width": 3 }}
              />
            </GeoJSONSource>
            {/* Kept portion drawn solid on top. */}
            {keptPositions.length > 1 && (
              <GeoJSONSource id="save-hike-route-kept" data={keptShape}>
                <Layer
                  type="line"
                  id="save-hike-route-kept-line"
                  layout={{ "line-join": "round", "line-cap": "round" }}
                  paint={{ "line-color": theme.colors.primary, "line-width": 4 }}
                />
              </GeoJSONSource>
            )}
          </Map>
        </View>
      )}

      {canTrim && (
        <View style={s.trimSection}>
          <Text variant="bodySmall" style={s.trimLabel}>
            {t("hike.trimRoute")}
          </Text>
          <Slider
            value={trim}
            minimumValue={0}
            maximumValue={totalPoints - 1}
            step={1}
            minimumTrackTintColor={theme.colors.primary}
            maximumTrackTintColor={theme.colors.outline}
            thumbTintColor={theme.colors.primary}
            onValueChange={(value) => {
              const [start, end] = value as number[];
              setTrim([Math.round(Math.min(start, end)), Math.round(Math.max(start, end))]);
            }}
          />
          <Text variant="bodySmall" style={[s.trimHint, { color: theme.colors.onSurfaceVariant }]}>
            {t("hike.trimHint")}
          </Text>
        </View>
      )}

      {!canSave && <Text style={[s.errorText, { color: theme.colors.error }]}>{t("hike.trimTooShort")}</Text>}

      <View style={s.actions}>
        <Pressable
          style={[s.actionButton, { backgroundColor: theme.colors.outlineVariant }]}
          disabled={isPending}
          onPress={onDismiss}
        >
          <MaterialIcons name="arrow-back" size={22} color={theme.colors.onSurface} />
          <Text style={s.buttonText}>{t("hike.goBack")}</Text>
        </Pressable>
        <Pressable
          style={[
            s.actionButton,
            { backgroundColor: theme.colors.primary },
            (isPending || !canSave) && s.disabledButton,
          ]}
          disabled={isPending || !canSave}
          onPress={openDialogIfValid}
        >
          <MaterialIcons name="save" size={22} color={theme.colors.onPrimary} />
          <Text style={[s.buttonText, { color: theme.colors.onPrimary }]}>
            {isPending ? t("common.saving") : t("common.save")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    gap: 12,
  },
  errorText: {
    fontSize: 12,
    paddingLeft: 4,
  },
  statsCard: {
    flexDirection: "row",
    borderRadius: BORDER_RADIUS,
    padding: 16,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  statLabel: {
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 24,
  },
  statDivider: {
    width: 1,
    marginVertical: 4,
  },
  mapContainer: {
    height: 200,
    borderRadius: BORDER_RADIUS,
    overflow: "hidden",
  },
  map: {
    flex: 1,
  },
  trimSection: {
    gap: 4,
  },
  trimLabel: {
    fontFamily: "Inter_600SemiBold",
  },
  trimHint: {
    fontSize: 12,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: BORDER_RADIUS,
    gap: 8,
    height: 52,
  },
  disabledButton: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
