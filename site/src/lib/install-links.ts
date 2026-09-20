// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

export type Platform = "ios" | "android" | "other";

export type InstallLinks = { ios: string | null; android: string | null };

/**
 * Which store button to put first, from the user agent alone.
 *
 * Deliberately a pure function over a string rather than a hook reading `navigator`,
 * so it is testable without a browser and so the page renders the same on the server
 * side of a static build.
 *
 * KNOWN LIMIT: iPadOS 13 and later report "Macintosh; Intel Mac OS X" and are
 * indistinguishable from a Mac by user agent. Such a visitor gets "other", which shows
 * BOTH platforms rather than the wrong one — the failure is a neutral page, not a
 * misdirected download.
 */
export function detectPlatform(userAgent: string): Platform {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "ios";
  if (/Android/i.test(userAgent)) return "android";
  return "other";
}

/**
 * The platforms to offer, most relevant first. An empty array means nothing is published
 * yet, and the caller renders no store button at all rather than one that goes nowhere.
 */
export function orderedPlatforms(
  links: InstallLinks,
  platform: Platform,
): { platform: "ios" | "android"; url: string }[] {
  const available: { platform: "ios" | "android"; url: string }[] = [];
  if (links.ios) available.push({ platform: "ios", url: links.ios });
  if (links.android) available.push({ platform: "android", url: links.android });

  if (platform === "other") return available;
  return available.sort((a, b) => {
    if (a.platform === platform) return -1;
    if (b.platform === platform) return 1;
    return 0;
  });
}
