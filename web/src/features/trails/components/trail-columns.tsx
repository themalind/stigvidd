// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { AdminTrailListItem, TableColumn } from "@/types/types";

export const trailColumns: TableColumn<AdminTrailListItem>[] = [
  { label: "Name", key: "name", type: "text" },
  { label: "City", key: "city", type: "text" },
  { label: "Length", key: "trailLength", type: "number" },
  { label: "Classification", key: "classification", type: "number" },
  { label: "Updated", key: "lastUpdatedAt", type: "text" },
  { label: "Identifier", key: "identifier", type: "text" },
];
