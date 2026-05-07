import { createHike } from "@/api/hikes";
import { showErrorAtom } from "@/atoms/snackbar-atoms";
import Map from "@/components/map/map";
import { BORDER_RADIUS } from "@/constants/constants";
import { ActiveHike, CreateHikeRequest } from "@/data/types";
import FormattedTime from "@/utils/format-time-from-ms";
import GetRegionFromTrail from "@/utils/get-region-from-trail";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useAtomValue, useSetAtom } from "jotai";
import { stigviddUserAtom } from "@/atoms/user-atoms";
import { useEffect, useMemo, useRef } from "react";
import { Controller, useForm } from "react-hook-form";
import { Pressable, StyleSheet, View } from "react-native";
import MapView, { LatLng, Polyline } from "react-native-maps";
import { Divider, Surface, Text, TextInput, useTheme } from "react-native-paper";

interface Props {
  hike: ActiveHike;
  onDismiss: () => void;
  onSaveSuccess: () => void;
}

type SaveHikeFormData = {
  hikeName: string;
};

export default function SaveHikeForm({ hike, onDismiss, onSaveSuccess }: Props) {
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
      setErrorMsg("Något gick fel försök igen senare.");
    },
  });

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<SaveHikeFormData>({
    defaultValues: {
      hikeName: "",
    },
  });

  const submit = async (data: SaveHikeFormData) => {
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

  const time = FormattedTime(hike.totalTime);

  const route = useMemo<LatLng[]>(() => {
    const coords: LatLng[] = [];

    hike.segments.forEach((segment) => {
      segment.coordinates.forEach((coordinate) => {
        coords.push({
          latitude: coordinate.data.latitude,
          longitude: coordinate.data.longitude,
        });
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
    <View>
      <Controller
        name="hikeName"
        control={control}
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            style={[s.inputText, { backgroundColor: theme.colors.surface }]}
            onChangeText={onChange}
            onBlur={onBlur}
            value={value}
            label="Promenadnamn"
            mode="outlined"
          />
        )}
        rules={{
          required: true,
          minLength: 3,
          maxLength: 60,
        }}
      />
      {errors.hikeName && <Text style={s.errorText}>Ange ett promenadnamn</Text>}

      <View style={s.summary}>
        <View style={s.Left}>
          {hike.totalDistance > 100 ? (
            <Text style={s.summaryText}>{(hike.totalDistance / 1000).toFixed(2)} km</Text>
          ) : (
            <Text style={s.summaryText}>{hike.totalDistance} m</Text>
          )}
        </View>
        <Divider style={{ width: StyleSheet.hairlineWidth, height: "100%" }} />
        <View style={s.Right}>
          <Text style={s.summaryText}>{time}</Text>
        </View>
      </View>

      {route.length > 0 ? (
        <Surface style={s.mapContainer}>
          <View style={s.mapInner}>
            <Map style={s.map} ref={mapRef} initialRegion={GetRegionFromTrail(route)}>
              <Polyline coordinates={route} strokeColor="#f00" strokeWidth={3} />
            </Map>
          </View>
        </Surface>
      ) : null}

      <View style={s.actions}>
        <View style={s.Left}>
          <Pressable style={s.action} disabled={isPending} onPress={onDismiss}>
            <Text>Gå tillbaka</Text>
          </Pressable>
        </View>
        <View style={s.Right}>
          <Pressable style={s.action} disabled={isPending} onPress={openDialogIfValid}>
            <Text>Bekräfta</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  inputText: {
    // borderRadius: BORDER_RADIUS,
    // marginTop: 10,
  },
  errorText: {
    color: "#e00",
    alignSelf: "flex-start",
    paddingLeft: 16,
  },
  summary: {
    flexDirection: "row",
    justifyContent: "center",
    paddingTop: 20,
    gap: 20,
  },
  summaryText: {
    fontSize: 18,
  },
  Left: {
    flex: 1,
    alignItems: "flex-end",
  },
  Right: {
    flex: 1,
    alignItems: "flex-start",
  },
  mapContainer: {
    height: 300,
    borderRadius: BORDER_RADIUS,
    marginVertical: 20,
  },
  mapInner: {
    flex: 1,
    borderRadius: BORDER_RADIUS,
    overflow: "hidden",
  },
  map: {
    flex: 1,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 25,
  },
  action: {
    padding: 15,
  },
});
