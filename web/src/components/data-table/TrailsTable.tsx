// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { CLASSIFICATION, type AdminTrailListItem, type TableColumn } from "@/types/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import TrailEditor from "../trail-editor";
import TrailImagesDialog from "../trail-images-dialog";
import TrailVerifiedToggle from "../trail-verified-toggle";

interface Props {
  columns: TableColumn<AdminTrailListItem>[];
  trails: AdminTrailListItem[];
  onVerifiedChange?: (identifier: string, isVerified: boolean) => void;
}

export default function TrailsTable({ columns, trails, onVerifiedChange }: Props) {
  // const [selectedCell, setSelectedCell] = useState();

  function getRowValues(columns: TableColumn<AdminTrailListItem>[], row: AdminTrailListItem) {
    return columns.map((column) => {
      const value = row[column.key];

      if (column.key === "trailLength") {
        return value + " km";
      }

      if (column.key === "lastUpdatedAt") {
        return new Date(value as string).toLocaleDateString("sv-SE");
      }

      if (column.key === "classification") {
        return CLASSIFICATION[value as number] ?? "Unknown";
      }

      return value;
    });
  }

  return (
    <div className="rounded-xs border">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column, index) => (
              <TableHead key={index} className="font-bold">
                {column.label}
              </TableHead>
            ))}
            <TableHead className="font-bold">Active</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {trails.map((trail, index) => (
            <TableRow key={trail.identifier} className={index % 2 === 0 ? "bg-sidebar" : "bg-background"}>
              {getRowValues(columns, trail).map((value, index) => (
                <TableCell key={index}>{value}</TableCell>
              ))}
              <TableCell>
                <TrailVerifiedToggle
                  data={trail}
                  onChange={(isVerified) => onVerifiedChange?.(trail.identifier, isVerified)}
                />
              </TableCell>
              <TableCell className="flex justify-end gap-1">
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
