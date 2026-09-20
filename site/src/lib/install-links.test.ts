// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { detectPlatform, orderedPlatforms, type InstallLinks } from "@/lib/install-links";

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
const DESKTOP =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const IPADOS =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";

describe("detectPlatform", () => {
  it("reads an iPhone", () => {
    expect(detectPlatform(IPHONE)).toBe("ios");
  });

  it("reads an Android phone", () => {
    expect(detectPlatform(ANDROID)).toBe("android");
  });

  it("falls back to other on desktop", () => {
    expect(detectPlatform(DESKTOP)).toBe("other");
  });

  // Pinned as documentation, not as an aspiration: iPadOS 13+ cannot be told from a Mac
  // by user agent, and "other" is the safe answer because it offers both platforms.
  it("cannot tell iPadOS from macOS, and answers other", () => {
    expect(detectPlatform(IPADOS)).toBe("other");
  });

  it("treats an empty user agent as other", () => {
    expect(detectPlatform("")).toBe("other");
  });
});

describe("orderedPlatforms", () => {
  const both: InstallLinks = {
    ios: "https://testflight.apple.com/x",
    android: "https://play.google.com/x",
  };

  it("puts the visitor's own platform first", () => {
    expect(orderedPlatforms(both, "android").map((p) => p.platform)).toEqual([
      "android",
      "ios",
    ]);
    expect(orderedPlatforms(both, "ios").map((p) => p.platform)).toEqual(["ios", "android"]);
  });

  it("keeps a stable order for a visitor on neither platform", () => {
    expect(orderedPlatforms(both, "other").map((p) => p.platform)).toEqual(["ios", "android"]);
  });

  it("omits a platform that has no link", () => {
    expect(orderedPlatforms({ ios: null, android: both.android }, "ios")).toEqual([
      { platform: "android", url: both.android },
    ]);
  });

  it("is empty while nothing is published, so no store button is rendered", () => {
    expect(orderedPlatforms({ ios: null, android: null }, "ios")).toEqual([]);
  });

  // An empty string is what a half-finished edit leaves behind. A link with href="" is a
  // button that reloads the page, so it must not count as published.
  it("does not count an empty string as a link", () => {
    expect(orderedPlatforms({ ios: "", android: "" }, "ios")).toEqual([]);
  });
});
