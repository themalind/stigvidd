// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { AdminTrailListItemResponse } from "@/api/generated/model";

export type TableColumn<T> = {
  label: string;
  key: keyof T;
  type: string;
  width?: number;
};

export const trailColumns: TableColumn<AdminTrailListItemResponse>[] = [
  { label: "Name", key: "name", type: "text" },
  { label: "City", key: "city", type: "text" },
  { label: "Length", key: "trailLength", type: "number" },
  { label: "Classification", key: "classification", type: "number" },
  { label: "Updated", key: "lastUpdatedAt", type: "text" },
  { label: "Identifier", key: "identifier", type: "text" },
];
