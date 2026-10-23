// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { getSubmissions, type SubmissionListItem, type SubmissionStatus } from "@/api/hike-submissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DEFAULT_JUMP_METRES } from "@/lib/geometry-edit";

const STATUSES: SubmissionStatus[] = ["Pending", "Approved", "Rejected"];

type State = { kind: "loading" } | { kind: "error" } | { kind: "loaded"; items: SubmissionListItem[] };

export default function HikeSubmissionsPage() {
  const [status, setStatus] = useState<SubmissionStatus>("Pending");
  const [state, setState] = useState<State>({ kind: "loading" });

  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;

    async function load() {
      try {
        const items = await getSubmissions(status);
        if (current) setState({ kind: "loaded", items });
      } catch {
        if (current) setState({ kind: "error" });
      }
    }

    void load();
    return () => {
      current = false;
    };
  }, [status, attempt]);

  const show = (which: SubmissionStatus) => {
    setState({ kind: "loading" });
    setStatus(which);
  };

  const retry = () => {
    setState({ kind: "loading" });
    setAttempt((n) => n + 1);
  };

  return (
    <main className="container mx-auto max-w-6xl space-y-6 py-10">
      <Card>
        <CardHeader>
          <CardTitle>Hike submissions</CardTitle>
          <CardDescription>
            Walks users have handed over to Stigvidd. Check the route on the map, fix GPS jumps and a start at
            someone&apos;s home, then approve to publish it as a user walk on the map.
          </CardDescription>
        </CardHeader>
      </Card>

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

      {state.kind === "loading" && (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      )}

      {state.kind === "error" && (
        <Card>
          <CardContent className="flex items-center justify-between py-6 text-sm">
            Could not load the submissions.
            <Button variant="outline" onClick={retry}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {state.kind === "loaded" && state.items.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No {status.toLowerCase()} submissions.
          </CardContent>
        </Card>
      )}

      {state.kind === "loaded" && state.items.length > 0 && (
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
              {state.items.map((item) => (
                <TableRow key={item.identifier}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>
                    {item.submitterNickName ?? "Deleted account"}
                    <span className="text-muted-foreground"> {item.showSubmitterName ? "(shown)" : "(hidden)"}</span>
                  </TableCell>
                  <TableCell>{new Date(item.createdAt ?? "").toLocaleDateString("sv-SE")}</TableCell>
                  <TableCell>{item.trailLength} km</TableCell>
                  <TableCell>{item.imageCount === 0 ? "None, example images" : item.imageCount}</TableCell>
                  <TableCell>
                    {(item.longestGapMetres ?? 0) > DEFAULT_JUMP_METRES ? (
                      <Badge variant="destructive">Jump of {Math.round(item.longestGapMetres ?? 0)} m</Badge>
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
      )}
    </main>
  );
}
