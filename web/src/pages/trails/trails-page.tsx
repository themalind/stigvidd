import { getAllTrails } from "@/api/trail";
import DataTable from "@/components/data-table/data-table";
import { trailColumns } from "@/components/data-table/columns";
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
        <DataTable columns={trailColumns} data={trails} />
      </div>
    </main>
  );
}
