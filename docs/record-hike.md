# Record Hike — Full Flow & Behavior

How the "record a hike" feature works end to end: the happy path, every state
transition, the platform-specific background engines, and the edge cases that are
deliberately handled. This is a behavioral reference, not an API doc — it explains
_why_ the code does what it does so future changes don't quietly undo a fix.

## Key files

| Concern                                       | File                                                           |
| --------------------------------------------- | -------------------------------------------------------------- |
| React hook orchestrating a recording session  | `src/services/use-location-tracking.ts`                        |
| Pure state machine + GPS filter + storage     | `src/services/location-task.ts`                                |
| iOS 18+ native background engine (JS wrapper) | `src/services/live-location.ts`                                |
| iOS 18+ native module (Swift)                 | `modules/expo-live-location/`                                  |
| Recording UI (map, timer, buttons)            | `src/components/trail/trail-creator/trail-creator.tsx`         |
| Permission gate + screen chrome               | `src/app/(tabs)/(profile-stack)/user/create-hike.tsx`          |
| Pre-start info dialog                         | `src/components/trail/trail-creator/recording-info-dialog.tsx` |
| Save form (name, trim, submit)                | `src/components/trail/trail-creator/save-hike-form.tsx`        |
| Trim/duration recompute                       | `src/utils/trim-hike.ts`                                       |

## Core data model

A recording is a **hike** made of one or more **segments**. Each press of Start
opens a new segment; each Pause closes it. This is what lets a hike survive breaks
without counting the rest-stop gap as distance or time.

```
ActiveHike {
  segments: Segment[]        // finalized (paused) segments
  totalDistance: number      // meters, accumulated across all segments
  totalTime: number          // ms, sum of completed segment spans
}

Segment {
  coordinates: LocationData[]  // accepted GPS fixes, in order
  distance: number             // meters within this segment
  startTime: number            // ms epoch, when Start was pressed
  endTime?: number             // ms epoch, set on finalize
}

LocationData { data: { latitude, longitude }, timeStamp }
```

The **single source of truth is an AsyncStorage record** (`@stigvidd_active_hike`),
not React state. The background engine writes to it; the UI polls and mirrors it.
This is what makes a recording survive the app being backgrounded, remounted, or
killed.

## The lifecycle: states and transitions

```
      ┌─────────┐  Start   ┌──────────┐  Pause   ┌─────────┐
      │  IDLE   │ ───────► │ TRACKING │ ───────► │ PAUSED  │
      │ no data │          │ segment  │          │ has data│
      └─────────┘          │  open    │ ◄─────── │         │
           ▲               └──────────┘  Resume  └─────────┘
           │                    │                  │    │
           │                    │ auto-finalize    │Save│ Discard
           │                    ▼ (stale/cap)      ▼    ▼
           └───────────────── PAUSED ────────► (persisted / wiped)
```

- **IDLE** — no segments and no open segment. The only button is **Start**.
- **TRACKING** — a segment is open, GPS is being recorded, the timer ticks. Buttons:
  **Pause**.
- **PAUSED** — has recorded data but nothing is being recorded now. Buttons:
  **Discard**, **Save**, **Resume**.

`hasData = segments.length > 0 || currentSegment has coordinates` decides IDLE vs
PAUSED in the UI (`trail-creator.tsx`).

### Start

1. The screen only mounts `TrailCreator` after **foreground** ("When In Use")
   permission is granted (`create-hike.tsx`). Without it the screen shows
   `createHike.locationRequired` and there is no way to record.
2. First-ever start shows the **recording info dialog** (auto-stop rules, trim hint)
   unless the user dismissed it with "don't show again". Dismissal is versioned
   (`RECORDING_INFO_VERSION`) so changing the rules re-surfaces it.
