import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MediaUpload from "@/components/media/media-upload";
import MediaBrowse from "@/components/media/media-browse";

export default function MediaPage() {
  const [tab, setTab] = useState("upload");
  const [refreshKey, setRefreshKey] = useState(0);

  function handleUploaded() {
    setRefreshKey((k) => k + 1);
    setTab("browse");
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
            <MediaUpload onUploaded={handleUploaded} />
          </TabsContent>
          <TabsContent value="browse">
            <MediaBrowse refreshKey={refreshKey} />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
