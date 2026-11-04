// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { startTransition } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { Link, useSearchParams } from "react-router";
import { Page, PageHeader } from "@/components/page";
import { QueryBoundary } from "@/components/query-boundary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { submissionsQueryOptions, type SubmissionStatus } from "@/features/hike-submissions/api/hike-submissions";
import { DEFAULT_JUMP_METRES } from "@/utils/geometry-edit";

const STATUSES: SubmissionStatus[] = ["Pending", "Approved", "Rejected"];

function isStatus(value: string | null): value is SubmissionStatus {
  return STATUSES.some((status) => status === value);
}

export default function HikeSubmissionsPage() {
  const [params, setParams] = useSearchParams();
  const requested = params.get("status");
  const status = isStatus(requested) ? requested : "Pending";

  const show = (which: SubmissionStatus) =>
    startTransition(() => setParams(which === "Pending" ? {} : { status: which }));

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

function SubmissionsTable({ status }: { status: SubmissionStatus }) {
  const { data: items } = useSuspenseQuery(submissionsQueryOptions(status));

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          No {status.toLowerCase()} submissions.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="overflow-x-auto rounded-[5px] border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Submitted by</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Length</TableHead>
            <TableHead>Photos</TableHead>
            <TableHead>To check</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.identifier}>
              <TableCell className="font-medium">{item.name}</TableCell>
              <TableCell>
                {item.submitterNickName ?? "Deleted account"}
                <span className="text-muted-foreground"> {item.showSubmitterName ? "(shown)" : "(hidden)"}</span>
              </TableCell>
              <TableCell>{new Date(item.createdAt).toLocaleDateString("sv-SE")}</TableCell>
              <TableCell>{item.trailLength} km</TableCell>
              <TableCell>{item.imageCount === 0 ? "None, example images" : item.imageCount}</TableCell>
              <TableCell>
                {item.longestGapMetres > DEFAULT_JUMP_METRES ? (
                  <Badge variant="destructive">Jump of {Math.round(item.longestGapMetres)} m</Badge>
                ) : (
                  <Badge variant="secondary">No jumps</Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                <Link
                  to={`/hike-submissions/${item.identifier}`}
                  className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                >
                  {status === "Approved" ? "Edit" : "Review"}
                  <ChevronRight className="size-4" aria-hidden="true" />
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
