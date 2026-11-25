// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import AlertDialog from "@/components/dialog/alert-dialog";
import LoadingIndicator from "@/components/status/loading-indicator";
import Map from "@/components/map/map";
import BasemapToggle from "@/components/map/basemap-toggle";
import CenterOnUserButton from "@/components/map/center-on-user-button";
import { ROUTE_LINE_COLOR, routeCasingPaint } from "@/components/map/marker-styles";
import { BORDER_RADIUS, START_COORDINATE_BORAS } from "@/constants/constants";
import { LocationData } from "@/data/types";
import { dismissRecordingInfo, shouldShowRecordingInfo } from "@/services/location-task";
import { useLocationTracking } from "@/services/use-location-tracking";
import { lineStringFromPositions } from "@/utils/geo/geojson";
import { cancellation } from "@/utils/cancellation";
import FormattedTime from "@/utils/format/format-time-from-ms";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import {
  Camera,
  type CameraRef,
  GeoJSONSource,
  Layer,
  type ViewStateChangeEvent,
} from "@maplibre/maplibre-react-native";
import * as Location from "expo-location";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NativeSyntheticEvent, Pressable, StyleSheet, View } from "react-native";
import { ActivityIndicator, Text, useTheme } from "react-native-paper";
import { useTranslation } from "react-i18next";
import RecordingInfoDialog from "./recording-info-dialog";
import SaveHikeModal from "./save-hike-modal";

const FALLBACK_CENTER: [number, number] = [START_COORDINATE_BORAS.longitude, START_COORDINATE_BORAS.latitude];

