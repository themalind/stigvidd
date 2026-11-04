// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { SessionList } from "@/features/trail-import/components/session-list";
import { UploadCard } from "@/features/trail-import/components/upload-card";
import { Page } from "@/components/page";
import { QueryBoundary } from "@/components/query-boundary";
import { Skeleton } from "@/components/ui/skeleton";

export default function TrailImportPage() {
  return (
    <Page width="wide">
      <UploadCard />
      <QueryBoundary fallback={<Skeleton className="h-32 w-full" />}>
        <SessionList />
      </QueryBoundary>
    </Page>
  );
}
