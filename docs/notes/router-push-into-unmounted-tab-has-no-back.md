# A router.push into a tab that has not mounted yet builds its stack with only the target screen

**Symptom (field report 2026-10-26, two users, iOS and Android).** After the app had been idle
overnight, "Mina delade promenader" was stuck: back went to the start tab, and pressing the
profile tab, which normally pops to the profile page, did nothing. It looked like a resume or
auth bug. It was not.

**Mechanism.** `NotificationHandler` in [app/src/app/_layout.tsx](../../app/src/app/_layout.tsx)
navigates a tapped push (`hike_share`, `friend_request`) with
`router.push("/(tabs)/(profile-stack)/user/...")`. If the profile stack has not mounted since the
process started, which is typical when the OS killed the app overnight and the tap cold-starts it,
expo-router 6 creates that stack as `[user/shared-hikes]` and nothing else. Back has nothing to
pop, so the tab navigator goes back to its first tab. A tab press calls popToTop, which does
nothing because the screen is already the top.

**Fix.** `router.navigate(route, { withAnchor: true })` together with
`export const unstable_settings = { anchor: "profile-page" }` in
[(profile-stack)/_layout.tsx](../../app/src/app/%28tabs%29/%28profile-stack%29/_layout.tsx).
`withAnchor` is the part that bites. Without the anchor setting the stack falls back to the first
`Stack.Screen` the active `Stack.Protected` group allows: `profile-page` when signed in, `login`
when signed out. With the anchor, a signed-out user still gets `login`, because react-navigation
falls back to the first route whenever the anchor is not in the route list. Every cross-tab
navigation into a signed-in profile screen needs `withAnchor` (`get-started-card.tsx` passes it
for both its targets). Navigations to `login` (`drawer.tsx`, `delete-account-modal.tsx`,
`not-authenticated-msg-dialog.tsx`) do not need it: `login` is the first route a signed-out user
is allowed, so the stack is already right.

**A tapped notification puts its screen on top, by design.** With [profile-page, user/friends,
user/friend/x, hike-follow/y], navigating to user/friends adds a second user/friends on top, so
back returns to the live map. Navigating to the screen already on top does not add a copy.
**Tried and rejected: `router.dismissTo` to the copy lower down** (a helper `openInProfileTab`,
2026-10-26). It unmounts every screen above the target without asking, including live tracking
(`hike-follow`) or a trail being followed (`follow`). It also does nothing from another tab: the
app's `Tabs` is type `tab`, not `expo-tab`, so expo-router sends POP_TO to the TabRouter, which
drops it ("The action 'POP_TO' ... was not handled by any navigator"). Making it work needed a
`TabActions.jumpTo` dispatch first. An extra back step costs less than a lost live screen.

**Measured** with the real router in
[(profile-stack)/__tests__/_layout.test.tsx](../../app/src/app/%28tabs%29/%28profile-stack%29/__tests__/_layout.test.tsx).
A plain push goes back to `/`, and `withAnchor` goes back to `/profile-page`.

**The tap does not have to be recent.** The affected user had opened the app from the share
notification the morning before and tapped nothing since. Android restores a killed app's task
with the intent that first opened it, so expo-notifications reports that old tap again on the next
launch. `handledNotificationId` is a `useRef` and does not survive the restart, so the app
navigated again. It looked as if the app had "resumed in yesterday's state". The fix is
`claimNotificationResponse` in [app/src/services/notifications.ts](../../app/src/services/notifications.ts),
which persists the handled identifiers in AsyncStorage (`@stigvidd_handled_notifications`, the
latest 200). A replayed id is moved to the front each time, because the id Android replays is
the oldest one, the tap that created the task. Claims are queued (`claimQueue`), because two
concurrent read-modify-writes would drop an id. When the read succeeds but the write fails, the
claim still answers from what it read. A list that cannot be parsed is logged ("Handled
notification list unreadable") and started over. The `.then` checks that the same user is still
signed in, because the AsyncStorage round-trip can outlast a sign-out or an account switch. A
replayed tap already at the front of the list is not written again. A tap that is claimed but
not opened (signed out mid-claim, or navigation threw) is given back with
`releaseNotificationResponse`, through the same queue, so the next sign-in or launch opens it.
In tests, hold back only the *first* read of the key: a read held forever jams the module-level
queue for every later test in the file.
expo-notifications keeps the last response in native memory only (`lastNotificationResponseBundle`
on Android, `lastResponse` on iOS), so the re-delivery comes from the intent, not from storage.

**Trail links go through the list, not an anchor.** Opened straight on `trail/<id>`, a
`link.stigvidd.se/trail/<id>` left the trail alone in the trails stack: the same stuck state
(confirmed on a device 2026-10-27). `redirectSystemPath` now returns
`/(tabs)/(trails-tab)?trail=<id>`, and `useOpenLinkedTrail` on the list clears the param and
pushes the trail with the screen's own `navigation` (the global `router` throws "navigate before
mounting the Root Layout" on a cold start). It acts in `useFocusEffect`, not `useEffect`: behind
the root layout's render gate a push from the list's first effect is dropped silently (the list
opens, the trail does not, as seen on a device), because the navigator is still applying the
link's initial state. The test's `GatedRoot` reproduces it. **Never `anchor: "index"` in the trails tab:** home,
map and trails all have an `index` at `/`, and with that anchor the app started on the trails tab
instead of the start page, on a device and in a renderRouter test with all the tab layouts.
Tests: `(trails-tab)/__tests__/_layout.test.tsx`; with the old redirect three of four fail.

**Not fixed: links replay too.** A task first opened by a trail link gets that VIEW intent back
after process death, so `redirectSystemPath` (`+native-intent.tsx`) reopens the trail. A link
carries no identifier to dedupe on. Telling a replay apart needs the native
`FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY`, which JS cannot see.

## Testing navigation with the real router

- `renderRouter` from `expo-router/testing-library`. Key the route map `"(tabs)/..."` so the
  pushed path type-checks against the typed routes.
- Use `renderRouter(...).getPathname()`. `expect(screen).toHavePathname` runs, but `tsc` rejects
  it.
- Stub every `Stack.Screen` name the layout declares, or each missing one logs
  `[Layout children]: No route named ...`.
- Importing `@/services/notifications` logs an expo-notifications Expo Go warning. Use the
  literal path instead.
- Ruled out (2026-10-27, measured): a session that expires on a deep profile screen and signs in
  again lands on `/profile-page`, and back works, with or without the anchor.

## Testing a tap on a device without a real push

Pushes do not reach a dev build reliably, but a local notification goes through the same
`useLastNotificationResponse` path: `Notifications.scheduleNotificationAsync({ content: { data:
{ type: "hike_share" } }, trigger: { type: TIME_INTERVAL, seconds: 10 } })`, kill the app, tap it.
Android replay: background the app, `adb shell am kill com.stigvidd.app`, reopen.
