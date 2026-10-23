# A Paper modal's pinned submit button hides behind the keyboard unless it uses useModalKeyboardLift

Found 2026-10-23 in `app/` (Expo 54, react-native-paper Modal), on the obstacle, share-hike,
edit/publish-hike, report and reset-password modals.

**Symptom:** with the keyboard up, the Skicka/Spara button vanishes; dismissing the keyboard brings it
back. Nothing hides it in code. It sits below a ScrollView, pinned to the card bottom, and the
keyboard covers it.

**Why Android looked "handled":** a comment claimed Android resizes the window itself. It does not:
[app.json](../../app/app.json) has `softwareKeyboardLayoutMode: "pan"` and `edgeToEdgeEnabled`, so
Android only pans far enough to show the focused input, and anything below it stays covered.

**Fix (JS only, no dev build):** [useModalKeyboardLift](../../app/src/hooks/useModalKeyboardLift.ts):
`style={modalStyle}` on the Paper `Modal`, the card's `height`/`maxHeight` from the hook, fields in a
[ModalFormScrollView](../../app/src/components/modal-form-scroll-view.tsx), button below it. A raw
`KeyboardAwareScrollView` there auto-scrolls on iOS as well, on top of the lift, and pushes the field up
under the header out of sight (seen on the obstacle form 2026-10-23); the component turns that off on iOS. RN's Android `keyboardDidShow` height is `ime - systemBars`, so the hook
adds the bottom inset there; iOS's height already includes it. Modals whose button is inside the
scroll content (login, register, add review) do not need it.

**Confirmed on device 2026-10-23, iOS and Android:** Android's pan and the lift do not add up
(`ViewRootImpl` recomputes the pan on each layout and drops it once the input is visible). If that
ever changes, the real fix is `"resize"` or `react-native-keyboard-controller`; both need a dev build.
Closing the keyboard on iOS: swiping down works, so a "Klar" bar (InputAccessoryView) was tried and
rejected by the user.
