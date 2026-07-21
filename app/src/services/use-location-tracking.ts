import { showErrorAtom } from "@/atoms/snackbar-atoms";
import { ActiveHike, LocationData, Segment } from "@/data/types";
import * as Location from "expo-location";
import { useSetAtom } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, AppState, Linking } from "react-native";
import {
  LOCATION_TASK_NAME,
  MIN_DISTANCE,
  MIN_SEGMENT_DISTANCE,
  StoredHikeState,
  clearHikeState,
  defaultHikeState,
  evaluatePoint,
  finalizeActiveSegment,
  ingestFixes,
  maybeFinalizeStaleHike,
  mutateHikeState,
  readHikeState,
} from "./location-task";
import {
  addLiveLocationListener,
  drainLiveLocation,
  isLiveLocationAvailable,
  startLiveLocation,
  stopLiveLocation,
} from "./live-location";

// How often the background task samples GPS (ms). Android-only — on iOS the
// sampling cadence is driven purely by distanceInterval (see startTracking).
const SAMPLE_INTERVAL = 3000;
// How often the UI reads AsyncStorage to reflect background task updates (ms)
const POLL_INTERVAL = 2000;

// True once cold-launch recovery has been attempted in this app process. Module
// scope (not a ref) so it survives component remounts but resets on a fresh launch —
// which is exactly how we tell an interrupted recording (new process, engine dead)
// from an active one that just remounted (same process, engine still running).
let recoveryAttempted = false;

