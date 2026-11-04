// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import type { AdminHikeSubmissionResponse } from "@/api/generated/model";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  similarRoutesQueryOptions,
  useApproveSubmission,
  useRejectSubmission,
} from "@/features/hike-submissions/api/hike-submissions";

interface Props {
  detail: AdminHikeSubmissionResponse;
  unsaved: boolean;
  onApproved: () => void;
  onRejected: () => void;
}

export function DecisionCard({ detail, unsaved, onApproved, onRejected }: Props) {
  const [reason, setReason] = useState("");
  const similar = useQuery(similarRoutesQueryOptions(detail.identifier));
  const approve = useApproveSubmission(detail.identifier);
  const reject = useRejectSubmission(detail.identifier);
  const busy = approve.isPending || reject.isPending;
  const noCity = !detail.city.trim();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Decide</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {unsaved && <p className="text-sm text-destructive">Save your changes before approving.</p>}
        {noCity && <p className="text-sm text-destructive">Add a city before approving.</p>}
        {similar.data?.some((r) => r.likelyDuplicate) && (
          <p className="text-sm text-destructive">
            This looks like a route that already exists. Check "Already on the map?" before approving.
          </p>
        )}
        <Button
          className="w-full"
          disabled={busy || unsaved || noCity}
          onClick={() => approve.mutate(undefined, { onSuccess: onApproved })}
        >
          {approve.isPending && <Loader2 className="size-4 animate-spin" />}
          Approve and publish
        </Button>
        <div className="space-y-1 border-t pt-3">
          <Label htmlFor="review-reject-reason">Reason the user will see</Label>
          <Textarea id="review-reject-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <Button
          className="w-full"
          variant="destructive"
          disabled={busy || reason.trim().length === 0}
          onClick={() => reject.mutate(reason.trim(), { onSuccess: onRejected })}
        >
          {reject.isPending && <Loader2 className="size-4 animate-spin" />}
          Reject
        </Button>
      </CardContent>
    </Card>
  );
}

export function DecidedCard({ detail }: { detail: AdminHikeSubmissionResponse }) {
  return (
    <Card>
      <CardContent className="py-4 text-sm">
        {detail.status} by {detail.decidedBy ?? "unknown"}
        {detail.decidedAt ? ` on ${new Date(detail.decidedAt).toLocaleString("sv-SE")}` : ""}.
        {detail.rejectionReason && <p className="mt-2">Reason: {detail.rejectionReason}</p>}
        {detail.publishedTrailIdentifier && (
          <p className="mt-2">Published as trail {detail.publishedTrailIdentifier}.</p>
        )}
      </CardContent>
    </Card>
  );
}
