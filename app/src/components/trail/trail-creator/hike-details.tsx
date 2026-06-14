import { deleteHike, shareHike, updateHike } from "@/api/hikes";
import { ApiError } from "@/api/api-error";
import { showErrorAtom, showSuccessAtom } from "@/atoms/snackbar-atoms";
import { stigviddUserAtom } from "@/atoms/user-atoms";
import AlertDialog from "@/components/alert-dialog";
import ShareHikeModal, { ShareHikeFormFields } from "@/components/shared-hike/share-hike-modal";
import { BORDER_RADIUS, SURFACE_BORDER_RADIUS } from "@/constants/constants";
import { Hike, ShareHikeRequest, UpdateHikeRequest } from "@/data/types";
import CoordinateParser from "@/utils/coordinate-parser";
import FormattedTime from "@/utils/format-time-from-ms";
import GetRegionFromTrail from "@/utils/get-region-from-trail";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BlurView } from "expo-blur";
import { useAtomValue, useSetAtom } from "jotai";
import { useRef, useState } from "react";
import { Dimensions, Pressable, StyleSheet, View } from "react-native";
import MapView, { Polyline } from "react-native-maps";
import { Button, Icon, Modal, Portal, Text, useTheme } from "react-native-paper";
import { useTranslation } from "react-i18next";
import Map from "../../map/map";

interface Props {
  visible: boolean;
  hike: Hike;
  onDismiss: () => void;
}

const HEIGHT = Dimensions.get("screen").height;

export default function HikeDetails({ visible, hike, onDismiss }: Props) {
  const setErrorMsg = useSetAtom(showErrorAtom);
  const setSuccessMsg = useSetAtom(showSuccessAtom);
  const [showOnDeleteDialog, setOnDeleteDialog] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  const mapRef = useRef<MapView>(null);
  const theme = useTheme();
  const { t } = useTranslation();
  const user = useAtomValue(stigviddUserAtom);
  const queryClient = useQueryClient();
  const coordinates = CoordinateParser({ data: hike.coordinates ?? "", identifier: hike.identifier });

  const handleMapReady = () => {
    if (!mapRef.current || coordinates.length === 0) return;
    mapRef.current.fitToCoordinates(coordinates, {
      edgePadding: { top: 20, right: 20, bottom: 20, left: 20 },
      animated: false,
    });
  };

  const updateHikeMutation = useMutation({
    mutationFn: (request: UpdateHikeRequest) => updateHike(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hikes", user.data?.identifier] });
    },
    onError: () => {
      setErrorMsg(t("hike.updateError"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (identifier: string) => deleteHike(identifier),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hikes", user.data?.identifier] });
      onDismiss();
      setSuccessMsg(t("hike.deleted"));
    },
    onError: () => {
      setErrorMsg(t("hike.genericError"));
    },
  });

  const shareMutation = useMutation({
    mutationFn: (request: ShareHikeRequest) => shareHike(request),
    onSuccess: () => {
      setShowShareModal(false);
      onDismiss();
      setSuccessMsg(t("hike.shared"));
    },
    onError: (error) => {
      setShowShareModal(false);
      onDismiss();
      if (error instanceof ApiError && error.status === 409) {
        setErrorMsg(t("hike.alreadyHas"));
      } else {
        setErrorMsg(t("hike.genericError"));
      }
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
        <Pressable style={s.closeButton} hitSlop={12} onPress={onDismiss}>
          <Icon size={24} source="close" color={theme.colors.onSurface} />
        </Pressable>
        <View style={[s.hikeDetailsContainer, { backgroundColor: theme.colors.outlineVariant }]}>
          <View style={s.hikeNameContainer}>
            <MaterialCommunityIcons name="map-legend" size={24} color={theme.colors.primary} />
            <Text style={s.hikeName} numberOfLines={2}>
              {hike.name}
            </Text>
          </View>
          <View style={s.hikeInfo}>
            <Text>
              <Icon color={theme.colors.tertiary} size={20} source="hiking" /> {hike.hikeLength} km
            </Text>
            <Text>
              <Icon color={theme.colors.tertiary} size={20} source="clock" /> {FormattedTime(hike.duration)}
            </Text>
          </View>
        </View>
        <View style={s.mapContainer}>
          {hike.coordinates && hike.coordinates.length > 0 && (
            <Map style={s.map} ref={mapRef} initialRegion={GetRegionFromTrail(coordinates)} onMapReady={handleMapReady}>
              <Polyline coordinates={coordinates} strokeWidth={3} strokeColor="#eb3204" />
            </Map>
          )}
        </View>
        <View style={s.buttonGroup}>
          <Button style={s.button} mode="contained" icon="share" onPress={() => setShowShareModal(true)}>
            {t("hike.share")}
          </Button>
          <Button style={s.button} mode="outlined" icon="delete" onPress={handeleDelete}>
            {t("hike.delete")}
          </Button>
        </View>
        <AlertDialog
          visible={showOnDeleteDialog}
          onDismiss={() => setOnDeleteDialog(false)}
          title={t("hike.deleteTitle")}
          infoText={[t("hike.deleteConfirm")]}
          textColor={theme.colors.onSurface}
          confirmText={t("hike.delete")}
          cancelText={t("common.cancel")}
          onConfirm={() => deleteMutation.mutate(hike.identifier)}
          backgroundColor={theme.colors.surface}
        />
        <ShareHikeModal
          visible={showShareModal}
          onDismiss={() => setShowShareModal(false)}
          defaultValues={{
            gettingThere: hike.gettingThere ?? undefined,
            parkingInfo: hike.parkingInfo ?? undefined,
            description: hike.description ?? undefined,
          }}
          onShare={async (friendNickName: string, formData: ShareHikeFormFields) => {
            await updateHikeMutation.mutateAsync({
              hikeIdentifier: hike.identifier,
              parkingInfo: formData.parkingInfo || null,
              gettingThere: formData.gettingThere || null,
              description: formData.description || null,
            });
            shareMutation.mutate({ hikeIdentifier: hike.identifier, sharedWithName: friendNickName });
          }}
          isPending={shareMutation.isPending || updateHikeMutation.isPending}
        />
      </Modal>
    </Portal>
  );
}

const s = StyleSheet.create({
  closeButton: {
    alignSelf: "flex-end",
  },
  contentContainerStyle: {
    justifyContent: "flex-start",
    height: HEIGHT * 0.8,
    borderRadius: BORDER_RADIUS,
    padding: 15,
    gap: 15,
  },
  hikeDetailsContainer: {
    gap: 10,
    justifyContent: "space-between",
    padding: 10,
    borderRadius: BORDER_RADIUS,
  },
  hikeNameContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  hikeName: {
    fontSize: 17,
    fontWeight: 700,
    flex: 1,
  },
  hikeInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  mapContainer: {
    height: HEIGHT * 0.4,
    borderRadius: SURFACE_BORDER_RADIUS,
    overflow: "hidden",
  },
  map: {
    flex: 1,
  },
  buttonGroup: {
    flexDirection: "row",
    marginTop: "auto",
    gap: 20,
  },
  button: {
    borderRadius: BORDER_RADIUS,
    flex: 1,
  },
});
