// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

export function roundTo(value: number | undefined, decimals: number): number | undefined {
  if (value === undefined) return undefined;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
