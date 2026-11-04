// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useExportData } from "@/features/migration/api/migration";

export function ExportCard({ sharedServices }: { sharedServices: boolean }) {
  const [anonymize, setAnonymize] = useState(false);
  const exportData = useExportData();
  const exporting = exportData.isPending;

  function handleExport() {
    exportData.mutate(
      { anonymize },
      { onSuccess: () => toast.success(anonymize ? "Anonymized export downloaded." : "Export downloaded.") },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Export</CardTitle>
        <CardDescription>
          Download a snapshot of this host — the database, all referenced media and trail-import files
          {sharedServices ? "" : ", and the Keycloak realm (users, clients)"} — as a single archive to move to another
          host.
          {sharedServices && " This host uses another host's Keycloak, so the archive never contains Keycloak users."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-start gap-3">
          <Checkbox
            id="anonymize"
            checked={anonymize}
            onCheckedChange={(checked) => setAnonymize(checked === true)}
            disabled={exporting}
          />
          <div className="space-y-1">
            <Label htmlFor="anonymize">Anonymize personal data (for staging/test)</Label>
            <p className="text-sm text-muted-foreground">
              Replaces every user&apos;s name, email address and login identity with a placeholder, removes push tokens,
              verification and reset codes and the mail log, clears moderation notes, and leaves out Keycloak. Hikes,
              reviews and photos are kept as they are.
            </p>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleExport} disabled={exporting}>
          {exporting ? <Loader2 className="animate-spin" /> : <Download />}
          {exporting ? "Preparing archive…" : anonymize ? "Export anonymized data" : "Export all data"}
        </Button>
      </CardFooter>
    </Card>
  );
}