export function useLocationTracking() {
  const { t } = useTranslation();
  const setError = useSetAtom(showErrorAtom);
  // Holds the setInterval handle for the polling loop
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [hike, setHike] = useState<ActiveHike>(defaultHikeState.hike);
  const [currentSegment, setCurrentSegment] = useState<Segment | null>(null);
  const [isTracking, setIsTracking] = useState(false);

  // Live foreground track of the active segment, updated on every GPS fix. Drives
  // the drawn route so it follows the user dot in real time instead of catching up
  // in polling-sized jumps. Purely visual — the background task remains the source
  // of truth for persisted distance and segments (see routePositions in the UI).
  const [liveCoordinates, setLiveCoordinates] = useState<LocationData[]>([]);
  const liveCoordsRef = useRef<LocationData[]>([]);
  const setLive = useCallback((coords: LocationData[]) => {
    liveCoordsRef.current = coords;
    setLiveCoordinates(coords);
  }, []);

  // Whether to drive background recording with the native iOS 18+ engine
  // (CLLocationUpdate.liveUpdates + CLBackgroundActivitySession) instead of the
  // expo-location background task. True only on iOS 18+; everywhere else this is
  // false and the existing expo-location pipeline is used unchanged. Captured once
  // in a ref — the answer can't change during a session (it's OS/build-fixed).
  const useNativeRef = useRef(isLiveLocationAvailable());

  // Pulls fixes the native engine buffered while JS was suspended (or is actively
  // delivering) and runs them through the shared evaluatePoint pipeline. Native is
  // the single background source of truth on iOS 18+, so this is the only writer of
  // background points there. Stops the engine if a batch trips the stale-session
  // finalizer. No-op on non-native platforms.
  const drainNative = useCallback(async () => {
    if (!useNativeRef.current) return;
    const fixes = await drainLiveLocation();
    if (!fixes.length) return;
    const { didFinalize } = await ingestFixes(fixes);
    if (didFinalize) await stopLiveLocation();
  }, []);

  // Stops whichever background source is running for the current platform. Native
  // engine on iOS 18+, the expo-location task otherwise.
  const stopBackgroundSource = useCallback(async () => {
    if (useNativeRef.current) {
      await stopLiveLocation();
    } else {
      const isTaskRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      if (isTaskRunning) await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    }
  }, []);

  // Cold-launch recovery. If storage still marks a recording active when a fresh
  // process starts, it was killed mid-hike (force-quit or system termination) and
  // the engine/task died with it. We recover the hike as PAUSED rather than silently
  // resuming: a swipe-away may be deliberate, and continuing would let fixes captured
  // somewhere else entirely (e.g. back home, hours later) re-anchor onto the open
  // segment as a low-speed-over-long-gap "walk" — a straight line across the map plus
  // phantom distance. Closing the segment leaves the data intact and the timer honest;
  // the user then chooses Save / Resume / Discard, and Resume opens a fresh segment
  // (a new anchor), so a disjoint location can never extend the line.
  const recoverInterruptedHike = useCallback(async () => {
    // Land any fixes the engine buffered before it died into the segment first.
    await drainNative();

    const current = await readHikeState();
    if (!current.isTracking || !current.currentSegment) return;

    await stopBackgroundSource();
    await mutateHikeState((state) => (state.isTracking && state.currentSegment ? finalizeActiveSegment(state) : null));
  }, [drainNative, stopBackgroundSource]);

  // Applies a StoredHikeState snapshot into React state
  const applyState = useCallback((state: StoredHikeState) => {
    setHike(state.hike);
    setCurrentSegment(state.currentSegment);
    setIsTracking(state.isTracking);
  }, []);

  // Reads the latest state from AsyncStorage and syncs it into React state.
  // Also auto-finalizes a forgotten recording (inactive or past the hard cap)
  // so reopening the app — or just polling while it's open — can never surface a
  // session that has been silently running for hours.
  const syncFromStorage = useCallback(async () => {
    // On iOS 18+ the native engine is the background source of truth: pull anything
    // it buffered (including everything captured while JS was suspended in the
    // background) into storage BEFORE reflecting state, so the polled UI and the
    // foreground-resume both catch up on the real track. No-op elsewhere.
    await drainNative();

    // Check-and-finalize atomically so a concurrent task batch can't slip a write
    // in between the read and the finalize. Returns null (no write) when the
    // session isn't stale, in which case we just reflect the current state.
    let didFinalize = false;
    const state = await mutateHikeState((current) => {
      const finalized = maybeFinalizeStaleHike(current, Date.now());
      if (finalized) {
        didFinalize = true;
        return finalized;
      }
      return null;
    });
    if (didFinalize) await stopBackgroundSource();
    applyState(state);
  }, [applyState, drainNative, stopBackgroundSource]);

  // On mount: recover a killed recording (once per process), restore state, and
  // listen for the app returning from background.
  useEffect(() => {
    (async () => {
      if (!recoveryAttempted) {
        recoveryAttempted = true;
        await recoverInterruptedHike();
      }
      await syncFromStorage();
    })();

    // Re-sync when the app returns from background so state is never stale
    const appStateSub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        syncFromStorage();
      }
    });

    return () => {
      appStateSub.remove();
    };
  }, [syncFromStorage, recoverInterruptedHike]);

  // Poll AsyncStorage while tracking so the UI stays up to date with background task writes
  useEffect(() => {
    if (isTracking) {
      pollingRef.current = setInterval(syncFromStorage, POLL_INTERVAL);
    } else {
      // Stop polling when tracking is paused or stopped
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [isTracking, syncFromStorage]);

  // Foreground GPS watcher: while tracking, append every accepted fix to the live
  // tail so the drawn route follows the user dot smoothly. Runs only while the app
  // is foregrounded (iOS suspends JS in the background) — the background task keeps
  // recording to storage during that time, and the UI stitches the two by
  // timestamp. Uses the same filter as the task so both agree on what counts.
  useEffect(() => {
    if (!isTracking) return;

    // iOS 18+ native path: the engine already delivers fixes (foreground AND
    // background). Subscribe to its live event for the smooth foreground tail —
    // the durable track comes from draining into storage (see drainNative). Using
    // the engine's own stream here avoids running a second competing
    // CLLocationManager via expo-location's watchPositionAsync.
    if (useNativeRef.current) {
      const sub = addLiveLocationListener((fix) => {
        const candidate: LocationData = {
          data: { latitude: fix.latitude, longitude: fix.longitude },
          timeStamp: fix.timestamp,
        };
        const { accept } = evaluatePoint(liveCoordsRef.current.at(-1), candidate, fix.accuracy);
        if (!accept) return;
        setLive([...liveCoordsRef.current, candidate]);
      });
      return () => {
        sub?.remove();
      };
    }

    let subscription: Location.LocationSubscription | null = null;
    let active = true;

    (async () => {
      try {
        const sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: MIN_DISTANCE },
          (location) => {
            const candidate: LocationData = {
              data: { latitude: location.coords.latitude, longitude: location.coords.longitude },
              timeStamp: location.timestamp,
            };
            const { accept } = evaluatePoint(liveCoordsRef.current.at(-1), candidate, location.coords.accuracy);
            if (!accept) return;
            setLive([...liveCoordsRef.current, candidate]);
          },
        );
        // If tracking stopped while awaiting, tear down immediately.
        if (active) {
          subscription = sub;
        } else {
          sub.remove();
        }
      } catch {
        // If the foreground watcher can't start, the polled line still renders.
      }
    })();

    return () => {
      active = false;
      subscription?.remove();
    };
  }, [isTracking, setLive]);

  const startTracking = async () => {
    // Foreground ("When In Use") is the only hard requirement to start recording.
    const { status: fgPermission } = await Location.requestForegroundPermissionsAsync();
    if (fgPermission !== "granted") {
      setError(t("createHike.fgPermissionDenied"));
      return;
    }

    // iOS never grants "Always" on the first request (it only offers "When In Use"
    // and escalates later), so a non-granted result must NOT block recording. With
    // foreground access + the location background mode, iOS records provisionally in
    // the background and prompts for "Always" on its own. But "When In Use" only
    // survives while the app stays alive in the background — if iOS suspends it under
    // memory pressure mid-hike, only "Always" relaunches it. So we surface a firm,
    // actionable prompt (Open Settings) rather than a transient snackbar, while still
    // letting the recording start provisionally.
    const { status: bgPermission } = await Location.requestBackgroundPermissionsAsync();
    if (bgPermission !== "granted") {
      Alert.alert(t("createHike.bgPermissionTitle"), t("createHike.bgPermissionMessage"), [
        { text: t("createHike.bgPermissionContinue"), style: "cancel" },
        {
          text: t("createHike.bgPermissionOpenSettings"),
          onPress: () => Linking.openSettings().catch(() => undefined),
        },
      ]);
    }

    // Each press of "start" opens a new segment
    const newSegment: Segment = {
      coordinates: [],
      distance: 0,
      startTime: Date.now(),
    };

    // Preserve paused hike data when resuming so segments accumulate correctly.
    // Read + write atomically so a lingering task batch can't clobber the start,
    // and persist before starting the task so it always finds a valid state.
    const newState = await mutateHikeState((existing) => ({
      isTracking: true,
      hike: existing.hike,
      currentSegment: newSegment,
    }));

    // Each new segment starts with an empty live tail so it never carries points
    // from the previous (now finalized) segment.
    setLive([]);

    // iOS 18+ native path: start the background activity session + live-updates
    // stream instead of the expo-location task. These two must be mutually
    // exclusive — running both would double-record the same fixes into storage.
    if (useNativeRef.current) {
      // Clear any fixes left buffered from a previous session so they can't leak
      // into this new segment, then start the engine.
      await drainLiveLocation();
      await startLiveLocation();
      applyState(newState);
      return;
    }

    // Avoid registering the task twice if it somehow survived a previous session
    const isAlreadyRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (!isAlreadyRunning) {
      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        // BestForNavigation keeps the GPS pinned hot for the duration of a recording.
        // High (~kCLLocationAccuracyNearestTenMeters, ~10m target) is too coarse for a
        // walking track: in a pocket with a locked screen the body blocks the antenna
        // and fixes scatter 10-30m, so the drawn line cuts through buildings and many
        // fixes fail the accuracy gate (looking like tracking "stopped"). The battery
        // cost is the standard fitness-app trade-off — we only run this while actively
        // recording and stop the task the moment the user stops.
        accuracy: Location.Accuracy.BestForNavigation,
        // Android-only: caps how often the task fires. On iOS this is ignored and
        // distanceInterval alone drives sampling.
        timeInterval: SAMPLE_INTERVAL,
        distanceInterval: MIN_DISTANCE,
        // iOS-only (safely ignored on Android). Without these, iOS defaults to
        // pausesUpdatesAutomatically = true and pauses background updates when it
        // decides the user is stationary (a rest stop, a viewpoint) without
        // reliably resuming — which both drops track points and, after
        // INACTIVITY_TIMEOUT with no fixes, lets maybeFinalizeStaleHike end the
        // hike behind the user's back. Flagging this as a Fitness activity and
        // disabling auto-pause keeps a hike recording across breaks.
        pausesUpdatesAutomatically: false,
        activityType: Location.ActivityType.Fitness,
        // Show the blue "using your location" status-bar indicator while recording
        // in the background, as Apple expects for continuous-location apps.
        showsBackgroundLocationIndicator: true,
        // Android foreground service: the persistent notification that keeps the
        // OS from killing the recording while backgrounded.
        foregroundService: {
          notificationTitle: "Stigvidd",
          notificationBody: t("createHike.notificationBody"),
        },
      });
    }

    applyState(newState);
  };

  const stopTracking = async () => {
    try {
      if (useNativeRef.current) {
        // Ingest anything the engine still holds so the final points land in this
        // segment, then stop the session. drainNative runs before the finalize
        // mutation below, so those points are part of the completed segment.
        await drainNative();
        await stopLiveLocation();
      } else {
        const isTaskRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
        if (isTaskRunning) {
          await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
        }
      }

      // Finalize atomically against the latest task-written state. A batch still
      // in flight when we stopped either lands before this mutation (its points are
      // included) or after it (it no-ops because isTracking is now false) — never a
      // clobber.
      const newState = await mutateHikeState((state) => {
        const seg = state.currentSegment;
        let updatedHike = state.hike;

        if (seg) {
          const endTime = Date.now();
          // Duration is the span of recorded GPS timestamps, matching the value
          // recomputeTrimmedHike saves — so the live timer and the saved hike agree.
          // Falls back to 0 for a segment with fewer than two fixes.
          const coords = seg.coordinates;
          const segmentDuration = coords.length > 1 ? coords[coords.length - 1].timeStamp - coords[0].timeStamp : 0;
          const completedSegment: Segment = { ...seg, endTime };

          // Only keep the segment if the user actually moved a meaningful distance
          if (completedSegment.distance >= MIN_SEGMENT_DISTANCE) {
            updatedHike = {
              ...state.hike,
              segments: [...state.hike.segments, completedSegment],
              // Accumulate the recorded span of this segment into the total
              totalTime: state.hike.totalTime + segmentDuration,
            };
          } else {
            // Discard the too-short segment as noise, and roll back the distance the
            // background task already accumulated for it — otherwise distance stays
            // stuck at a phantom value while the segment and its time are thrown away.
            updatedHike = {
              ...state.hike,
              totalDistance: Math.max(0, state.hike.totalDistance - seg.distance),
            };
          }
        }

        return {
          isTracking: false,
          hike: updatedHike,
          currentSegment: null,
        };
      });

      applyState(newState);
    } catch {
      // Surface the failure instead of leaving an unhandled rejection and a UI that
      // silently disagrees with the (possibly still-running) background task.
      setError(t("createHike.trackingError"));
    }
  };

  const resetTracking = async () => {
    try {
      if (useNativeRef.current) {
        // Stop the engine and discard any buffered fixes so they can't bleed into
        // the next recording.
        await stopLiveLocation();
        await drainLiveLocation();
      } else {
        // Stop the background task if it's still running
        const isTaskRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
        if (isTaskRunning) {
          await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
        }
      }
      // Wipe persisted state and reset UI back to the initial empty hike
      await clearHikeState();
      setLive([]);
      applyState(defaultHikeState);
    } catch {
      setError(t("createHike.trackingError"));
    }
  };

  // Total recording time as a real stopwatch: the wall-clock span of every
  // completed segment (startTime → endTime) plus, while tracking, the live span of
  // the active segment (startTime → now). It measures against the clock rather than
  // GPS-fix timestamps so it ticks smoothly every second regardless of movement.
  //
  // The *saved* duration is recomputed from GPS timestamps in recomputeTrimmedHike
  // so start/end trimming stays exact; the live stopwatch and the saved duration
  // can therefore differ by the few stationary seconds at a segment's edges, as in
  // any GPS fitness app.
  const getActiveTime = () => {
    const completedTime = hike.segments.reduce(
      (sum, seg) => sum + Math.max(0, (seg.endTime ?? seg.startTime) - seg.startTime),
      0,
    );
    if (!currentSegment) return completedTime;
    return completedTime + Math.max(0, Date.now() - currentSegment.startTime);
  };

  return {
    startTracking,
    stopTracking,
    resetTracking,
    isTracking,
    hike,
    currentSegment,
    liveCoordinates,
    getActiveTime,
  };
}
