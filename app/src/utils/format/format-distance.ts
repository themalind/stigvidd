// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

export function formatDistanceKm(km: number): string {
  const meters = Math.round((km * 1000) / 10) * 10;

  if (meters < 1000) return `${meters} m`;

  const value = km >= 10 ? Math.round(km).toString() : km.toFixed(1).replace(".", ",");
  return `${value} km`;
}
