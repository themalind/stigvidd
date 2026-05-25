import { removeSharedHike, reshareHike } from "@/api/shared-hikes";
import { ApiError } from "@/api/users";
import { showErrorAtom, showSuccessAtom } from "@/atoms/snackbar-atoms";
import { stigviddUserAtom } from "@/atoms/user-atoms";
import AlertDialog from "@/components/alert-dialog";
import ReshareHikeModal from "@/components/shared-hike/reshare-hike-modal";
import { BORDER_RADIUS, SURFACE_BORDER_RADIUS } from "@/constants/constants";
import { ReshareSharedHikeRequest, SharedHike } from "@/data/types";
import CoordinateParser from "@/utils/coordinate-parser";
import { formatDate } from "@/utils/format-date";
import FormattedTime from "@/utils/format-time-from-ms";
import GetRegionFromTrail from "@/utils/get-region-from-trail";
import { Fontisto } from "@expo/vector-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BlurView } from "expo-blur";
import { useAtomValue, useSetAtom } from "jotai";
import { useRef, useState } from "react";
import { Dimensions, Pressable, ScrollView, StyleSheet, View } from "react-native";
import MapView, { Polyline } from "react-native-maps";
import { Button, Divider, Icon, Modal, Portal, Text, useTheme } from "react-native-paper";
import { useTranslation } from "react-i18next";
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
  const [showShareModal, setShowShareModal] = useState(false);

  const mapRef = useRef<MapView>(null);
  const theme = useTheme();
  const { t } = useTranslation();
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
      setSuccessMsg(t("hike.sharedHikeDeleted"));
    },
    onError: () => {
      setErrorMsg(t("hike.genericError"));
    },
  });

  const reShareMutation = useMutation({
    mutationFn: (request: ReshareSharedHikeRequest) => reshareHike(request),
    onSuccess: () => {
      setShowShareModal(false);
      onDismiss();
      setSuccessMsg(t("hike.shared"));
    },
    onError: (error) => {
      setShowShareModal(false);
      onDismiss();
      if (error instanceof ApiError && error.status === 409) {
        setErrorMsg(t("hike.sharedHikeAlreadyHas"));
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
        <Pressable style={s.closeIcon} hitSlop={12} onPress={onDismiss}>
          <Icon size={24} source="close" color={theme.colors.onSurface} />
        </Pressable>
        <View style={[s.hikeDetailsContainer, { backgroundColor: theme.colors.outlineVariant }]}>
          <View style={s.hikeNameContainer}>
            <Fontisto name="map" size={20} color={theme.colors.primary} />
            <Text style={[s.hikeName, { color: theme.colors.secondary }]}>{sharedHike.hikeName}</Text>
          </View>
          <View style={s.hikeInfo}>
            <Text>
              <Icon color={theme.colors.tertiary} size={20} source="hiking" /> {sharedHike.hikeLength} km
            </Text>
            <Text>
              <Icon color={theme.colors.tertiary} size={20} source="clock" /> {FormattedTime(sharedHike.duration)}
            </Text>
          </View>
        </View>

        <View style={s.mapContainer}>
          {sharedHike.coordinates && sharedHike.coordinates.length > 0 && (
            <Map style={s.map} ref={mapRef} initialRegion={GetRegionFromTrail(coordinates)} onMapReady={handleMapReady}>
              <Polyline coordinates={coordinates} strokeWidth={3} strokeColor="#eb3204" />
            </Map>
          )}
        </View>
        <ScrollView style={s.scrollArea} contentContainerStyle={s.scrollContent} bounces={false}>
          <View style={s.sharedDetails}>
            <View style={s.row}>
              <Text style={[s.bold, { color: theme.colors.secondary }]}>{t("hike.sharedBy")} </Text>
              <Text>{sharedHike.sharedByName}</Text>
            </View>
            <View style={s.row}>
              <Text style={[s.bold, { color: theme.colors.secondary }]}>{t("hike.date")} </Text>
              <Text>{formatDate(sharedHike.sharedAt)}</Text>
            </View>
          </View>
          {(sharedHike.gettingThere || sharedHike.parkingInfo || sharedHike.description) && (
            <>
              <Divider style={s.divider} />
              {sharedHike.gettingThere && (
                <View style={s.infoRow}>
                  <Icon source="map-marker" size={18} color={theme.colors.primary} />
                  <View style={s.infoText}>
                    <Text style={[s.infoLabel, { color: theme.colors.secondary }]}>{t("hike.gettingThere")}</Text>
                    <Text>{sharedHike.gettingThere}</Text>
                  </View>
                </View>
              )}
              {sharedHike.parkingInfo && (
                <View style={s.infoRow}>
                  <Icon source="car" size={18} color={theme.colors.primary} />
                  <View style={s.infoText}>
                    <Text style={[s.infoLabel, { color: theme.colors.secondary }]}>{t("hike.parking")}</Text>
                    <Text>{sharedHike.parkingInfo}</Text>
                  </View>
                </View>
              )}
              {sharedHike.description && (
                <View style={s.infoRow}>
                  <Icon source="text" size={18} color={theme.colors.primary} />
                  <View style={s.infoText}>
                    <Text style={[s.infoLabel, { color: theme.colors.secondary }]}>{t("hike.description")}</Text>
                    <Text>{sharedHike.description}</Text>
                  </View>
                </View>
              )}
            </>
          )}
        </ScrollView>
        <View style={s.buttonGroup}>
          <Button style={s.button} mode="contained" onPress={() => setShowShareModal(true)}>
            <View style={s.buttonContent}>
              <Icon color={theme.colors.onPrimary} size={20} source="share" />
              <Text style={{ color: theme.colors.onPrimary }}>{t("common.share")}</Text>
            </View>
          </Button>
          <Button style={s.button} mode="outlined" onPress={handeleDelete}>
            <View style={s.buttonContent}>
              <Icon size={20} source="delete" />
              <Text>{t("common.delete")}</Text>
            </View>
          </Button>
        </View>

        <AlertDialog
          visible={showOnDeleteDialog}
          onDismiss={() => setOnDeleteDialog(false)}
          title={t("hike.deleteTitle")}
          infoText={[t("hike.deleteConfirm")]}
          textColor={theme.colors.onSurface}
          confirmText={t("common.delete")}
          cancelText={t("common.cancel")}
          onConfirm={() => deleteMutation.mutate(sharedHike.hikeIdentifier)}
          backgroundColor={theme.colors.surface}
        />
        <ReshareHikeModal
          visible={showShareModal}
          onDismiss={() => setShowShareModal(false)}
          onShare={(friendNickName) => {
            if (friendNickName === sharedHike.createdByName) {
              setShowShareModal(false);
              onDismiss();
              setErrorMsg(t("hike.cannotShareWithCreator"));
              return;
            }
            reShareMutation.mutate({ hikeIdentifier: sharedHike.hikeIdentifier, reShareToName: friendNickName });
          }}
          isPending={reShareMutation.isPending}
          excludeNickName={sharedHike.sharedByName}
        />
      </Modal>
    </Portal>
  );
}

const s = StyleSheet.create({
  contentContainerStyle: {
    justifyContent: "flex-start",
    height: HEIGHT * 0.9,
    borderRadius: BORDER_RADIUS,
    padding: 15,
    gap: 10,
  },
  closeIcon: {
    alignSelf: "flex-end",
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
    fontSize: 18,
    fontWeight: 700,
  },
  hikeInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sharedDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  row: {
    flexDirection: "row",
  },
  bold: {
    fontWeight: 700,
  },
  mapContainer: {
    borderWidth: 0.3,
    borderColor: "black",
    height: HEIGHT * 0.4,
    borderRadius: SURFACE_BORDER_RADIUS,
    overflow: "hidden",
  },
  map: {
    flex: 1,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    gap: 10,
    paddingVertical: 4,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  infoText: {
    flex: 1,
    gap: 2,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  divider: {
    marginVertical: 4,
  },
  buttonGroup: {
    flexDirection: "row",
    gap: 20,
    paddingTop: 10,
  },
  button: {
    flex: 1,
    borderRadius: BORDER_RADIUS,
  },
  buttonContent: {
    gap: 5,
    flexDirection: "row",
  },
});
