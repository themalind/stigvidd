# On iOS the image picker hands back HEIC, so a JPEG-only check rejects nearly every iPhone photo

**Measured 2026-10-04.** Users reported that the iOS app could not add images to a review and
showed "Endast JPG-bilder är tillåtna" / "Only JPG images are allowed". Android worked.

## Mechanism

iPhones save camera-roll photos as HEIC. `expo-image-picker`'s `launchImageLibraryAsync`
returns the original file, so `asset.mimeType` is `image/heic`. Android galleries are mostly
JPEG, which is why the bug showed up only on iOS.

[add-review-images.tsx](../../app/src/components/review/add/add-review-images.tsx) used to reject
any asset whose `mimeType` was not `image/jpeg`, and it did that **before** resizing. That check
was never needed. The next step,
[resizeImage](../../app/src/utils/resizeImage.ts), uses `expo-image-manipulator` with
`SaveFormat.JPEG`, so every pick is re-encoded as JPEG. `createReview` then uploads it as
`image/jpeg`. The API never sees the original format.

## Why it looked right

The comment said "the API takes JPEG only", which is true of the **upload**, not of the
**picked file**. The jest tests used only JPEG and PNG fixtures, and a test pinned the
rejection ("turns away a picture that is not a JPEG"). So the bug passed CI.

## Rule

Do not gate on the picker's `mimeType` or file extension. Gate on what you upload, which is the
re-encoded output. A file the manipulator cannot decode throws, and the existing `catch` already
shows `review.addImageError`. Any new picker flow, such as trail or facility images from the app,
should go through `resizeImage` (or another JPEG re-encode) rather than check the source format.
