// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useSearchState } from "@/hooks/use-search-state";
import { Page, PageHeader } from "@/components/page";
import { QueryBoundary } from "@/components/query-boundary";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { SubmissionStatus } from "@/features/hike-submissions/api/hike-submissions";
import { SubmissionsTable } from "@/features/hike-submissions/components/submissions-table";

const STATUSES: SubmissionStatus[] = ["Pending", "Approved", "Rejected"];
const STATUS_DEFAULT = { status: "Pending" };

function isStatus(value: string | null): value is SubmissionStatus {
  return STATUSES.some((status) => status === value);
}

export default function HikeSubmissionsPage() {
  const { values, update } = useSearchState(STATUS_DEFAULT);
  const status = isStatus(values.status) ? values.status : "Pending";

  const show = (which: SubmissionStatus) => update({ status: which });

  return (
    <Page width="wide">
      <PageHeader
        title="Hike submissions"
        description={
          <>
            Walks users have handed over to Stigvidd. Check the route on the map, fix GPS jumps and a start at
            someone&apos;s home, then approve to publish it as a user walk on the map.
          </>
        }
      />

      <div className="flex flex-wrap gap-2" role="tablist">
        {STATUSES.map((s) => (
          <Button
            key={s}
            role="tab"
            aria-selected={status === s}
            variant={status === s ? "default" : "outline"}
            onClick={() => show(s)}
          >
            {s}
          </Button>
        ))}
      </div>

      <QueryBoundary
        resetKeys={[status]}
        fallback={
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        }
      >
        <SubmissionsTable status={status} />
      </QueryBoundary>
    </Page>
  );
}
