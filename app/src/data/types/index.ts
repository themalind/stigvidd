// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

// Barrel for app data types. Types are grouped by domain in sibling files;
// importing from '@/data/types' re-exports all of them so existing imports
// keep working. New code may also import from a specific module,
// e.g. '@/data/types/trail'.
export * from "./geo";
export * from "./trail";
export * from "./review";
export * from "./user";
export * from "./hike";
export * from "./friends";
export * from "./obstacle";
export * from "./facility";
