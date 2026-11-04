// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useQuery } from "@tanstack/react-query";
import { QueryBoundary } from "@/components/query-boundary";
import { useSearchState } from "@/hooks/use-search-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { facilitiesQueryOptions } from "@/features/facilities/api/facility";
import MediaBrowse from "@/features/media/components/media-browse";
import MediaReprocessJobs from "@/features/media/components/media-reprocess-jobs";
import MediaUpload from "@/features/media/components/media-upload";
import { trailsQueryOptions, useInvalidateTrailQueries } from "@/features/trails/api/trail";

function UploadTab({ onTrailImagesChanged }: { onTrailImagesChanged: () => void }) {
  const trails = useQuery(trailsQueryOptions());
  const facilities = useQuery(facilitiesQueryOptions());

  return (
    <MediaUpload
      trails={{ items: trails.data, failed: trails.isError }}
      facilities={{ items: facilities.data, failed: facilities.isError }}
      onTrailImagesChanged={onTrailImagesChanged}
    />
  );
}

const TAB = { tab: "upload" };

export default function MediaPage() {
  const { values, page, update } = useSearchState(TAB);
  const { tab } = values;
  const setTab = (next: string) => update({ tab: next, page });
  const invalidateTrails = useInvalidateTrailQueries();
  const onTrailImagesChanged = () => void invalidateTrails();

  return (
    <main>
      <div className="container mx-auto py-10">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="upload">Upload</TabsTrigger>
            <TabsTrigger value="browse">Browse</TabsTrigger>
            <TabsTrigger value="jobs">Batch jobs</TabsTrigger>
          </TabsList>
          <TabsContent value="upload">
            <UploadTab onTrailImagesChanged={onTrailImagesChanged} />
          </TabsContent>
          <TabsContent value="browse">
            <MediaBrowse onTrailImagesChanged={onTrailImagesChanged} onBatchStarted={() => setTab("jobs")} />
          </TabsContent>
          <TabsContent value="jobs">
            <QueryBoundary>
              <MediaReprocessJobs />
            </QueryBoundary>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
