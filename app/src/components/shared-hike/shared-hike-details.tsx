import { removeSharedHike, reshareHike } from "@/api/shared-hikes";
import { showErrorAtom, showSuccessAtom } from "@/atoms/snackbar-atoms";
import { stigviddUserAtom } from "@/atoms/user-atoms";
import AlertDialog from "@/components/alert-dialog";
import { BORDER_RADIUS, SURFACE_BORDER_RADIUS } from "@/constants/constants";
import { ReshareSharedHikeRequest, SharedHike } from "@/data/types";
import CoordinateParser from "@/utils/coordinate-parser";
import { formatDate } from "@/utils/format-date";
import FormattedTime from "@/utils/format-time-from-ms";
import GetRegionFromTrail from "@/utils/get-region-from-trail";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BlurView } from "expo-blur";
import { useAtomValue, useSetAtom } from "jotai";
import { useRef, useState } from "react";
import { Dimensions, Pressable, StyleSheet, View } from "react-native";
import MapView, { Polyline } from "react-native-maps";
import { Button, Icon, Modal, Portal, Text, useTheme } from "react-native-paper";
import Map from "./../map/map";

interface Props {
  visible: boolean;
  sharedHike: SharedHike;
  onDismiss: () => void;
}

const HEIGHT = Dimensions.get("screen").height;

export default function SharedHikeDetails({ visible, sharedHike, onDismiss }: Props) {
  const setErrorMsg = useSetAtom(showErrorAtom);
  const setSuccessMsg = useSetAtom(showSuccessAtom);
  const [showOnDeleteDialog, setOnDeleteDialog] = useState(false);

  const mapRef = useRef<MapView>(null);
  const theme = useTheme();
  const user = useAtomValue(stigviddUserAtom);
  const queryClient = useQueryClient();
  const coordinates = CoordinateParser({ data: sharedHike.coordinates ?? "", identifier: sharedHike.hikeIdentifier });

  const handleMapReady = () => {
    if (!mapRef.current || coordinates.length === 0) return;
    mapRef.current.fitToCoordinates(coordinates, {
      edgePadding: { top: 20, right: 20, bottom: 20, left: 20 },
      animated: false,
    });
  };

  const deleteMutation = useMutation({
    mutationFn: (hikeIdentifier: string) => removeSharedHike(hikeIdentifier),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shared-hikes", user.data?.identifier] });
      onDismiss();
      setSuccessMsg("Promenaden har tagits bort!");
    },
    onError: () => {
      setErrorMsg("Något gick fel försök igen senare.");
    },
  });

  const reShareMutation = useMutation({
    mutationFn: (request: ReshareSharedHikeRequest) => reshareHike(request),
    onSuccess: () => {
      setSuccessMsg("Promenaden har delats!");
    },
    onError: () => {
      setErrorMsg("Något gick fel försök igen senare.");
    },
  });
  const handeleDelete = () => {
    setOnDeleteDialog(true);
  };

  return (
    <Portal>
      {visible && <BlurView intensity={100} tint="dark" style={StyleSheet.absoluteFill} />}
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={[s.contentContainerStyle, { backgroundColor: theme.colors.surface }]}
      >
        <Pressable style={{ alignSelf: "flex-end" }} hitSlop={12} onPress={onDismiss}>
          <Icon size={24} source="close" color={theme.colors.onSurface} />
        </Pressable>

        <Text style={{ fontSize: 18, fontWeight: 700 }}>{sharedHike.hikeName}</Text>
        <Text>
          <Icon size={20} source="hiking" /> {sharedHike.hikeLength} km
        </Text>
        <Text>
          <Icon size={20} source="clock" /> {FormattedTime(sharedHike.duration)}
        </Text>
        <Text>Delad av: {sharedHike.sharedByName}</Text>
        <Text>Delad: {formatDate(sharedHike.sharedAt)}</Text>
        <View style={s.mapContainer}>
          {sharedHike.coordinates && sharedHike.coordinates.length > 0 && (
            <Map style={s.map} ref={mapRef} initialRegion={GetRegionFromTrail(coordinates)} onMapReady={handleMapReady}>
              <Polyline coordinates={coordinates} strokeWidth={3} strokeColor="#eb3204" />
            </Map>
          )}
        </View>
        <Button style={{ borderRadius: BORDER_RADIUS, marginTop: "auto" }} mode="outlined" onPress={handeleDelete}>
          <View style={{ gap: 5, flexDirection: "row" }}>
            <Icon size={20} source="delete" />
            <Text>Ta bort</Text>
          </View>
        </Button>
        <AlertDialog
          visible={showOnDeleteDialog}
          onDismiss={() => setOnDeleteDialog(false)}
          title="Ta bort promenad"
          infoText={["Vill du ta bort promenaden?"]}
          textColor={theme.colors.onSurface}
          confirmText="Ta bort"
          cancelText="Avbryt"
          onConfirm={() => deleteMutation.mutate(sharedHike.hikeIdentifier)}
          backgroundColor={theme.colors.surface}
        />
      </Modal>
    </Portal>
  );
}

const s = StyleSheet.create({
  contentContainerStyle: {
    justifyContent: "flex-start",
    height: HEIGHT * 0.8,
    borderRadius: BORDER_RADIUS,
    padding: 15,
    gap: 15,
  },
  mapContainer: {
    height: HEIGHT * 0.4,
    borderRadius: SURFACE_BORDER_RADIUS,
    overflow: "hidden",
  },
  map: {
    flex: 1,
  },
});
