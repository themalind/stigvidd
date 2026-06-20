import { ApiError } from "@/api/api-error";
import { deleteHike, shareHike, updateHike } from "@/api/hikes";
import { showErrorAtom, showSuccessAtom } from "@/atoms/snackbar-atoms";
import { stigviddUserAtom } from "@/atoms/user-atoms";
import AlertDialog from "@/components/alert-dialog";
import ShareHikeModal, { ShareHikeFormFields } from "@/components/shared-hike/share-hike-modal";
import { BORDER_RADIUS, SURFACE_BORDER_RADIUS } from "@/constants/constants";
import { Hike, ShareHikeRequest, UpdateHikeRequest } from "@/data/types";
import CoordinateParser from "@/utils/coordinate-parser";
import FormattedTime from "@/utils/format-time-from-ms";
import { lineStringFromPositions } from "@/utils/geojson";
import getBoundsFromTrail from "@/utils/get-bounds-from-trail";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Camera, type CameraRef, GeoJSONSource, Layer } from "@maplibre/maplibre-react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BlurView } from "expo-blur";
import { useAtomValue, useSetAtom } from "jotai";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dimensions, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Button, Divider, Icon, Modal, Portal, Text, useTheme } from "react-native-paper";
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

  const cameraRef = useRef<CameraRef>(null);
  const theme = useTheme();
  const { t } = useTranslation();
  const user = useAtomValue(stigviddUserAtom);
  const queryClient = useQueryClient();
  const coordinates = CoordinateParser({ data: hike.coordinates ?? "", identifier: hike.identifier });
  const routeShape = lineStringFromPositions(coordinates);

  const handleMapReady = () => {
    const bounds = getBoundsFromTrail(coordinates);
    if (!bounds) return;
    cameraRef.current?.fitBounds(bounds, { padding: { top: 20, right: 20, bottom: 20, left: 20 }, duration: 0 });
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
        <View style={s.hikeNameContainer}>
          <MaterialCommunityIcons name="map-legend" size={24} color={theme.colors.primary} />
          <Text style={s.hikeName} numberOfLines={1}>
            {hike.name}
          </Text>
          <View style={s.closeButtonSpacer} />
        </View>
        <View style={s.mapContainer}>
          {coordinates.length > 0 && (
            <Map style={s.map} showsUserLocation={false} onDidFinishLoadingMap={handleMapReady}>
              <Camera ref={cameraRef} />
              <GeoJSONSource id="hike-details-route" data={routeShape}>
                <Layer
                  type="line"
                  id="hike-details-route-line"
                  layout={{ "line-join": "round", "line-cap": "round" }}
                  paint={{ "line-color": theme.colors.primary, "line-width": 3 }}
                />
              </GeoJSONSource>
            </Map>
          )}
        </View>
        <View style={[s.statsCard, { backgroundColor: theme.colors.outlineVariant }]}>
          <View style={s.statItem}>
            <Text style={s.statLabel}>{t("hike.length")}</Text>
            <Text style={s.statValue}>{hike.hikeLength} km</Text>
          </View>
          <Divider style={[s.statDivider, { backgroundColor: theme.colors.outline }]} />
          <View style={s.statItem}>
            <Text style={s.statLabel}>{t("hike.time")}</Text>
            <Text style={s.statValue}>{FormattedTime(hike.duration)}</Text>
          </View>
        </View>
        <ScrollView
          style={s.infoScroll}
          contentContainerStyle={s.infoScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {(hike.gettingThere || hike.parkingInfo || hike.description) && (
            <>
              <Divider style={s.divider} />

              {hike.gettingThere && (
                <View style={s.infoRow}>
                  <Icon source="map-marker" size={18} color={theme.colors.primary} />
                  <View style={s.infoText}>
                    <Text style={[s.infoLabel, { color: theme.colors.secondary }]}>{t("hike.gettingThere")}</Text>
                    <Text>{hike.gettingThere}</Text>
                  </View>
                </View>
              )}
              {hike.parkingInfo && (
                <View style={s.infoRow}>
                  <Icon source="car" size={18} color={theme.colors.primary} />
                  <View style={s.infoText}>
                    <Text style={[s.infoLabel, { color: theme.colors.secondary }]}>{t("hike.parking")}</Text>
                    <Text>{hike.parkingInfo}</Text>
                  </View>
                </View>
              )}
              {hike.description && (
                <View style={s.infoRow}>
                  <Icon source="text" size={18} color={theme.colors.primary} />
                  <View style={s.infoText}>
                    <Text style={[s.infoLabel, { color: theme.colors.secondary }]}>{t("hike.description")}</Text>
                    <Text>{hike.description}</Text>
                  </View>
                </View>
              )}
            </>
          )}
        </ScrollView>
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
    position: "absolute",
    top: 15,
    right: 15,
    zIndex: 1,
  },
  closeButtonSpacer: {
    width: 24,
  },
  contentContainerStyle: {
    justifyContent: "flex-start",
    maxHeight: HEIGHT * 0.9,
    borderRadius: BORDER_RADIUS,
    padding: 15,
    gap: 15,
  },
  hikeNameContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minWidth: 0,
  },
  hikeName: {
    fontSize: 15,
    fontWeight: 700,
    flex: 1,
    minWidth: 0,
  },
  statsCard: {
    flexDirection: "row",
    borderRadius: BORDER_RADIUS,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    opacity: 0.6,
  },
  statValue: {
    fontSize: 18,
  },
  statDivider: {
    width: 1,
    marginVertical: 4,
  },
  mapContainer: {
    height: HEIGHT * 0.4,
    flexShrink: 0,
    borderRadius: SURFACE_BORDER_RADIUS,
    overflow: "hidden",
  },
  map: {
    flex: 1,
  },
  buttonGroup: {
    flexDirection: "row",
    gap: 20,
  },
  button: {
    borderRadius: BORDER_RADIUS,
    flex: 1,
  },
  infoScroll: {
    flexShrink: 1,
  },
  infoScrollContent: {
    gap: 12,
    paddingBottom: 4,
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
});
