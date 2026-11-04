// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { AdminTrailListItemResponse } from "@/api/generated/model";
import { CLASSIFICATION, type TableColumn } from "@/types/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import TrailEditor from "./trail-editor";
import TrailImagesDialog from "./trail-images-dialog";
import TrailPathDialog from "./trail-path-dialog";
import TrailVerifiedToggle from "./trail-verified-toggle";

interface Props {
  columns: TableColumn<AdminTrailListItemResponse>[];
  trails: AdminTrailListItemResponse[];
}

function cellValue(column: TableColumn<AdminTrailListItemResponse>, row: AdminTrailListItemResponse) {
  switch (column.key) {
    case "trailLength":
      return `${row.trailLength} km`;
    case "lastUpdatedAt":
      return new Date(row.lastUpdatedAt).toLocaleDateString("sv-SE");
    case "classification":
      return CLASSIFICATION[row.classification] ?? "Unknown";
    default:
      return String(row[column.key] ?? "");
  }
}

export default function TrailsTable({ columns, trails }: Props) {
  return (
    <div className="rounded-xs border">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column.key} className="font-bold">
                {column.label}
              </TableHead>
            ))}
            <TableHead className="font-bold">Active</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {trails.map((trail, index) => (
            <TableRow key={trail.identifier} className={index % 2 === 0 ? "bg-sidebar" : "bg-background"}>
              {columns.map((column) => (
                <TableCell key={column.key}>{cellValue(column, trail)}</TableCell>
              ))}
              <TableCell>
                <TrailVerifiedToggle data={trail} />
              </TableCell>
              <TableCell className="flex justify-end gap-1">
                <TrailPathDialog data={trail} />
                <TrailImagesDialog data={trail} selected={true} />
                <TrailEditor data={trail} selected={true} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
