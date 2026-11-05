// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useImportData } from "@/features/migration/api/migration";

export function ImportCard({ sharedServices }: { sharedServices: boolean }) {
  const [file, setFile] = useState<File | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importData = useImportData();
  const importing = importData.isPending;

  // keep-comment: the operator types this host's name to arm the destructive import
  const confirmPhrase = window.location.hostname;
  const canImport = file !== null && confirmText === confirmPhrase && !importing;

  function handleImport() {
    if (!file) return;
    importData.mutate(file, {
      onSuccess: ({ message, notes }) => {
        toast.success(message, { description: notes.join(" ") || undefined, duration: 15000 });
        setFile(null);
        setConfirmText("");
        if (fileInputRef.current) fileInputRef.current.value = "";
      },
    });
  }

  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="size-5" />
          Import (replace all data)
        </CardTitle>
        <CardDescription>
          Restores an archive exported from another host.{" "}
          {sharedServices ? (
            <>
              <strong>This permanently overwrites the database and media on this host.</strong> This host uses
              production&apos;s Keycloak, mail server and observatory: Keycloak users in the archive are not restored,
              and queued mail, push tokens and verification/reset codes are cleared so nobody is contacted from here.
              Afterwards, restart the <code>api</code> service.
            </>
          ) : (
            <>
              <strong>This permanently overwrites ALL data on this host</strong> (database, media and Keycloak). Run it
              on a freshly deployed target. Afterwards, restart the <code>api</code> and <code>keycloak</code> services.
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="archive">Migration archive (.zip)</Label>
          <Input
            id="archive"
            ref={fileInputRef}
            type="file"
            accept=".zip,application/zip"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            disabled={importing}
          />
        </div>

        <Separator />

        <div className="space-y-2">
          <Label htmlFor="confirm">
            Type <code className="font-mono">{confirmPhrase}</code> to confirm you want to overwrite this host
          </Label>
          <Input
            id="confirm"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={confirmPhrase}
            disabled={importing}
            autoComplete="off"
          />
        </div>
      </CardContent>
      <CardFooter>
        <Button variant="destructive" onClick={handleImport} disabled={!canImport}>
          {importing ? <Loader2 className="animate-spin" /> : <Upload />}
          {importing ? "Importing…" : "Import and replace"}
        </Button>
      </CardFooter>
    </Card>
  );
}
