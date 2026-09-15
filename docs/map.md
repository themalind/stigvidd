# Map — Full Flow & Behavior

How maps work across the app: the shared MapLibre base map, the rendering
primitives every screen reuses, the two location sources, and each of the
places a map appears — the fullscreen browse map, the fullscreen follow view
(for a trail or a recorded hike), and the small embedded maps on the trail-detail,
record-hike, save-hike, hike-detail and home screens. This is a behavioral reference:
it explains _why_ the code is shaped this way so future changes don't quietly undo a fix.

Related: recording the live track that some of these maps draw is documented
separately in [`record-hike.md`](./record-hike.md).

## Key files

| Concern                                                            | File                                                            |
| ------------------------------------------------------------------ | --------------------------------------------------------------- |
| Shared base map (style, puck, attribution)                         | `src/components/map/map.tsx`                                    |
| Basemap style URL + MapTiler setup                                 | `src/components/map/map-style.ts`                               |
| Ambient tile-cache health                                          | `src/utils/map-cache.ts`                                        |
| Trailhead "start" marker (GeoJSON layers)                          | `src/components/map/start-marker.tsx`                           |
| Live user puck with heading arrow                                  | `src/components/map/user-location-marker.tsx`                   |
| Recenter-on-user button                                            | `src/components/map/center-on-user-button.tsx`                  |
| Marker/route/ring colours (fixed light palette)                    | `src/components/map/marker-styles.ts`                           |
| DTO → GeoJSON builders                                             | `src/utils/geojson.ts`                                          |
| **Fullscreen browse map** (clusters, facilities, filter, carousel) | `src/components/map/trail-markers-map.tsx`                      |
| Browse-map screen (camera memory, carousel, filters)               | `src/app/(tabs)/(map)/index.tsx`                                |
| Cluster tap decision (zoom vs open carousel)                       | `src/utils/cluster-action.ts`, `src/utils/cluster-zoom-band.ts` |
| **Fullscreen follow view** (one route + live puck, shared)         | `src/components/map/route-follow-view.tsx`                      |
| Follow view data path for a trail                                  | `src/components/map/trail-follow-screen.tsx`                    |
| Follow view data path for a recorded / shared hike                 | `src/components/map/hike-follow-screen.tsx`                     |
| Live puck data source                                              | `src/hooks/useLiveUserLocation.ts`                              |
| One-shot user location (open-on-user, recenter)                    | `src/hooks/useUserLocation.tsx`                                 |
| **Embedded** trail-detail preview                                  | `src/components/trail/trail-map.tsx`                            |
| Preview-as-button chrome ("show on map" badge + directions pill)   | `src/components/map/map-preview-overlay.tsx`                    |
| **Embedded** record-hike map                                       | `src/components/trail/trail-creator/trail-creator.tsx`          |
| **Embedded** save-hike trim map                                    | `src/components/trail/trail-creator/save-hike-form.tsx`         |
| **Embedded** recorded-hike preview (shared by the hike maps below) | `src/components/map/route-preview-map.tsx`                      |
| Hike / shared-hike detail modals, home "latest hike" card          | `hike-details.tsx`, `shared-hike-details.tsx`, `home/latest-hike-card.tsx` |

## The stack at a glance

