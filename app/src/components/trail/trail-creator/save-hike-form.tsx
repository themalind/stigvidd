import { createHike } from "@/api/hikes";
import { showErrorAtom } from "@/atoms/snackbar-atoms";
import { stigviddUserAtom } from "@/atoms/user-atoms";
import Map from "@/components/map/map";
import { BORDER_RADIUS } from "@/constants/constants";
import { ActiveHike, CreateHikeRequest } from "@/data/types";
import { asTranslationKey } from "@/i18n";
import FormattedTime from "@/utils/format-time-from-ms";
import GetRegionFromTrail from "@/utils/get-region-from-trail";
import { MaterialIcons } from "@expo/vector-icons";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useAtomValue, useSetAtom } from "jotai";
import { useEffect, useMemo, useRef } from "react";
import { Controller, SubmitHandler, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";
import MapView, { LatLng, Polyline } from "react-native-maps";
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
  const mapRef = useRef<MapView>(null);
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

  const submit: SubmitHandler<SaveHikeFormData> = async (data) => {
    const newHike: CreateHikeRequest = {
      name: data.hikeName,
      hikeLength: hike.totalDistance,
      duration: hike.totalTime,
      coordinates: [],
    };
    hike.segments.forEach((segment) => {
      segment.coordinates.forEach((coords) => {
        newHike.coordinates.push(coords.data);
      });
    });
    mutate(newHike);
  };

  const route = useMemo<LatLng[]>(() => {
    const coords: LatLng[] = [];
    hike.segments.forEach((segment) => {
      segment.coordinates.forEach((coordinate) => {
        coords.push({ latitude: coordinate.data.latitude, longitude: coordinate.data.longitude });
      });
    });
    return coords;
  }, [hike.segments]);

  useEffect(() => {
    if (!mapRef.current || hike.totalDistance === 0) return;
    mapRef.current.animateToRegion(GetRegionFromTrail(route), 500);
  }, [route, hike.totalDistance]);

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
          <Text style={s.statLabel}>Distans</Text>
          <Text style={s.statValue}>
            {hike.totalDistance > 100 ? `${(hike.totalDistance / 1000).toFixed(2)} km` : `${hike.totalDistance} m`}
          </Text>
        </View>
        <Divider style={[s.statDivider, { backgroundColor: theme.colors.outline }]} />
        <View style={s.statItem}>
          <Text style={s.statLabel}>Tid</Text>
          <Text style={s.statValue}>{FormattedTime(hike.totalTime)}</Text>
        </View>
      </View>

      {route.length > 0 && (
        <View style={s.mapContainer}>
          <Map style={s.map} ref={mapRef} initialRegion={GetRegionFromTrail(route)}>
            <Polyline coordinates={route} strokeColor={theme.colors.primary} strokeWidth={3} />
          </Map>
        </View>
      )}

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
          style={[s.actionButton, { backgroundColor: theme.colors.primary }]}
          disabled={isPending}
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
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    opacity: 0.6,
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
  buttonText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
