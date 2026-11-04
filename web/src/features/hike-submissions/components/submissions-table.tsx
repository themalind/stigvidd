// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useSuspenseQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router";
import { paths } from "@/config/paths";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { submissionsQueryOptions, type SubmissionStatus } from "@/features/hike-submissions/api/hike-submissions";
import { DEFAULT_JUMP_METRES } from "@/utils/geometry-edit";

export function SubmissionsTable({ status }: { status: SubmissionStatus }) {
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
    <div className="overflow-x-auto rounded-sm border">
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
                  to={paths.hikeSubmission(item.identifier)}
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
