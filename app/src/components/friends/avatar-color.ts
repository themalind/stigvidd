// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

export interface AvatarColors {
  background: string;
  foreground: string;
}

const HUES = [200, 130, 280, 350, 32, 170, 230, 60, 310, 15] as const;

// FNV-1a, so a person keeps the same colour on every device and app version. keep-comment: changing the hash recolours everyone
function hash(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function avatarColors(seed: string, dark: boolean): AvatarColors {
  const hue = HUES[hash(seed) % HUES.length];
  return dark
    ? { background: `hsl(${hue}, 30%, 26%)`, foreground: `hsl(${hue}, 60%, 86%)` }
    : { background: `hsl(${hue}, 45%, 86%)`, foreground: `hsl(${hue}, 50%, 24%)` };
}

export function initials(name: string): string {
  return name.trim().slice(0, 2).toUpperCase();
}
