// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { toast } from "sonner";
import type { ReprocessJobSummary } from "@/api/media";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MediaUpload from "@/components/media/media-upload";
import MediaBrowse from "@/components/media/media-browse";
import MediaReprocessJobs from "@/components/media/media-reprocess-jobs";

export default function MediaPage() {
  const [tab, setTab] = useState("upload");
  const [refreshKey, setRefreshKey] = useState(0);
  const [jobsRefreshKey, setJobsRefreshKey] = useState(0);

  // Keep Browse in sync, but stay on Upload — that tab now shows the target's
  // images itself, so jumping away would hide the result of the change.
  function handleMediaChanged() {
    setRefreshKey((k) => k + 1);
  }

  // keep-comment: the job's own totalCount, not the dialog's - in filter mode the dialog only knows what the listing last counted, while the server expanded the filter again when the job was created
  function handleBatchStarted(job: ReprocessJobSummary) {
    toast.success(`Batch started for ${job.totalCount ?? 0} image(s).`);
    setJobsRefreshKey((k) => k + 1);
    setTab("jobs");
  }

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
            <MediaUpload onMediaChanged={handleMediaChanged} />
          </TabsContent>
          <TabsContent value="browse">
            <MediaBrowse refreshKey={refreshKey} onBatchStarted={handleBatchStarted} />
          </TabsContent>
          <TabsContent value="jobs">
            <MediaReprocessJobs refreshKey={jobsRefreshKey} />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