export default function HikeRecorder() {
  const cameraRef = useRef<CameraRef>(null);
  const {
    startTracking,
    stopTracking,
    resetTracking,
    isTracking,
    hike,
    currentSegment,
    liveCoordinates,
    getActiveTime,
  } = useLocationTracking();

  // The clock only ticks while recording; the time shown is worked out from it on each render. keep-comment: now is an input, so the compiler cannot freeze the reading
  const [now, setNow] = useState(Date.now);
  const displayTime = getActiveTime(now);

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showStartInfo, setShowStartInfo] = useState(false);
  const [initialCenter, setInitialCenter] = useState<[number, number] | undefined>(undefined);
  const [isLocating, setIsLocating] = useState(false);
  const theme = useTheme();
  const { t } = useTranslation();

  const routePositions = useMemo<[number, number][]>(() => {
    const toPos = (l: LocationData): [number, number] => [l.data.longitude, l.data.latitude];

    const finished = hike.segments.flatMap((segment) => segment.coordinates.map(toPos));

    // keep-comment: background-task points are the base (they hold what was recorded while backgrounded);
    // keep-comment: newer live points go on top so the line keeps up with the dot
    const persistedActive = currentSegment?.coordinates ?? [];
    const lastPersistedTs = persistedActive.at(-1)?.timeStamp ?? 0;
    const liveTail = isTracking ? liveCoordinates.filter((l) => l.timeStamp > lastPersistedTs) : [];

    return [...finished, ...persistedActive.map(toPos), ...liveTail.map(toPos)];
  }, [hike.segments, currentSegment, liveCoordinates, isTracking]);

  const routeShape = useMemo(() => lineStringFromPositions(routePositions), [routePositions]);

  const routePositionsRef = useRef(routePositions);
  useEffect(() => {
    routePositionsRef.current = routePositions;
  });

  // keep-comment: a camera command before the map loads fails ("ReactTagResolver: resolved to null"), so the latest waits
  const mapReadyRef = useRef(false);
  const pendingCenterRef = useRef<{ center: [number, number]; zoom?: number } | null>(null);

  // keep-comment: a user pan stops auto-follow until recentred, so the camera does not yank away mid-look
  const followRef = useRef(true);

  const moveCamera = useCallback((center: [number, number], zoom?: number) => {
    if (mapReadyRef.current) {
      cameraRef.current?.easeTo({ center, ...(zoom !== undefined ? { zoom } : {}), duration: 500 });
    } else {
      pendingCenterRef.current = { center, zoom };
    }
  }, []);

  const handleMapReady = useCallback(() => {
    mapReadyRef.current = true;
    const pending = pendingCenterRef.current;
    if (pending) {
      pendingCenterRef.current = null;
      cameraRef.current?.easeTo({ ...pending, duration: 500 });
    }
  }, []);

  const handleRegionDidChange = useCallback((event: NativeSyntheticEvent<ViewStateChangeEvent>) => {
    if (event.nativeEvent.userInteraction) followRef.current = false;
  }, []);

  const recenterAndFollow = useCallback(() => {
    followRef.current = true;
    const last = routePositionsRef.current.at(-1);
    if (last) moveCamera(last);
  }, [moveCamera]);

  useEffect(() => {
    if (!isTracking) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [isTracking]);

  const formattedTime = FormattedTime(displayTime);

  const formattedDistance = useMemo(() => {
    const km = hike.totalDistance / 1000;
    return `${km.toFixed(2)} km`;
  }, [hike.totalDistance]);

  useEffect(() => {
    const { isCancelled, cancel } = cancellation();
    void (async () => {
      // keep-comment: last-known first, so the map does not wait on a cold GPS fix
      const last = await Location.getLastKnownPositionAsync().catch(() => null);
      if (isCancelled()) return;
      setInitialCenter(last ? [last.coords.longitude, last.coords.latitude] : FALLBACK_CENTER);

      setIsLocating(true);
      try {
        const precise = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (isCancelled() || routePositionsRef.current.length > 0) return;
        moveCamera([precise.coords.longitude, precise.coords.latitude], 16);
      } catch {
        // keep-comment: no precise fix keeps the last-known centre
      } finally {
        if (!isCancelled()) setIsLocating(false);
      }
    })();
    return cancel;
  }, [moveCamera]);

  const handleStartPress = async () => {
    if (await shouldShowRecordingInfo()) {
      setShowStartInfo(true);
      return;
    }
    void startTracking();
  };

  const handleConfirmStart = async (dontShowAgain: boolean) => {
    setShowStartInfo(false);
    if (dontShowAgain) await dismissRecordingInfo();
    void startTracking();
  };

  useEffect(() => {
    if (!followRef.current) return;
    const last = routePositions.at(-1);
    if (!last) return;
    moveCamera(last);
  }, [routePositions, moveCamera]);

  const hasData = hike.segments.length > 0 || (currentSegment && currentSegment.coordinates.length > 0);

  if (!initialCenter) return <LoadingIndicator />;

  return (
    <View style={s.container}>
      <View style={s.mapContainer}>
        <Map
          style={s.map}
          showsUserLocation
          onDidFinishLoadingMap={handleMapReady}
          onRegionDidChange={handleRegionDidChange}
        >
          <Camera ref={cameraRef} initialViewState={{ center: initialCenter, zoom: 16 }} />
          {routePositions.length > 1 && (
            <GeoJSONSource id="hike-route" data={routeShape}>
              <Layer
                type="line"
                id="hike-route-casing"
                layout={{ "line-join": "round", "line-cap": "round" }}
                paint={routeCasingPaint(4)}
              />
              <Layer
                type="line"
                id="hike-route-line"
                layout={{ "line-join": "round", "line-cap": "round" }}
                paint={{ "line-color": ROUTE_LINE_COLOR, "line-width": 4 }}
              />
            </GeoJSONSource>
          )}
        </Map>
        <CenterOnUserButton cameraRef={cameraRef} onPress={recenterAndFollow} />
        <BasemapToggle />
        {isLocating && (
          <View style={[s.locatingPill, { backgroundColor: theme.colors.elevation.level3 }]} pointerEvents="none">
            <ActivityIndicator size={16} color={theme.colors.onSurface} />
            <Text variant="bodySmall" style={{ color: theme.colors.onSurface }}>
              {t("map.locating")}
            </Text>
          </View>
        )}
      </View>

      <View style={[s.statsCard, { backgroundColor: theme.colors.outlineVariant }]}>
        <View style={s.statItem}>
          <Text variant="labelSmall" style={[s.statLabel, { color: theme.colors.onSurfaceVariant }]}>
            {t("hike.time")}
          </Text>
          <Text variant="headlineMedium" style={s.statValue}>
            {formattedTime}
          </Text>
        </View>
        <View style={[s.statDivider, { backgroundColor: theme.colors.outline }]} />
        <View style={s.statItem}>
          <Text variant="labelSmall" style={[s.statLabel, { color: theme.colors.onSurfaceVariant }]}>
            {t("hike.distance")}
          </Text>
          <Text variant="headlineMedium" style={s.statValue}>
            {formattedDistance}
          </Text>
        </View>
      </View>

      <View style={s.actions}>
        {isTracking ? (
          <Pressable style={[s.actionButton, { backgroundColor: theme.colors.surface }]} onPress={() => stopTracking()}>
            <Ionicons name="pause" size={28} color={theme.colors.onSurface} />
            <Text style={s.buttonText}>{t("createHike.pause")}</Text>
          </Pressable>
        ) : !hasData ? (
          <Pressable style={[s.actionButton, { backgroundColor: theme.colors.primary }]} onPress={handleStartPress}>
            <MaterialIcons name="hiking" size={28} color={theme.colors.onPrimary} />
            <Text style={[s.buttonText, { color: theme.colors.onPrimary }]}>{t("createHike.start")}</Text>
          </Pressable>
        ) : (
          <>
            <Pressable
              style={[s.actionButton, { backgroundColor: theme.colors.outlineVariant }]}
              onPress={() => setShowDeleteDialog(true)}
            >
              <MaterialIcons name="close" size={28} color={theme.colors.error} />
              <Text style={s.buttonText}>{t("createHike.reset")}</Text>
            </Pressable>
            <Pressable
              style={[s.actionButton, { backgroundColor: theme.colors.primary }]}
              onPress={() => setShowSaveModal(true)}
            >
              <MaterialIcons name="save" size={28} color={theme.colors.onPrimary} />
              <Text style={[s.buttonText, { color: theme.colors.onPrimary }]}>{t("common.save")}</Text>
            </Pressable>
            <Pressable
              style={[s.actionButton, { backgroundColor: theme.colors.outlineVariant }]}
              onPress={() => startTracking()}
            >
              <MaterialIcons name="play-arrow" size={28} color={theme.colors.onSurface} />
              <Text style={[s.buttonText, { color: theme.colors.onSurface }]}>{t("createHike.resume")}</Text>
            </Pressable>
          </>
        )}
      </View>

      <AlertDialog
        visible={showDeleteDialog}
        onDismiss={() => setShowDeleteDialog(false)}
        onConfirm={() => {
          void resetTracking();
          setShowDeleteDialog(false);
        }}
        title={t("createHike.cancelTitle")}
        infoText={[t("createHike.cancelConfirm")]}
        icon="stop-circle-outline"
        tone="danger"
        irreversible
        cancelText={t("createHike.no")}
        confirmText={t("createHike.yes")}
      />

      <SaveHikeModal
        visible={showSaveModal}
        onDismiss={() => setShowSaveModal(false)}
        onSaveSuccess={resetTracking}
        hike={hike}
      />

      <RecordingInfoDialog
        visible={showStartInfo}
        onDismiss={() => setShowStartInfo(false)}
        onStart={handleConfirmStart}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    gap: 10,
  },
  map: {
    flex: 1,
  },
  mapContainer: {
    flex: 1,
    borderRadius: BORDER_RADIUS,
    overflow: "hidden",
  },
  locatingPill: {
    position: "absolute",
    top: 8,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS,
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
    fontSize: 32,
  },
  statDivider: {
    width: 1,
    marginVertical: 4,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexBasis: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: BORDER_RADIUS,
    gap: 8,
    height: 60,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
