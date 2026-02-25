import type { TableColumn, TrailShortInfoResponse } from "@/types/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import Editor from "../editor";

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
    return columns.map((column) => row[column.key]);
  }

  return (
    <div className="rounded-md border">
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
          {trails.map((trail) => (
            <TableRow key={trail.identifier}>
              {getRowValues(columns, trail).map((value, index) => (
                <TableCell key={index}>{value}</TableCell>
              ))}
              <TableCell className="flex justify-end">
                <Editor data={trail} selected={true} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
