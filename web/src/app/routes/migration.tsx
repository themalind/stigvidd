// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useSuspenseQuery } from "@tanstack/react-query";
import { Page } from "@/components/page";
import { QueryBoundary } from "@/components/query-boundary";
import { transferInfoQueryOptions } from "@/features/migration/api/migration";
import { ExportCard } from "@/features/migration/components/export-card";
import { ImportCard } from "@/features/migration/components/import-card";
import UserMappingCard from "@/features/migration/components/user-mapping-card";

export default function MigrationPage() {
  const { data: info } = useSuspenseQuery(transferInfoQueryOptions());
  const { sharedServices } = info;

  return (
    <Page width="narrow">
      <ExportCard sharedServices={sharedServices} />

      {sharedServices && (
        <QueryBoundary>
          <UserMappingCard />
        </QueryBoundary>
      )}

      <ImportCard sharedServices={sharedServices} />
    </Page>
  );
}
