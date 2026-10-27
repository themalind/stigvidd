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

**Trail links: the trails tab is a real path segment.** Opened straight on `trail/<id>`, a
`link.stigvidd.se/trail/<id>` left the trail alone in the trails stack: the same stuck state
(confirmed on a device 2026-10-27). The tab is the folder `trails/` (the list is `/trails`), its
layout has `anchor: "index"`, and `redirectSystemPath` returns `/trails/trail/<id>`. The anchor
puts the list beneath the trail on a cold link and on a link while the app runs (device-checked
2026-10-27: icon start lands on the start page; cold and background links go back to the list).
**Never an index anchor in a group tab at `/`:** as `(trails-tab)`, home, map and trails all had
an `index` at `/`, and with that anchor the app started on the trails tab instead of the start
page (device and renderRouter). That is why the tab got its own segment. Ruled out before that: a
`?trail=` param that the list pushed from. It needed the screen's own `navigation` (the global
`router` throws "navigate before mounting the Root Layout" on a cold start) and `useFocusEffect`
(a push from the first `useEffect` behind the root layout's render gate is dropped silently).
Tests: `trails/__tests__/_layout.test.tsx`. Without the anchor, or with the old `/trail/<id>`
redirect, three of five fail. The test kit stubs out the `url` event, so a link while the app
runs is replayed the way `fork/useLinking.native.js` does it: `getStateFromPath`, then
`getActionFromState`, then `store.navigationRef.dispatch`.

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
