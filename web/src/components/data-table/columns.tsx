import type { TableColumn, TrailShortInfoResponse } from "@/types/types";

export const trailColumns: TableColumn<TrailShortInfoResponse>[] = [
  { label: "Name", key: "name", type: "text" },
  { label: "City", key: "city", type: "text" },
  { label: "Length", key: "trailLength", type: "number" },
  { label: "Classification", key: "classification", type: "number" },
  { label: "Identifier", key: "identifier", type: "text" },
];
