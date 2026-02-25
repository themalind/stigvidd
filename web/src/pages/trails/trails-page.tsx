import { getAllTrails } from "@/api/trail";
import DataTable from "@/components/data-table/data-table";
import { columns } from "@/components/data-table/trails-columns";
import type { TrailShortInfoResponse } from "@/types/types";
import { useEffect, useState } from "react";

export default function TrailsPage() {
  const [trails, setTrails] = useState<TrailShortInfoResponse[]>([]);

  useEffect(() => {
    async function fetchTrails() {
      const data = await getAllTrails();
      setTrails(data);
    }

    fetchTrails();
  }, []);

  return (
    <main>
      <div className="container mx-auto py-10">
        <pre>{JSON.stringify(trails, null, 2)}</pre>
        <DataTable columns={columns} data={trails} />
      </div>
    </main>
  );
}