3. `startTracking()`:
   - Re-requests foreground permission (hard requirement — aborts with an error snack
     if denied).
   - Requests **background** ("Always") permission. **A non-granted result does NOT
     block recording** — see [Background permission](#background-permission-always).
   - Opens a new `Segment { coordinates: [], distance: 0, startTime: now }`.
   - Persists `{ isTracking: true, currentSegment, hike }` atomically _before_
     starting the background source (so the source always finds valid state).
   - Starts the platform background source (native engine on iOS 18+, expo-location
     task otherwise).

### Pause (`stopTracking`)

- Drains any buffered native fixes into the segment first, then stops the background
  source.
- Finalizes the open segment atomically against the latest stored state:
  - If `distance >= MIN_SEGMENT_DISTANCE` (10 m): the segment is appended to
    `hike.segments`, and its recorded span is added to `totalTime`.
  - If shorter: the segment is **discarded as noise**, and the distance the background
    task already accumulated for it is **rolled back** from `totalDistance` (otherwise
    distance would stay stuck at a phantom value).
- State becomes PAUSED (`isTracking: false, currentSegment: null`).

### Resume

- Just `startTracking()` again — opens a _fresh_ segment. Existing segments are
  preserved, so distance/time accumulate. A fresh segment is also a fresh GPS anchor,
  which is what prevents a disjoint location from drawing a line across the map (see
  [Cold-launch recovery](#cold-launch-recovery-killed-mid-hike)).

### Discard (Reset)

- Confirmation dialog → `resetTracking()`: stops the source, discards buffered fixes,
  wipes the storage record, resets UI to the empty hike.

### Save

- Opens the save modal → `SaveHikeForm`. On success the tracking state is reset and
  the user is routed to **My Hikes**. See [Saving](#saving-a-hike).

## The GPS filter (`evaluatePoint`)

Every fix — from either background engine or the foreground watcher — passes through
the **same** pure `evaluatePoint(lastPoint, candidate, accuracy)` function, so the
recorded track and the drawn live line always agree on what counts. A fix is
**rejected** when:

| Rule                     | Threshold                                      | Why                                                                                                         |
| ------------------------ | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Bad accuracy             | missing, `< 0`, or `> MAX_ACCURACY`            | iOS reports negative accuracy when it can't determine one (unusable). iOS gate 40 m, Android 20 m.          |
| Impossible speed         | `distance / dt > MAX_SPEED` (10 m/s ≈ 36 km/h) | Catches GPS teleport spikes while allowing hike/run/cycle.                                                  |
| Teleport (no time delta) | `distance > MAX_DISTANCE` (100 m)              | Fallback when timestamps are missing/non-increasing.                                                        |
| Jitter in place          | `distance < max(MIN_DISTANCE, noiseFloor)`     | A stationary phone wanders within its accuracy radius. iOS `noiseFloor = accuracy/2`, Android `= accuracy`. |

`MIN_DISTANCE` (3 m) is also the GPS `distanceInterval`.

**Why a big jump over a long gap is accepted:** when iOS suspends JS in a pocket, the
user keeps walking. The next fix can be hundreds of meters away — but over a long time
delta that's a _low, plausible speed_, so it's accepted and re-anchors the track to
reality. The same jump over a _short_ delta is a glitch and is rejected. Speed, not raw
distance, is the plausibility gate whenever a usable time delta exists.

## Background recording: two engines

### iOS 18+ — native engine (preferred)

`isLiveLocationAvailable()` returns true only on iOS 18+. There the app uses a local
Swift module (`CLLocationUpdate.liveUpdates` + `CLBackgroundActivitySession`) instead
of the expo-location task. Rationale in memory: `ios-background-suspension` — this was
confirmed on a real hike to keep recording through OS suspension where the plain
expo-location task did not.

- The native engine **buffers** fixes while JS is suspended. `drainLiveLocation()`
  pulls the buffer and runs it through the shared `ingestFixes` pipeline.
- Native is the **single background writer** on iOS 18+. The two engines are mutually
  exclusive — running both would double-record.
- Draining happens on: app returning to foreground (`AppState` → `active`), each poll
  tick, Pause, and cold-launch recovery.
- The foreground live tail subscribes to the engine's own event stream (no second
  `CLLocationManager` via expo-location).

### Android + iOS < 18 — expo-location task

`Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, ...)` with a `TaskManager`
task (`location-task.ts`). Key options and why:

- `accuracy: BestForNavigation` — a pocket + locked screen scatters `High` fixes
  10–30 m; too coarse for a walking line. Battery cost is the standard fitness trade-off
  and it only runs while actively recording. (See memory `ios-location-tracking-tuning`
  — do not downgrade to save battery.)
- `pausesUpdatesAutomatically: false` + `activityType: Fitness` — otherwise iOS
  auto-pauses when it thinks you're stationary and doesn't reliably resume, dropping
  points and eventually tripping the inactivity finalizer behind the user's back.
- `showsBackgroundLocationIndicator: true` — the blue status-bar pill Apple expects.
- `foregroundService` notification — keeps Android from killing the recording while
  backgrounded.

The task maps each `LocationObject` to a `RawFix` and calls `ingestFixes`, the single
atomic write path both platforms share.

## Foreground vs background & the live line

- **Background** (screen off / app backgrounded): the background engine writes accepted
  points to storage. This is the durable, authoritative track.
- **Foreground** (app open): a `watchPositionAsync` watcher (or the native event stream
  on iOS 18+) appends accepted points to a **live tail** so the drawn route follows the
  user dot smoothly in real time — purely visual.
- The UI stitches them (`routePositions` in `trail-creator.tsx`): persisted
  background points are the committed base; the live tail contributes only points newer
  than the last persisted timestamp. So there are no duplicates and no gaps when
  returning from background.

The map auto-follows the route until the user pans/zooms; the center-on-user button
re-enables follow.

## Concurrency & the storage lock

The background task and the UI (start/stop/reset/sync) mutate the same AsyncStorage
record. While the app is alive they share one JS runtime, so a promise-chain lock
(`withHikeStateLock` → `mutateHikeState`) makes each read-modify-write atomic.

Without it, a late task batch could read pre-Pause state and write its points back
_after_ a Pause — resurrecting a finished recording or double-counting distance. With
it, a batch in flight when the user stops either lands before the finalize (its points
are included) or after it (it no-ops because `isTracking` is now false). Never a clobber.

`mutateHikeState(mutator)` — mutator returning `null` means "no change, don't write".

## Auto-stop: forgotten recordings

Two ceilings protect a session the user forgot to stop. Both are evaluated inside
`ingestFixes` (on every batch) and in `syncFromStorage` (on every poll / foreground
resume), via `maybeFinalizeStaleHike`:

- **Inactivity** — no accepted GPS point for `INACTIVITY_TIMEOUT` (60 min) ⇒ finalize.
  The end is trimmed back to the last movement, so stationary time isn't counted.
- **Hard cap** — a single recording running past `MAX_DURATION` (12 h) ⇒ finalize,
  clamped to the cap.

When either trips, the finalized state (`isTracking: false`) is persisted first, then
the background source is stopped — so any in-flight batch safely no-ops. The user finds
the hike in PAUSED state with intact data. These thresholds are surfaced up front in the
recording info dialog.

## Cold-launch recovery (killed mid-hike)

If storage still says `isTracking: true` when a **fresh process** starts, the recording
was killed mid-hike (force-quit or system termination) and the engine/task died with it.
`recoverInterruptedHike()` (guarded by a module-scope `recoveryAttempted` flag so it runs
once per process, distinguishing a killed recording from a mere component remount):

1. Drains any fixes the native engine buffered before it died.
2. If still marked tracking with an open segment, stops the source and **finalizes the
   segment — recovering as PAUSED, not resuming.**

**Why paused, not resumed:** a swipe-away may be deliberate, and silently resuming would
let fixes captured somewhere else entirely (back home, hours later) re-anchor onto the
still-open segment as a low-speed-over-long-gap "walk" — a straight line across the map
plus phantom distance. Closing the segment keeps the data intact and the timer honest;
the user then chooses Save / Resume / Discard. Resume opens a fresh segment (new anchor),
so a disjoint location can never extend the old line.

## The timer: live stopwatch vs saved duration

Two different numbers, by design (memory: `record-hike-timer-wallclock`):

- **Live timer** (`getActiveTime`) is a real **wall-clock stopwatch**: sum of completed
  segment spans (`endTime - startTime`) plus, while tracking, `now - currentSegment.startTime`.
  It ticks every second regardless of movement, so it feels alive even when standing still.
- **Saved duration** (`recomputeTrimmedHike`) is computed from **GPS timestamps** (span of
  fixes per segment) so start/end trimming stays exact.

They can differ by the few stationary seconds at a segment's edges — normal for any GPS
fitness app. An iOS "stopped recording" symptom is OS suspension, not the timer.

## Saving a hike

`SaveHikeForm` (`save-hike-form.tsx`):

1. **Name** — required, 3–40 chars (zod).
2. **Trim** — a dual-thumb slider over the flattened point list picks an inclusive
   `[start, end]` window. Only available when there are `> 2` points. Defaults to the
   full route. The map shows the full route faded with the kept portion solid on top.
3. `recomputeTrimmedHike` recomputes distance and duration for the kept window:
   - Distance sums only consecutive kept points **from the same segment** (never counts
     a pause gap as travel).
   - Duration sums each segment's kept span (excludes paused-between time).
   - Duration is **rounded to a whole ms** — iOS timestamps carry fractional ms and the
     backend `Duration` is an int; a non-integer payload is rejected (400).
4. **Save guard** — `canSave = distance > 0 && duration > 0`. The backend rejects a hike
   with no distance/duration, so an over-tight trim shows `hike.trimTooShort` instead of a
   generic error.
5. On submit: `POST` via `createHike` with `{ name, hikeLength, duration, coordinates }`.
   On success: invalidate the hikes query, reset tracking, route to My Hikes. On error:
   `hike.errorSaving` snack, state preserved so the user can retry.

## Permissions

### Foreground ("When In Use")

Hard requirement. The screen gates on it; `startTracking` re-checks and aborts with
`createHike.fgPermissionDenied` if missing.

### Background ("Always")

**Not a hard requirement to start.** iOS never grants "Always" on first ask (only "When In
Use", escalating later), so a non-granted result must not block recording. With foreground
access + the location background mode, iOS records provisionally in the background and
prompts for "Always" itself.

But "When In Use" only survives while the app stays alive in the background — if iOS
suspends it under memory pressure mid-hike, **only "Always" relaunches it**. So on a
non-granted result the app shows a firm, actionable alert (Continue / Open Settings) rather
than a transient snackbar, while still letting the recording start provisionally.

## Edge cases — quick reference

| Scenario                                    | Behavior                                                                                                     |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Foreground permission denied                | Cannot record; screen shows `locationRequired`.                                                              |
| Background permission denied                | Records provisionally; alert offers Open Settings. Track survives foreground; may not survive OS suspension. |
| App backgrounded / screen off               | Background engine keeps writing to storage; live tail resumes/stitches on return.                            |
| App swiped away or OS-killed mid-hike       | Next launch recovers the hike as **PAUSED** (never auto-resumes).                                            |
| iOS suspends JS in a pocket                 | Native engine (18+) buffers and is drained on resume; big-jump-over-long-gap fix accepted (plausible speed). |
| User forgets to stop, stands still 60 min   | Auto-finalized (inactivity), time trimmed to last movement.                                                  |
| Recording runs past 12 h                    | Auto-finalized at the hard cap.                                                                              |
| Very short segment (< 10 m) on Pause        | Discarded as noise; its accumulated distance rolled back.                                                    |
| GPS teleport / glitch fix                   | Rejected by speed / distance / accuracy gates.                                                               |
| Stationary drift                            | Rejected by the noise-floor gate; no phantom distance.                                                       |
| Late background batch arrives after Pause   | No-ops via the storage lock; never resurrects the session.                                                   |
| Trim window too tight (0 distance/duration) | Save disabled with `trimTooShort`.                                                                           |
| iOS fractional-ms duration                  | Rounded before submit to avoid backend 400.                                                                  |
| Save request fails                          | Error snack; recorded state preserved for retry.                                                             |

## Tunable constants (`location-task.ts`)

| Constant               | Value                   | Meaning                                                        |
| ---------------------- | ----------------------- | -------------------------------------------------------------- |
| `MIN_DISTANCE`         | 3 m                     | Min step between accepted points; also GPS `distanceInterval`. |
| `MIN_SEGMENT_DISTANCE` | 10 m                    | Segments shorter than this are discarded on finalize.          |
| `MAX_DISTANCE`         | 100 m                   | Teleport cap when there's no usable time delta.                |
| `MAX_ACCURACY`         | 40 m iOS / 20 m Android | Worst accuracy still accepted.                                 |
| `MAX_SPEED`            | 10 m/s                  | Plausibility gate between two fixes.                           |
| `INACTIVITY_TIMEOUT`   | 60 min                  | Auto-finalize after no movement.                               |
| `MAX_DURATION`         | 12 h                    | Absolute recording ceiling.                                    |
| `SAMPLE_INTERVAL`      | 3 s                     | Android-only task cadence (iOS uses `distanceInterval`).       |
| `POLL_INTERVAL`        | 2 s                     | How often the UI mirrors storage while tracking.               |
