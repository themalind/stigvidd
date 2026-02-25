import type { TrailShortInfoResponse } from "@/types/types";
import type { ColumnDef } from "@tanstack/react-table";

export const columns: ColumnDef<TrailShortInfoResponse>[] = [
  {
    accessorKey: "name",
    header: "Name",
  },
  {
    accessorKey: "identifier",
    header: "Identifier",
  },
  {
    accessorKey: "trailLength",
    header: "Length",
  },
  {
    accessorKey: "accessibility",
    header: "Accessibility",
  },
  {
    accessorKey: "classification",
    header: "Classification",
  },
  {
    accessorKey: "city",
    header: "City",
  },
];
