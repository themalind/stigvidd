// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useSuspenseQuery } from "@tanstack/react-query";
import { userWalksQueryOptions } from "@/features/trails/api/trail";
import { userWalkColumns } from "@/features/trails/components/trail-columns";
import { TrailList } from "@/features/trails/components/trail-list";
import { Page, PageHeader } from "@/components/page";

export default function UserWalksPage() {
  const { data: walks } = useSuspenseQuery(userWalksQueryOptions());

  return (
    <Page width="full">
      <PageHeader
        title="User walks"
        description="Walks users handed over to Stigvidd and an admin approved. They are shown on the map as user walks, apart from the curated trails."
      />
      <TrailList trails={walks} columns={userWalkColumns} noun="user walks" />
    </Page>
  );
}
