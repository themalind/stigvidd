// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MediaUpload from "@/components/media/media-upload";
import MediaBrowse from "@/components/media/media-browse";

export default function MediaPage() {
  const [tab, setTab] = useState("upload");
  const [refreshKey, setRefreshKey] = useState(0);

  // Keep Browse in sync, but stay on Upload — that tab now shows the target's
  // images itself, so jumping away would hide the result of the change.
  function handleMediaChanged() {
    setRefreshKey((k) => k + 1);
  }

  return (
    <main>
      <div className="container mx-auto py-10">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="upload">Upload</TabsTrigger>
            <TabsTrigger value="browse">Browse</TabsTrigger>
          </TabsList>
          <TabsContent value="upload">
            <MediaUpload onMediaChanged={handleMediaChanged} />
          </TabsContent>
          <TabsContent value="browse">
            <MediaBrowse refreshKey={refreshKey} />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
