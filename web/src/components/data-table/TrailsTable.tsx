import {
  CLASSIFICATION,
  type TableColumn,
  type TrailShortInfoResponse,
} from "@/types/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import TrailEditor from "../trail-editor";

interface Props {
  columns: TableColumn<TrailShortInfoResponse>[];
  trails: TrailShortInfoResponse[];
}

export default function TrailsTable({ columns, trails }: Props) {
  // const [selectedCell, setSelectedCell] = useState();

  function getRowValues(
    columns: TableColumn<TrailShortInfoResponse>[],
    row: TrailShortInfoResponse,
  ) {
    return columns.map((column) => {
      const value = row[column.key];

      if (column.key === "trailLength") {
        return value + " km";
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
          </TableRow>
        </TableHeader>
        <TableBody>
          {trails.map((trail, index) => (
            <TableRow
              key={trail.identifier}
              className={index % 2 === 0 ? "bg-sidebar" : "bg-background"}
            >
              {getRowValues(columns, trail).map((value, index) => (
                <TableCell key={index}>{value}</TableCell>
              ))}
              <TableCell className="flex justify-end">
                <TrailEditor data={trail} selected={true} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
