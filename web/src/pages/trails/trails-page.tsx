import { getAllTrails } from "@/api/trail";
import { trailColumns } from "@/components/data-table/columns";
import type { TrailShortInfoResponse } from "@/types/types";
import { useEffect, useState } from "react";
import TrailsTable from "@/components/data-table/TrailsTable";

export default function TrailsPage() {
  const [trails, setTrails] = useState<TrailShortInfoResponse[]>([]);

  useEffect(() => {
    async function fetchTrails() {
      const data = await getAllTrails();
      setTrails(data);
    }

    fetchTrails();
  }, []);

  trails.sort((a, b) => a.name.localeCompare(b.name));

  return (
    <main>
      <div className="container mx-auto py-10">
        <TrailsTable columns={trailColumns} trails={trails} />
      </div>
    </main>
  );
}
