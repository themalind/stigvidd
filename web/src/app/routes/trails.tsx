// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useSuspenseQuery } from "@tanstack/react-query";
import { curatedTrailsQueryOptions } from "@/features/trails/api/trail";
import { trailColumns } from "@/features/trails/components/trail-columns";
import { TrailList } from "@/features/trails/components/trail-list";
import { Page } from "@/components/page";

export default function TrailsPage() {
  const { data: trails } = useSuspenseQuery(curatedTrailsQueryOptions());

  return (
    <Page width="full">
      <TrailList trails={trails} columns={trailColumns} noun="trails" />
    </Page>
  );
}
