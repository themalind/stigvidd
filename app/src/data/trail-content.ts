// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

export interface DifficultyInfo {
  value: number;
  label: string;
  description: string;
}

export interface AccessibilityInfo {
  title: string;
  description: string;
  iconName: "wheelchair-accessibility" | "hiking";
}

export const DIFFICULTIES: DifficultyInfo[] = [
  {
    value: 1,
    label: "trail.difficulties.easy.label",
    description: "trail.difficulties.easy.description",
  },
  {
    value: 2,
    label: "trail.difficulties.medium.label",
    description: "trail.difficulties.medium.description",
  },
  {
    value: 3,
    label: "trail.difficulties.hard.label",
    description: "trail.difficulties.hard.description",
  },
  {
    value: 0,
    label: "trail.difficulties.unclassified.label",
    description: "trail.difficulties.unclassified.description",
  },
];

export const ACCESSIBILITY_INFO: AccessibilityInfo[] = [
  {
    title: "trail.accessibilityInfo.adapted.title",
    iconName: "wheelchair-accessibility",
    description: "trail.accessibilityInfo.adapted.description",
  },
  {
    title: "trail.accessibilityInfo.notAdapted.title",
    iconName: "hiking",
    description: "trail.accessibilityInfo.notAdapted.description",
  },
];
