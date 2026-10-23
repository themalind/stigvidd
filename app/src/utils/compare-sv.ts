// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

// localeCompare(b, "sv") builds a new collator per call on Hermes. keep-comment: perf workaround, don't inline
const svCollator = new Intl.Collator("sv");

export const compareSv = (a: string, b: string): number => svCollator.compare(a, b);
