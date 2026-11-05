// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { ReactNode } from "react";
import { Link } from "react-router";
import type { AdminTrailContributionResponse, AdminTrailListItemResponse } from "@/api/generated/model";
import { paths } from "@/config/paths";

export type TableColumn<T> = {
  label: string;
  key: keyof T;
  type: string;
  width?: number;
  render?: (row: T) => ReactNode;
};

export const trailColumns: TableColumn<AdminTrailListItemResponse>[] = [
  { label: "Name", key: "name", type: "text" },
  { label: "City", key: "city", type: "text" },
  { label: "Length", key: "trailLength", type: "number" },
  { label: "Classification", key: "classification", type: "number" },
  { label: "Updated", key: "lastUpdatedAt", type: "text" },
  { label: "Identifier", key: "identifier", type: "text" },
];

function submitter(contribution: AdminTrailContributionResponse) {
  if (!contribution.submitterNickName) return <span className="text-muted-foreground">Deleted account</span>;
  return (
    <span>
      {contribution.submitterNickName}
      {!contribution.showSubmitterName && <span className="text-muted-foreground"> (not named in the app)</span>}
    </span>
  );
}

function withContribution(render: (contribution: AdminTrailContributionResponse) => ReactNode) {
  return (row: AdminTrailListItemResponse) => (row.contribution ? render(row.contribution) : null);
}

export const userWalkColumns: TableColumn<AdminTrailListItemResponse>[] = [
  { label: "Name", key: "name", type: "text" },
  { label: "City", key: "city", type: "text" },
  { label: "Length", key: "trailLength", type: "number" },
  { label: "Submitted by", key: "contribution", type: "text", render: withContribution(submitter) },
  {
    label: "Published",
    key: "contribution",
    type: "text",
    render: withContribution((c) => new Date(c.publishedAt).toLocaleDateString("sv-SE")),
  },
  { label: "Likes", key: "contribution", type: "number", render: withContribution((c) => c.likeCount) },
  {
    label: "Submission",
    key: "contribution",
    type: "text",
    render: withContribution((c) =>
      c.submissionIdentifier ? (
        <Link className="underline underline-offset-2" to={paths.hikeSubmission(c.submissionIdentifier)}>
          Open submission
        </Link>
      ) : (
        <span className="text-muted-foreground">Removed</span>
      ),
    ),
  },
];