Everything is [MapLibre](https://maplibre.org/) via
`@maplibre/maplibre-react-native` (v11, native clustering). The app migrated off
`react-native-maps` — see memory `map-ios-polyline-crash`. A single shared `<Map>`
component wraps `MapLibreMap` and every screen composes its own `<Camera>`,
`<GeoJSONSource>` and `<Layer>` children on top of it.

```
                         ┌───────────────────────────┐
                         │   <Map> (map.tsx)          │
                         │  MapTiler Outdoor style     │
                         │  UserLocation puck (opt.)   │
                         │  attribution, no logo/compass│
                         └───────────────────────────┘
             ┌──────────────────┬───────────┴───────────┬──────────────────┐
   TrailMarkersMap        RouteFollowView           TrailMap /          RoutePreviewMap
   (browse, clusters)     (one route + puck;        TrailCreator /      (hike details,
                           trail or hike)           SaveHikeForm        shared hike,
                                                    (preview / record)  latest-hike card)
```

## The shared base map (`map.tsx`)

`<Map>` is a thin `forwardRef` wrapper over `MapLibreMap`. It centralises the
decisions every map must share, so no screen re-derives them:

- **Style** — always the MapTiler vector "Outdoor" basemap via `getMapStyle()`.
- **User puck** — renders MapLibre's built-in `<UserLocation>` when
  `showsUserLocation` is true (the default). Note this is the _passive_ built-in
  puck; the _live follow_ puck is a separate GeoJSON marker (see below).
- **Ornaments** — `logo={false}`, `compass={false}` so the app lays out its own
  controls. **Attribution stays on** and is not opt-in: the MapTiler + OpenStreetMap
  credit is required by the data licence on every screen, so it defaults on here.
  It sits bottom-left (the one corner no custom control uses — recenter is
  bottom-right, filter top-right, back top-left), inset by `SCREEN_PADDING`. There is
  **no safe-area offset**: fullscreen maps live inside the tab navigator, whose tab bar
  already clears the home indicator. The embedded previews override
  `attributionPosition` to top-left, because their bottom corners hold the overlay pills.
- All other `MapProps` pass through, so callers still set `onPress`,
  `onDidFinishLoadingMap`, `onRegionDidChange`, gesture toggles, etc.

### Basemap style & MapTiler (`map-style.ts`)

- The style URL is `https://api.maptiler.com/maps/{STYLE_ID}/style.json?key={KEY}`,
  both parts from `EXPO_PUBLIC_MAPTILER_*` env vars — never hard-coded (same
  mechanism as `BASE_URL` in `api-config`). Current style is the built-in
  `outdoor-v2`; the planned end state is a custom clone with the hiking-route
  relation layers hidden so the app's own trail overlays are the only routes drawn
  — that's just a matter of swapping the published style id into the env var.
- **User-Agent restriction:** the restricted MapTiler key only accepts requests
  whose `User-Agent` contains `stigvidd` (case-sensitive). `initMapTiler()`
  registers a `TransformRequestManager` header to send exactly that on every
  `api.maptiler.com` request. If this constant drifts from the dashboard value the
  map goes blank. (See memory `map-tile-providers`.)
- `initMapTiler()` also silences MapLibre's benign `ParseStyle` warnings while
  letting other logs — notably the `Canceled` cache warnings — through.
- **The basemap is always the light style, even in the app's dark mode.** A legible
  dark topo map needs a separately tuned custom style (MapTiler's off-the-shelf
  "Outdoor Dark" is night-vision dark and hard to read), which is a dedicated
  follow-up. This is why every map overlay uses a **fixed light palette** and never
  `useTheme()` (see [Colours](#colours-the-always-light-palette)).

### Tile cache health (`map-cache.ts`)

MapLibre's local ambient tile cache (SQLite) can corrupt itself, after which native
cancels every tile/glyph request (`permanent error: Canceled`) and the map stays
blank until wiped. The verified trigger is installing a new build over an old one
(dev and preview EAS profiles share `com.stigvidd.app`, so swapping profiles serves
the other's stale cache). `initMapCache()`, run once at startup:

- Caps the ambient cache at `MAP_AMBIENT_CACHE_MAX_BYTES` (50 MB).
- On a **new build id** (`nativeBuildVersion` + `dev`/`release`) → `resetDatabase()`
  (the in-app `pm clear`). On the **same build** → cheap `invalidateAmbientCache()`
  so a warm cache is kept but no bad entry is served.
- Fully best-effort: it never throws, because cache maintenance must never block
  app start. (See memory `map-tiles-canceled-cache-bug`.)

## Rendering primitives: GeoJSON layers, never view markers

**Every overlay — route lines, the trailhead marker, the live puck, cluster
circles, the selection ring — is drawn as `<GeoJSONSource>` + `<Layer>`, never a
view-hosted `<Marker>` annotation.** View annotations are the most fragile path on
iOS under the New Architecture (Fabric). The only place a `<Marker>` is used is the
facility name callout bubble, which is transient and tap-driven.

Two shared marker components, both pure GeoJSON:

- **`StartMarker`** — the trailhead: a dot, a stroke, and a label symbol. When given
  `onPress` it also adds an invisible finger-sized (22 px) hit circle so the small
  dot is easy to tap, and typically opens directions.
- **`UserLocationMarker`** — the live "you are here" puck used on follow-style maps.
  A halo, a heading arrow, and a solid dot, stacked bottom→top so the dot masks the
  arrow's base and only its tip shows. Each layer is pinned above the previous with
  `afterId` / `aboveLayerId`, so the order survives regardless of which source
  finishes loading first (the trail geometry and the GPS fix arrive at different
  times). The heading arrow only renders when a heading is present (speed-gated —
  see below). Its `<Images>` icon is registered unconditionally so it's always ready
  before the layer references it.

GeoJSON builders live in `geojson.ts`: `featureCollectionFromMarkers` /
`…FromFacilities` (skip items missing coordinates in a single pass),
`pointFeatureFromPosition`, and `lineStringFromPositions`.

## The two location sources

The app deliberately uses different location engines for different jobs:

| Hook / API                        | Used for                                            | Engine                                                               | Accuracy            |
| --------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------- | ------------------- |
| `useUserLocation()`               | open-on-user, recenter target, "locating…" gate     | one-shot fix; reports `isFallback` (→ Borås) when denied/unavailable | —                   |
| `useCurrentPosition()` (MapLibre) | detect when the passive puck has a fix (browse map) | MapLibre's shared native GPS singleton                               | —                   |
| `useLiveUserLocation()`           | the **live follow puck** on the follow views        | app's own `expo-location` watcher                                    | `BestForNavigation` |
| MapLibre `<UserLocation>`         | passive puck on browse / preview / record maps      | MapLibre built-in                                                    | —                   |

**Why the follow puck has its own watcher (`useLiveUserLocation`):** MapLibre's
built-in location engine froze the dot mid-walk on both platforms (iOS auto-pauses
`CLLocationManager` when idle and never resumes; Android's default engine delivers
one fix and stops). So the follow puck is driven by an `expo-location`
`watchPositionAsync` watcher instead. Details that matter:

- **Foreground re-arm.** The watcher only delivers while foregrounded, and it's
  movement-gated (`distanceInterval = MIN_DISTANCE`), so on every `AppState → active`
  it re-arms _and_ pulls one fresh `getCurrentPositionAsync` fix — otherwise the puck
  stays stuck at the stale pre-pocket position until you happen to walk `MIN_DISTANCE`.
- **Generation guard.** Every `arm()` bumps a generation counter so a slower,
  superseded arm can't install its watcher or write a stale fix (prevents leaked
  native watchers and out-of-order updates).
- **Heading speed-gate.** Course-over-ground is only trusted once the user is
  actually walking (`speed ≥ HEADING_MIN_SPEED`, ~0.6 m/s). Below that iOS returns
  −1 and Android can report a bogus 0 (due north), so gating on speed — not on the
  presence of a heading — stops the arrow spinning while you stand still.
- Accuracy is `BestForNavigation` to match the hike recorder; coarser accuracies
  scatter the dot by tens of metres. (See memory `live-follow-puck`.)

## Screen 1 — Fullscreen browse map (`trail-markers-map.tsx` + `(map)/index.tsx`)

The main Map tab. Shows **all** trailheads and facilities as clustered pins, with
filters and a card carousel. `TrailMarkersMap` owns the map + layers; `MapScreen`
owns the surrounding chrome and camera memory.

### Data & clustering

- Three clustered `<GeoJSONSource cluster>` sources: **trails**, **fire pits**,
  **shelters**. Trails come from `getTrailMarkers`, facilities from
  `getFacilityMarkers` (both React Query, 5-min `staleTime`, fetched only when their
  filter is on). Load errors surface via the global snackbar **without blanking the
  map** — whatever tiles/markers are already shown stay.
- Facilities cluster identically to trails (same `FacilityClusterSource`, radii and
  step thresholds) so every category groups and breaks apart at the same zooms.
- `clusterMaxZoom = 16` keeps overlapping trailheads a single tappable cluster up to
  a high zoom, instead of un-tappable stacked pins.
- Cluster circle radius steps by `point_count` (16 / 20 / 26 px at ≥10 / ≥50).

### Filters (`MapFilterMenu`)

`filter: { trails, shelters, firePits, accessibility }`. `accessibility` is a
cross-cutting modifier, not a category — it filters _every_ visible category to
accessible items (`isAccessible`). Toggling a filter off also dismisses any facility
name bubble whose marker just stopped rendering, so a label never lingers over an
empty spot.

### Tapping a cluster or pin (`decideClusterAction`)

On a **trail** feature tap:

- **Cluster** → resolve `getClusterExpansionZoom`, then `decideClusterAction`:
  - **Small cluster** (`≤ CAROUSEL_MAX_COUNT = 10`) → open the **carousel** directly
    with its member identifiers (co-located trailheads that wouldn't separate
    usefully by zooming).
  - **Larger, genuinely separable cluster** → `flyTo` its expansion zoom so it breaks
    apart.
- **Single trail** → open the carousel with that one identifier.

On a **facility** tap: clusters just `flyTo` their expansion zoom (facilities have no
carousel); a single pin shows its **name in a callout bubble** (facilities have no
detail screen yet).

### The selection ring

While a carousel is open, a thin tertiary-coloured **ring** hugs the tapped
cluster/trail. It's a stroke-only circle layer (`trail-highlight-ring`), declared
last so it draws above every other layer, and its radius travels in the feature so
it sizes to hug a marker of any size (`markerRadius`). It's set once on tap, not per
swipe — co-located trails share the same spot, so re-setting per card would look like
the map is stuttering. Built as a plain circle layer, never a `<Marker>` (the
iOS/Fabric-safe path).

### The "locating…" pill

Shown while a real fix is genuinely expected but hasn't arrived:
`userLocation && !isFallback && !currentPosition`. `useCurrentPosition` subscribes to
the same shared native engine as the passive puck, so it flips non-null exactly when
the puck appears. Gated on `!isFallback` so it never spins forever when permission is
denied (no fix will ever come).

### Camera memory & carousel dismissal (`MapScreen`)

- The map **unmounts on blur** (`isFocused` via `useFocusEffect`) to free native
  resources, but `MapScreen` stays mounted. The last camera view is held in a
  `lastViewState` ref (not state — panning shouldn't re-render the map) and re-seeds
  the camera on return, so the map reopens where you left it instead of resetting.
- **Open-on-user:** once, on first ready, glide to the user's position if there's a
  real fix (`didAutoCenter` ref limits it to one glide; skipped on the Borås
  fallback). A warm re-entry seeds directly from cached location to avoid a Borås
  flash; a cold start opens at the Borås default and animates over when the fix lands.
- **Carousel auto-dismiss on zoom:** from the cluster's expansion zoom, `clusterZoomBand`
  derives the band of zooms where the cluster holds together. A _user_ zoom out of that
  band (`isZoomOutsideBand`, gated on `userInteraction`) means the cluster has split or
  merged and no longer matches the open carousel, so it closes. Panning and small zooms
  within the band keep it; programmatic camera restores never close it.
- Carousel actions route out: **"Show on map"** → the follow view; **"Read more"** →
  the trail detail screen (both via `guardedNavigate`).

## Screen 2 — Fullscreen follow view (`route-follow-view.tsx`)

One route drawn cleanly with the live user puck — no clusters, other trails, or
facility pins. `RouteFollowView` owns all of the presentation and is shared by two thin
data-path screens, so the trail and hike variants cannot drift apart visually:

- **`TrailFollowScreen`** — reached from the carousel's "Show on map" and by tapping the
  embedded preview on a trail's detail screen. Coordinates come from
  `getCoordinatesByTrailIdentifier` (React Query, keyed on the identifier) → parsed via
  `CoordinateParser`. Route file `follow/[identifier].tsx` in the home, map, trails and
  profile stacks.
- **`HikeFollowScreen`** — a recorded hike, your own or one a friend shared with you
  (the API authorises both through the same endpoint), which is what makes a shared hike
  walkable. The coordinates are fetched by identifier under `hikeRouteQueryKey`, so the
  screen survives a deep link or cold start; in practice the detail modal that opens it
  has already primed that cache. A failed fetch, or coordinates that parse to nothing,
  shows a centred message rather than a blank map. Route file
  `hike-follow/[identifier].tsx` in the home and profile stacks.

Both route files simply re-export the component, so the view is pushed within the
current stack and **back returns where you came from**.

- **Fit-to-trail race:** the camera fits the trail's bounds once _both_ the map and
  the coordinates are ready — whichever arrives last triggers the fit (the map-ready
  callback sets `mapReadyRef`, and a `useEffect` on `bounds` covers the other order).
  `FIT_PADDING` leaves room for the top bar and recenter button.
- **Single-point route:** a zero-area bounding box would fit to maximum zoom, so a
  one-point route is centred at `SINGLE_POINT_ZOOM` (15) instead.
- The **live puck** is `UserLocationMarker` driven by `useLiveUserLocation`, pinned
  `aboveLayerId` the start marker's **label** (its topmost layer) — not the route line,
  which would bury the puck under the trailhead circle exactly where you set off. The
  anchor is only named once the route exists (the GPS fix usually lands first), and the
  marker is remounted rather than mutated when it appears. `showsUserLocation` on
  `<Map>` is **false** here — this screen supplies its own puck instead of the passive
  built-in one.
- Chrome: one back chip carrying the route name (top-left, no safe-area offset — the
  app header already clears it), a loading spinner while coordinates fetch, and `CenterOnUserButton`. The recenter button is passed the
  puck's live position so it flies exactly to the dot rather than taking its own
  one-shot fix. Tapping the trailhead hands off to the device maps app for directions
  (`openDirectionsToStart`).

## Screen 3 — Embedded preview on trail detail (`trail-map.tsx`)

A **static, non-pannable** map preview (30% screen height) on the trail detail
screen. All gestures are disabled (`dragPan`, `touchZoom`, `touchRotate`,
`touchPitch`, `doubleTapZoom` all off) — **the whole surface is a button** that opens
the fullscreen follow view (`handleOpenFollowMap`). It draws the route line + the
`StartMarker`, and on `onDidFinishLoadingMap` fits the trail bounds (`duration: 0`,
no animation). The corner pills come from the shared `MapPreviewOverlay`:

- **"Show on map"** (bottom-right) — visual affordance; the tap is actually handled by
  the overlay's full-surface `Pressable`.
- **Directions** (bottom-left) — rendered _last_ so its tap wins in its corner and
  opens directions instead of the follow view. On narrow phones (`< 380 px`) it drops
  its label to just the icon.

Until coordinates load, the screen shows a `MapSkeleton` instead.

## Screen 4 — Embedded record-hike map (`trail-creator.tsx`)

The map you watch while recording a hike. Draws the live track and auto-follows it.
Recording internals (segments, GPS filter, background engines) are documented in
[`record-hike.md`](./record-hike.md) — here's just the map behavior:

- **`routePositions`** stitches the drawn line from `useLocationTracking`: all
  finished segments' points + the active segment's persisted (background) points +
  the live foreground tail (only points newer than the last persisted timestamp).
  So the line follows the dot in real time with no duplicates or gaps across a
  background trip. A `LineString` needs ≥ 2 points, so nothing is drawn for the first
  fix.
- **Auto-follow with hand-off.** The camera eases to the latest point as the route
  grows (`followRef`), but a _user_ pan/zoom (`userInteraction`) turns follow **off**
  so the camera doesn't yank away from someone inspecting the map. The recenter button
  (`CenterOnUserButton` with an `onPress` that sets `followRef = true`) turns it back
  on.
- **Load-race guard.** Camera commands sent before the native map finishes loading hit
  an unresolved view tag. `moveCamera` gates every move on `mapReadyRef` and stashes
  the latest target in `pendingCenterRef`, applied once `handleMapReady` fires — so no
  centering is lost to the race.
- **Fast first paint.** The map renders immediately from the cached last-known
  position (or a Borås fallback) instead of blocking on a cold GPS lock, then refines
  with a precise `Balanced` fix and nudges the camera there — unless the user has
  already started moving, in which case the route drives the camera. A "locating…"
  pill shows during that refine.

## Screen 5 — Embedded save-hike trim map (`save-hike-form.tsx`)

A 200 px map in the save form after recording stops. The full recorded route is drawn
faded for context and the portion that survives trimming solid on top, so the user sees
what will actually be saved. `showsUserLocation={false}`; fits the full route's bounds
on map-ready. Trimming itself is documented in [`record-hike.md`](./record-hike.md).

## Screen 6 — Recorded-hike previews (`route-preview-map.tsx`)

`RoutePreviewMap` is the small route map of a completed hike: the recorded line plus its
`StartMarker`, with `showsUserLocation={false}` (a saved hike isn't about _now_). It
fits the bounds on map-ready (or centres a single point at zoom 15). One component serves
three places:

| Where | `onOpen` | Behaviour |
| ----- | -------- | --------- |
| Hike-detail modal (`hike-details.tsx`, 30% height) | opens the hike follow view | static; badge + directions pill via `MapPreviewOverlay` |
| Shared-hike modal (`shared-hike-details.tsx`), accepted share | opens the hike follow view | as above |
| Shared-hike modal, share **awaiting accept/reject** | none | plain **pannable** preview; tapping the start marker opens directions |
| Home "latest hike" card (`latest-hike-card.tsx`) | opens the hike-detail modal | `showBadge={false}`: no chrome, just a full-cover `Pressable` so the card still receives the tap |

Passing `onOpen` disables every gesture, since the full-cover `Pressable` would swallow a
drag anyway. The shared-hikes screen mounts two modals at once, so their `idPrefix`es
differ to keep the map source/layer ids apart.

## Colours: the always-light palette

Because the basemap is always the light Outdoor style (even in dark mode), **every
map overlay uses a fixed light palette from `AppDefaultTheme`, never `useTheme()`** —
which would turn markers orange and controls wrong-coloured against the light map.
`marker-styles.ts` is the single source of truth so a category's pin always matches
its filter-menu legend swatch:

| Element                                | Colour                                                        |
| -------------------------------------- | ------------------------------------------------------------- |
| Trail pins / route line / start marker | `primary` (teal) on `onPrimary` stroke                        |
| Shelter pins                           | `tertiary`                                                    |
| Fire-pit pins                          | `secondary`                                                   |
| Selection ring                         | `tertiary` outline (pops against the teal trail pins)         |
| Live user puck                         | fixed `#1A73E8` blue on white (distinct from the green route) |

`CenterOnUserButton` likewise uses `AppDefaultTheme.colors` directly, not the active
theme.

## Camera patterns — quick reference

| Pattern                 | Where                               | How                                                                                                                             |
| ----------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Fit a whole trail/hike  | follow, trail preview, hike previews | `cameraRef.fitBounds(getBoundsFromTrail(...), { padding })`, `duration: 0`, on map-ready (+ effect on bounds for the load race) |
| Open on the user        | browse map                          | one-time `flyTo` once a real (non-fallback) fix arrives                                                                         |
| Recenter on the puck    | follow, record                      | `CenterOnUserButton` `flyTo(zoom: 14)`; follow passes the live puck position, record re-enables auto-follow                     |
| Follow a growing route  | record                              | `easeTo(latest point)` on each new point, until a user gesture disables it                                                      |
| Break apart a cluster   | browse map                          | `flyTo(expansionZoom)`                                                                                                          |
| Remember & restore view | browse map                          | `lastViewState` ref seeded back into `initialViewState` on return                                                               |

## Edge cases — quick reference

| Scenario                                               | Behavior                                                                                                                |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| New build installed over old (corrupt tile cache)      | `initMapCache` resets the DB on build-id change → map recovers instead of staying blank.                                |
| MapTiler User-Agent drifts from dashboard              | Every tile request is rejected → blank map. Keep `MAP_USER_AGENT = "stigvidd"` in sync.                                 |
| Location permission denied                             | `useUserLocation` reports `isFallback` → browse map opens on Borås, no open-on-user glide, no endless "locating…" pill. |
| Passive puck slow to get a first fix                   | "locating…" pill shows only while a real fix is expected (`!isFallback && !currentPosition`).                           |
| MapLibre built-in puck freezes mid-walk                | Follow puck uses `useLiveUserLocation` (own watcher) instead; re-arms + fresh fix on foreground.                        |
| User stands still                                      | Heading arrow hidden (speed-gate) so it doesn't spin; puck dot stays.                                                   |
| Trail coords arrive before / after map ready           | Fit runs on whichever is last (map-ready callback + bounds effect).                                                     |
| Camera command before map finishes loading             | Queued in `pendingCenterRef`, applied on `handleMapReady` (record map).                                                 |
| Map tab blurred                                        | Map unmounts to free native resources; camera view restored from `lastViewState` on return.                             |
| Marker/facility fetch fails                            | Global snackbar (`map.loadError`); existing tiles/markers stay on screen.                                               |
| Facility filter toggled off with its bubble open       | Bubble dismissed the moment the marker stops rendering.                                                                 |
| User zooms a cluster open in the carousel out of range | Carousel auto-closes (`isZoomOutsideBand`), only on a user gesture.                                                     |
| App in dark mode                                       | Basemap stays light by design; overlays use the fixed light palette.                                                    |

## Tunable constants

| Constant                      | Value           | Where                     | Meaning                                                      |
| ----------------------------- | --------------- | ------------------------- | ------------------------------------------------------------ |
| `CLUSTER_MAX_ZOOM`            | 16              | `trail-markers-map.tsx`   | Points stay clustered up to this zoom.                       |
| `CAROUSEL_MAX_COUNT`          | 10              | `trail-markers-map.tsx`   | Clusters at/below this open the carousel instead of zooming. |
| `clusterRadius`               | 60              | `trail-markers-map.tsx`   | Pixel radius within which points merge into a cluster.       |
| Cluster radii                 | 16 / 20 / 26 px | `trail-markers-map.tsx`   | Circle size at ≥ 10 / ≥ 50 members.                          |
| `RING_GAP`                    | 5 px            | `trail-markers-map.tsx`   | Gap between a marker edge and its selection ring.            |
| `HEADING_MIN_SPEED`           | ~0.6 m/s        | `useLiveUserLocation.ts`  | Below this, course-over-ground is treated as noise.          |
| `MAP_AMBIENT_CACHE_MAX_BYTES` | 50 MB           | `constants/cache.ts`      | Ambient tile-cache cap.                                      |
| `MAP_USER_AGENT`              | `"stigvidd"`    | `map-style.ts`            | Must match the MapTiler key's allowed User-Agent.            |
| `FIT_PADDING`                 | 100/60/120/60   | `route-follow-view.tsx`   | Fit padding leaving room for chrome.                         |
| `SINGLE_POINT_ZOOM`           | 15              | `route-follow-view.tsx`, `route-preview-map.tsx` | Zoom for a one-point route (zero-area bounds). |
