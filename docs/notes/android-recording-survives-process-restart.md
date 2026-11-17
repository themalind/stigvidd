<!--
SPDX-FileCopyrightText: 2026 The Stigvidd Authors
SPDX-License-Identifier: AGPL-3.0-or-later
-->

# On Android a new app process does not mean the hike recording died, and its notification tap carries nothing

Read from the installed native sources on 2026-11-17 (expo-location 58.0.20); not yet seen on a device.

**The tap.** The "Spelar in vandring..." notification belongs to expo-location's
`LocationTaskService.buildServiceNotification`, not to expo-notifications. Its content intent is
`getLaunchIntentForPackage` with `flags = FLAG_ACTIVITY_SINGLE_TOP`, with no data or extras. So the
tap is identical to the launcher icon: no `useLastNotificationResponse`, no `+native-intent`, and
the app shows whatever screen it had, or the start page if the activity was rebuilt. The app cannot
tell the two apart from JS. `useOpenActiveRecording` (app/src/hooks/hike/) therefore opens the
recorder on any start, or on a return after `AWAY_BEFORE_RECORDER_MS`, while `isTracking`. A tap-only
route would need a patched contentIntent and a new build.

**The restart.** `LocationTaskService.onStartCommand` returns `START_REDELIVER_INTENT`, and
expo-task-manager's `TaskService.restoreTasks` calls `LocationTaskConsumer.didRegister` in every
new process, which restarts location updates and the foreground service. The headless task runs
in the app's shared `reactHost` (`RNHeadlessAppLoader`), so it keeps writing to storage before
any screen mounts. The once-per-process cold-launch recovery in `use-location-tracking.ts`
assumed "new process = engine dead" (true on iOS) and stopped a live recording. On Android it
now keeps a running task whose last fix is within `RESTART_GRACE` (`survivedRestart` in
`location-task.ts`); an older fix still pauses, since the restored task's next fix may be far away.

**Also measured here:** on Android 11+ `requestBackgroundPermissionsAsync` leaves the app for the
settings page, so it is asked only when a new hike starts, never on resume.

Related: [[router-push-into-unmounted-tab-has-no-back]], [[ios-background-suspension]].
